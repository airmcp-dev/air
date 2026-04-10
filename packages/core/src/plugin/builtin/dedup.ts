// @airmcp-dev/core — plugin/builtin/dedup.ts
//
// 중복 호출 방지 플러그인.
// 같은 파라미터로 동시에 여러 호출이 오면 하나만 실행하고 나머지는 같은 결과를 공유.
// (Request Deduplication / Coalescing)
//
// @example
//   defineServer({
//     use: [dedupPlugin()],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface DedupOptions {
  /** 중복 제거 윈도우 ms (기본: 1000) */
  windowMs?: number;
}

export function dedupPlugin(options?: DedupOptions): AirPlugin {
  const windowMs = options?.windowMs ?? 1000;
  const inflight = new Map<string, { promise: Promise<any>; timestamp: number }>();

  function makeKey(toolName: string, params: Record<string, any>): string {
    return `${toolName}:${JSON.stringify(params, Object.keys(params).sort())}`;
  }

  // 주기적으로 만료된 항목 정리
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inflight.entries()) {
      if (now - entry.timestamp > windowMs * 2) inflight.delete(key);
    }
  }, windowMs * 5);

  const middleware: AirMiddleware = {
    name: 'air:dedup',
    before: async (ctx) => {
      const key = makeKey(ctx.tool.name, ctx.params);
      const existing = inflight.get(key);

      if (existing && Date.now() - existing.timestamp < windowMs) {
        // 동일 호출이 진행 중 — 결과를 공유
        const result = await existing.promise;
        ctx.meta._deduped = true;
        return {
          abort: true,
          abortResponse: result,
        };
      }

      // 새 호출 — inflight에 등록 (promise는 after에서 resolve)
      let resolveInflight: (result: any) => void;
      const promise = new Promise<any>((r) => { resolveInflight = r; });
      inflight.set(key, { promise, timestamp: Date.now() });
      ctx.meta._dedupKey = key;
      ctx.meta._dedupResolve = resolveInflight!;
    },
    after: async (ctx) => {
      if (ctx.meta._deduped) return;

      const key = ctx.meta._dedupKey as string;
      const resolve = ctx.meta._dedupResolve as ((r: any) => void) | undefined;
      if (key && resolve) {
        resolve(ctx.result);
        // 짧은 시간 유지 후 삭제
        setTimeout(() => inflight.delete(key), windowMs);
      }
    },
  };

  return {
    meta: { name: 'air:dedup', version: '1.0.0' },
    middleware: [middleware],
  };
}
