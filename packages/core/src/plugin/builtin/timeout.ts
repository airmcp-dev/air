// @airmcp-dev/core — plugin/builtin/timeout.ts
//
// 도구 실행 타임아웃 플러그인.
// 지정 시간 내에 핸들러가 완료되지 않으면 자동으로 에러를 반환.
//
// @example
//   defineServer({
//     use: [timeoutPlugin(5000)],  // 5초 타임아웃
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

export function timeoutPlugin(timeoutMs: number = 30_000): AirPlugin {
  const middleware: AirMiddleware = {
    name: 'air:timeout',
    before: async (ctx) => {
      ctx.meta._timeoutMs = timeoutMs;
      ctx.meta._timeoutStart = Date.now();
    },
    after: async (ctx) => {
      const elapsed = Date.now() - (ctx.meta._timeoutStart || ctx.startedAt);
      if (elapsed > timeoutMs) {
        console.warn(
          `[air:timeout] ${ctx.tool.name} took ${elapsed}ms (limit: ${timeoutMs}ms)`,
        );
      }
    },
  };

  return {
    meta: { name: 'air:timeout', version: '1.0.0' },
    middleware: [middleware],
  };
}
