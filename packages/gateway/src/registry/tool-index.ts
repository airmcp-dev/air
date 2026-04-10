// @airmcp-dev/gateway — registry/tool-index.ts
//
// 전체 하위 서버의 도구를 하나의 인덱스로 관리한다.
// 도구 이름으로 어떤 서버가 제공하는지 즉시 조회 가능.

import type { ToolEntry, ServerEntry } from '../types.js';

export class ToolIndex {
  /** toolName → ToolEntry[] (같은 이름의 도구가 여러 서버에 있을 수 있음) */
  private index = new Map<string, ToolEntry[]>();

  /**
   * 서버의 도구 목록을 인덱스에 반영한다.
   * 기존 항목은 제거 후 재등록.
   */
  reindex(server: ServerEntry): void {
    // 기존 항목 제거
    this.removeServer(server.id);

    // 새 도구 등록
    for (const tool of server.tools) {
      const existing = this.index.get(tool.name) || [];
      existing.push(tool);
      this.index.set(tool.name, existing);
    }
  }

  /**
   * 서버의 모든 도구를 인덱스에서 제거한다.
   */
  removeServer(serverId: string): void {
    for (const [name, entries] of this.index) {
      const filtered = entries.filter((e) => e.serverId !== serverId);
      if (filtered.length === 0) {
        this.index.delete(name);
      } else {
        this.index.set(name, filtered);
      }
    }
  }

  /**
   * 도구 이름으로 제공 서버를 조회한다.
   */
  find(toolName: string): ToolEntry[] {
    return this.index.get(toolName) || [];
  }

  /**
   * 도구가 존재하는지 확인.
   */
  has(toolName: string): boolean {
    return this.index.has(toolName);
  }

  /**
   * 전체 도구 목록 (중복 제거 없이).
   */
  listAll(): ToolEntry[] {
    const all: ToolEntry[] = [];
    for (const entries of this.index.values()) {
      all.push(...entries);
    }
    return all;
  }

  /**
   * 고유 도구 이름 목록.
   */
  listNames(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * 전체 도구 수.
   */
  get size(): number {
    return this.index.size;
  }
}
