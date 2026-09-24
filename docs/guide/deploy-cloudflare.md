# Deploy to Cloudflare Workers

Deploy your air MCP server to Cloudflare Workers for edge deployment with zero infrastructure management.

## Prerequisites

- Cloudflare account (free or paid)
- `wrangler` CLI: `npm install -g wrangler`
- `wrangler login` completed

## Quick Start

### 1. Create project

```bash
mkdir my-mcp-worker && cd my-mcp-worker
npm init -y
npm install @airmcp-dev/core
npm install -D wrangler typescript @cloudflare/workers-types
```

### 2. Configure wrangler.toml

```toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]
```

### 3. Write your server

```typescript
// src/index.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  transport: { type: 'workers' },
  tools: [
    defineTool('greet', {
      description: 'Greet someone by name',
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // MCP Streamable HTTP
    if (request.method === 'POST' && url.pathname === '/') {
      return server.fetch!(request);
    }

    // Server status
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json(server.status());
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

### 4. Deploy

```bash
wrangler deploy
```

Your MCP server is now live at `https://my-mcp-server.<your-subdomain>.workers.dev`.

## Transport

Use `transport: { type: 'workers' }`. This tells air to:

- Skip Node.js http server creation
- Expose `server.fetch()` for handling MCP requests
- Handle JSON-RPC 2.0 directly (no MCP SDK runtime dependency)
- Process `initialize`, `tools/list`, `tools/call` through air's middleware chain

::: warning
`stdio` and `sse` transports are **not supported** on Workers. Only `workers` transport works in this environment.
:::

::: tip
You don't need to call `server.start()` in Workers. The server is ready immediately.
:::

## Using D1 (SQLite)

For persistent storage, use Cloudflare D1:

### wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "your-database-id"
```

### Migration

```sql
-- migrations/001_init.sql
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

```bash
wrangler d1 create my-db
wrangler d1 execute my-db --file=./migrations/001_init.sql --remote
```

### In your server

```typescript
export interface Env {
  DB: D1Database;
}

let _db: D1Database;

const server = defineServer({
  name: 'my-server',
  transport: { type: 'workers' },
  tools: [
    defineTool('save', {
      params: { key: 'string', value: 'string' },
      handler: async ({ key, value }) => {
        await _db.prepare('INSERT INTO items (id, data) VALUES (?, ?)')
          .bind(key, value).run();
        return 'Saved';
      },
    }),
  ],
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    _db = env.DB;
    // ... routing
  },
};
```

## Using KV

For simple key-value storage:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

```typescript
export interface Env {
  KV: KVNamespace;
}
```

## Custom domain

1. Go to Cloudflare Dashboard → Workers → your worker → Settings → Domains
2. Add your custom domain (must be on Cloudflare DNS)
3. Your MCP server is now available at `https://your-domain.com`

## Connecting clients

```bash
# Any MCP client can connect via remote URL
npx mcp-remote https://your-domain.com
```

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-domain.com"]
    }
  }
}
```

## Limitations

- **No filesystem**: Use D1, KV, or R2 for storage
- **No long-running processes**: Each request is independent
- **No stdio/SSE**: Only `workers` transport
- **Execution time**: 30s (free) or 15min (paid) per request
- **Bundle size**: 10MB limit (air core is ~83KB, well within)

## Real-world example: SQ-MCP

[SQ-MCP](https://sq.infoshell.cloud) is a social intelligence assessment tool built with air + Workers + D1, serving as a reference implementation:

- 9 MCP tools (diagnosis, training, progress tracking)
- D1 for user progress persistence
- HTML test page served from Workers
- Deployed to Kakao PlayMCP
