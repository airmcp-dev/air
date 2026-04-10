// air CLI — commands/dev.ts
//
// airmcp-dev dev [--port <port>] [--transport stdio|http|sse]
//
// 개발 모드로 MCP 서버를 실행한다.
// - 소스 변경 감지 → 자동 재시작 (fs.watch)
// - 빌드 없이 tsx/ts-node로 직접 실행
// - 종료 시 graceful shutdown
//
// @example
//   airmcp-dev dev
//   airmcp-dev dev --port 3100
//   airmcp-dev dev --transport http

import { Command } from 'commander';
import { spawn, type ChildProcess } from 'node:child_process';
import { watch, type FSWatcher } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { access } from 'node:fs/promises';
import { printer } from '../utils/printer.js';

/** 감시 대상 확장자 */
const WATCH_EXTENSIONS = new Set(['.ts', '.js', '.json']);

/** 재시작 디바운스 (ms) */
const DEBOUNCE_MS = 300;

/**
 * 엔트리 파일을 찾는다.
 * air.config.ts → src/index.ts → index.ts 순서.
 */
async function findEntry(cwd: string): Promise<string> {
  const candidates = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];

  for (const candidate of candidates) {
    const full = resolve(cwd, candidate);
    try {
      await access(full);
      return full;
    } catch {
      continue;
    }
  }

  throw new Error('No entry file found. Expected src/index.ts or index.ts');
}

/**
 * tsx로 서버 프로세스를 실행한다.
 * tsx가 없으면 ts-node/esm, 그것도 없으면 node 사용.
 */
function spawnServer(entry: string, env: Record<string, string>, cwd: string): ChildProcess {
  const child = spawn('npx', ['tsx', entry], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
  return child;
}

export const devCommand = new Command('dev')
  .description('Start MCP server in development mode (hot reload)')
  .option('-p, --port <port>', 'HTTP/SSE port', '3000')
  .option('-t, --transport <type>', 'Transport: stdio | http | sse', 'stdio')
  .option('-c, --console', 'Open interactive test console (requires SSE transport)')
  .action(async (opts: { port: string; transport: string; console?: boolean }) => {
    const cwd = process.cwd();

    // 콘솔 모드는 SSE transport가 필요
    if (opts.console && opts.transport === 'stdio') {
      opts.transport = 'sse';
      printer.info('Console mode requires SSE transport — switching to SSE.');
    }

    // ── 1. 엔트리 파일 찾기 ──
    let entry: string;
    try {
      entry = await findEntry(cwd);
    } catch (err: any) {
      printer.error(err.message);
      process.exit(1);
    }

    const env: Record<string, string> = {
      NODE_ENV: 'development',
      AIR_TRANSPORT: opts.transport,
      AIR_PORT: opts.port,
    };

    printer.blank();
    printer.banner('dev');
    printer.kv('entry', entry);
    printer.kv('transport', opts.transport);
    if (opts.transport !== 'stdio') {
      printer.kv('port', opts.port);
    }
    if (opts.console) {
      printer.kv('console', 'enabled');
    }
    printer.blank();

    // ── 2. 서버 시작 ──
    let child: ChildProcess | null = null;
    let restarting = false;

    function startServer(): void {
      printer.info('Starting server...');
      child = spawnServer(entry, env, cwd);

      child.on('exit', (code, signal) => {
        if (!restarting) {
          if (signal === 'SIGTERM' || signal === 'SIGINT') {
            printer.info('Server stopped.');
          } else if (code !== 0) {
            printer.error(`Server exited with code ${code}`);
          }
        }
        child = null;
      });
    }

    function stopServer(): Promise<void> {
      return new Promise((resolve) => {
        if (!child) {
          resolve();
          return;
        }
        restarting = true;
        child.once('exit', () => {
          restarting = false;
          resolve();
        });
        child.kill('SIGTERM');

        // 강제 종료 타이머
        setTimeout(() => {
          if (child) {
            child.kill('SIGKILL');
          }
        }, 3000);
      });
    }

    async function restart(): Promise<void> {
      printer.blank();
      printer.info('Change detected, restarting...');
      await stopServer();
      startServer();
    }

    startServer();

    // ── 3. 파일 감시 (디바운스) ──
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let watcher: FSWatcher | null = null;

    try {
      const srcDir = resolve(cwd, 'src');
      watcher = watch(srcDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const ext = extname(filename);
        if (!WATCH_EXTENSIONS.has(ext)) return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => restart(), DEBOUNCE_MS);
      });

      printer.success('Watching src/ for changes...');
    } catch {
      printer.warn('Could not watch src/ — hot reload disabled.');
    }

    // ── 4. 테스트 콘솔 (--console) ──
    if (opts.console) {
      // 서버가 뜰 시간 대기
      const { startTestConsole } = await import('../utils/test-console.js');
      await startTestConsole({
        serverUrl: `http://localhost:${opts.port}`,
        onQuit: async () => {
          await shutdown();
        },
      });
    }

    // ── 5. Graceful shutdown ──
    async function shutdown(): Promise<void> {
      printer.blank();
      printer.info('Shutting down...');
      if (watcher) watcher.close();
      if (debounceTimer) clearTimeout(debounceTimer);
      await stopServer();
      process.exit(0);
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });;