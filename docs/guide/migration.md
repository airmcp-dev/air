# Migrate from MCP SDK

Guide for converting existing `@modelcontextprotocol/sdk` servers to air.

## Key differences

| | MCP SDK direct | air |
|---|---|---|
| **Tool definition** | `server.tool(name, desc, zodSchema, handler)` | `defineTool(name, { params, handler })` |
| **Parameters** | Manual Zod schemas | `'string'`, `'number?'` shorthand (Zod also works) |
| **Return value** | `{ content: [{ type: 'text', text: '...' }] }` manual | Return anything → auto-converted |
| **Error handling** | try/catch in every handler | Built-in error boundary middleware |
| **Transport** | `StdioServerTransport` / Express setup | `transport: { type: 'sse' }` one line |
| **Retry/cache** | Manual implementation | `use: [retryPlugin(), cachePlugin()]` |

## Before / After

### Tool definition

**MCP SDK:**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool('search', 'Search documents',
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
);
```

**air:**

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
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

### Transport

**MCP SDK:** Manual `StdioServerTransport` or Express + `SSEServerTransport` setup.

**air:**

```typescript
defineServer({ transport: { type: 'sse', port: 3510 } });
```

### Resources

**MCP SDK:** `server.resource(new ResourceTemplate(...), handler)` with manual content wrapping.

**air:**

```typescript
defineResource('file:///{path}', {
  name: 'file',
  handler: async (uri) => readFile(matchTemplate('file:///{path}', uri)!.path, 'utf-8'),
});
```

## Step-by-step migration

### 1. Replace dependencies

```bash
npm uninstall @modelcontextprotocol/sdk
npm install @airmcp-dev/core
```

::: info
air uses `@modelcontextprotocol/sdk` internally. No need to depend on it directly.
:::

### 2. Change imports

```typescript
// Before
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// After
import { defineServer, defineTool } from '@airmcp-dev/core';
```

### 3. Convert server definition

```typescript
// Before
const server = new McpServer({ name: 'my-server', version: '0.1.0' });
server.tool('search', '...', { query: z.string() }, handler);
await server.connect(new StdioServerTransport());

// After
const server = defineServer({
  name: 'my-server',
  tools: [defineTool('search', { params: { query: 'string' }, handler })],
});
server.start();
```

### 4. Remove error handling boilerplate

Remove try/catch from each handler. air handles it automatically.

### 5. Add plugins (optional)

Replace manually implemented retry/cache/auth with plugins:

```typescript
use: [retryPlugin({ maxRetries: 3 }), cachePlugin({ ttlMs: 60_000 }), authPlugin({ ... })]
```

## Compatibility

air uses `@modelcontextprotocol/sdk ^1.12.0` internally. MCP protocol compatibility is identical. Existing clients (Claude Desktop, Cursor, VS Code) work without changes.
