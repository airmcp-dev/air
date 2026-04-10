// @airmcp-dev/core — middleware/before-hook.ts
// 내장 before 미들웨어 — 입력 검증

import type { AirMiddleware } from '../types/middleware.js';
import { paramsToZodSchema } from '../tool/tool-schema.js';
import { McpErrors } from './error-handler.js';

/** 입력 파라미터 자동 검증 미들웨어 */
export function validationMiddleware(): AirMiddleware {
  return {
    name: 'air:validation',
    before: async (ctx) => {
      const schema = paramsToZodSchema(ctx.tool.params);
      if (!schema) return;

      const result = schema.safeParse(ctx.params);
      if (!result.success) {
        const details = result.error.errors.map((e) => ({
          field: e.path.join('.') || '(root)',
          message: e.message,
          code: e.code,
          expected: (e as any).expected,
          received: (e as any).received,
        }));

        const summary = details
          .map((d) => `  - ${d.field}: ${d.message}${d.expected ? ` (expected: ${d.expected}, got: ${d.received})` : ''}`)
          .join('\n');

        return {
          abort: true,
          abortResponse: {
            content: [{
              type: 'text',
              text: `[Validation] Invalid parameters for "${ctx.tool.name}":\n${summary}\n\nExpected schema:\n${Object.entries(ctx.tool.params || {}).map(([k, v]) => `  - ${k}: ${typeof v === 'string' ? v : (v as any).type || 'any'}${(v as any)?.optional ? ' (optional)' : ''}`).join('\n')}`,
            }],
            isError: true,
          },
        };
      }
      return { params: result.data };
    },
  };
}
