# air MCP Framework — AI Context Document

> This document is a concise reference for AI coding assistants (Claude, Cursor, GitHub Copilot, etc.) to accurately use the air framework.
> Include this file in your project so AI understands air's APIs.

## What is air?

air is a TypeScript framework for building MCP (Model Context Protocol) servers. With `@airmcp-dev/core` alone, you can define tools, resources, and prompts, and add retry/cache/auth with 19 built-in plugins in one line each.

- **Packages**: `@airmcp-dev/core`, `@airmcp-dev/cli`, `@airmcp-dev/gateway`, `@airmcp-dev/logger`, `@airmcp-dev/meter`
- **Runtime**: Node.js 18+, TypeScript ESM
- **MCP SDK**: Uses `@modelcontextprotocol/sdk ^1.12.0` internally
- **License**: Apache-2.0

## Core API

### defineServer

```typescript
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',              // Required
  version: '1.0.0',               // Default: '0.1.0'
  description: 'Server description',
  transport: { type: 'sse', port: 3510 },  // 'stdio' | 'sse' | 'http' | 'auto'
  storage: { type: 'file', path: '.air/data' },  // 'memory' | 'file'
  logging: { level: 'info', format: 'json' },
  meter: { classify: true, trackCalls: true },
  use: [ /* Plugin array — order = execution order */ ],
  middleware: [ /* Custom middleware */ ],
  tools: [ /* defineTool array */ ],
  resources: [ /* defineResource array */ ],
  prompts: [ /* definePrompt array */ ],
});

server.start();
```

### defineTool

```typescript
defineTool('search', {
  description: 'Search documents',
  params: {
    query: 'string',                    // Shorthand
    limit: 'number?',                   // ? = optional
    email: { type: 'string', description: 'Email', optional: true },  // Object form
    tags: z.array(z.string()),          // Zod also works
  },
  layer: 4,                             // L1-L7 Meter hint (optional)
  handler: async ({ query, limit }, context) => {
    // context: { requestId, serverName, startedAt, state }
    // Return value auto-converts to MCP content:
    //   string → text, number/boolean → String, object/array → JSON.stringify
    //   { text } → text, { image, mimeType } → image, { content: [...] } → passthrough
    return await doSearch(query, limit);
  },
});
```

**ParamShorthand**: `'string'`, `'string?'`, `'number'`, `'number?'`, `'boolean'`, `'boolean?'`, `'object'`, `'object?'`

### defineResource

```typescript
defineResource('file:///{path}', {
  name: 'file',
  mimeType: 'text/plain',
  handler: async (uri, ctx) => {
    const vars = matchTemplate('file:///{path}', uri);  // { path: '...' } | null
    return readFile(vars!.path, 'utf-8');  // string → text/plain
  },
});
```

### definePrompt

```typescript
definePrompt('summarize', {
  description: 'Summarize text',
  arguments: [{ name: 'text', required: true }],  // All string type
  handler: ({ text }) => [
    { role: 'user', content: `Summarize: ${text}` },
  ],
});
```

## 19 Built-in Plugins

```typescript
import {
  // Stability
  timeoutPlugin,         // timeoutPlugin(30_000) — ms
  retryPlugin,           // retryPlugin({ maxRetries: 3, delayMs: 200, retryOn?: (err) => bool })
  circuitBreakerPlugin,  // circuitBreakerPlugin({ failureThreshold: 5, resetTimeoutMs: 30_000, perTool: true })
  fallbackPlugin,        // fallbackPlugin({ 'primary_tool': 'backup_tool' }) — tool name → fallback tool map

  // Performance
  cachePlugin,           // cachePlugin({ ttlMs: 60_000, maxEntries: 1000, exclude: ['write'] })
  dedupPlugin,           // dedupPlugin({ windowMs: 1000 })
  queuePlugin,           // queuePlugin({ concurrency: { 'db': 3, '*': 10 }, maxQueueSize: 100, queueTimeoutMs: 30_000 })

  // Security
  authPlugin,            // authPlugin({ type: 'api-key', keys: [process.env.KEY!], publicTools: ['ping'], paramName: '_auth' })
  sanitizerPlugin,       // sanitizerPlugin({ stripHtml: true, stripControl: true, maxStringLength: 10_000, exclude: [] })
  validatorPlugin,       // validatorPlugin({ rules: [{ tool: '*', validate: (p) => errorMsg | undefined }] })

  // Network
  corsPlugin,            // corsPlugin({ origins: ['*'], methods: ['GET','POST','OPTIONS'], credentials: false })
  webhookPlugin,         // webhookPlugin({ url, events: ['tool.call','tool.error','tool.slow'], slowThresholdMs: 5000, batchSize: 1 })

  // Data
  transformPlugin,       // transformPlugin({ before: { '*': (p) => p }, after: { 'tool': (r) => r } })
  i18nPlugin,            // i18nPlugin({ defaultLang: 'en', translations: { key: { en: '', ko: '' } }, langParam: '_lang' })

  // Monitoring
  jsonLoggerPlugin,      // jsonLoggerPlugin({ output: 'stderr', logParams: false, extraFields: {} })
  perUserRateLimitPlugin,// perUserRateLimitPlugin({ maxCalls: 10, windowMs: 60_000, identifyBy: '_userId' })

  // Dev
  dryrunPlugin,          // dryrunPlugin({ enabled: false, perCall: true, mockResponse?: (tool, params) => any })
} from '@airmcp-dev/core';
```

**Recommended order**: `authPlugin → sanitizerPlugin → timeoutPlugin → retryPlugin → cachePlugin → queuePlugin`

## Storage

```typescript
import { createStorage, MemoryStore, FileStore } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/data' });

// Key-Value
await store.set('namespace', 'key', value, ttlSeconds?);  // TTL in seconds!
await store.get('namespace', 'key');          // T | null
await store.delete('namespace', 'key');       // boolean
await store.list('namespace', 'prefix?');     // string[]
await store.entries('namespace', 'prefix?');  // { key, value }[]

// Append-Only Log
await store.append('logs', { action: 'login' });  // Auto-adds _ts
await store.query('logs', { limit: 100, since?: Date, filter?: { action: 'login' } });

await store.close();  // FileStore: immediate flush + stop timer
```

## Middleware

```typescript
const myMiddleware: AirMiddleware = {
  name: 'my-mw',
  before: async (ctx) => {
    // ctx: { tool, params, requestId, serverName, startedAt, meta }
    // return undefined → continue
    // return { params: {...} } → replace params
    // return { abort: true, abortResponse: '...' } → stop chain
  },
  after: async (ctx) => {
    // ctx also has: result, duration
  },
  onError: async (ctx, error) => {
    // return value → convert to normal response
    // return undefined → pass to next error handler
  },
};
```

## Errors

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

throw McpErrors.toolNotFound('name');        // -32601
throw McpErrors.invalidParams('bad email');  // -32602
throw McpErrors.internal('db failed');       // -32603
throw McpErrors.forbidden('denied');         // -32000
throw McpErrors.rateLimited('tool', 5000);   // -32001
throw McpErrors.timeout('tool', 30000);      // -32003
throw new AirError('custom', -32010, { detail: 'value' });
```

## onShutdown

```typescript
import { onShutdown } from '@airmcp-dev/core';

onShutdown(async () => {
  await store.close();
  await db.disconnect();
});
```

## CLI

```bash
npx @airmcp-dev/cli create my-server --template basic --lang ko
npx @airmcp-dev/cli dev --console -p 3510
npx @airmcp-dev/cli connect claude-desktop
npx @airmcp-dev/cli connect cursor --transport sse --port 3510
npx @airmcp-dev/cli start / stop / status / list / inspect <tool>
```

**Supported clients**: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## Gateway

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',  // 'round-robin' | 'least-connections' | 'weighted' | 'random'
});

gateway.register({
  id: 'search-1', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});
// stdio: connection: { type: 'stdio', command: 'node', args: ['dist/index.js'] }

await gateway.start();
```

## Metrics

```typescript
import { getMetrics, resetMetrics, getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

getMetrics();          // { toolName: { calls, errors, totalDuration, avgDuration, lastCalledAt } }
getMetricsSnapshot();  // { totalCalls, successRate, avgLatencyMs, layerDistribution, toolCounts }
```

## Custom Plugin

```typescript
function myPlugin(options?: MyOptions): AirPlugin {
  return {
    meta: { name: 'my-plugin', version: '1.0.0' },
    middleware: [{ name: 'my:mw', before, after, onError }],
    hooks: {
      onInit: async (ctx) => { ctx.state.db = createPool(); },
      onStop: async (ctx) => { await ctx.state.db.close(); },
      onToolRegister: (tool, ctx) => ({ ...tool, description: `[Enhanced] ${tool.description}` }),
    },
    tools: [{ name: '_status', handler: async () => 'ok' }],
  };
}
```

## Gotchas

- ESM project: `"type": "module"`, `.js` extension required in imports
- Never use `console.log()` in stdio mode → breaks MCP protocol. Use `console.error()`
- `cachePlugin({ ttlMs })` = milliseconds, `store.set(ns, key, val, ttl)` = seconds
- `authPlugin`'s `_auth` param must be defined in tool params for MCP client passthrough
- `fallbackPlugin` maps tool names, not values: `{ 'primary': 'backup' }`
- `queuePlugin`'s `concurrency` is a map: `{ 'db': 3, '*': 10 }`
