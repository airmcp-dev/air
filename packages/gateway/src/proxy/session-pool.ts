// @airmcp-dev/gateway — proxy/session-pool.ts
//
// 하위 MCP 서버와의 연결 세션을 관리한다.
// 서버 ID별로 세션을 풀링하고, 재사용 / 정리를 담당.

import type { ServerEntry } from '../types.js';

export interface Session {
  id: string;
  serverId: string;
  createdAt: Date;
  lastUsedAt: Date;
  active: boolean;
  /** 하위 서버와의 실제 연결 핸들 (transport별로 다름) */
  handle: any;
}

export class SessionPool {
  private sessions = new Map<string, Session[]>();
  private sessionCounter = 0;

  /**
   * 서버의 기존 세션을 가져오거나 없으면 새로 생성한다.
   */
  acquire(server: ServerEntry): Session {
    const pool = this.sessions.get(server.id) || [];

    // 재사용 가능한 세션 찾기
    const reusable = pool.find((s) => s.active);
    if (reusable) {
      reusable.lastUsedAt = new Date();
      return reusable;
    }

    // 새 세션 생성
    const session: Session = {
      id: `session_${++this.sessionCounter}`,
      serverId: server.id,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      active: true,
      handle: null, // 실제 연결은 proxy에서 설정
    };

    pool.push(session);
    this.sessions.set(server.id, pool);
    return session;
  }

  /**
   * 세션을 반환한다 (재사용 가능 상태로 전환).
   */
  release(sessionId: string): void {
    for (const pool of this.sessions.values()) {
      const session = pool.find((s) => s.id === sessionId);
      if (session) {
        session.lastUsedAt = new Date();
        return;
      }
    }
  }

  /**
   * 세션을 종료한다.
   */
  destroy(sessionId: string): void {
    for (const [serverId, pool] of this.sessions) {
      const idx = pool.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        pool[idx].active = false;
        pool.splice(idx, 1);
        this.sessions.set(serverId, pool);
        return;
      }
    }
  }

  /**
   * 특정 서버의 모든 세션을 종료한다.
   */
  destroyByServer(serverId: string): void {
    const pool = this.sessions.get(serverId);
    if (pool) {
      for (const session of pool) {
        session.active = false;
      }
      this.sessions.delete(serverId);
    }
  }

  /**
   * 유휴 세션 정리 (maxIdleMs 이상 사용하지 않은 세션).
   */
  cleanup(maxIdleMs: number = 300_000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [serverId, pool] of this.sessions) {
      const active = pool.filter((s) => {
        const idle = now - s.lastUsedAt.getTime();
        if (idle > maxIdleMs) {
          s.active = false;
          cleaned++;
          return false;
        }
        return true;
      });
      this.sessions.set(serverId, active);
    }

    return cleaned;
  }

  /**
   * 전체 세션 수.
   */
  get size(): number {
    let count = 0;
    for (const pool of this.sessions.values()) {
      count += pool.length;
    }
    return count;
  }
}
