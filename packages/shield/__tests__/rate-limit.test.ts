// @airmcp-dev/shield — __tests__/rate-limit.test.ts

import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/rate-limit/limiter.js';

describe('RateLimiter', () => {
  it('should allow calls within limit', () => {
    const limiter = new RateLimiter();
    limiter.addRule({ target: 'search', windowMs: 60_000, maxCalls: 3 });

    expect(limiter.check('search').allowed).toBe(true);
    expect(limiter.check('search').allowed).toBe(true);
    expect(limiter.check('search').allowed).toBe(true);
  });

  it('should block calls exceeding limit', () => {
    const limiter = new RateLimiter();
    limiter.addRule({ target: 'search', windowMs: 60_000, maxCalls: 2 });

    limiter.check('search');
    limiter.check('search');
    const result = limiter.check('search');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should allow unlimited for unknown targets', () => {
    const limiter = new RateLimiter();
    const result = limiter.check('unknown-tool');
    expect(result.allowed).toBe(true);
  });

  it('should track usage correctly', () => {
    const limiter = new RateLimiter();
    limiter.addRule({ target: 'api', windowMs: 60_000, maxCalls: 10 });

    limiter.check('api');
    limiter.check('api');
    limiter.check('api');

    const usage = limiter.usage('api');
    expect(usage).toBeDefined();
    expect(usage!.used).toBe(3);
    expect(usage!.max).toBe(10);
  });

  it('should reset all counters', () => {
    const limiter = new RateLimiter();
    limiter.addRule({ target: 'api', windowMs: 60_000, maxCalls: 2 });

    limiter.check('api');
    limiter.check('api');
    limiter.reset();

    expect(limiter.check('api').allowed).toBe(true);
  });
});
