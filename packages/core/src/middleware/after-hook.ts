// @airmcp-dev/core — middleware/after-hook.ts
// 내장 after 미들웨어 — 기본 로깅

import type { AirMiddleware } from '../types/middleware.js';

/** 도구 호출 로깅 미들웨어 */
export function loggingMiddleware(logFn?: (msg: string) => void): AirMiddleware {
  const log = logFn || ((msg: string) => console.log(`[air] ${msg}`));

  return {
    name: 'air:logging',
    after: async (ctx) => {
      log(`${ctx.tool.name} (${ctx.duration}ms) [${ctx.requestId}]`);
    },
    onError: async (ctx, error) => {
      log(`${ctx.tool.name} ERROR: ${error.message} [${ctx.requestId}]`);
      return undefined; // 에러를 먹지 않고 다음 핸들러에 위임
    },
  };
}
