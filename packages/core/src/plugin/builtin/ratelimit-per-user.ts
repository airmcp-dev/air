// @airmcp-dev/core — plugin/builtin/ratelimit-per-user.ts
//
// 사용자별 레이트 리밋 플러그인.
// shield의 글로벌 레이트 리밋과 달리, 사용자/세션별 개별 추적.
//
// @example
//   defineServer({
//     use: [perUserRateLimitPlugin({
//       maxCalls: 10,
//       windowMs: 60_000,
//       identifyBy: '_userId',
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface PerUserRateLimitOptions {
  /** 윈도우 내 최대 호출 수 (기본: 10) */
  maxCalls?: number;
  /** 윈도우 크기 ms (기본: 60000) */
  windowMs?: number;
  /** 사용자 식별 파라미터 이름 (기본: '_userId') */
  identifyBy?: string;
}

export function perUserRateLimitPlugin(options?: PerUserRateLimitOptions): AirPlugin {
  const maxCalls = options?.maxCalls ?? 10;
  const windowMs = options?.windowMs ?? 60_000;
  const identifyBy = options?.identifyBy ?? '_userId';
  const windows = new Map<string, number[]>();

  const middleware: AirMiddleware = {
    name: 'air:per-user-ratelimit',
    before: async (ctx) => {
      const userId = (ctx.params[identifyBy] as string) || 'anonymous';
      const now = Date.now();
      const key = `${userId}:${ctx.tool.name}`;
      const timestamps = (windows.get(key) || []).filter((t) => t > now - windowMs);

      if (timestamps.length >= maxCalls) {
        return {
          abort: true,
          abortResponse: {
            content: [{ type: 'text', text: `[RateLimit] User "${userId}" exceeded ${maxCalls} calls per ${windowMs / 1000}s for "${ctx.tool.name}".` }],
            isError: true,
          },
        };
      }

      timestamps.push(now);
      windows.set(key, timestamps);
    },
  };

  return {
    meta: { name: 'air:per-user-ratelimit', version: '1.0.0' },
    middleware: [middleware],
  };
}
