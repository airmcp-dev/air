// @airmcp-dev/core — __tests__/http-transport.test.ts
//
// Streamable HTTP transport의 보안 요구사항 (basic/transports, Streamable HTTP, Security Warning):
//   - Origin 헤더 검증: 허용되지 않은 Origin은 403
//   - 로컬 서버는 127.0.0.1에만 바인딩 (transport.host로 변경)

import { describe, it, expect, afterEach, vi } from 'vitest';
import http, { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';
import { AirHttpTransport, type AirHttpTransportOptions } from '../src/protocol/http-transport.js';
import { defineServer } from '../src/server/define-server.js';

const servers: Server[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

/** AirHttpTransport를 127.0.0.1 임시 포트에 띄우고 도구 호출 횟수를 센다 */
async function startTransport(options?: AirHttpTransportOptions) {
  const calls: string[] = [];
  const engine = new McpProtocolEngine({
    name: 'http-test',
    version: '1.0.0',
    tools: [{ name: 'echo', params: { text: 'string' }, handler: async () => 'unused' }],
    resources: [],
    prompts: [],
    callTool: async (name, params) => {
      calls.push(name);
      return [{ type: 'text', text: params.text }];
    },
  });
  const transport = new AirHttpTransport(engine, { endpoint: '/mcp', ...options });
  const server = createServer((req, res) => transport.handleRequest(req, res));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { port: (server.address() as AddressInfo).port, calls };
}

/** Origin 같은 헤더를 그대로 보내기 위해 node:http로 요청한다 */
function request(
  port: number,
  method: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; json: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/mcp', method, headers, agent: false },
      (res) => {
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (d) => (data += d));
        res.on('end', () =>
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            json: data ? JSON.parse(data) : null,
          }),
        );
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};
const echoCall = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'echo', arguments: { text: 'hi' } },
};

describe('AirHttpTransport — Origin validation', () => {
  it('should reject a foreign Origin with 403 without running the tool', async () => {
    const { port, calls } = await startTransport();
    const res = await request(
      port,
      'POST',
      { ...jsonHeaders, Origin: 'http://evil.example' },
      echoCall,
    );
    expect(res.status).toBe(403);
    expect(res.json.error).toBeDefined();
    expect(calls).toEqual([]);
  });

  it('should reject an opaque "null" Origin', async () => {
    const { port } = await startTransport();
    const res = await request(port, 'POST', { ...jsonHeaders, Origin: 'null' }, echoCall);
    expect(res.status).toBe(403);
  });

  it('should accept requests without Origin and from loopback origins', async () => {
    const { port, calls } = await startTransport();
    expect((await request(port, 'POST', jsonHeaders, echoCall)).status).toBe(200);
    for (const origin of ['http://localhost:6274', 'http://127.0.0.1:3000', 'http://[::1]:8080']) {
      expect(
        (await request(port, 'POST', { ...jsonHeaders, Origin: origin }, echoCall)).status,
      ).toBe(200);
    }
    expect(calls).toHaveLength(4);
  });

  it('should accept origins listed in allowedOrigins', async () => {
    const { port } = await startTransport({ allowedOrigins: ['https://app.example.com'] });
    const ok = await request(
      port,
      'POST',
      { ...jsonHeaders, Origin: 'https://app.example.com' },
      echoCall,
    );
    const other = await request(
      port,
      'POST',
      { ...jsonHeaders, Origin: 'https://other.example.com' },
      echoCall,
    );
    expect(ok.status).toBe(200);
    expect(other.status).toBe(403);
  });
});

describe('ServerRunner — listen address', () => {
  /** 실제로 포트를 열지 않고 listen 인자만 기록한다 */
  async function listenArgs(transport: Record<string, any>) {
    const spy = vi.spyOn(http.Server.prototype, 'listen').mockImplementation(function (
      this: http.Server,
      ...args: any[]
    ) {
      args.find((a) => typeof a === 'function')?.();
      return this;
    });
    await defineServer({ name: 'bind-test', logging: { level: 'silent' }, transport }).start();
    return spy.mock.calls[0];
  }

  it('should listen on 127.0.0.1 by default', async () => {
    expect((await listenArgs({ type: 'http', port: 39001 })).slice(0, 2)).toEqual([
      39001,
      '127.0.0.1',
    ]);
    vi.restoreAllMocks();
    expect((await listenArgs({ type: 'sse', port: 39002 })).slice(0, 2)).toEqual([
      39002,
      '127.0.0.1',
    ]);
  });

  it('should honor transport.host', async () => {
    expect((await listenArgs({ type: 'http', port: 39003, host: '0.0.0.0' })).slice(0, 2)).toEqual([
      39003,
      '0.0.0.0',
    ]);
  });
});
