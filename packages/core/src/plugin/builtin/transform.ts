// @airmcp-dev/core — plugin/builtin/transform.ts
//
// 도구 입출력 변환 플러그인.
// 파라미터 전처리, 응답 후처리를 선언적으로 등록.
//
// @example
//   defineServer({
//     use: [transformPlugin({
//       before: {
//         '*': (params) => ({ ...params, _caller: 'air' }),
//         'search': (params) => ({ ...params, query: params.query.trim() }),
//       },
//       after: {
//         '*': (result) => ({ ...result, _processedAt: new Date().toISOString() }),
//       },
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

type TransformFn = (data: any) => any;

interface TransformOptions {
  /** 입력 파라미터 변환 (도구명 → 변환 함수, '*'는 전체 적용) */
  before?: Record<string, TransformFn>;
  /** 출력 결과 변환 */
  after?: Record<string, TransformFn>;
}

export function transformPlugin(options: TransformOptions): AirPlugin {
  const beforeMap = options.before || {};
  const afterMap = options.after || {};

  const middleware: AirMiddleware = {
    name: 'air:transform',
    before: async (ctx) => {
      const toolName = ctx.tool.name;

      // 글로벌 변환
      if (beforeMap['*']) {
        ctx.params = beforeMap['*'](ctx.params);
      }
      // 도구별 변환
      if (beforeMap[toolName]) {
        ctx.params = beforeMap[toolName](ctx.params);
      }

      return { params: ctx.params };
    },
    after: async (ctx) => {
      const toolName = ctx.tool.name;

      if (afterMap['*']) {
        ctx.result = afterMap['*'](ctx.result);
      }
      if (afterMap[toolName]) {
        ctx.result = afterMap[toolName](ctx.result);
      }
    },
  };

  return {
    meta: { name: 'air:transform', version: '1.0.0' },
    middleware: [middleware],
  };
}
