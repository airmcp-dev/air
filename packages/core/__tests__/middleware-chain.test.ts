// @airmcp-dev/core — __tests__/middleware-chain.test.ts

import { describe, it, expect } from 'vitest';
import { MiddlewareChain } from '../src/middleware/chain.js';

describe('MiddlewareChain', () => {
  it('should execute tool handler when no middleware', async () => {
    const chain = new MiddlewareChain();
    const tool = {
      name: 'test',
      handler: async (params: any) => [{ type: 'text' as const, text: `got: ${params.x}` }],
      params: {},
    };

    const result = await chain.execute(tool, { x: 42 }, {} as any);
    expect(result).toBeDefined();
  });

  it('should add middleware without throwing', () => {
    const chain = new MiddlewareChain();
    const mw = { name: 'test-mw', before: async (ctx: any) => ({ ...ctx }) };

    expect(() => chain.add(mw)).not.toThrow();
  });

  it('should add multiple middleware', () => {
    const chain = new MiddlewareChain();
    const mw1 = { name: 'mw1', before: async (ctx: any) => ({ ...ctx }) };
    const mw2 = { name: 'mw2', before: async (ctx: any) => ({ ...ctx }) };

    chain.addAll([mw1, mw2]);
    // 에러 없으면 성공
    expect(true).toBe(true);
  });
});
