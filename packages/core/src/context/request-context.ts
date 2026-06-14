// @airmcp-dev/core — context/request-context.ts
// 요청별 컨텍스트 — 각 도구 호출마다 생성

import { randomUUID } from 'crypto';
import type { AirToolContext, AirElicitSchema, AirElicitResult } from '../types/tool.js';

/** 요청 컨텍스트 확장 옵션 */
export interface RequestContextOptions {
  /** 요청 취소 시그널 */
  signal?: AbortSignal;
  /** Elicitation 함수 (MCP 2025-06-18+) */
  elicit?: (message: string, schema: AirElicitSchema) => Promise<AirElicitResult>;
}

/** 새 요청 컨텍스트 생성 */
export function createRequestContext(
  serverName: string,
  state: Record<string, any>,
  options?: RequestContextOptions,
): AirToolContext {
  return {
    requestId: randomUUID(),
    serverName,
    startedAt: Date.now(),
    state,
    signal: options?.signal,
    elicit: options?.elicit,
  };
}
