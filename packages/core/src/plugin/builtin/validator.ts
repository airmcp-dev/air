// @airmcp-dev/core — plugin/builtin/validator.ts
//
// 커스텀 검증 플러그인.
// zod 스키마 외에 비즈니스 로직 검증을 추가.
// 도구별로 검증 규칙을 등록할 수 있다.
//
// @example
//   defineServer({
//     use: [validatorPlugin({
//       rules: {
//         'transfer': (params) => {
//           if (params.amount > 10000) return 'Amount exceeds limit';
//           return null; // OK
//         },
//       },
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

type ValidationRule = (params: Record<string, any>) => string | null;

interface ValidatorOptions {
  /** 도구별 검증 규칙 */
  rules: Record<string, ValidationRule>;
}

export function validatorPlugin(options: ValidatorOptions): AirPlugin {
  const middleware: AirMiddleware = {
    name: 'air:validator',
    before: async (ctx) => {
      const rule = options.rules[ctx.tool.name];
      if (!rule) return;

      const error = rule(ctx.params);
      if (error) {
        return {
          abort: true,
          abortResponse: {
            content: [{ type: 'text', text: `[Validator] ${ctx.tool.name}: ${error}` }],
            isError: true,
          },
        };
      }
    },
  };

  return {
    meta: { name: 'air:validator', version: '1.0.0' },
    middleware: [middleware],
  };
}
