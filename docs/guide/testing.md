# Writing Tests

air uses [vitest](https://vitest.dev) for testing. The `callTool` method makes it easy to test tools without starting a server.

## Setup

```bash
npm install -D vitest
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Or use the global vitest config (already included in the air monorepo):

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

## Testing a tool

```typescript
// __tests__/greet.test.ts
import { describe, it, expect } from 'vitest';
import { defineServer, defineTool } from '@airmcp-dev/core';

describe('greet tool', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('greet', {
        description: 'Say hello',
        params: { name: 'string' },
        handler: async ({ name }) => `Hello, ${name}!`,
      }),
    ],
  });

  it('should greet by name', async () => {
    const result = await server.callTool('greet', { name: 'World' });
    expect(result).toBe('Hello, World!');
  });

  it('should handle empty name', async () => {
    const result = await server.callTool('greet', { name: '' });
    expect(result).toBe('Hello, !');
  });
});
```

## Testing with plugins

Plugins are applied automatically when you use `callTool`:

```typescript
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

describe('caching', () => {
  let callCount = 0;

  const server = defineServer({
    name: 'test-server',
    use: [cachePlugin({ ttlMs: 5000 })],
    tools: [
      defineTool('counter', {
        handler: async () => {
          callCount++;
          return `called ${callCount} times`;
        },
      }),
    ],
  });

  it('should cache results', async () => {
    callCount = 0;
    const first = await server.callTool('counter', {});
    const second = await server.callTool('counter', {});

    expect(first).toBe('called 1 times');
    expect(second).toBe('called 1 times');  // Cached
    expect(callCount).toBe(1);
  });
});
```

## Testing defineTool in isolation

You can test `defineTool` without `defineServer`:

```typescript
import { describe, it, expect } from 'vitest';
import { defineTool } from '@airmcp-dev/core';

describe('defineTool', () => {
  it('should create a tool definition', () => {
    const tool = defineTool('search', {
      description: 'Search items',
      params: {
        q: { type: 'string', description: 'Query' },
        limit: { type: 'number', description: 'Max results' },
      },
      handler: async () => 'ok',
    });

    expect(tool.name).toBe('search');
    expect(tool.description).toBe('Search items');
    expect(tool.params!.q).toEqual({ type: 'string', description: 'Query' });
  });

  it('should execute the handler', async () => {
    const tool = defineTool('add', {
      handler: async ({ a, b }: any) => a + b,
    });

    const result = await tool.handler({ a: 2, b: 3 }, {
      requestId: 'test',
      serverName: 'test',
      startedAt: Date.now(),
      state: {},
    });
    expect(result).toBe(5);
  });
});
```

## Testing validation

Invalid params should throw:

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

describe('validation', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('typed', {
        params: { email: 'string', age: 'number' },
        handler: async ({ email, age }) => `${email} is ${age}`,
      }),
    ],
  });

  it('should reject invalid params', async () => {
    await expect(
      server.callTool('typed', { email: 123, age: 'not-a-number' })
    ).rejects.toThrow();
  });

  it('should accept valid params', async () => {
    const result = await server.callTool('typed', {
      email: 'test@example.com',
      age: 25,
    });
    expect(result).toBe('test@example.com is 25');
  });
});
```

## Testing with dryrunPlugin

Skip handler execution to test middleware only:

```typescript
import { defineServer, defineTool, dryrunPlugin, sanitizerPlugin } from '@airmcp-dev/core';

describe('middleware chain', () => {
  const server = defineServer({
    name: 'test-server',
    use: [
      sanitizerPlugin(),
      dryrunPlugin(),  // Handler is skipped, returns params
    ],
    tools: [
      defineTool('process', {
        params: { input: 'string' },
        handler: async () => 'never called',
      }),
    ],
  });

  it('should sanitize input', async () => {
    const result = await server.callTool('process', {
      input: '<script>alert("xss")</script>hello',
    });
    // Sanitized params are returned (handler skipped)
    expect(result.input).not.toContain('<script>');
  });
});
```

## Testing error handling

```typescript
import { defineServer, defineTool, McpErrors } from '@airmcp-dev/core';

describe('error handling', () => {
  const server = defineServer({
    name: 'test-server',
    tools: [
      defineTool('fail', {
        handler: async () => {
          throw McpErrors.forbidden('Not allowed');
        },
      }),
    ],
  });

  it('should throw AirError', async () => {
    await expect(server.callTool('fail', {})).rejects.toThrow('Not allowed');
  });

  it('should return error for unknown tool', async () => {
    await expect(server.callTool('nonexistent', {})).rejects.toThrow('not found');
  });
});
```

## Testing plugin middleware directly

Test plugin middleware hooks without `defineServer`:

```typescript
import { describe, it, expect } from 'vitest';
import { cachePlugin } from '@airmcp-dev/core';

describe('cachePlugin middleware', () => {
  it('first call is cache miss', async () => {
    const plugin = cachePlugin({ ttlMs: 60_000 });
    const mw = plugin.middleware![0];

    const ctx = { tool: { name: 'search' }, params: { q: 'hello' }, meta: {} } as any;
    const result = await mw.before!(ctx);
    expect(result?.abort).toBeUndefined();
    expect(ctx.meta._cacheKey).toBeDefined();
  });

  it('second call is cache hit', async () => {
    const plugin = cachePlugin({ ttlMs: 60_000 });
    const mw = plugin.middleware![0];

    const ctx1 = { tool: { name: 'search' }, params: { q: 'hello' }, meta: {} } as any;
    await mw.before!(ctx1);
    await mw.after!({ ...ctx1, result: 'cached-value', duration: 10 });

    const ctx2 = { tool: { name: 'search' }, params: { q: 'hello' }, meta: {} } as any;
    const result = await mw.before!(ctx2);
    expect(result?.abort).toBe(true);
    expect(result?.abortResponse).toBe('cached-value');
  });

  it('excluded tools bypass cache', async () => {
    const plugin = cachePlugin({ exclude: ['write'] });
    const mw = plugin.middleware![0];
    const ctx = { tool: { name: 'write' }, params: {}, meta: {} } as any;
    expect(await mw.before!(ctx)).toBeUndefined();
  });
});
```

## Testing FileStore

Use a temp directory and clean up after:

```typescript
import { describe, it, expect } from 'vitest';
import { FileStore } from '@airmcp-dev/core';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

describe('FileStore', () => {
  const testDir = join('/tmp', 'air-test-' + Date.now());

  it('set and get', async () => {
    const store = new FileStore(testDir);
    await store.init();
    await store.set('ns', 'key1', { name: 'test' });
    expect(await store.get('ns', 'key1')).toEqual({ name: 'test' });
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('list keys with prefix', async () => {
    const store = new FileStore(testDir);
    await store.init();
    await store.set('ns', 'user_1', { id: 1 });
    await store.set('ns', 'user_2', { id: 2 });
    await store.set('ns', 'post_1', { id: 1 });
    expect((await store.list('ns', 'user_')).length).toBe(2);
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('append and query logs', async () => {
    const store = new FileStore(testDir);
    await store.init();
    await store.append('audit', { action: 'login', user: 'alice' });
    await store.append('audit', { action: 'logout', user: 'alice' });
    expect((await store.query('audit')).length).toBe(2);
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });
});
```

## Testing resources and prompts

```typescript
import { describe, it, expect } from 'vitest';
import { defineResource, definePrompt } from '@airmcp-dev/core';

describe('defineResource', () => {
  it('(uri, options) form', () => {
    const r = defineResource('config://app', { name: 'config', handler: async () => 'data' });
    expect(r.uri).toBe('config://app');
    expect(r.name).toBe('config');
  });

  it('single object form', () => {
    const r = defineResource({ uri: 'file:///logs', name: 'logs', handler: async () => 'data' });
    expect(r.uri).toBe('file:///logs');
  });
});

describe('definePrompt', () => {
  it('executes handler', async () => {
    const p = definePrompt('greet', {
      handler: async ({ name }) => [{ role: 'user', content: `Hello ${name}` }],
    });
    const messages = await p.handler({ name: 'air' });
    expect(messages[0].content).toBe('Hello air');
  });
});
```

## Running tests

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# Run specific file
npx vitest run __tests__/greet.test.ts

# With coverage
npx vitest run --coverage
```
