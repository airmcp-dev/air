# Example: Multi-Server Gateway

Unify multiple MCP servers behind a single Gateway endpoint. Develop and deploy each server independently — clients connect to one Gateway.

## Architecture

```
Claude Desktop → Gateway (:4000) → search-server  (:3510, SSE)
                                 → files-server   (:3511, SSE)
                                 → analytics       (stdio)
```

## Project structure

```
my-mcp-platform/
├── servers/
│   ├── search/
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── files/
│   │   ├── src/index.ts
│   │   └── package.json
│   └── analytics/
│       ├── src/index.ts
│       └── package.json
├── gateway/
│   ├── src/index.ts
│   └── package.json
└── package.json              # Workspace root
```

## 1. Search server

```typescript
// servers/search/src/index.ts
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'search-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },

  use: [cachePlugin({ ttlMs: 30_000, exclude: ['search_reindex'] })],

  tools: [
    defineTool('search', {
      description: 'Full-text search across titles and body',
      params: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      handler: async ({ query, limit }) => {
        return { results: [], total: 0, query };
      },
    }),

    defineTool('search_reindex', {
      description: 'Rebuild the search index',
      handler: async () => {
        return { status: 'reindexing', startedAt: new Date().toISOString() };
      },
    }),
  ],
});

server.start();
```

## 2. Files server

```typescript
// servers/files/src/index.ts
import { defineServer, defineTool, defineResource, matchTemplate } from '@airmcp-dev/core';
import { readFile, readdir } from 'node:fs/promises';

const server = defineServer({
  name: 'files-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3511 },

  tools: [
    defineTool('read_file', {
      description: 'Read file contents',
      params: { path: { type: 'string', description: 'File path' } },
      handler: async ({ path }) => readFile(path, 'utf-8'),
    }),

    defineTool('list_files', {
      description: 'List directory contents',
      params: { dir: { type: 'string', description: 'Directory path' } },
      handler: async ({ dir }) => {
        const files = await readdir(dir, { withFileTypes: true });
        return files.map(f => ({ name: f.name, type: f.isDirectory() ? 'directory' : 'file' }));
      },
    }),
  ],

  resources: [
    defineResource('file:///{path}', {
      name: 'file-content',
      description: 'File content as resource',
      handler: async (uri) => {
        const vars = matchTemplate('file:///{path}', uri);
        if (!vars) return 'Not found';
        return readFile(vars.path, 'utf-8');
      },
    }),
  ],
});

server.start();
```

## 3. Analytics server (stdio)

```typescript
// servers/analytics/src/index.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'analytics-server',
  version: '1.0.0',
  transport: { type: 'stdio' },  // Gateway launches as child process

  tools: [
    defineTool('aggregate', {
      description: 'Aggregate metrics data',
      layer: 4,
      params: {
        metric: { type: 'string', description: 'Metric name' },
        period: { type: 'string', description: 'Period (e.g. 7d, 30d, 1y)' },
      },
      handler: async ({ metric, period }) => {
        return { metric, period, value: Math.random() * 1000, unit: 'count' };
      },
    }),
  ],
});

server.start();
```

## 4. Gateway

```typescript
// gateway/src/index.ts
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  name: 'my-platform-gateway',
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

// SSE servers
gateway.register({
  id: 'search-1',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});

gateway.register({
  id: 'files-1',
  name: 'files',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3511' },
});

// stdio server
gateway.register({
  id: 'analytics-1',
  name: 'analytics',
  transport: 'stdio',
  connection: {
    type: 'stdio',
    command: 'node',
    args: ['../servers/analytics/dist/index.js'],
  },
});

await gateway.start();
console.log('Gateway listening on port 4000');
console.log('Registered servers:', gateway.list().map(s => `${s.name} (${s.status})`));
```

## Running

```bash
# 1. Build each server
cd servers/search && npx tsc && cd ../..
cd servers/files && npx tsc && cd ../..
cd servers/analytics && npx tsc && cd ../..

# 2. Start SSE servers
cd servers/search && node dist/index.js &
cd servers/files && node dist/index.js &

# 3. Start Gateway (analytics launches automatically via stdio)
cd gateway && node dist/index.js
```

## Connect Claude Desktop

```bash
# Connect to Gateway — all tools available through one endpoint
npx @airmcp-dev/cli connect claude-desktop --transport http --port 4000
```

Usage in Claude:
- "Search for hello" → Gateway → search-server → `search`
- "Read README.md" → Gateway → files-server → `read_file`
- "Aggregate sales for the last 30 days" → Gateway → analytics-server → `aggregate`

## Load balancing

Register multiple servers with the same name for automatic load balancing:

```typescript
gateway.register({ id: 'search-1', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://server1:3510' } });
gateway.register({ id: 'search-2', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://server2:3510' } });
// → search calls alternate between server1 and server2
```

## Failover

- Server down → health check detects within 15s → `error` status → removed from routing pool
- Server recovers → next health check passes → `connected` → routing pool restored
- If `search-1` is down but `search-2` is healthy, tool calls continue uninterrupted
