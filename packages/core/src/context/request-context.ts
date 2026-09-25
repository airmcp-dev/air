// @airmcp-dev/core — context/request-context.ts
// 요청별 컨텍스트 — 각 도구 호출마다 생성

import { randomUUID } from 'crypto';
import type {
  AirToolContext, AirElicitSchema, AirElicitResult,
  AirInputResponse, AirInputRequiredResult,
} from '../types/tool.js';

/** 요청 컨텍스트 확장 옵션 */
export interface RequestContextOptions {
  /** 요청 취소 시그널 */
  signal?: AbortSignal;
  /** Elicitation 함수 (MCP 2025-06-18+, 레거시) */
  elicit?: (message: string, schema: AirElicitSchema) => Promise<AirElicitResult>;
  /** MRTR: 클라이언트가 보낸 inputResponses (재시도 시) */
  inputResponses?: AirInputResponse[];
}

/** MRTR requestInput 헬퍼 — handler에서 반환하면 input_required 응답이 됨 */
function createRequestInputHelper() {
  return (
    message: string,
    schema: Record<string, { type: string; description?: string }>,
    requestState?: string,
  ): AirInputRequiredResult => {
    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];

    for (const [key, def] of Object.entries(schema)) {
      properties[key] = { type: def.type, ...(def.description ? { description: def.description } : {}) };
      required.push(key);
    }

    return {
      _inputRequired: true,
      inputRequests: [{
        type: 'elicitation',
        message,
        requestedSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      }],
      ...(requestState ? { requestState } : {}),
    };
  };
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
    inputResponses: options?.inputResponses,
    requestInput: createRequestInputHelper(),
  };
}
