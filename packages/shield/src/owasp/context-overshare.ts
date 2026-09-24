// @airmcp-dev/shield — owasp/context-overshare.ts
//
// OWASP MCP-05: Context Over-sharing 방지.
// 도구 응답에 포함된 민감 데이터를 감지하고 마스킹한다.
// 과도한 응답 크기를 차단하여 컨텍스트 윈도우 오염 방지.

import type { OvershareConfig } from '../types.js';

/** 내장 PII 패턴 */
const PII_PATTERNS = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, mask: '***@***.***' },
  { name: 'phone-kr', pattern: /01[0-9]-?\d{3,4}-?\d{4}/g, mask: '***-****-****' },
  { name: 'phone-intl', pattern: /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g, mask: '+**-****-****' },
  { name: 'ssn-kr', pattern: /\d{6}-?[1-4]\d{6}/g, mask: '******-*******' },
  { name: 'credit-card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, mask: '****-****-****-****' },
  { name: 'ip-address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, mask: '***.***.***.***' },
  { name: 'api-key', pattern: /(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[\w\-./+=]{16,}['"]?/gi, mask: '***REDACTED***' },
];

export class ContextOvershareGuard {
  private maxResponseSize: number;
  private sensitivePatterns: RegExp[];
  private maskPII: boolean;

  constructor(config?: OvershareConfig) {
    this.maxResponseSize = config?.maxResponseSize || 100 * 1024; // 100KB
    this.maskPII = config?.maskPII !== false;

    // 사용자 정의 패턴 추가
    this.sensitivePatterns = (config?.sensitivePatterns || []).map((p) => new RegExp(p, 'gi'));
  }

  /**
   * 응답을 검사하고 필요 시 필터링한다.
   *
   * @returns 필터링된 응답 + 감지 내역
   */
  filter(response: string): {
    filtered: string;
    issues: Array<{ type: string; count: number }>;
    truncated: boolean;
  } {
    const issues: Array<{ type: string; count: number }> = [];
    let filtered = response;
    let truncated = false;

    // ── 1. 응답 크기 체크 ──
    const byteLength = Buffer.byteLength(filtered, 'utf-8');
    if (byteLength > this.maxResponseSize) {
      filtered = filtered.slice(0, this.maxResponseSize);
      filtered += '\n\n[air:shield] Response truncated (exceeded size limit)';
      truncated = true;
      issues.push({ type: 'size-exceeded', count: 1 });
    }

    // ── 2. PII 마스킹 ──
    if (this.maskPII) {
      for (const pii of PII_PATTERNS) {
        const matches = filtered.match(pii.pattern);
        if (matches && matches.length > 0) {
          filtered = filtered.replace(pii.pattern, pii.mask);
          issues.push({ type: `pii:${pii.name}`, count: matches.length });
        }
      }
    }

    // ── 3. 사용자 정의 민감 패턴 ──
    for (const pattern of this.sensitivePatterns) {
      const matches = filtered.match(pattern);
      if (matches && matches.length > 0) {
        filtered = filtered.replace(pattern, '***REDACTED***');
        issues.push({ type: 'sensitive-pattern', count: matches.length });
      }
      pattern.lastIndex = 0;
    }

    return { filtered, issues, truncated };
  }

  /**
   * 응답에 민감 데이터가 포함되어 있는지만 검사한다 (마스킹 없이).
   */
  scan(response: string): {
    hasSensitiveData: boolean;
    findings: Array<{ type: string; count: number }>;
  } {
    const findings: Array<{ type: string; count: number }> = [];

    if (this.maskPII) {
      for (const pii of PII_PATTERNS) {
        const matches = response.match(pii.pattern);
        if (matches) findings.push({ type: `pii:${pii.name}`, count: matches.length });
        pii.pattern.lastIndex = 0;
      }
    }

    for (const pattern of this.sensitivePatterns) {
      const matches = response.match(pattern);
      if (matches) findings.push({ type: 'sensitive-pattern', count: matches.length });
      pattern.lastIndex = 0;
    }

    return { hasSensitiveData: findings.length > 0, findings };
  }
}
