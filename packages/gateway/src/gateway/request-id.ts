// @airmcp-dev/gateway — gateway/request-id.ts
//
// 하위 서버가 보낸 요청(elicitation 등)의 id를 게이트웨이 id로 바꾼다.
// 게이트웨이를 여러 대 띄워도 어느 인스턴스가 클라이언트 응답을 받든 처리할 수 있도록,
// id 안에 "어느 백엔드의 어떤 요청인지"를 담고 HMAC으로 위조를 막는다 (공유 저장소 불필요).
//
//   gw.<backendId b64url>.<upstreamId b64url>.<hmac b64url 22자>

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'gw';

function b64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}
function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

export interface DecodedGatewayId {
  backendId: string;
  upstreamId: string | number;
}

export class GatewayRequestIds {
  private readonly secret: Buffer;

  /** secret이 없으면 프로세스마다 임의 값 — 단일 인스턴스에서만 검증 가능 */
  constructor(secret?: string) {
    this.secret = secret ? Buffer.from(secret, 'utf-8') : randomBytes(32);
  }

  private sign(backend: string, upstream: string): string {
    return createHmac('sha256', this.secret).update(`${backend}.${upstream}`).digest('base64url').slice(0, 22);
  }

  /** 백엔드 요청 id → 게이트웨이 id */
  encode(backendId: string, upstreamId: string | number): string {
    const b = b64url(backendId);
    const u = b64url(JSON.stringify(upstreamId)); // 숫자/문자열 구분 보존
    return `${PREFIX}.${b}.${u}.${this.sign(b, u)}`;
  }

  /** 게이트웨이 id → 백엔드 요청. 형식이 다르거나 서명이 맞지 않으면 null */
  decode(id: string | number): DecodedGatewayId | null {
    if (typeof id !== 'string') return null;
    const parts = id.split('.');
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;
    const [, b, u, sig] = parts;
    const expected = this.sign(b, u);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    try {
      return { backendId: unb64url(b), upstreamId: JSON.parse(unb64url(u)) };
    } catch {
      return null;
    }
  }

  /** 게이트웨이가 만든 id처럼 생겼는지 (서명 검증은 하지 않음) */
  static looksLike(id: unknown): boolean {
    return typeof id === 'string' && id.startsWith(`${PREFIX}.`) && id.split('.').length === 4;
  }
}
