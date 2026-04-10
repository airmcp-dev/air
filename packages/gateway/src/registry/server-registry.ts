// @airmcp-dev/gateway — registry/server-registry.ts
//
// MCP 서버 등록/해제/조회.
// Gateway에 하위 서버를 등록하면 자동으로 도구를 발견하고 인덱싱한다.

import type { ServerEntry, ServerConnection, ServerStatus, ToolEntry } from '../types.js';

export class ServerRegistry {
  private servers = new Map<string, ServerEntry>();

  /**
   * 서버를 등록한다.
   */
  register(id: string, name: string, connection: ServerConnection): ServerEntry {
    const entry: ServerEntry = {
      id,
      name,
      transport: connection.type === 'stdio' ? 'stdio' : connection.type,
      connection,
      tools: [],
      status: 'registered',
    };
    this.servers.set(id, entry);
    return entry;
  }

  /**
   * 서버를 해제한다.
   */
  unregister(id: string): boolean {
    return this.servers.delete(id);
  }

  /**
   * 서버를 ID로 조회한다.
   */
  get(id: string): ServerEntry | undefined {
    return this.servers.get(id);
  }

  /**
   * 전체 서버 목록.
   */
  listAll(): ServerEntry[] {
    return Array.from(this.servers.values());
  }

  /**
   * 특정 상태의 서버만 조회.
   */
  listByStatus(status: ServerStatus): ServerEntry[] {
    return this.listAll().filter((s) => s.status === status);
  }

  /**
   * 서버 상태를 갱신한다.
   */
  updateStatus(id: string, status: ServerStatus): void {
    const server = this.servers.get(id);
    if (server) {
      server.status = status;
    }
  }

  /**
   * 서버의 도구 목록을 갱신한다 (발견 후 호출).
   */
  updateTools(id: string, tools: ToolEntry[]): void {
    const server = this.servers.get(id);
    if (server) {
      server.tools = tools;
    }
  }

  /**
   * 등록된 서버 수.
   */
  get size(): number {
    return this.servers.size;
  }
}
