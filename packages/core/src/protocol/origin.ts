// @airmcp-dev/core — protocol/origin.ts
//
// Origin 헤더 검증 (DNS rebinding 방지).
// Streamable HTTP transport와 이전 HTTP+SSE transport가 같은 규칙을 쓴다.
//   - Origin 헤더가 없는 요청(브라우저가 아닌 클라이언트)은 받는다
//   - 루프백 출처(localhost, 127.0.0.1, [::1], 포트 무관)는 받는다
//   - transport.allowedOrigins에 있는 출처는 받는다 ('*'는 모든 Origin)
//   - 나머지는 403

import type { IncomingMessage, ServerResponse } from 'node:http';

/** 항상 허용하는 Origin 호스트 (루프백) */
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/** Origin 헤더 값이 허용되는지 */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins?: string[]): boolean {
  if (origin === undefined) return true;
  if (allowedOrigins?.includes('*') || allowedOrigins?.includes(origin)) return true;
  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(origin).hostname);
  } catch {
    return false; // 'null' 같은 불투명 Origin
  }
}

/**
 * 요청의 Origin을 검사한다. 허용되지 않으면 403과 id 없는 JSON-RPC 에러로 답하고 false를 돌려준다.
 * 호출한 쪽은 false면 요청 처리를 멈춘다.
 */
export function checkOrigin(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins?: string[],
): boolean {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin, allowedOrigins)) return true;
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: `Forbidden: Origin ${origin} is not allowed` },
    }),
  );
  return false;
}
