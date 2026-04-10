// @airmcp-dev/core — tool/tool-result.ts
// 도구 핸들러 반환값 → MCP content 형식으로 정규화

import type { AirToolResponse } from '../types/tool.js';

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** AirToolResponse를 MCP content 배열로 변환 */
export function normalizeResult(result: AirToolResponse): McpContent[] {
  if (result === null || result === undefined) {
    return [{ type: 'text', text: '' }];
  }

  // string, number, boolean → text
  if (typeof result === 'string') return [{ type: 'text', text: result }];
  if (typeof result === 'number') return [{ type: 'text', text: String(result) }];
  if (typeof result === 'boolean') return [{ type: 'text', text: String(result) }];

  // 배열 → JSON text
  if (Array.isArray(result)) return [{ type: 'text', text: JSON.stringify(result, null, 2) }];

  // { content: [...] } → 이미 MCP 형식
  if ('content' in result && Array.isArray(result.content)) return result.content;

  // { text: "..." } → text content
  if ('text' in result && typeof result.text === 'string')
    return [{ type: 'text', text: result.text }];

  // { image: "base64...", mimeType: "..." } → image content
  if ('image' in result && typeof result.image === 'string') {
    return [
      { type: 'image', data: result.image, mimeType: (result as any).mimeType || 'image/png' },
    ];
  }

  // 기타 객체 → JSON text
  return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
}
