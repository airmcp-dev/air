// air CLI — commands/connect.ts
//
// air connect <client> [--name <name>] [--transport stdio|http|sse] [--port <port>]
//
// MCP 클라이언트의 설정 파일에 현재 서버를 자동 등록한다.
// path-resolver로 OS별 경로를 해석하고, json-editor로 안전하게 수정.
//
// @example
//   air connect claude-desktop
//   air connect cursor --name my-db-tool
//   air connect vscode --transport http --port 3100

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { printer } from '../utils/printer.js';
import { resolveClientConfig, listClients } from '../utils/path-resolver.js';
import { JsonEditor } from '../utils/json-editor.js';

/** package.json에서 서버 정보를 읽는다 */
async function readPkg(cwd: string): Promise<{ name: string; version: string }> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return { name: pkg.name || 'air-server', version: pkg.version || '0.0.0' };
  } catch {
    return { name: 'air-server', version: '0.0.0' };
  }
}

/** MCP 서버 등록 엔트리 생성 */
function buildServerEntry(
  cwd: string,
  transport: string,
  port: string,
  opts: { host?: string; proxyPath?: string },
): Record<string, any> {
  const host = opts.host || 'localhost';

  if (transport === 'stdio') {
    return {
      command: 'npx',
      args: ['tsx', `${cwd}/src/index.ts`],
    };
  }

  if (transport === 'sse') {
    // mcp-proxy가 있으면 프록시 경유, 없으면 직접 연결
    if (opts.proxyPath) {
      return {
        command: 'node',
        args: [opts.proxyPath, `http://${host}:${port}`],
      };
    }
    // 직접 SSE 연결 (클라이언트가 SSE를 지원하는 경우)
    return {
      url: `http://${host}:${port}/sse`,
      transport: 'sse',
    };
  }

  // http (Streamable HTTP)
  return {
    url: `http://${host}:${port}`,
    transport: 'http',
  };
}

export const connectCommand = new Command('connect')
  .description('Register this MCP server with a client')
  .argument('<client>', 'Client to connect: claude-desktop, cursor, vscode, ...')
  .option('-n, --name <n>', 'Server name in client config (default: from package.json)')
  .option('-t, --transport <type>', 'Transport: stdio | http | sse', 'stdio')
  .option('-p, --port <port>', 'Port for http/sse transport', '3000')
  .option('-H, --host <host>', 'Host for remote server (default: localhost)')
  .option('--proxy <path>', 'Path to mcp-proxy.js for SSE via stdio-to-SSE proxy')
  .action(async (client: string, opts: { name?: string; transport: string; port: string; host?: string; proxy?: string }) => {
    const cwd = process.cwd();

    // ── 1. 클라이언트 경로 해석 ──
    let clientInfo;
    try {
      clientInfo = resolveClientConfig(client);
    } catch (err: any) {
      printer.error(err.message);
      printer.blank();
      printer.info('Available clients:');
      printer.blank();
      printer.list(listClients().map((c) => ({ name: c.id, description: c.name })));
      printer.blank();
      process.exit(1);
    }

    // custom 클라이언트는 경로 직접 지정 필요
    if (client === 'custom') {
      printer.error('Custom client requires manual config. See docs for details.');
      process.exit(1);
    }

    // ── 2. 서버 이름 결정 ──
    const pkg = await readPkg(cwd);
    const serverName = opts.name || pkg.name;

    // ── 3. 설정 파일 로드 ──
    printer.blank();
    printer.step(1, 3, `Loading ${clientInfo.displayName} config...`);

    const editor = await JsonEditor.load(clientInfo.configPath);

    // ── 4. 서버 엔트리 등록 ──
    printer.step(2, 3, `Registering "${serverName}"...`);

    const entryPath = `${clientInfo.mcpKey}.${serverName}`;
    const entry = buildServerEntry(cwd, opts.transport, opts.port, {
      host: opts.host,
      proxyPath: opts.proxy,
    });

    // 이미 등록되어 있으면 덮어쓰기 경고
    if (editor.has(entryPath)) {
      printer.warn(`"${serverName}" already registered — overwriting.`);
    }

    editor.set(entryPath, entry);

    // ── 5. 저장 ──
    printer.step(3, 3, 'Saving config...');
    await editor.save();

    printer.blank();
    printer.success(`Connected "${serverName}" to ${clientInfo.displayName}`);
    printer.kv('config', clientInfo.configPath);
    printer.kv('transport', opts.transport);
    if (opts.transport !== 'stdio') {
      printer.kv('host', opts.host || 'localhost');
      printer.kv('port', opts.port);
    }
    if (opts.proxy) {
      printer.kv('proxy', opts.proxy);
    }
    printer.blank();

    if (opts.transport === 'stdio') {
      printer.info('The client will start the server automatically via stdio.');
    } else if (opts.proxy) {
      printer.info('The proxy will bridge stdio (client) ↔ SSE (server).');
      printer.info(`Make sure the server is running: air start --transport sse --port ${opts.port}`);
    } else {
      printer.info(
        `Make sure the server is running: air start --transport ${opts.transport} --port ${opts.port}`,
      );
    }
    printer.blank();
  });;