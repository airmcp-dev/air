// air CLI — commands/stop.ts
//
// airmcp-dev stop [name]
//
// 실행 중인 MCP 서버를 종료한다.
// - PID 파일 기반으로 SIGTERM → SIGKILL
// - 이름 생략 시 package.json의 name 사용
//
// @example
//   air stop
//   air stop my-tool

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { printer } from '../utils/printer.js';
import { ProcessManager } from '../utils/process-manager.js';

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

export const stopCommand = new Command('stop')
  .description('Stop a running MCP server')
  .argument('[name]', 'Server name (default: from package.json)')
  .action(async (name?: string) => {
    const cwd = process.cwd();
    const serverName = name || (await readServerName(cwd));

    printer.blank();

    // 실행 중인지 확인
    const running = await ProcessManager.isRunning(serverName, cwd);
    if (!running) {
      printer.warn(`Server "${serverName}" is not running.`);
      // 죽은 PID 파일 정리
      await ProcessManager.remove(serverName, cwd);
      printer.blank();
      return;
    }

    // 종료
    printer.info(`Stopping "${serverName}"...`);
    const killed = await ProcessManager.kill(serverName, cwd);

    if (killed) {
      printer.success(`Server "${serverName}" stopped.`);
    } else {
      printer.warn(`Server "${serverName}" was not running or already exited.`);
    }
    printer.blank();
  });
