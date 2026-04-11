---
title: "70 Lines to 15: Why I Built a Framework on Top of the MCP SDK"
published: true
tags: typescript, ai, opensource, mcp
---

Last month I was building my third MCP server. Same boilerplate again — Zod schema, content wrapping, try/catch, transport setup. For every single tool.

I stopped and counted. **~70 lines of code per tool** with the MCP SDK. Most of it was ceremony, not logic.

So I built [air](https://github.com/airmcp-dev/air).

## The Problem

Here's what a basic search tool looks like with the MCP SDK:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool(
  'search',
  'Search documents',
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(results) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

That's one tool. Now add retry logic. Caching. Authentication. Rate limiting. Logging. Each one is another 20-50 lines of manual implementation, in every handler.

## The Solution

Same tool in air:

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

15 lines. Retry and caching included. No Zod import, no content wrapping, no try/catch boilerplate.

## What Changed

**Parameter shorthand** — Instead of `z.string()`, just write `'string'`. Optional? `'number?'`. air generates the Zod schema and JSON schema internally.

**Auto content conversion** — Return a string, number, object, array, null — air wraps it into MCP content format. No more `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`.

**Plugin system** — 19 built-in plugins. Add them to the `use` array:

```typescript
use: [
  authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
  sanitizerPlugin(),
  timeoutPlugin(10_000),
  retryPlugin({ maxRetries: 3 }),
  cachePlugin({ ttlMs: 60_000 }),
]
```

Order matters — first plugin runs first. Auth before sanitizer before timeout before retry before cache.

**Built-in storage** — MemoryStore and FileStore out of the box:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });
await store.set('users', 'u1', { name: 'Alice' }, 3600); // TTL in seconds
await store.append('logs', { action: 'login' });          // append-only log
```

## Testing with a Local LLM

I connected air to llama3.1 running locally via Ollama. Defined 4 tools — system info, note management, calculator, metrics. Sent natural language queries.

The LLM correctly:
- Called `system_info` when asked "What's the CPU and memory?"
- Called `note_create` with proper title/content/tags when asked to create a note
- Called `calc` with `{ a: 1234, op: '*', b: 5678 }` when asked to multiply
- Called `note_list` when asked to show saved notes
- **Did not call any tool** when asked "What is MCP?" — answered from its own knowledge

Every tool call went through air's plugin pipeline — sanitizer, timeout, retry, cache — automatically.

## What's in the Box

- **19 plugins**: timeout, retry, circuit breaker, fallback, cache, dedup, queue, auth, sanitizer, validator, cors, webhook, transform, i18n, json logger, per-user rate limit, dryrun
- **3 transports**: stdio, SSE, Streamable HTTP (auto-detection)
- **Storage**: MemoryStore, FileStore with TTL and append-only logs
- **7-Layer Meter**: classify calls from L1 (cache hit) to L7 (agent chain) for cost tracking
- **CLI**: `npx @airmcp-dev/cli create my-server` — scaffolding, dev mode, client registration
- **Gateway**: multi-server proxy with load balancing and health checks

## Numbers

- 5 npm packages, Apache-2.0
- 165 tests passing
- 0 security vulnerabilities (all 93 dependencies are MIT/ISC/BSD/Apache-2.0)
- [110-page documentation](https://docs.airmcp.dev) in English and Korean
- Verified every API signature against source code

## Try It

```bash
npm install @airmcp-dev/core
```

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'hello',
  tools: [
    defineTool('greet', {
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

- [GitHub](https://github.com/airmcp-dev/air)
- [Documentation](https://docs.airmcp.dev)
- [npm](https://www.npmjs.com/package/@airmcp-dev/core)

---

If you've built MCP servers and felt the boilerplate pain, I'd love to hear your thoughts. Star the repo if it looks useful. Issues and PRs welcome.
