// @airmcp-dev/core — __tests__/stdio-transport.test.ts
//
// stdio transport 프레이밍 E2E — MCP 스펙(basic/transports, stdio)의 줄 단위 JSON.
// 픽스처 서버(fixtures/stdio-server.mjs)를 실제 프로세스로 띄워서 확인한다.
//   1. 원시 바이트: JSON 한 줄을 보내면 stdout으로 JSON 한 줄이 돌아오는지
//   2. 공식 MCP SDK StdioClientTransport: initialize → tools/list → tools/call

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'stdio-server.mjs');

// 픽스처가 불러오는 dist를 현재 소스로 빌드 (pnpm build와 같은 tsc)
beforeAll(() => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tsc, '-p', join(here, '..', 'tsconfig.json')], {
    stdio: 'pipe',
    windowsHide: true,
  });
}, 120_000);

const children: ChildProcessWithoutNullStreams[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

/** 픽스처 서버를 띄우고 stdout을 그대로 모은다 */
function startServer() {
  const child = spawn(process.execPath, [fixture], { windowsHide: true });
  children.push(child);
  const out = { raw: '' };
  child.stdout.setEncoding('utf-8');
  child.stdout.on('data', (chunk: string) => (out.raw += chunk));
  child.stderr.resume(); // 로그는 stderr로 나간다 — 읽어서 버린다

  /** 줄바꿈으로 끝난 줄이 n개 모일 때까지 기다렸다가 JSON으로 파싱한다 */
  async function waitForLines(n: number, timeoutMs = 3_000): Promise<any[]> {
    const deadline = Date.now() + timeoutMs;
    const complete = () => out.raw.split('\n').slice(0, -1);
    while (complete().length < n) {
      if (Date.now() > deadline) {
        throw new Error(
          `timeout: ${complete().length}/${n} lines, stdout=${JSON.stringify(out.raw)}`,
        );
      }
      await sleep(10);
    }
    return complete().map((line) => JSON.parse(line));
  }

  return { out, waitForLines, write: (data: string | Buffer) => child.stdin.write(data) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const initialize = (id: number) =>
  JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'raw', version: '0' },
    },
  });

describe('AirStdioTransport — newline-delimited JSON', () => {
  it('should answer one JSON line with one JSON line on stdout', async () => {
    const server = startServer();
    server.write(initialize(1) + '\n');

    const [res] = await server.waitForLines(1);
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe('2025-11-25');
    // Content-Length 같은 헤더 없이 JSON으로 시작해서 줄바꿈으로 끝난다
    expect(server.out.raw.startsWith('{')).toBe(true);
    expect(server.out.raw.endsWith('\n')).toBe(true);
  });

  it('should handle CRLF, a message split inside a multibyte character, and several messages per chunk', async () => {
    const server = startServer();
    const call = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: '한글 ✓' } },
    });
    const bytes = Buffer.from(call + '\r\n', 'utf-8');
    const cut = bytes.indexOf(Buffer.from('한', 'utf-8')) + 1; // UTF-8 3바이트 문자 중간에서 자른다
    server.write(bytes.subarray(0, cut));
    await sleep(50);
    server.write(bytes.subarray(cut));
    server.write(
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }) +
        '\n' +
        JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'ping' }) +
        '\n',
    );

    const byId = Object.fromEntries((await server.waitForLines(3)).map((r) => [r.id, r]));
    expect(byId[2].result.content).toEqual([{ type: 'text', text: '한글 ✓' }]);
    expect(byId[3].result).toBeDefined();
    expect(byId[4].result).toBeDefined();
  });

  it('should not answer notifications and should skip blank lines', async () => {
    const server = startServer();
    server.write(
      '\n' + JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n\n',
    );
    server.write(JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'ping' }) + '\n');

    const [res] = await server.waitForLines(1);
    await sleep(100);
    expect(res.id).toBe(5);
    expect(server.out.raw.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('should reply -32700 to a line that is not JSON and keep reading', async () => {
    const server = startServer();
    server.write('Content-Length: 42\n'); // 이전 LSP 스타일 헤더 같은 비 JSON 줄
    server.write(JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'ping' }) + '\n');

    const lines = await server.waitForLines(2);
    expect(lines).toContainEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
    expect(lines.find((l) => l.id === 6)?.result).toBeDefined();
  });
});

describe('AirStdioTransport — official MCP SDK client', () => {
  it('should initialize, list tools, and call a tool over StdioClientTransport', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fixture],
      stderr: 'ignore',
    });
    const client = new Client({ name: 'air-stdio-e2e', version: '1.0.0' });

    try {
      await client.connect(transport, { timeout: 10_000 });
      expect(client.getServerVersion()).toMatchObject({ name: 'stdio-test', version: '1.0.0' });

      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(['echo']);

      const result = await client.callTool({
        name: 'echo',
        arguments: { text: 'hello over stdio' },
      });
      expect(result.content).toEqual([{ type: 'text', text: 'hello over stdio' }]);
    } finally {
      await client.close();
    }
  }, 30_000);
});
