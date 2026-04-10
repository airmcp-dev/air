// @airmcp-dev/core — __tests__/plugins-extra.test.ts
// 추가 플러그인 테스트

import { describe, it, expect, vi } from 'vitest';
import { perUserRateLimitPlugin } from '../src/plugin/builtin/ratelimit-per-user.js';
import { sanitizerPlugin } from '../src/plugin/builtin/sanitizer.js';
import { jsonLoggerPlugin } from '../src/plugin/builtin/logger-json.js';
import { circuitBreakerPlugin } from '../src/plugin/builtin/circuit-breaker.js';
import { fallbackPlugin } from '../src/plugin/builtin/fallback.js';
import { dedupPlugin } from '../src/plugin/builtin/dedup.js';
import { i18nPlugin } from '../src/plugin/builtin/i18n.js';
import { queuePlugin } from '../src/plugin/builtin/queue.js';
import { dryrunPlugin } from '../src/plugin/builtin/dryrun.js';

// ── perUserRateLimitPlugin ──

describe('perUserRateLimitPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = perUserRateLimitPlugin({ maxCalls: 5 });
    expect(plugin.meta.name).toBe('air:per-user-ratelimit');
  });

  it('should allow calls within limit', async () => {
    const plugin = perUserRateLimitPlugin({ maxCalls: 3, windowMs: 60_000 });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { _userId: 'alice' }, meta: {} } as any;

    expect(await mw.before!(ctx)).toBeUndefined();
    expect(await mw.before!(ctx)).toBeUndefined();
    expect(await mw.before!(ctx)).toBeUndefined();
  });

  it('should block when limit exceeded', async () => {
    const plugin = perUserRateLimitPlugin({ maxCalls: 2, windowMs: 60_000 });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { _userId: 'bob' }, meta: {} } as any;

    await mw.before!(ctx);
    await mw.before!(ctx);
    const result = await mw.before!(ctx);
    expect(result?.abort).toBe(true);
  });

  it('should track users independently', async () => {
    const plugin = perUserRateLimitPlugin({ maxCalls: 1, windowMs: 60_000 });
    const mw = plugin.middleware![0];

    const ctx1 = { tool: { name: 'test' }, params: { _userId: 'alice' }, meta: {} } as any;
    const ctx2 = { tool: { name: 'test' }, params: { _userId: 'bob' }, meta: {} } as any;

    await mw.before!(ctx1); // alice: 1/1
    const r1 = await mw.before!(ctx1); // alice: 2/1 → blocked
    const r2 = await mw.before!(ctx2); // bob: 1/1 → OK

    expect(r1?.abort).toBe(true);
    expect(r2).toBeUndefined();
  });
});

// ── sanitizerPlugin ──

describe('sanitizerPlugin', () => {
  it('should strip HTML tags', async () => {
    const plugin = sanitizerPlugin();
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { text: '<script>alert("xss")</script>Hello' }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.params?.text).toBe('alert("xss")Hello');
  });

  it('should strip control characters', async () => {
    const plugin = sanitizerPlugin();
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { text: 'hello\x00\x01world' }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.params?.text).toBe('helloworld');
  });

  it('should truncate long strings', async () => {
    const plugin = sanitizerPlugin({ maxStringLength: 10 });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { text: 'a'.repeat(100) }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.params?.text.length).toBe(10);
  });

  it('should skip excluded tools', async () => {
    const plugin = sanitizerPlugin({ exclude: ['raw_input'] });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'raw_input' }, params: { text: '<b>bold</b>' }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result).toBeUndefined();
  });
});

// ── jsonLoggerPlugin ──

describe('jsonLoggerPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = jsonLoggerPlugin();
    expect(plugin.meta.name).toBe('air:json-logger');
  });

  it('should log JSON on after hook', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin = jsonLoggerPlugin({ output: 'stderr' });
    const mw = plugin.middleware![0];

    await mw.after!({
      tool: { name: 'search' },
      params: {},
      meta: {},
      requestId: 'r1',
      serverName: 's1',
      startedAt: Date.now(),
      result: 'ok',
      duration: 42,
    } as any);

    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.event).toBe('tool.call');
    expect(logged.tool).toBe('search');
    expect(logged.duration_ms).toBe(42);

    spy.mockRestore();
  });
});

// ── circuitBreakerPlugin ──

describe('circuitBreakerPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = circuitBreakerPlugin();
    expect(plugin.meta.name).toBe('air:circuit-breaker');
  });

  it('should allow calls when circuit closed', async () => {
    const plugin = circuitBreakerPlugin({ failureThreshold: 3 });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: {}, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.abort).toBeUndefined();
  });

  it('should open circuit after threshold failures', async () => {
    const plugin = circuitBreakerPlugin({ failureThreshold: 2, resetTimeoutMs: 60_000 });
    const mw = plugin.middleware![0];

    // 2번 실패
    for (let i = 0; i < 2; i++) {
      const ctx = { tool: { name: 'flaky' }, params: {}, meta: {} } as any;
      await mw.before!(ctx);
      await mw.onError!(ctx, new Error('fail'));
    }

    // 3번째 호출 → 서킷 오픈
    const ctx3 = { tool: { name: 'flaky' }, params: {}, meta: {} } as any;
    const result = await mw.before!(ctx3);
    expect(result?.abort).toBe(true);
  });

  it('should reset circuit on success', async () => {
    const plugin = circuitBreakerPlugin({ failureThreshold: 3 });
    const mw = plugin.middleware![0];

    // 1번 실패
    const ctx1 = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    await mw.before!(ctx1);
    await mw.onError!(ctx1, new Error('fail'));

    // 1번 성공 → 리셋
    const ctx2 = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    await mw.before!(ctx2);
    await mw.after!({ ...ctx2, result: 'ok', duration: 10 });

    // 다시 실패해도 카운트 1부터
    const ctx3 = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    await mw.before!(ctx3);
    await mw.onError!(ctx3, new Error('fail'));

    const ctx4 = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    const result = await mw.before!(ctx4);
    expect(result?.abort).toBeUndefined(); // 아직 threshold 안 넘음
  });
});

// ── fallbackPlugin ──

describe('fallbackPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = fallbackPlugin({ primary: 'backup' });
    expect(plugin.meta.name).toBe('air:fallback');
  });

  it('should not fallback for unmapped tools', async () => {
    const plugin = fallbackPlugin({ primary: 'backup' });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'other' }, params: {}, meta: {} } as any;

    const result = await mw.onError!(ctx, new Error('fail'));
    expect(result).toBeUndefined();
  });
});

// ── dedupPlugin ──

describe('dedupPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = dedupPlugin();
    expect(plugin.meta.name).toBe('air:dedup');
  });

  it('should allow first call', async () => {
    const plugin = dedupPlugin({ windowMs: 5000 });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'search' }, params: { q: 'test' }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.abort).toBeUndefined();
    expect(ctx.meta._dedupKey).toBeDefined();
  });
});

// ── i18nPlugin ──

describe('i18nPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = i18nPlugin();
    expect(plugin.meta.name).toBe('air:i18n');
  });

  it('should extract lang param', async () => {
    const plugin = i18nPlugin({ defaultLang: 'en' });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { query: 'hello', _lang: 'ko' }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.params).not.toHaveProperty('_lang');
    expect(ctx.meta._lang).toBe('ko');
  });

  it('should translate template keys', async () => {
    const plugin = i18nPlugin({
      defaultLang: 'en',
      translations: {
        saved: { ko: '저장 완료', en: 'Saved' },
      },
    });
    const mw = plugin.middleware![0];

    const ctx = {
      tool: { name: 'test' },
      params: {},
      meta: { _lang: 'ko' },
      result: '{{saved}}',
      duration: 0,
    } as any;
    // after는 ctx를 직접 수정하므로 spread하지 않고 원본 전달
    await mw.after!(ctx);
    expect(ctx.result).toBe('저장 완료');
  });
});

// ── queuePlugin ──

describe('queuePlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = queuePlugin();
    expect(plugin.meta.name).toBe('air:queue');
  });

  it('should allow calls within concurrency limit', async () => {
    const plugin = queuePlugin({ concurrency: { test: 2 } });
    const mw = plugin.middleware![0];

    const ctx1 = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    const ctx2 = { tool: { name: 'test' }, params: {}, meta: {} } as any;

    await mw.before!(ctx1);
    await mw.before!(ctx2);
    expect(ctx1.meta._queued).toBe(true);
    expect(ctx2.meta._queued).toBe(true);

    // release
    await mw.after!({ ...ctx1, result: 'ok', duration: 0 });
    await mw.after!({ ...ctx2, result: 'ok', duration: 0 });
  });

  it('should release on error', async () => {
    const plugin = queuePlugin({ concurrency: { test: 1 } });
    const mw = plugin.middleware![0];

    const ctx = { tool: { name: 'test' }, params: {}, meta: {} } as any;
    await mw.before!(ctx);
    await mw.onError!({ ...ctx, result: undefined, duration: 0 } as any, new Error('fail'));
    // should not deadlock — next call should work
  });
});

// ── dryrunPlugin ──

describe('dryrunPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = dryrunPlugin();
    expect(plugin.meta.name).toBe('air:dryrun');
  });

  it('should not intercept when disabled', async () => {
    const plugin = dryrunPlugin({ enabled: false, perCall: false });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { x: 1 }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result).toBeUndefined();
  });

  it('should intercept when _dryrun param is true', async () => {
    const plugin = dryrunPlugin();
    const mw = plugin.middleware![0];
    const ctx = {
      tool: { name: 'search', description: 'Search stuff', params: { query: { type: 'string' } } },
      params: { query: 'hello', _dryrun: true },
      meta: {},
    } as any;

    const result = await mw.before!(ctx);
    expect(result?.abort).toBe(true);
    expect(result?.abortResponse).toContain('Dryrun');
    expect(result?.abortResponse).toContain('search');
  });

  it('should intercept when globally enabled', async () => {
    const plugin = dryrunPlugin({ enabled: true });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: { x: 1 }, meta: {} } as any;

    const result = await mw.before!(ctx);
    expect(result?.abort).toBe(true);
  });
});
