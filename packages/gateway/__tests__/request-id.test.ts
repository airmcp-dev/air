// @airmcp-dev/gateway — __tests__/request-id.test.ts
// 서버발 요청 id 코덱: 왕복, 타입 보존, 서명 검증, 다른 키 거부

import { describe, it, expect } from 'vitest';
import { GatewayRequestIds } from '../src/gateway/request-id.js';

describe('GatewayRequestIds', () => {
  it('should round-trip backend id and upstream id, preserving number/string', () => {
    const ids = new GatewayRequestIds('k');
    expect(ids.decode(ids.encode('search-1', 'http-7'))).toEqual({ backendId: 'search-1', upstreamId: 'http-7' });
    expect(ids.decode(ids.encode('a.b/c', 42))).toEqual({ backendId: 'a.b/c', upstreamId: 42 });
    expect(GatewayRequestIds.looksLike(ids.encode('x', 1))).toBe(true);
  });

  it('should reject tampered ids, foreign keys and other shapes', () => {
    const a = new GatewayRequestIds('key-a');
    const b = new GatewayRequestIds('key-b');
    const id = a.encode('srv', 'u-1');
    expect(b.decode(id)).toBeNull();
    expect(a.decode(id.slice(0, -1) + (id.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(a.decode('gw.only.three')).toBeNull();
    expect(a.decode(123)).toBeNull();
    expect(GatewayRequestIds.looksLike('up-1')).toBe(false);
  });

  it('should verify across instances that share the secret', () => {
    const one = new GatewayRequestIds('shared');
    const two = new GatewayRequestIds('shared');
    expect(two.decode(one.encode('s', 'x'))).toEqual({ backendId: 's', upstreamId: 'x' });
  });
});
