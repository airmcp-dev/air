// @airmcp-dev/core — tool/define-tool.ts
// defineTool() — 도구 정의 헬퍼. 타입 안전한 도구를 간결하게 정의.

import type { AirToolDef, AirToolParams, AirToolHandler } from '../types/tool.js';

/**
 * MCP 도구를 정의한다.
 *
 * @example
 * ```ts
 * const search = defineTool('search', {
 *   description: '고객 검색',
 *   params: { query: 'string', limit: 'number?' },
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
    handler: AirToolHandler;
    layer?: number;
    tags?: string[];
  },
): AirToolDef {
  return {
    name,
    description: options.description,
    params: options.params,
    handler: options.handler,
    layer: options.layer,
    tags: options.tags,
  };
}
