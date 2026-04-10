// air CLI — utils/process-manager.ts
//
// MCP 서버 프로세스의 PID를 추적한다.
// airmcp-dev start → PID 기록, air stop → PID로 종료, air status → 살아있는지 확인.
//
// PID 파일 위치: <project>/.air/pids/<server-name>.pid
// .air/ 디렉토리는 .gitignore 대상.
//
// @example
//   await ProcessManager.save('my-tool', 12345);
//   await ProcessManager.isRunning('my-tool');  // true
//   await ProcessManager.kill('my-tool');        // SIGTERM → PID 파일 삭제

import { readFile, writeFile, unlink, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** PID 디렉토리 경로 (.air/pids/) */
function pidDir(cwd: string): string {
  return join(cwd, '.air', 'pids');
}

/** PID 파일 경로 */
function pidFile(cwd: string, name: string): string {
  return join(pidDir(cwd), `${name}.pid`);
}

/** 프로세스가 살아있는지 확인 (signal 0) */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface ServerProcess {
  name: string;
  pid: number;
  alive: boolean;
}

export const ProcessManager = {
  /**
   * 서버 PID를 기록한다.
   */
  async save(name: string, pid: number, cwd: string = process.cwd()): Promise<void> {
    const dir = pidDir(cwd);
    await mkdir(dir, { recursive: true });
    await writeFile(pidFile(cwd, name), String(pid), 'utf-8');
  },

  /**
   * 서버 PID를 읽는다.
   * 파일이 없거나 프로세스가 죽었으면 null.
   */
  async read(name: string, cwd: string = process.cwd()): Promise<number | null> {
    try {
      const raw = await readFile(pidFile(cwd, name), 'utf-8');
      const pid = parseInt(raw.trim(), 10);
      if (isNaN(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  },

  /**
   * 서버가 실행 중인지 확인한다.
   */
  async isRunning(name: string, cwd: string = process.cwd()): Promise<boolean> {
    const pid = await this.read(name, cwd);
    if (pid === null) return false;
    return processAlive(pid);
  },

  /**
   * 서버 프로세스를 종료한다.
   * SIGTERM → 2초 대기 → 여전히 살아있으면 SIGKILL.
   *
   * @returns 종료 성공 여부
   */
  async kill(name: string, cwd: string = process.cwd()): Promise<boolean> {
    const pid = await this.read(name, cwd);
    if (pid === null) return false;

    if (!processAlive(pid)) {
      await this.remove(name, cwd);
      return false;
    }

    // graceful 종료 시도
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      await this.remove(name, cwd);
      return false;
    }

    // 2초 대기 후 강제 종료
    await sleep(2000);
    if (processAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // 이미 죽었을 수 있음
      }
    }

    await this.remove(name, cwd);
    return true;
  },

  /**
   * PID 파일을 삭제한다.
   */
  async remove(name: string, cwd: string = process.cwd()): Promise<void> {
    try {
      await unlink(pidFile(cwd, name));
    } catch {
      // 이미 없으면 무시
    }
  },

  /**
   * 현재 프로젝트에 등록된 모든 서버 프로세스 목록.
   */
  async listAll(cwd: string = process.cwd()): Promise<ServerProcess[]> {
    const dir = pidDir(cwd);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    const results: ServerProcess[] = [];
    for (const file of files) {
      if (!file.endsWith('.pid')) continue;
      const name = file.replace(/\.pid$/, '');
      const pid = await this.read(name, cwd);
      if (pid !== null) {
        results.push({ name, pid, alive: processAlive(pid) });
      }
    }
    return results;
  },
};

/** 간단한 sleep 헬퍼 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
