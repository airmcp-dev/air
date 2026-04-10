// @airmcp-dev/core — context/request-context.ts
// 요청별 컨텍스트 — 각 도구 호출마다 생성

import { randomUUID } from 'crypto';
import type { AirToolContext } from '../types/tool.js';

/** 새 요청 컨텍스트 생성 */
export function createRequestContext(
  serverName: string,
  state: Record<string, any>,
): AirToolContext {
  return {
    requestId: randomUUID(),
    serverName,
    startedAt: Date.now(),
    state,
  };
}
