// air CLI — commands/disconnect.ts
//
// air disconnect <client> [--name <n>]
//
// MCP 클라이언트의 설정 파일에서 서버 등록을 제거한다.
//
// @example
//   air disconnect claude-desktop
//   air disconnect cursor --name my-db-tool

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { printer } from '../utils/printer.js';
import { resolveClientConfig, listClients } from '../utils/path-resolver.js';
import { JsonEditor } from '../utils/json-editor.js';

/** package.json에서 서버 이름을 읽는다 */
async function readServerName(cwd: string): Promise<string> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.name || 'air-server';
  } catch {
    return 'air-server';
  }
}

export const disconnectCommand = new Command('disconnect')
  .description('Remove this MCP server from a client')
  .argument('<client>', 'Client to disconnect: claude-desktop, cursor, vscode, ...')
  .option('-n, --name <n>', 'Server name to remove (default: from package.json)')
  .action(async (client: string, opts: { name?: string }) => {
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

    // ── 2. 서버 이름 결정 ──
    const serverName = opts.name || (await readServerName(cwd));

    // ── 3. 설정 파일 로드 ──
    printer.blank();
    printer.step(1, 2, `Loading ${clientInfo.displayName} config...`);

    const editor = await JsonEditor.load(clientInfo.configPath);
    const entryPath = `${clientInfo.mcpKey}.${serverName}`;

    // ── 4. 등록 제거 ──
    if (!editor.has(entryPath)) {
      printer.warn(`"${serverName}" is not registered in ${clientInfo.displayName}.`);
      printer.blank();
      return;
    }

    printer.step(2, 2, `Removing "${serverName}"...`);
    editor.delete(entryPath);
    await editor.save();

    printer.blank();
    printer.success(`Disconnected "${serverName}" from ${clientInfo.displayName}`);
    printer.kv('config', clientInfo.configPath);
    printer.blank();
  });
