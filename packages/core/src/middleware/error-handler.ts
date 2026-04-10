// @airmcp-dev/core — middleware/error-handler.ts
// 에러 → MCP 프로토콜 형식 자동 변환
//
// MCP 프로토콜 에러 코드:
// -32700: Parse error
// -32600: Invalid Request
// -32601: Method not found
// -32602: Invalid params
// -32603: Internal error
// -32000 ~ -32099: Server error (implementation-defined)

import type { AirMiddleware, MiddlewareContext } from '../types/middleware.js';

/** air 전용 에러 클래스 — 에러 코드와 메타데이터를 포함 */
export class AirError extends Error {
  code: number;
  details?: Record<string, any>;

  constructor(message: string, code: number = -32603, details?: Record<string, any>) {
    super(message);
    this.name = 'AirError';
    this.code = code;
    this.details = details;
  }
}

/** MCP 표준 에러 팩토리 */
export const McpErrors = {
  /** 도구를 찾을 수 없음 */
  toolNotFound: (name: string) =>
    new AirError(`Tool "${name}" not found`, -32601, { tool: name }),

  /** 파라미터 검증 실패 */
  invalidParams: (message: string, params?: Record<string, any>) =>
    new AirError(`Invalid params: ${message}`, -32602, params),

  /** 내부 서버 에러 */
  internal: (message: string, cause?: Error) =>
    new AirError(`Internal error: ${message}`, -32603, { cause: cause?.message }),

  /** 접근 거부 */
  forbidden: (message: string) =>
    new AirError(message, -32000, { type: 'forbidden' }),

  /** 레이트 리밋 초과 */
  rateLimited: (tool: string, retryAfterMs?: number) =>
    new AirError(`Rate limit exceeded for "${tool}"`, -32001, { tool, retryAfterMs }),

  /** 위협 감지 */
  threatDetected: (type: string, severity: string) =>
    new AirError(`Threat detected: ${type}`, -32002, { threatType: type, severity }),

  /** 타임아웃 */
  timeout: (tool: string, timeoutMs: number) =>
    new AirError(`Tool "${tool}" timed out after ${timeoutMs}ms`, -32003, { tool, timeoutMs }),
};

/** 에러를 MCP 프로토콜 형식으로 변환 */
function formatError(error: Error): {
  content: Array<{ type: string; text: string }>;
  isError: true;
} {
  const message = error instanceof AirError
    ? `[${error.code}] ${error.message}`
    : `Error: ${error.message}`;

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/** 에러 → MCP 응답 변환 미들웨어 */
export function errorBoundaryMiddleware(): AirMiddleware {
  return {
    name: 'air:error-boundary',
    onError: async (ctx: MiddlewareContext, error: Error) => {
      // 에러 로그 (stderr로 출력, stdout은 MCP 프로토콜 전용)
      const toolName = ctx.tool?.name || 'unknown';
      const requestId = ctx.requestId || 'no-id';
      console.error(
        `[air:error] ${toolName} (${requestId}): ${error.message}`,
      );

      return formatError(error);
    },
  };
}
