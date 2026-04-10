// @airmcp-dev/core — resource/define-resource.ts
//
// defineResource() — MCP 리소스를 정의한다.
//
// 두 가지 호출 방식 지원:
//   defineResource('file:///path', { name, handler, ... })
//   defineResource({ uri, name, handler, ... })

import type { AirResourceDef } from '../types/resource.js';

export function defineResource(
  uriOrOptions: string | AirResourceDef,
  options?: Omit<AirResourceDef, 'uri'>,
): AirResourceDef {
  if (typeof uriOrOptions === 'string') {
    // defineResource('file:///path', { name, handler })
    if (!options) throw new Error('defineResource: options required when first arg is uri string');
    return { uri: uriOrOptions, ...options };
  }

  // defineResource({ uri, name, handler })
  return uriOrOptions;
}
