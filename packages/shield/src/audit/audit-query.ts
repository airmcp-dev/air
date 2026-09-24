// @airmcp-dev/shield — audit/audit-query.ts
//
// 감사 로그를 필터링하여 조회한다.

import type { AuditEntry, AuditQuery } from '../types.js';
import { AuditLogger } from './audit-logger.js';

export class AuditQueryEngine {
  constructor(private logger: AuditLogger) {}

  /**
   * 필터 조건에 맞는 로그를 조회한다.
   */
  query(filter: AuditQuery): AuditEntry[] {
    let results = [...this.logger.getEntries()];

    if (filter.from) {
      results = results.filter((e) => e.timestamp >= filter.from!);
    }
    if (filter.to) {
      results = results.filter((e) => e.timestamp <= filter.to!);
    }
    if (filter.action) {
      results = results.filter((e) => e.action === filter.action);
    }
    if (filter.toolName) {
      results = results.filter((e) => e.toolName === filter.toolName);
    }
    if (filter.decision) {
      results = results.filter((e) => e.decision === filter.decision);
    }

    // 최신순 정렬
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /** 요약 통계 */
  summary(): {
    total: number;
    allowed: number;
    denied: number;
    rateLimited: number;
  } {
    const entries = this.logger.getEntries();
    return {
      total: entries.length,
      allowed: entries.filter((e) => e.decision === 'allowed').length,
      denied: entries.filter((e) => e.decision === 'denied').length,
      rateLimited: entries.filter((e) => e.decision === 'rate-limited').length,
    };
  }
}
