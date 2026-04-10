// @airmcp-dev/core — plugin/builtin/logger-json.ts
//
// JSON 구조화 로깅 플러그인.
// 프로덕션 환경에서 JSON 형태로 도구 호출 로그를 출력.
// ELK, Datadog, CloudWatch 등 로그 수집기와 호환.
//
// @example
//   defineServer({
//     use: [jsonLoggerPlugin({ output: 'stderr' })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface JsonLoggerOptions {
  /** 출력 대상 (기본: 'stderr') */
  output?: 'stderr' | 'stdout';
  /** 추가 필드 */
  extraFields?: Record<string, any>;
  /** 파라미터를 로그에 포함할지 (기본: false) */
  logParams?: boolean;
}

export function jsonLoggerPlugin(options?: JsonLoggerOptions): AirPlugin {
  const logFn = options?.output === 'stdout' ? console.log : console.error;
  const extra = options?.extraFields || {};
  const logParams = options?.logParams ?? false;

  const middleware: AirMiddleware = {
    name: 'air:json-logger',
    after: async (ctx) => {
      const entry = {
        level: 'info',
        event: 'tool.call',
        tool: ctx.tool.name,
        duration_ms: ctx.duration,
        request_id: ctx.requestId,
        server: ctx.serverName,
        timestamp: new Date().toISOString(),
        ...(logParams ? { params: ctx.params } : {}),
        ...extra,
      };
      logFn(JSON.stringify(entry));
    },
    onError: async (ctx, error) => {
      const entry = {
        level: 'error',
        event: 'tool.error',
        tool: ctx.tool.name,
        error: error.message,
        request_id: ctx.requestId,
        server: ctx.serverName,
        timestamp: new Date().toISOString(),
        ...extra,
      };
      logFn(JSON.stringify(entry));
      return undefined;
    },
  };

  return {
    meta: { name: 'air:json-logger', version: '1.0.0' },
    middleware: [middleware],
  };
}
