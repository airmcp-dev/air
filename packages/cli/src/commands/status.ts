// air CLI — commands/status.ts
//
// airmcp-dev status
//
// 현재 프로젝트의 MCP 서버 상태를 보여준다.
// - 프로세스 실행 여부 (PID, alive)
// - 프로젝트 정보 (name, version, entry)
// - 등록된 도구 수 (air.config 기반, 향후)
//
// @example
//   air status

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { printer } from '../utils/printer.js';
import { ProcessManager } from '../utils/process-manager.js';

interface PkgInfo {
  name: string;
  version: string;
  description?: string;
}

/** package.json 읽기 */
async function readPkg(cwd: string): Promise<PkgInfo> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return {
      name: pkg.name || 'unknown',
      version: pkg.version || '0.0.0',
      description: pkg.description,
    };
  } catch {
    return { name: 'unknown', version: '0.0.0' };
  }
}

/** 엔트리 파일 존재 여부 확인 */
async function detectEntry(cwd: string): Promise<{ src: boolean; dist: boolean }> {
  const check = async (rel: string) => {
    try {
      await access(resolve(cwd, rel));
      return true;
    } catch {
      return false;
    }
  };
  return {
    src: (await check('src/index.ts')) || (await check('src/index.js')),
    dist: (await check('dist/index.js')) || (await check('build/index.js')),
  };
}

export const statusCommand = new Command('status')
  .description('Show MCP server status')
  .action(async () => {
    const cwd = process.cwd();
    const pkg = await readPkg(cwd);
    const entry = await detectEntry(cwd);
    const processes = await ProcessManager.listAll(cwd);

    printer.blank();
    printer.heading(`${pkg.name} @ ${pkg.version}`);

    if (pkg.description) {
      printer.kv('description', pkg.description);
    }

    // 소스/빌드 상태
    printer.kv('source', entry.src ? 'found' : 'not found');
    printer.kv('build', entry.dist ? 'found' : '✖ not built');

    // 프로세스 상태
    printer.blank();
    if (processes.length === 0) {
      printer.info('No server processes found.');
    } else {
      for (const proc of processes) {
        const status = proc.alive ? 'running' : 'stopped';
        printer.kv(proc.name, `${status}  (PID: ${proc.pid})`);
      }

      // 죽은 프로세스 PID 파일 정리
      for (const proc of processes) {
        if (!proc.alive) {
          await ProcessManager.remove(proc.name, cwd);
        }
      }
    }

    printer.blank();
  });
