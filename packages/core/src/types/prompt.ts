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

/**
 * 프롬프트 메시지 콘텐츠 (MCP PromptMessage.content).
 * 문자열은 text로 감싸고, 객체(image/audio/resource/resource_link)는 그대로 전달한다.
 */
export type AirPromptContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string; blob?: string } }
  | { type: 'resource_link'; uri: string; name?: string; description?: string; mimeType?: string };

export interface AirPromptMessage {
  role: 'user' | 'assistant';
  /** 문자열(= text) 또는 콘텐츠 객체 */
  content: string | AirPromptContent;
}
