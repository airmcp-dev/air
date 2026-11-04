// @airmcp-dev/core — context/request-context.ts
// 요청별 컨텍스트 — 각 도구 호출마다 생성

import { randomUUID } from 'crypto';
import type {
  AirToolContext, AirElicitSchema, AirElicitJsonSchema, AirElicitResult, AirLogLevel,
  AirInputResponse, AirInputRequiredResult,
} from '../types/tool.js';
import type { AirOutbound } from '../protocol/outbound.js';

/** 요청 컨텍스트 확장 옵션 */
export interface RequestContextOptions {
  /** 요청 취소 시그널 */
  signal?: AbortSignal;
  /** Elicitation 함수를 직접 주입 (테스트/커스텀 transport용). outbound보다 우선한다. */
  elicit?: (message: string, schema: AirElicitSchema | AirElicitJsonSchema) => Promise<AirElicitResult>;
  /** MRTR: 클라이언트가 보낸 inputResponses (재시도 시) */
  inputResponses?: AirInputResponse[];
  /** 서버 → 클라이언트 채널 (transport가 제공). 없으면 progress/log는 no-op, elicit은 undefined */
  outbound?: AirOutbound;
  /** 요청의 _meta.progressToken — 있을 때만 progress 알림을 보낸다 */
  progressToken?: string | number;
  /** 클라이언트가 elicitation 능력을 선언했는지 */
  clientSupportsElicitation?: boolean;
  /** 현재 로그 레벨을 돌려주는 함수 (logging/setLevel 반영). 없으면 전부 보낸다 */
  getLogLevel?: () => AirLogLevel | undefined;
}

/** RFC 5424 심각도 순서 — 인덱스가 클수록 심각 */
const LOG_LEVELS: AirLogLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

/** 단축형 스키마를 MCP requestedSchema(JSON Schema object)로 변환한다. 이미 object 스키마면 그대로. */
export function toElicitJsonSchema(schema: AirElicitSchema | AirElicitJsonSchema): AirElicitJsonSchema {
  if ((schema as AirElicitJsonSchema).type === 'object' && (schema as AirElicitJsonSchema).properties) {
    return schema as AirElicitJsonSchema;
  }
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, def] of Object.entries(schema as AirElicitSchema)) {
    const { required: isRequired, ...rest } = def;
    properties[key] = rest;
    if (isRequired) required.push(key);
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
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
  const outbound = options?.outbound;
  const progressToken = options?.progressToken;

  // progress: 토큰이 있고 채널이 있을 때만 실제 전송
  const progress: AirToolContext['progress'] =
    outbound && progressToken !== undefined
      ? (value, total, message) =>
          outbound.notify('notifications/progress', {
            progressToken,
            progress: value,
            ...(total !== undefined ? { total } : {}),
            ...(message !== undefined ? { message } : {}),
          })
      : () => {};

  // log: 채널이 있으면 setLevel 이상만 전송
  const log: AirToolContext['log'] = outbound
    ? (level, data, logger) => {
        const min = options?.getLogLevel?.();
        if (min && LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(min)) return;
        outbound.notify('notifications/message', {
          level,
          ...(logger !== undefined ? { logger } : {}),
          data,
        });
      }
    : () => {};

  // elicit: 직접 주입 > 양방향 채널 + 클라이언트 능력
  let elicit = options?.elicit;
  if (!elicit && outbound?.request && options?.clientSupportsElicitation !== false) {
    const request = outbound.request.bind(outbound);
    elicit = async (message, schema) => {
      const result = await request('elicitation/create', {
        message,
        requestedSchema: toElicitJsonSchema(schema),
      });
      return {
        action: result?.action ?? 'cancel',
        ...(result?.content !== undefined ? { content: result.content } : {}),
      };
    };
  }

  return {
    requestId: randomUUID(),
    serverName,
    startedAt: Date.now(),
    state,
    signal: options?.signal,
    elicit,
    inputResponses: options?.inputResponses,
    requestInput: createRequestInputHelper(),
    progress,
    log,
  };
}
