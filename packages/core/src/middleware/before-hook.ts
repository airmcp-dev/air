// @airmcp-dev/core — middleware/before-hook.ts
// 내장 before 미들웨어 — 입력 검증

import type { AirMiddleware } from '../types/middleware.js';
import type { AirToolParams } from '../types/tool.js';
import { paramsToZodSchema, paramsToJsonSchema } from '../tool/tool-schema.js';
import { McpErrors } from './error-handler.js';

/** JSON Schema 속성의 타입 이름 — nullable의 anyOf는 `number | null`처럼 잇는다 */
function typeLabel(prop: Record<string, any>): string {
  if (Array.isArray(prop.anyOf)) return prop.anyOf.map(typeLabel).join(' | ');
  return Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type || 'any';
}

/** 검증 실패 메시지의 "Expected schema" 줄 — 단축 표기는 그대로, 나머지는 JSON Schema의 타입과 필수 여부 */
function describeParams(params: AirToolParams = {}): string {
  const json = paramsToJsonSchema(params);
  return Object.entries(params)
    .map(([k, v]) => {
      if (typeof v === 'string') return `  - ${k}: ${v}`;
      const prop = json?.properties?.[k] ?? {};
      return `  - ${k}: ${typeLabel(prop)}${json?.required?.includes(k) ? '' : ' (optional)'}`;
    })
    .join('\n');
}

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
              text: `[Validation] Invalid parameters for "${ctx.tool.name}":\n${summary}\n\nExpected schema:\n${describeParams(ctx.tool.params)}`,
            }],
            isError: true,
          },
        };
      }
      return { params: result.data };
    },
  };
}
