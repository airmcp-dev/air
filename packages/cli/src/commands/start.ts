// air CLI — commands/start.ts
//
// airmcp-dev start [--port <port>] [--transport stdio|http|sse]
//
// MCP 서버를 프로덕션 모드로 백그라운드 실행한다.
// - 빌드된 JS(dist/)를 node로 실행
// - detached 프로세스로 띄우고 PID 기록
// - 이미 실행 중이면 중복 방지
//
// @example
//   airmcp-dev start
//   airmcp-dev start --port 3100 --transport http

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { printer } from '../utils/printer.js';
import { ProcessManager } from '../utils/process-manager.js';

/** 실행할 엔트리 파일을 찾는다 (빌드 결과물 우선) */
async function findProductionEntry(cwd: string): Promise<string> {
  const candidates = ['dist/index.js', 'build/index.js', 'src/index.js'];

  for (const candidate of candidates) {
    const full = resolve(cwd, candidate);
    try {
      await access(full);
      return full;
    } catch {
      continue;
    }
  }

  throw new Error(
    'No built entry found. Run "npm run build" first, or use "airmcp-dev dev" for development.',
  );
}

/** package.json에서 서버 이름을 읽는다 */
async function readServerName(cwd: string): Promise<string> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.name || 'air-server';
  } catch {
    return 'air-server';
  }
}

export const startCommand = new Command('start')
  .description('Start MCP server in production mode (background)')
  .option('-p, --port <port>', 'HTTP/SSE port', '3000')
  .option('-t, --transport <type>', 'Transport: stdio | http | sse', 'stdio')
  .option('-f, --foreground', 'Run in foreground (no detach)', false)
  .action(async (opts: { port: string; transport: string; foreground: boolean }) => {
    const cwd = process.cwd();
    const name = await readServerName(cwd);

    // ── 1. 중복 실행 확인 ──
    if (await ProcessManager.isRunning(name, cwd)) {
      printer.warn(`Server "${name}" is already running.`);
      printer.info('Use "airmcp-dev stop" to stop it first, or "airmcp-dev status" to check.');
      process.exit(1);
    }

    // ── 2. 엔트리 파일 찾기 ──
    let entry: string;
    try {
      entry = await findProductionEntry(cwd);
    } catch (err: any) {
      printer.error(err.message);
      process.exit(1);
    }

    const env: Record<string, string> = {
      NODE_ENV: 'production',
      AIR_TRANSPORT: opts.transport,
      AIR_PORT: opts.port,
    };

    // ── 3-A. 포그라운드 모드 ──
    if (opts.foreground) {
      printer.blank();
      printer.kv('server', name);
      printer.kv('entry', entry);
      printer.kv('transport', opts.transport);
      if (opts.transport !== 'stdio') printer.kv('port', opts.port);
      printer.kv('mode', 'foreground');
      printer.blank();
      printer.info('Starting server (foreground)...');

      const child = spawn('node', [entry], {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, ...env },
      });

      // PID 기록 (포그라운드에서도 status 확인용)
      await ProcessManager.save(name, child.pid!, cwd);

      child.on('exit', async (code) => {
        await ProcessManager.remove(name, cwd);
        process.exit(code ?? 0);
      });

      // 부모 시그널 전파
      const forward = () => {
        child.kill('SIGTERM');
      };
      process.on('SIGTERM', forward);
      process.on('SIGINT', forward);
      return;
    }

    // ── 3-B. 백그라운드 모드 (detached) ──
    printer.blank();
    printer.kv('server', name);
    printer.kv('entry', entry);
    printer.kv('transport', opts.transport);
    if (opts.transport !== 'stdio') printer.kv('port', opts.port);
    printer.blank();

    const child = spawn('node', [entry], {
      cwd,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...env },
    });

    child.unref();

    if (!child.pid) {
      printer.error('Failed to start server process.');
      process.exit(1);
    }

    // PID 기록
    await ProcessManager.save(name, child.pid, cwd);

    printer.success(`Server "${name}" started (PID: ${child.pid})`);
    printer.info('Use "airmcp-dev status" to check, "airmcp-dev stop" to stop.');
    printer.blank();
  });
