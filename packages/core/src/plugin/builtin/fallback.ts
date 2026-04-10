// @airmcp-dev/core — plugin/builtin/fallback.ts
//
// 도구 폴백 플러그인.
// 특정 도구가 에러나면 대체 도구를 자동으로 호출.
//
// @example
//   defineServer({
//     use: [fallbackPlugin({
//       'search_primary': 'search_backup',
//       'fetch_api': 'fetch_cached',
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

type FallbackMap = Record<string, string>;

export function fallbackPlugin(fallbacks: FallbackMap): AirPlugin {
  const middleware: AirMiddleware = {
    name: 'air:fallback',
    onError: async (ctx, error) => {
      const fallbackTool = fallbacks[ctx.tool.name];
      if (!fallbackTool) return undefined;

      console.warn(`[air:fallback] "${ctx.tool.name}" failed, trying "${fallbackTool}"`);

      // 같은 서버의 도구 목록에서 폴백 도구를 찾아 실행
      // ctx.meta에 서버의 callTool이 있으면 사용
      if (ctx.meta._serverCallTool) {
        try {
          const result = await ctx.meta._serverCallTool(fallbackTool, ctx.params);
          return result;
        } catch (fallbackError: any) {
          console.error(`[air:fallback] Fallback "${fallbackTool}" also failed: ${fallbackError.message}`);
          return undefined;
        }
      }

      return undefined;
    },
  };

  return {
    meta: { name: 'air:fallback', version: '1.0.0' },
    middleware: [middleware],
  };
}
