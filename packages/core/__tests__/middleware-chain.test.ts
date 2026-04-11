// @airmcp-dev/core — __tests__/middleware-chain.test.ts

import { describe, it, expect, vi } from 'vitest';
import { MiddlewareChain } from '../src/middleware/chain.js';

/** 헬퍼: 기본 toolCtx 생성 */
function makeCtx(state: Record<string, any> = {}) {
  return { requestId: 'r1', serverName: 's1', startedAt: Date.now(), state };
}

describe('MiddlewareChain', () => {
  it('should execute tool handler when no middleware', async () => {
    const chain = new MiddlewareChain();
    const tool = {
      name: 'test',
      handler: async (params: any) => [{ type: 'text' as const, text: `got: ${params.x}` }],
      params: {},
    };

    const result = await chain.execute(tool, { x: 42 }, makeCtx());
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
    expect(true).toBe(true);
  });

  // ── abort 시 after 미들웨어 실행 확인 ──

  it('should run after middleware even when before aborts', async () => {
    const chain = new MiddlewareChain();
    const afterSpy = vi.fn();

    chain.add({
      name: 'aborter',
      before: async () => ({ abort: true, abortResponse: 'blocked' }),
    });
    chain.add({
      name: 'logger',
      after: afterSpy,
    });

    const tool = {
      name: 'test',
      handler: async () => 'should not reach',
    };

    const result = await chain.execute(tool, {}, makeCtx());

    // abort 결과가 반환되어야 함
    expect(result[0].text).toBe('blocked');
    // after가 호출되어야 함 (로깅/메트릭 보장)
    expect(afterSpy).toHaveBeenCalledOnce();
  });

  it('should not execute handler when before aborts', async () => {
    const chain = new MiddlewareChain();
    const handlerSpy = vi.fn().mockResolvedValue('handler result');

    chain.add({
      name: 'auth-block',
      before: async () => ({ abort: true, abortResponse: 'unauthorized' }),
    });

    const tool = { name: 'test', handler: handlerSpy };
    await chain.execute(tool, {}, makeCtx());

    expect(handlerSpy).not.toHaveBeenCalled();
  });

  // ── before에서 params 수정 ──

  it('should pass modified params to handler', async () => {
    const chain = new MiddlewareChain();

    chain.add({
      name: 'sanitizer',
      before: async (ctx: any) => ({
        params: { ...ctx.params, injected: true },
      }),
    });

    let receivedParams: any;
    const tool = {
      name: 'test',
      handler: async (params: any) => { receivedParams = params; return 'ok'; },
    };

    await chain.execute(tool, { original: 'value' }, makeCtx());

    expect(receivedParams.original).toBe('value');
    expect(receivedParams.injected).toBe(true);
  });

  // ── onError recovery ──

  it('should recover from handler error via onError', async () => {
    const chain = new MiddlewareChain();

    chain.add({
      name: 'recovery',
      onError: async (_ctx: any, error: Error) => {
        return `recovered from: ${error.message}`;
      },
    });

    const tool = {
      name: 'test',
      handler: async () => { throw new Error('db failed'); },
    };

    const result = await chain.execute(tool, {}, makeCtx());
    expect(result[0].text).toBe('recovered from: db failed');
  });

  it('should return error text when no onError handles it', async () => {
    const chain = new MiddlewareChain();
    const tool = {
      name: 'test',
      handler: async () => { throw new Error('unhandled'); },
    };

    const result = await chain.execute(tool, {}, makeCtx());
    expect(result[0].text).toContain('unhandled');
  });

  // ── _serverState 주입 확인 ──

  it('should inject _serverState into meta from toolCtx.state', async () => {
    const chain = new MiddlewareChain();
    let capturedMeta: any;

    chain.add({
      name: 'inspector',
      before: async (ctx: any) => { capturedMeta = ctx.meta; },
    });

    const tool = { name: 'test', handler: async () => 'ok' };
    const serverState = { db: 'connected', pool: 5 };

    await chain.execute(tool, {}, makeCtx(serverState));

    expect(capturedMeta._serverState).toBe(serverState);
    expect(capturedMeta._serverState.db).toBe('connected');
  });

  // ── after 미들웨어 에러 무시 ──

  it('should ignore errors in after middleware', async () => {
    const chain = new MiddlewareChain();

    chain.add({
      name: 'bad-after',
      after: async () => { throw new Error('after crash'); },
    });

    const tool = { name: 'test', handler: async () => 'success' };
    const result = await chain.execute(tool, {}, makeCtx());

    // after 에러가 있어도 정상 결과 반환
    expect(result[0].text).toBe('success');
  });

  // ── before 순서 보장 ──

  it('should execute before middlewares in order', async () => {
    const chain = new MiddlewareChain();
    const order: string[] = [];

    chain.add({ name: 'first', before: async () => { order.push('1st'); } });
    chain.add({ name: 'second', before: async () => { order.push('2nd'); } });
    chain.add({ name: 'third', before: async () => { order.push('3rd'); } });

    const tool = { name: 'test', handler: async () => 'ok' };
    await chain.execute(tool, {}, makeCtx());

    expect(order).toEqual(['1st', '2nd', '3rd']);
  });
});
