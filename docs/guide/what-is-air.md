# What is air?

air is a TypeScript framework for building [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers.

## What is MCP?

MCP is an open protocol by Anthropic that lets AI agents (Claude, Cursor, VS Code Copilot, etc.) access external tools, data, and services. When you build an MCP server, AI can use your APIs, databases, file systems, and more as tools.

For example:
- Claude searching your company's internal database
- Cursor running CI/CD pipelines
- An AI agent calling external APIs

These are all MCP servers.

## The problem

Building an MCP server from scratch means using `@modelcontextprotocol/sdk` directly:

```typescript
// MCP SDK directly — 70+ lines
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

// Retry? Cache? Auth? Logging? All manual.
```

You need to:
- Define Zod schemas manually and convert results to MCP content format
- Write try/catch error handling in every tool
- Implement retry, cache, auth, rate limiting yourself
- Modify code to switch transports
- Add logging, metrics, graceful shutdown manually

## The solution

air builds the same server like this:

```typescript
// air — 20 lines
import { defineServer, defineTool, retryPlugin, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: { query: 'string', limit: 'number?' },
      handler: async ({ query, limit }) => {
        return await doSearch(query, limit);
      },
    }),
  ],
});

server.start();
```

What's different:
- Params use shorthand `'string'`, `'number?'` — auto-converted to Zod internally
- Handler return values (string, object, array) are auto-converted to MCP content
- Error handling is automatic via builtin middleware → MCP error codes
- Retry, cache are one line each in the `use` array
- Transport switches with one config line

## What can you build?

| Use case | Description | Template |
|----------|-------------|----------|
| Internal API wrapper | Expose REST APIs as MCP tools | `api` |
| DB management | AI performs CRUD operations | `crud` |
| File/document search | Search and summarize local files | `basic` |
| AI agent | Multi-step tasks (think-execute-remember) | `agent` |
| DevOps tools | CI/CD, monitoring, log analysis | `api` |
| Data analysis | Statistics, chart generation | `basic` |

## Packages

air is a monorepo with 5 packages. Install only `@airmcp-dev/core` to get started.

| Package | Description | License |
|---------|-------------|---------|
| `@airmcp-dev/core` | Server, tools, 19 plugins, storage, transport. Everything you need to build an MCP server | Apache-2.0 |
| `@airmcp-dev/cli` | CLI — project creation (`create`), dev mode (`dev`), client registration (`connect`), status check (`status`), and 12 commands total | Apache-2.0 |
| `@airmcp-dev/gateway` | Reverse proxy for multiple MCP servers. Health checks, load balancing, automatic failover | Apache-2.0 |
| `@airmcp-dev/logger` | Structured logger with JSON/pretty formats, file rotation, remote transport | Apache-2.0 |
| `@airmcp-dev/meter` | Auto-classifies every MCP call into L1 (cache) through L7 (agent chain). Token cost tracking, budget setting | Apache-2.0 |

## What defineServer handles automatically

When you call `defineServer()`, the framework sets up the following in order:

1. **Error boundary middleware** — catches all thrown errors and converts them to MCP protocol error codes (`-32601`, `-32602`, `-32603`, etc.). Logs go to stderr (stdout is reserved for MCP protocol)
2. **Input validation middleware** — converts `params` definitions to Zod schemas and validates every call. Returns `-32602 Invalid params` on failure
3. **Meter middleware** — when `meter` config is present, classifies every call into L1–L7 and tracks call volume and latency. Auto-classifies based on execution time if no `layer` hint
4. **Builtin logger plugin** — auto-logs every tool call. Level controlled by `logging.level` (debug/info/warn/error/silent). Pretty format in dev, JSON in production
5. **Builtin metrics plugin** — auto-collects per-tool call count, error rate, latency percentiles (p50/p95/p99). Access via `getMetrics()`
6. **User plugins** — middleware collected from plugins in the `use` array. Array order = execution order
7. **User middleware** — custom middleware from the `middleware` array (runs after plugins)
8. **Graceful shutdown** — on SIGTERM/SIGINT, runs registered cleanup functions in order before process exit

## Tech stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (ESM)
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.12.0
- **Validation**: Zod ^3.23
- **Build**: turbo (monorepo)
- **Test**: vitest
- **Package manager**: pnpm

## Next steps

- [Getting Started](/guide/getting-started) — create your first server in 5 minutes
- [Define a Server](/guide/server) — full defineServer options and AirServer interface
- [Tools](/guide/tools) — defineTool API, 3 parameter formats, handler context
- [Plugins](/guide/plugins) — 19 built-in plugins and execution order
- [Configuration](/guide/configuration) — air.config.ts and defaults
