// @airmcp-dev/core — middleware/shield-middleware.ts
//
// ShieldConfig → AirMiddleware 자동 생성.
// defineServer에서 shield 설정이 있으면 이 미들웨어가 체인에 자동 등록된다.
//
// 담당: 정책 체크, 위협 탐지, 레이트 리밋, 감사 로그

import type { AirMiddleware, MiddlewareContext, MiddlewareResult } from '../types/middleware.js';
import type { ShieldConfig } from '../types/config.js';

// ── 내장 위협 패턴 (경량 버전) ──
const THREAT_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, type: 'prompt-injection', severity: 'high', description: 'Prompt injection: ignore previous instructions' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, type: 'prompt-injection', severity: 'high', description: 'Prompt injection: role reassignment' },
  { pattern: /\bsystem\s*:\s*/i, type: 'prompt-injection', severity: 'medium', description: 'Prompt injection: system prompt attempt' },
  { pattern: /\.\.\//g, type: 'path-traversal', severity: 'high', description: 'Path traversal: directory escape' },
  { pattern: /\/etc\/(passwd|shadow|hosts)/i, type: 'path-traversal', severity: 'critical', description: 'Path traversal: sensitive system file' },
  { pattern: /[;&|`$]\s*(rm|chmod|chown|curl|wget|nc|bash|sh|python|node)\b/i, type: 'command-injection', severity: 'critical', description: 'Command injection: shell command' },
  { pattern: /\$\(.*\)/, type: 'command-injection', severity: 'high', description: 'Command injection: command substitution' },
  { pattern: /<tool_description>|<function_call>/i, type: 'tool-poisoning', severity: 'high', description: 'Tool poisoning: embedded tool definition' },
];

/** 정책 매칭 */
function matchesTarget(ruleTarget: string, toolName: string): boolean {
  if (ruleTarget === '*') return true;
  if (ruleTarget === toolName) return true;
  if (ruleTarget.endsWith('*') && toolName.startsWith(ruleTarget.slice(0, -1))) return true;
  return false;
}

/** 파라미터 값들을 재귀적으로 문자열 추출 */
function flattenValues(obj: any): string[] {
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(flattenValues);
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(flattenValues);
  return [];
}

/** 레이트 리밋 윈도우 추적 */
const rateLimitWindows = new Map<string, number[]>();

/** 감사 로그 저장소 */
const auditLog: Array<{
  timestamp: string;
  tool: string;
  decision: 'allowed' | 'denied' | 'threat' | 'rate-limited';
  reason?: string;
}> = [];

/**
 * ShieldConfig로부터 보안 미들웨어를 생성한다.
 */
export function createShieldMiddleware(config: ShieldConfig): AirMiddleware {
  // 정책 규칙을 우선순위 내림차순 정렬
  const policies = (config.policies || [])
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const threatEnabled = config.threatDetection !== false;
  const auditEnabled = config.audit !== false;

  const defaultRateWindow = config.rateLimit?.windowMs || 60_000;
  const defaultRateMax = config.rateLimit?.maxCalls || 100;
  const perToolRate = config.rateLimit?.perTool || {};

  return {
    name: 'air:shield',

    before: async (ctx: MiddlewareContext): Promise<MiddlewareResult | void> => {
      const toolName = ctx.tool.name;

      // ── 1. 정책 체크 ──
      for (const rule of policies) {
        if (!matchesTarget(rule.target, toolName)) continue;

        if (rule.action === 'deny') {
          if (auditEnabled) {
            auditLog.push({
              timestamp: new Date().toISOString(),
              tool: toolName,
              decision: 'denied',
              reason: `Policy: ${rule.name}`,
            });
          }
          return {
            abort: true,
            abortResponse: {
              content: [{ type: 'text', text: `[Shield] Access denied: tool "${toolName}" is blocked by policy "${rule.name}". Contact the server administrator if you believe this is an error.` }],
              isError: true,
            },
            meta: { shield: { decision: 'denied', rule: rule.name, code: -32000 } },
          };
        }

        if (rule.action === 'allow') break; // 허용이면 이후 규칙 스킵
      }

      // ── 2. 위협 탐지 ──
      if (threatEnabled) {
        const values = flattenValues(ctx.params);
        for (const value of values) {
          for (const tp of THREAT_PATTERNS) {
            if (tp.pattern.test(value)) {
              tp.pattern.lastIndex = 0; // global flag reset

              if (auditEnabled) {
                auditLog.push({
                  timestamp: new Date().toISOString(),
                  tool: toolName,
                  decision: 'threat',
                  reason: `${tp.type} (${tp.severity})`,
                });
              }
              return {
                abort: true,
                abortResponse: {
                  content: [{ type: 'text', text: `[Shield] Threat detected in "${toolName}": ${tp.description} (severity: ${tp.severity}). The request has been blocked for security.` }],
                  isError: true,
                },
                meta: { shield: { decision: 'threat', type: tp.type, severity: tp.severity, code: -32002 } },
              };
            }
            tp.pattern.lastIndex = 0;
          }
        }
      }

      // ── 3. 레이트 리밋 ──
      if (config.rateLimit) {
        const toolConfig = perToolRate[toolName];
        const windowMs = toolConfig?.windowMs || defaultRateWindow;
        const maxCalls = toolConfig?.maxCalls || defaultRateMax;

        const now = Date.now();
        const key = toolName;
        const timestamps = rateLimitWindows.get(key) || [];

        // 윈도우 밖의 오래된 타임스탬프 제거
        const valid = timestamps.filter((t) => t > now - windowMs);

        if (valid.length >= maxCalls) {
          if (auditEnabled) {
            auditLog.push({
              timestamp: new Date().toISOString(),
              tool: toolName,
              decision: 'rate-limited',
              reason: `${valid.length}/${maxCalls} in ${windowMs}ms`,
            });
          }
          return {
            abort: true,
            abortResponse: {
              content: [{ type: 'text', text: `[Shield] Rate limit exceeded for "${toolName}": ${maxCalls} calls per ${windowMs / 1000}s. Please wait and try again.` }],
              isError: true,
            },
            meta: { shield: { decision: 'rate-limited', code: -32001 } },
          };
        }

        valid.push(now);
        rateLimitWindows.set(key, valid);
      }

      // ── 감사 로그: 허용 ──
      if (auditEnabled) {
        auditLog.push({
          timestamp: new Date().toISOString(),
          tool: toolName,
          decision: 'allowed',
        });
      }

      ctx.meta.shield = { decision: 'allowed' };
    },
  };
}

/** 감사 로그 조회 (외부에서 접근용) */
export function getAuditLog() {
  return [...auditLog];
}

/** 감사 로그 초기화 */
export function clearAuditLog() {
  auditLog.length = 0;
}
