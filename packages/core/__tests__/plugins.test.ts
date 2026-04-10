// @airmcp-dev/core — __tests__/plugins.test.ts
// 빌트인 플러그인 + FileStore + definePrompt 테스트

import { describe, it, expect, vi } from 'vitest';
import { timeoutPlugin } from '../src/plugin/builtin/timeout.js';
import { retryPlugin } from '../src/plugin/builtin/retry.js';
import { cachePlugin } from '../src/plugin/builtin/cache.js';
import { corsPlugin } from '../src/plugin/builtin/cors.js';
import { FileStore } from '../src/storage/file-store.js';
import { createStorage } from '../src/storage/storage-adapter.js';
import { definePrompt } from '../src/prompt/define-prompt.js';
import { defineResource } from '../src/resource/define-resource.js';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

// ── 플러그인 테스트 ──

describe('timeoutPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = timeoutPlugin(5000);
    expect(plugin.meta.name).toBe('air:timeout');
    expect(plugin.middleware?.length).toBe(1);
  });

  it('should set timeout in meta during before', async () => {
    const plugin = timeoutPlugin(3000);
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'test' }, params: {}, meta: {} } as any;

    await mw.before!(ctx);
    expect(ctx.meta._timeoutMs).toBe(3000);
  });
});

describe('retryPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = retryPlugin({ maxRetries: 2 });
    expect(plugin.meta.name).toBe('air:retry');
    expect(plugin.middleware?.length).toBe(1);
  });

  it('should retry on error', async () => {
    const plugin = retryPlugin({ maxRetries: 2, delayMs: 10 });
    const mw = plugin.middleware![0];

    let callCount = 0;
    const ctx = {
      tool: {
        name: 'test',
        handler: async () => {
          callCount++;
          if (callCount < 2) throw new Error('fail');
          return 'success';
        },
      },
      params: {},
      meta: { _retryCount: 0 },
      requestId: 'r1',
      serverName: 's1',
      startedAt: Date.now(),
    } as any;

    // onError에서 재시도 — 성공하면 결과 반환, 실패하면 undefined
    const result = await mw.onError!(ctx, new Error('fail'));
    // retry 플러그인이 handler를 재호출하므로 callCount가 증가
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(ctx.meta._retryCount).toBe(1);
  });
});

describe('cachePlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = cachePlugin({ ttlMs: 5000 });
    expect(plugin.meta.name).toBe('air:cache');
  });

  it('should cache result on after hook', async () => {
    const plugin = cachePlugin({ ttlMs: 60000 });
    const mw = plugin.middleware![0];

    // 첫 호출 — cache miss
    const ctx1 = {
      tool: { name: 'search' },
      params: { q: 'hello' },
      meta: {},
    } as any;
    const beforeResult = await mw.before!(ctx1);
    expect(beforeResult?.abort).toBeUndefined();
    expect(ctx1.meta._cacheKey).toBeDefined();

    // after — 캐시 저장
    await mw.after!({ ...ctx1, result: 'cached-value', duration: 10 });

    // 두 번째 호출 — cache hit
    const ctx2 = {
      tool: { name: 'search' },
      params: { q: 'hello' },
      meta: {},
    } as any;
    const hitResult = await mw.before!(ctx2);
    expect(hitResult?.abort).toBe(true);
    expect(hitResult?.abortResponse).toBe('cached-value');
  });

  it('should exclude specified tools', async () => {
    const plugin = cachePlugin({ exclude: ['write'] });
    const mw = plugin.middleware![0];

    const ctx = {
      tool: { name: 'write' },
      params: { data: 'test' },
      meta: {},
    } as any;
    const result = await mw.before!(ctx);
    expect(result).toBeUndefined();
    expect(ctx.meta._cacheKey).toBeUndefined();
  });
});

describe('corsPlugin', () => {
  it('should create plugin with meta', () => {
    const plugin = corsPlugin({ origins: ['http://localhost:3000'] });
    expect(plugin.meta.name).toBe('air:cors');
  });

  it('should set CORS config on init', async () => {
    const plugin = corsPlugin({ origins: ['http://example.com'] });
    const ctx = { state: {} } as any;
    await plugin.hooks!.onInit!(ctx);

    expect(ctx.state._cors.origins).toContain('http://example.com');
    expect(ctx.state._cors.methods).toContain('POST');
  });
});

// ── FileStore 테스트 ──

describe('FileStore', () => {
  const testDir = join('/tmp', 'air-test-filestore-' + Date.now());

  it('should set and get a value', async () => {
    const store = new FileStore(testDir);
    await store.init();

    await store.set('ns', 'key1', { name: 'test' });
    const result = await store.get('ns', 'key1');
    expect(result).toEqual({ name: 'test' });

    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should return null for missing key', async () => {
    const store = new FileStore(testDir);
    await store.init();

    const result = await store.get('ns', 'missing');
    expect(result).toBeNull();

    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should list keys with prefix', async () => {
    const store = new FileStore(testDir);
    await store.init();

    await store.set('ns', 'user_1', { id: 1 });
    await store.set('ns', 'user_2', { id: 2 });
    await store.set('ns', 'post_1', { id: 1 });

    const keys = await store.list('ns', 'user_');
    expect(keys.length).toBe(2);

    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should delete a key', async () => {
    const store = new FileStore(testDir);
    await store.init();

    await store.set('ns', 'key1', 'value');
    await store.delete('ns', 'key1');
    const result = await store.get('ns', 'key1');
    expect(result).toBeNull();

    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should append and query logs', async () => {
    const store = new FileStore(testDir);
    await store.init();

    await store.append('audit', { action: 'login', user: 'alice' });
    await store.append('audit', { action: 'logout', user: 'alice' });

    const logs = await store.query('audit');
    expect(logs.length).toBe(2);
    // 두 항목 모두 존재하는지 확인 (타임스탬프가 같을 수 있어 순서 무관)
    const actions = logs.map((l: any) => l.action).sort();
    expect(actions).toEqual(['login', 'logout']);

    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });
});

// ── createStorage 팩토리 테스트 ──

describe('createStorage', () => {
  it('should create MemoryStore by default', async () => {
    const store = await createStorage();
    await store.set('ns', 'key', 'value');
    expect(await store.get('ns', 'key')).toBe('value');
    await store.close();
  });

  it('should create FileStore when type is file', async () => {
    const testDir = join('/tmp', 'air-test-factory-' + Date.now());
    const store = await createStorage({ type: 'file', path: testDir });
    await store.set('ns', 'key', 'value');
    expect(await store.get('ns', 'key')).toBe('value');
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });
});

// ── definePrompt 테스트 ──

describe('definePrompt', () => {
  it('should accept (name, options) form', () => {
    const prompt = definePrompt('review', {
      description: 'Code review',
      args: [{ name: 'language' }],
      handler: async ({ language }) => [
        { role: 'user', content: `Review this ${language} code` },
      ],
    });

    expect(prompt.name).toBe('review');
    expect(prompt.description).toBe('Code review');
  });

  it('should accept object form', () => {
    const prompt = definePrompt({
      name: 'summarize',
      description: 'Summarize text',
      args: [{ name: 'text' }],
      handler: async ({ text }) => [
        { role: 'user', content: `Summarize: ${text}` },
      ],
    });

    expect(prompt.name).toBe('summarize');
  });

  it('should execute handler', async () => {
    const prompt = definePrompt('greet', {
      handler: async ({ name }) => [
        { role: 'user', content: `Hello ${name}` },
      ],
    });

    const messages = await prompt.handler({ name: 'air' });
    expect(messages[0].content).toBe('Hello air');
  });
});

// ── defineResource 테스트 ──

describe('defineResource', () => {
  it('should accept (uri, options) form', () => {
    const resource = defineResource('file:///config', {
      name: 'config',
      handler: async () => 'data',
    });

    expect(resource.uri).toBe('file:///config');
    expect(resource.name).toBe('config');
  });

  it('should accept object form', () => {
    const resource = defineResource({
      uri: 'file:///logs',
      name: 'logs',
      handler: async () => 'log data',
    });

    expect(resource.uri).toBe('file:///logs');
    expect(resource.name).toBe('logs');
  });
});
