// @airmcp-dev/core — plugin/builtin/retry.ts
//
// 도구 실행 재시도 플러그인.
// 핸들러에서 에러가 발생하면 지정 횟수만큼 재시도.
// 지수 백오프(exponential backoff) 적용.
//
// @example
//   defineServer({
//     use: [retryPlugin({ maxRetries: 3, delayMs: 200 })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 초기 대기 시간 ms (기본: 200) */
  delayMs?: number;
  /** 재시도할 에러 패턴 (기본: 전부) */
  retryOn?: (error: Error) => boolean;
}

export function retryPlugin(options?: RetryOptions): AirPlugin {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.delayMs ?? 200;
  const retryOn = options?.retryOn ?? (() => true);

  const middleware: AirMiddleware = {
    name: 'air:retry',
    onError: async (ctx, error) => {
      if (!retryOn(error)) return undefined;

      const startCount = (ctx.meta._retryCount || 0) as number;
      if (startCount >= maxRetries) return undefined; // 이미 재시도 초과

      // 내부 루프로 재시도를 완결 — 체인 재순회에 의존하지 않음
      let lastError: Error = error;
      for (let attempt = startCount; attempt < maxRetries; attempt++) {
        ctx.meta._retryCount = attempt + 1;
        const delay = baseDelay * Math.pow(2, attempt);

        console.warn(
          `[air:retry] ${ctx.tool.name} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`,
        );

        await new Promise((r) => setTimeout(r, delay));

        try {
          const result = await ctx.tool.handler(ctx.params, {
            requestId: ctx.requestId,
            serverName: ctx.serverName,
            startedAt: ctx.startedAt,
            state: ctx.meta._serverState || {},
          });
          return result; // 성공 시 즉시 반환
        } catch (retryError) {
          lastError = retryError as Error;
          if (!retryOn(lastError)) return undefined; // 재시도 대상 아닌 에러
        }
      }

      // 모든 재시도 실패 — 에러 처리를 다음 onError 핸들러에 위임
      return undefined;
    },
  };

  return {
    meta: { name: 'air:retry', version: '1.0.0' },
    middleware: [middleware],
  };
}
