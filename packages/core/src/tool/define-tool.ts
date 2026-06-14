// @airmcp-dev/core — tool/define-tool.ts
// defineTool() — 도구 정의 헬퍼. 타입 안전한 도구를 간결하게 정의.

import type { AirToolDef, AirToolParams, AirToolHandler, AirToolAnnotations } from '../types/tool.js';

/**
 * MCP 도구를 정의한다.
 *
 * @example
 * ```ts
 * const search = defineTool('search', {
 *   description: '고객 검색',
 *   params: { query: 'string', limit: 'number?' },
 *   annotations: { readOnlyHint: true },
 *   handler: async ({ query, limit }) => {
 *     return db.find({ query }).limit(limit ?? 10);
 *   },
 * });
 * ```
 */
export function defineTool(
  name: string,
  options: {
    description?: string;
    params?: AirToolParams;
    outputSchema?: AirToolParams;
    annotations?: AirToolAnnotations;
    handler: AirToolHandler;
    layer?: number;
    tags?: string[];
  },
): AirToolDef {
  return {
    name,
    description: options.description,
    params: options.params,
    outputSchema: options.outputSchema,
    annotations: options.annotations,
    handler: options.handler,
    layer: options.layer,
    tags: options.tags,
  };
}
