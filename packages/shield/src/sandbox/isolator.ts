// @airmcp-dev/shield — sandbox/isolator.ts
//
// MCP 서버를 격리된 환경에서 실행한다.
// child_process.fork + 타임아웃 + 리소스 제한.

import { fork, type ChildProcess } from 'node:child_process';
import type { SandboxConfig } from '../types.js';
import { mergeConfig } from './resource-limit.js';

export interface IsolatedProcess {
  pid: number;
  kill: () => void;
}

export class Isolator {
  private processes = new Map<string, ChildProcess>();

  /**
   * MCP 서버를 격리 실행한다.
   */
  spawn(id: string, entryPath: string, config?: SandboxConfig): IsolatedProcess {
    const merged = mergeConfig(config);

    // 기존 프로세스가 있으면 종료
    this.kill(id);

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      AIR_SANDBOX: '1',
      AIR_SANDBOX_TIMEOUT: String(merged.timeout),
      AIR_SANDBOX_MEMORY: String(merged.memoryLimit),
    };

    if (!merged.networkAccess) {
      // 네트워크 차단은 OS 레벨(seccomp, cgroup 등)이 필요하지만
      // 여기서는 환경변수 플래그로 표시만
      env.AIR_SANDBOX_NO_NETWORK = '1';
    }

    const child = fork(entryPath, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      execArgv: [`--max-old-space-size=${Math.floor(merged.memoryLimit / (1024 * 1024))}`],
    });

    this.processes.set(id, child);

    // 타임아웃 강제 종료
    const timer = setTimeout(() => {
      this.kill(id);
    }, merged.timeout);

    child.on('exit', () => {
      clearTimeout(timer);
      this.processes.delete(id);
    });

    return {
      pid: child.pid!,
      kill: () => this.kill(id),
    };
  }

  /** 격리 프로세스를 종료한다 */
  kill(id: string): boolean {
    const child = this.processes.get(id);
    if (!child) return false;

    try {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already dead */
        }
      }, 3000);
    } catch {
      // already dead
    }

    this.processes.delete(id);
    return true;
  }

  /** 전체 격리 프로세스를 종료한다 */
  killAll(): void {
    for (const id of this.processes.keys()) {
      this.kill(id);
    }
  }

  /** 실행 중인 격리 프로세스 수 */
  get size(): number {
    return this.processes.size;
  }
}
