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
  | { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };

/** 도구 정의 객체 */
export interface AirToolDef {
  /** 도구 이름 (MCP 등록명) */
  name: string;
  /** 설명 (LLM이 도구를 선택할 때 참고) */
  description?: string;
  /** 파라미터 정의 */
  params?: AirToolParams;
  /** 핸들러 함수 */
  handler: AirToolHandler;
  /** 7-Layer 계층 힌트 (1~7, 선택) */
  layer?: number;
  /** 태그 (분류/필터용) */
  tags?: string[];
}
