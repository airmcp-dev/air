// @airmcp-dev/core — prompt/define-prompt.ts
//
// definePrompt() — MCP 프롬프트 템플릿을 정의한다.
//
// 두 가지 호출 방식:
//   definePrompt('name', { description, args, handler })
//   definePrompt({ name, description, args, handler })

import type { AirPromptDef } from '../types/prompt.js';

export function definePrompt(
  nameOrOptions: string | AirPromptDef,
  options?: Omit<AirPromptDef, 'name'>,
): AirPromptDef {
  if (typeof nameOrOptions === 'string') {
    if (!options) throw new Error('definePrompt: options required when first arg is name string');
    return { name: nameOrOptions, ...options };
  }

  return nameOrOptions;
}
