// @airmcp-dev/core — types/middleware.ts

import type { AirToolDef } from './tool.js';

/** 미들웨어 컨텍스트 */
export interface MiddlewareContext {
  /** 호출되는 도구 정의 */
  tool: AirToolDef;
  /** 요청 파라미터 */
  params: Record<string, any>;
  /** 요청 고유 ID */
  requestId: string;
  /** 서버 이름 */
  serverName: string;
  /** 호출 시작 시각 (ms) */
  startedAt: number;
  /** 미들웨어 간 공유 메타데이터 */
  meta: Record<string, any>;
}

/** 미들웨어 결과 */
export interface MiddlewareResult {
  /** 변경된 파라미터 (원본 유지하려면 undefined) */
  params?: Record<string, any>;
  /** true면 이후 미들웨어 + 핸들러 스킵 */
  abort?: boolean;
  /** abort 시 클라이언트에 반환할 응답 */
  abortResponse?: any;
  /** 메타데이터 추가 */
  meta?: Record<string, any>;
}

/** before 미들웨어 함수 */
export type BeforeMiddleware = (
  ctx: MiddlewareContext,
) => Promise<MiddlewareResult | void> | MiddlewareResult | void;

/** after 미들웨어 함수 */
export type AfterMiddleware = (
  ctx: MiddlewareContext & { result: any; duration: number },
) => Promise<void> | void;

/** 에러 미들웨어 함수 */
export type ErrorMiddleware = (ctx: MiddlewareContext, error: Error) => Promise<any> | any;

/** 미들웨어 묶음 */
export interface AirMiddleware {
  /** 이름 (로깅/디버그용) */
  name: string;
  /** 도구 호출 전 */
  before?: BeforeMiddleware;
  /** 도구 호출 후 */
  after?: AfterMiddleware;
  /** 에러 발생 시 */
  onError?: ErrorMiddleware;
}
