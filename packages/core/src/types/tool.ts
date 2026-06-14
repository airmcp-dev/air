// @airmcp-dev/core — types/tool.ts

import type { z } from 'zod';

/** 파라미터 단축 타입 → zod로 변환됨 */
export type ParamShorthand =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string?'
  | 'number?'
  | 'boolean?'
  | 'object'
  | 'object?';

/** 파라미터 객체 형식 정의 */
export interface ParamObjectDef {
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;
  optional?: boolean;
}

/** 파라미터 정의: zod 스키마, 단축 표기, 또는 객체 형식 */
export type AirToolParams = Record<string, ParamShorthand | ParamObjectDef | z.ZodType>;

/** 도구 핸들러 함수 */
export type AirToolHandler<P = Record<string, any>> = (
  params: P,
  context: AirToolContext,
) => Promise<AirToolResponse> | AirToolResponse;

/** Elicitation 요청 스키마 (form 모드) */
export interface AirElicitSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required?: boolean;
  };
}

/** Elicitation 결과 */
export interface AirElicitResult {
  /** 사용자 응답 액션 */
  action: 'accept' | 'decline' | 'cancel';
  /** accept 시 사용자 입력 값 */
  content?: Record<string, any>;
}

/** 도구 호출 시 전달되는 컨텍스트 */
export interface AirToolContext {
  /** 요청 고유 ID */
  requestId: string;
  /** 서버 이름 */
  serverName: string;
  /** 호출 시각 (ms) */
  startedAt: number;
  /** 서버 글로벌 상태 접근 */
  state: Record<string, any>;
  /** 요청 취소 시그널 (MCP SDK extra.signal) */
  signal?: AbortSignal;
  /**
   * 사용자에게 입력을 요청 (MCP Elicitation, 2025-06-18+)
   * 클라이언트가 elicitation을 지원하지 않으면 undefined
   */
  elicit?: (message: string, schema: AirElicitSchema) => Promise<AirElicitResult>;
}

/** 도구 응답 (자동으로 MCP content 형식으로 변환됨) */
export type AirToolResponse =
  | string
  | number
  | boolean
  | Record<string, any>
  | any[]
  | { text: string }
  | { image: string; mimeType?: string }
  | { resource: AirResourceLink }
  | { content: Array<{ type: string; text?: string; data?: string; mimeType?: string; uri?: string; name?: string }> };

/** 리소스 링크 — MCP 2025-06-18 Resource Links */
export interface AirResourceLink {
  /** 리소스 URI */
  uri: string;
  /** 리소스 이름 */
  name?: string;
  /** 설명 */
  description?: string;
  /** MIME 타입 */
  mimeType?: string;
}

/** 도구 어노테이션 — MCP 2025-03-26+ Tool Annotations (힌트 전용) */
export interface AirToolAnnotations {
  /** 도구의 사람이 읽을 수 있는 제목 */
  title?: string;
  /** 읽기 전용 작업 힌트 (데이터 변경 없음) */
  readOnlyHint?: boolean;
  /** 파괴적 작업 힌트 (삭제, 덮어쓰기 등) */
  destructiveHint?: boolean;
  /** 멱등성 힌트 (같은 입력 → 같은 결과) */
  idempotentHint?: boolean;
  /** 오픈 월드 힌트 (외부 시스템과 상호작용) */
  openWorldHint?: boolean;
}

/** 도구 정의 객체 */
export interface AirToolDef {
  /** 도구 이름 (MCP 등록명) */
  name: string;
  /** 설명 (LLM이 도구를 선택할 때 참고) */
  description?: string;
  /** 파라미터 정의 */
  params?: AirToolParams;
  /** 출력 스키마 정의 — MCP 2025-06-18 Structured Output (zod 스키마 또는 단축 표기) */
  outputSchema?: AirToolParams;
  /** 핸들러 함수 */
  handler: AirToolHandler;
  /** 도구 어노테이션 (MCP 2025-03-26+) */
  annotations?: AirToolAnnotations;
  /** 7-Layer 계층 힌트 (1~7, 선택) */
  layer?: number;
  /** 태그 (분류/필터용) */
  tags?: string[];
}
