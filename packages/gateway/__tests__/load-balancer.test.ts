// @airmcp-dev/gateway — __tests__/load-balancer.test.ts

import { describe, it, expect } from 'vitest';
import { LoadBalancer } from '../src/router/load-balancer.js';

describe('LoadBalancer', () => {
  const candidates = [
    { name: 'search', serverId: 's1' },
    { name: 'search', serverId: 's2' },
    { name: 'search', serverId: 's3' },
  ];

  it('should return single candidate directly', () => {
    const lb = new LoadBalancer('round-robin');
    const result = lb.select([candidates[0]]);
    expect(result.serverId).toBe('s1');
  });

  it('should round-robin across candidates', () => {
    const lb = new LoadBalancer('round-robin');
    const r1 = lb.select(candidates);
    const r2 = lb.select(candidates);
    const r3 = lb.select(candidates);
    const r4 = lb.select(candidates);

    expect(r1.serverId).toBe('s1');
    expect(r2.serverId).toBe('s2');
    expect(r3.serverId).toBe('s3');
    expect(r4.serverId).toBe('s1'); // 순환
  });

  it('should random select from candidates', () => {
    const lb = new LoadBalancer('random');
    const result = lb.select(candidates);
    expect(['s1', 's2', 's3']).toContain(result.serverId);
  });

  it('should throw on empty candidates', () => {
    const lb = new LoadBalancer('round-robin');
    expect(() => lb.select([])).toThrow('No candidates');
  });
});
