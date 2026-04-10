// @airmcp-dev/core — types/prompt.ts

/** 프롬프트 템플릿 정의 */
export interface AirPromptDef {
  /** 프롬프트 이름 */
  name: string;
  /** 설명 */
  description?: string;
  /** 인자 정의 */
  arguments?: AirPromptArg[];
  /** 프롬프트 생성 함수 */
  handler: (args: Record<string, string>) => Promise<AirPromptMessage[]> | AirPromptMessage[];
}

export interface AirPromptArg {
  name: string;
  description?: string;
  required?: boolean;
}

export interface AirPromptMessage {
  role: 'user' | 'assistant';
  content: string;
}
