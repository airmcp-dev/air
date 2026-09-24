// @airmcp-dev/shield — audit/audit-logger.ts
//
// 감사 로그를 기록한다. 모든 도구 호출, 정책 결정, 위협 탐지를 추적.

import type { AuditEntry } from '../types.js';

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 10_000) {
    this.maxEntries = maxEntries;
  }

  /**
   * 감사 로그를 기록한다.
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    };

    this.entries.push(full);

    // 최대 크기 초과 시 오래된 것부터 제거
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return full;
  }

  /** 도구 호출 로그 간편 기록 */
  logToolCall(
    toolName: string,
    decision: 'allowed' | 'denied' | 'rate-limited',
    details?: Record<string, any>,
  ): AuditEntry {
    return this.log({
      action: 'tool-call',
      toolName,
      decision,
      details,
    });
  }

  /** 전체 로그 수 */
  get size(): number {
    return this.entries.length;
  }

  /** 내부 배열 접근 (AuditQuery에서 사용) */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }
}
