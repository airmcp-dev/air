# 테스트 작성

air는 [vitest](https://vitest.dev)를 사용합니다. `callTool` 메서드로 서버를 시작하지 않고도 도구를 테스트할 수 있습니다.

## 설정

```bash
npm install -D vitest
```

`package.json`에 추가:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

## 도구 테스트

```typescript
// __tests__/greet.test.ts
import { describe, it, expect } from 'vitest';
import { defineServer, defineTool } from '@airmcp-dev/core';

describe('greet 도구', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('greet', {
        params: { name: 'string' },
        handler: async ({ name }) => `안녕하세요, ${name}!`,
      }),
    ],
  });

  it('이름으로 인사해야 함', async () => {
    const result = await server.callTool('greet', { name: '세계' });
    expect(result).toBe('안녕하세요, 세계!');
  });
});
```

## 플러그인이 적용된 테스트

`callTool`은 플러그인을 자동 적용합니다:

```typescript
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

describe('캐싱', () => {
  let callCount = 0;

  const server = defineServer({
    name: 'test-server',
    use: [cachePlugin({ ttlMs: 5000 })],
    tools: [
      defineTool('counter', {
        handler: async () => { callCount++; return `${callCount}번 호출됨`; },
      }),
    ],
  });

  it('결과를 캐싱해야 함', async () => {
    callCount = 0;
    const first = await server.callTool('counter', {});
    const second = await server.callTool('counter', {});
    expect(first).toBe('1번 호출됨');
    expect(second).toBe('1번 호출됨');  // 캐시됨
    expect(callCount).toBe(1);
  });
});
```

## defineTool 단독 테스트

`defineServer` 없이 `defineTool`만 테스트:

```typescript
import { defineTool } from '@airmcp-dev/core';

describe('defineTool', () => {
  it('도구 정의를 생성해야 함', () => {
    const tool = defineTool('search', {
      description: '검색',
      params: { q: { type: 'string', description: '검색어' } },
      handler: async () => 'ok',
    });
    expect(tool.name).toBe('search');
    expect(tool.params!.q).toEqual({ type: 'string', description: '검색어' });
  });

  it('핸들러를 실행해야 함', async () => {
    const tool = defineTool('add', {
      handler: async ({ a, b }: any) => a + b,
    });
    const result = await tool.handler({ a: 2, b: 3 }, {
      requestId: 'test', serverName: 'test', startedAt: Date.now(), state: {},
    });
    expect(result).toBe(5);
  });
});
```

## 검증 테스트

잘못된 파라미터는 에러를 던져야 합니다:

```typescript
describe('검증', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('typed', {
        params: { email: 'string', age: 'number' },
        handler: async ({ email, age }) => `${email}은 ${age}세`,
      }),
    ],
  });

  it('잘못된 파라미터를 거부해야 함', async () => {
    await expect(
      server.callTool('typed', { email: 123, age: 'not-a-number' })
    ).rejects.toThrow();
  });

  it('올바른 파라미터를 받아야 함', async () => {
    const result = await server.callTool('typed', { email: 'test@example.com', age: 25 });
    expect(result).toBe('test@example.com은 25세');
  });
});
```

## dryrunPlugin으로 미들웨어 테스트

핸들러 실행을 건너뛰고 미들웨어만 테스트:

```typescript
import { defineServer, defineTool, dryrunPlugin, sanitizerPlugin } from '@airmcp-dev/core';

describe('미들웨어 체인', () => {
  const server = defineServer({
    name: 'test-server',
    use: [sanitizerPlugin(), dryrunPlugin()],
    tools: [
      defineTool('process', {
        params: { input: 'string' },
        handler: async () => 'never called',
      }),
    ],
  });

  it('입력을 새니타이즈해야 함', async () => {
    const result = await server.callTool('process', {
      input: '<script>alert("xss")</script>hello',
    });
    expect(result.input).not.toContain('<script>');
  });
});
```

## 에러 처리 테스트

```typescript
import { defineServer, defineTool, McpErrors } from '@airmcp-dev/core';

describe('에러 처리', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('fail', {
        handler: async () => { throw McpErrors.forbidden('허용되지 않음'); },
      }),
    ],
  });

  it('AirError를 던져야 함', async () => {
    await expect(server.callTool('fail', {})).rejects.toThrow('허용되지 않음');
  });

  it('없는 도구에 에러 반환', async () => {
    await expect(server.callTool('nonexistent', {})).rejects.toThrow('not found');
  });
});
```

## 스토리지 테스트

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '@airmcp-dev/core';

describe('MemoryStore', () => {
  let store: MemoryStore;
  beforeEach(async () => { store = new MemoryStore(); await store.init(); });

  it('값을 저장하고 조회해야 함', async () => {
    await store.set('test', 'key1', { name: 'Alice' });
    const result = await store.get('test', 'key1');
    expect(result).toEqual({ name: 'Alice' });
  });

  it('없는 키는 null을 반환해야 함', async () => {
    const result = await store.get('test', 'missing');
    expect(result).toBeNull();
  });

  it('키를 나열해야 함', async () => {
    await store.set('users', 'u1', { name: 'Alice' });
    await store.set('users', 'u2', { name: 'Bob' });
    const keys = await store.list('users');
    expect(keys).toHaveLength(2);
  });

  it('로그를 추가하고 조회해야 함', async () => {
    await store.append('audit', { tool: 'search', timestamp: Date.now() });
    await store.append('audit', { tool: 'greet', timestamp: Date.now() });
    const logs = await store.query('audit', { limit: 10 });
    expect(logs).toHaveLength(2);
  });
});
```

## 플러그인 미들웨어 직접 테스트

플러그인의 미들웨어 훅을 `defineServer` 없이 직접 테스트할 수 있습니다:

```typescript
import { describe, it, expect } from 'vitest';
import { cachePlugin } from '@airmcp-dev/core';

describe('cachePlugin 미들웨어', () => {
  it('첫 호출은 캐시 미스', async () => {
    const plugin = cachePlugin({ ttlMs: 60_000 });
    const mw = plugin.middleware![0];

    const ctx = {
      tool: { name: 'search' },
      params: { q: 'hello' },
      meta: {},
    } as any;

    const result = await mw.before!(ctx);
    expect(result?.abort).toBeUndefined();  // 캐시 미스 → 통과
    expect(ctx.meta._cacheKey).toBeDefined();
  });

  it('두 번째 호출은 캐시 히트', async () => {
    const plugin = cachePlugin({ ttlMs: 60_000 });
    const mw = plugin.middleware![0];

    // 첫 호출 → 캐시 저장
    const ctx1 = { tool: { name: 'search' }, params: { q: 'hello' }, meta: {} } as any;
    await mw.before!(ctx1);
    await mw.after!({ ...ctx1, result: 'cached-value', duration: 10 });

    // 두 번째 호출 → 캐시 히트
    const ctx2 = { tool: { name: 'search' }, params: { q: 'hello' }, meta: {} } as any;
    const result = await mw.before!(ctx2);
    expect(result?.abort).toBe(true);
    expect(result?.abortResponse).toBe('cached-value');
  });

  it('제외된 도구는 캐시 안 함', async () => {
    const plugin = cachePlugin({ exclude: ['write'] });
    const mw = plugin.middleware![0];

    const ctx = { tool: { name: 'write' }, params: {}, meta: {} } as any;
    const result = await mw.before!(ctx);
    expect(result).toBeUndefined();
  });
});
```

## FileStore 테스트

임시 디렉토리를 사용하고 테스트 후 정리합니다:

```typescript
import { describe, it, expect } from 'vitest';
import { FileStore } from '@airmcp-dev/core';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

describe('FileStore', () => {
  const testDir = join('/tmp', 'air-test-' + Date.now());

  it('값을 저장하고 조회', async () => {
    const store = new FileStore(testDir);
    await store.init();
    await store.set('ns', 'key1', { name: 'test' });
    expect(await store.get('ns', 'key1')).toEqual({ name: 'test' });
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('프리픽스로 키 검색', async () => {
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

  it('로그 추가 및 조회', async () => {
    const store = new FileStore(testDir);
    await store.init();
    await store.append('audit', { action: 'login', user: 'alice' });
    await store.append('audit', { action: 'logout', user: 'alice' });
    const logs = await store.query('audit');
    expect(logs.length).toBe(2);
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });
});
```

## 리소스 & 프롬프트 테스트

```typescript
import { describe, it, expect } from 'vitest';
import { defineResource, definePrompt } from '@airmcp-dev/core';

describe('defineResource', () => {
  it('(uri, options) 형식', () => {
    const r = defineResource('config://app', {
      name: 'config',
      handler: async () => 'data',
    });
    expect(r.uri).toBe('config://app');
    expect(r.name).toBe('config');
  });

  it('단일 객체 형식', () => {
    const r = defineResource({
      uri: 'file:///logs',
      name: 'logs',
      handler: async () => 'log data',
    });
    expect(r.uri).toBe('file:///logs');
  });
});

describe('definePrompt', () => {
  it('핸들러 실행', async () => {
    const p = definePrompt('greet', {
      handler: async ({ name }) => [
        { role: 'user', content: `Hello ${name}` },
      ],
    });
    const messages = await p.handler({ name: 'air' });
    expect(messages[0].content).toBe('Hello air');
  });
});
```

## 테스트 실행

```bash
npx vitest run                              # 전체 테스트
npx vitest                                   # 워치 모드
npx vitest run __tests__/greet.test.ts      # 특정 파일
npx vitest run --coverage                    # 커버리지 포함
```
