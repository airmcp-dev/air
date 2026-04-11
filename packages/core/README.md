# @airmcp-dev/core

TypeScript framework for building MCP servers.

One function per tool. One line per plugin. Security, caching, retry — all built in.

## Install

```bash
npm install @airmcp-dev/core
```

## Quick Example

```typescript
import { defineServer, defineTool, retryPlugin, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: { query: 'string', limit: 'number?' },
      handler: async ({ query, limit }) => doSearch(query, limit),
    }),
  ],
});

server.start();
```

## Features

- **defineTool** — string shorthand params (`'string'`, `'number?'`), auto Zod validation, auto MCP content conversion
- **19 built-in plugins** — timeout, retry, cache, auth, rate limit, circuit breaker, webhook, i18n, and more
- **Multi-transport** — stdio, SSE, HTTP with auto-detection
- **Storage** — MemoryStore and FileStore (JSON + JSONL append-only logs)
- **7-Layer Meter** — auto-classify calls from L1 (cache) to L7 (agent chain)
- **Middleware** — before/after/onError hooks with abort and param modification
- **Error handling** — AirError, McpErrors factory, auto error boundary

## 19 Plugins

| Category | Plugins |
|----------|---------|
| Stability | timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin |
| Performance | cachePlugin, dedupPlugin, queuePlugin |
| Security | authPlugin, sanitizerPlugin, validatorPlugin |
| Network | corsPlugin, webhookPlugin |
| Data | transformPlugin, i18nPlugin |
| Monitoring | jsonLoggerPlugin, perUserRateLimitPlugin |
| Dev/Test | dryrunPlugin |

## Documentation

Full docs: **[docs.airmcp.dev](https://docs.airmcp.dev)** — 110 pages, EN/KO bilingual

## Part of the air ecosystem

| Package | Description |
|---------|-------------|
| **@airmcp-dev/core** | Server, tools, plugins, storage, transport |
| [@airmcp-dev/cli](https://www.npmjs.com/package/@airmcp-dev/cli) | CLI (create, dev, connect, inspect) |
| [@airmcp-dev/gateway](https://www.npmjs.com/package/@airmcp-dev/gateway) | Multi-server proxy, load balancing |
| [@airmcp-dev/logger](https://www.npmjs.com/package/@airmcp-dev/logger) | Structured logging |
| [@airmcp-dev/meter](https://www.npmjs.com/package/@airmcp-dev/meter) | 7-layer classification, cost tracking |

## License

Apache-2.0 — [GitHub](https://github.com/airmcp-dev/air)
