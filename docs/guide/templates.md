# Templates

The `air create` command generates a project from a template. Each template is a ready-to-run MCP server.

## Available templates

| Template | Description |
|----------|-------------|
| `basic` | Minimal server with one tool. Good for learning. |
| `api` | External API wrapper. Includes fetch helper, env-based config. |
| `crud` | CRUD tools (create, read, update, delete) with in-memory storage. |
| `agent` | Think-execute-remember pattern. Agent-style with memory storage. |

## Usage

```bash
# Basic template (default)
air create my-server

# Specific template
air create my-server --template api

# Korean comments
air create my-server --template basic --lang ko
```

## Template structure

All templates generate the same project layout:

```
my-server/
├── src/
│   └── index.ts          # Server definition
├── package.json          # @airmcp-dev/core dependency
└── tsconfig.json         # TypeScript config
```

## basic

One tool, no plugins. The simplest starting point.

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '0.1.0',
  description: 'My first MCP server built with air',
  tools: [
    defineTool('hello', {
      description: 'Say hello',
      params: { name: { type: 'string', description: 'Your name' } },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

## api

External API wrapper. Uses a `fetch` helper with Bearer auth support.

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

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
  version: '0.1.0',
  tools: [
    defineTool('fetch', {
      description: 'Fetch data from the API',
      params: { path: { type: 'string', description: 'API endpoint (e.g. /users)' } },
      handler: async ({ path }) => apiFetch(path),
    }),
    defineTool('post', {
      description: 'Create data via API',
      params: {
        path: { type: 'string', description: 'API endpoint' },
        body: { type: 'string', description: 'JSON string of request body' },
      },
      handler: async ({ path, body }) => apiFetch(path, { method: 'POST', body }),
    }),
    defineTool('search', {
      description: 'Search with query parameters',
      params: {
        path: { type: 'string', description: 'API endpoint' },
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

Environment variables:
- `API_BASE_URL` — external API base URL
- `API_KEY` — Bearer token (optional)

## crud

Four CRUD tools with in-memory storage. Replace with a real database for production.

```typescript
import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

const store = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-crud-server',
  version: '0.1.0',
  tools: [
    defineTool('create', {
      description: 'Create a new record',
      params: {
        collection: { type: 'string', description: 'Collection name' },
        data: { type: 'string', description: 'JSON string of record data' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(id, { ...record, _id: id, _collection: collection });
        return { id, message: `Created in ${collection}` };
      },
    }),
    defineTool('read', { /* read by id or list all */ }),
    defineTool('update', { /* update existing record */ }),
    defineTool('delete', { /* delete by id */ }),
  ],
});

server.start();
```

## agent

Think-execute-remember pattern. LLM integration is left for you to add — the template provides the structure.

```typescript
import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

const memory = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-agent-server',
  version: '0.1.0',
  tools: [
    defineTool('think', {
      description: 'Analyze a problem and produce a plan',
      params: {
        problem: { type: 'string', description: 'Problem statement' },
        context: { type: 'string', description: 'Additional context', optional: true },
      },
      handler: async ({ problem, context }) => {
        // TODO: Connect LLM call here
        const plan = {
          problem,
          steps: ['Understand', 'Gather data', 'Execute', 'Verify'],
          reasoning: 'Replace with LLM-generated reasoning',
        };
        await memory.set(`thought_${Date.now()}`, { ...plan, timestamp: new Date().toISOString() });
        return plan;
      },
    }),
    defineTool('execute', {
      description: 'Execute a step from the plan',
      params: {
        step: { type: 'string', description: 'Step to execute' },
        input: { type: 'string', description: 'Input data', optional: true },
      },
      handler: async ({ step }) => {
        const result = { step, status: 'completed', output: `Executed: ${step}` };
        await memory.set(`exec_${Date.now()}`, result);
        return result;
      },
    }),
    defineTool('remember', {
      description: 'Store or recall from agent memory',
      params: {
        action: { type: 'string', description: '"store" or "recall"' },
        key: { type: 'string', description: 'Memory key' },
        value: { type: 'string', description: 'Value to store', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set(key, { value, timestamp: new Date().toISOString() });
          return { action: 'stored', key };
        }
        if (action === 'recall') {
          const data = await memory.get(key);
          return data ? { found: true, data } : { found: false };
        }
        return { error: 'Use "store" or "recall"' };
      },
    }),
  ],
});

server.start();
```

## Language variants

Every template has a Korean variant (e.g., `basic-ko`) with Korean comments and descriptions. Use `--lang ko` to select.
