// @airmcp-dev/core — resource/resource-template.ts
// URI 템플릿 기반 동적 리소스 (예: "file:///{path}")

import type { AirResourceDef } from '../types/resource.js';

/** URI 템플릿에서 변수 추출 */
export function extractTemplateVars(uri: string): string[] {
  const matches = uri.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/** URI가 템플릿 패턴과 매칭되는지 확인 */
export function matchTemplate(template: string, uri: string): Record<string, string> | null {
  const regex = template.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)');
  const match = uri.match(new RegExp(`^${regex}$`));
  return match?.groups ?? null;
}
