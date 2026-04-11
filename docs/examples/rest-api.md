# Example: REST API Wrapper

Wrap an external REST API as MCP tools so AI can call your API.

## Create project

```bash
npx @airmcp-dev/cli create my-api-server --template api
cd my-api-server
npm install
```

## Full code

```typescript
// src/index.ts
import { defineServer, defineTool, retryPlugin, cachePlugin, timeoutPlugin } from '@airmcp-dev/core';

const BASE_URL = process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com';
const API_KEY = process.env.API_KEY || '';

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

const server = defineServer({
  name: 'my-api-server',
  version: '1.0.0',
  description: 'External API wrapped as MCP tools',

  transport: { type: 'sse', port: 3510 },
  logging: { level: 'info', format: 'json' },

  use: [
    timeoutPlugin(15_000),
    retryPlugin({ maxRetries: 2, retryOn: (err) => err.message.includes('fetch failed') }),
    cachePlugin({ ttlMs: 30_000, exclude: ['api_post'] }),
  ],

  tools: [
    defineTool('api_get', {
      description: 'Fetch data from the API (GET)',
      params: { path: { type: 'string', description: 'API path (e.g. /users, /posts/1)' } },
      handler: async ({ path }) => apiFetch(path),
    }),

    defineTool('api_post', {
      description: 'Create data via API (POST)',
      params: {
        path: { type: 'string', description: 'API path' },
        body: { type: 'string', description: 'Request body (JSON string)' },
      },
      handler: async ({ path, body }) => apiFetch(path, { method: 'POST', body }),
    }),

    defineTool('api_search', {
      description: 'Search the API with query parameters',
      params: {
        path: { type: 'string', description: 'API path' },
        query: { type: 'string', description: 'Query string (e.g. "q=hello&limit=10")' },
      },
      handler: async ({ path, query }) => {
        const sep = path.includes('?') ? '&' : '?';
        return apiFetch(`${path}${sep}${query}`);
      },
    }),
  ],
});

server.start();
```

## Run

```bash
npx @airmcp-dev/cli dev --console -p 3510

# With custom API
API_BASE_URL=https://api.example.com API_KEY=your-key npx @airmcp-dev/cli dev -p 3510
```

## Connect to Claude Desktop

```bash
npx @airmcp-dev/cli connect claude-desktop --transport sse --port 3510
```

## Plugin highlights

- `timeoutPlugin` — abort after 15s if API is slow
- `retryPlugin` — retry network errors 2x (200ms → 400ms backoff)
- `cachePlugin` — cache GET results for 30s. POST excluded via `exclude`

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `https://jsonplaceholder.typicode.com` | Base URL |
| `API_KEY` | (none) | Bearer token (optional) |
