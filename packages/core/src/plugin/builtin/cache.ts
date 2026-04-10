// @airmcp-dev/core — plugin/builtin/cache.ts
//
// 도구 결과 캐시 플러그인.
// 같은 파라미터로 같은 도구를 호출하면 캐시된 결과를 반환.
//
// @example
//   defineServer({
//     use: [cachePlugin({ ttlMs: 60_000 })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface CacheOptions {
  /** 캐시 유지 시간 ms (기본: 60000) */
  ttlMs?: number;
  /** 캐시 최대 항목 수 (기본: 1000) */
  maxEntries?: number;
  /** 캐시 제외 도구 */
  exclude?: string[];
}

interface CacheEntry {
  result: any;
  cachedAt: number;
}

export function cachePlugin(options?: CacheOptions): AirPlugin {
  const ttlMs = options?.ttlMs ?? 60_000;
  const maxEntries = options?.maxEntries ?? 1000;
  const exclude = new Set(options?.exclude || []);

  const cache = new Map<string, CacheEntry>();

  function makeKey(toolName: string, params: Record<string, any>): string {
    return `${toolName}:${JSON.stringify(params, Object.keys(params).sort())}`;
  }

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.cachedAt > ttlMs) {
        cache.delete(key);
      }
    }
  }

  const middleware: AirMiddleware = {
    name: 'air:cache',
    before: async (ctx) => {
      if (exclude.has(ctx.tool.name)) return;

      evictExpired();
      const key = makeKey(ctx.tool.name, ctx.params);
      const entry = cache.get(key);

      if (entry && Date.now() - entry.cachedAt <= ttlMs) {
        ctx.meta._cached = true;
        return {
          abort: true,
          abortResponse: entry.result,
        };
      }

      ctx.meta._cacheKey = key;
    },
    after: async (ctx) => {
      if (exclude.has(ctx.tool.name)) return;
      if (ctx.meta._cached) return;

      const key = ctx.meta._cacheKey as string;
      if (!key) return;

      if (cache.size >= maxEntries) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }

      cache.set(key, { result: ctx.result, cachedAt: Date.now() });
    },
  };

  return {
    meta: { name: 'air:cache', version: '1.0.0' },
    middleware: [middleware],
  };
}
