# air

TypeScript framework for building MCP servers.

One function per tool. One line per plugin. Security, caching, retry — all built in.

```bash
npm install @airmcp-dev/core
```

## Why air?

Building an MCP server with the SDK directly requires ~70 lines of boilerplate per tool: Zod schemas, manual content wrapping, try/catch in every handler, transport setup. air reduces it to what matters.

**MCP SDK (direct):**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool('search', 'Search docs', { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

// retry? cache? auth? rate limit? logging? implement them all yourself
```

**air:**

```typescript
import { defineServer, defineTool, retryPlugin, cachePlugin, authPlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
  ],
  tools: [
    defineTool('search', {
      description: 'Search docs',
      params: { query: 'string', limit: 'number?' },
      handler: async ({ query, limit }) => doSearch(query, limit),
    }),
  ],
});

server.start();
```

## Quick Start

```bash
npx @airmcp-dev/cli create my-server
cd my-server && npm install
npx @airmcp-dev/cli dev --console -p 3510
```

## Real-World Examples

### REST API Wrapper

Wrap any REST API as MCP tools in 30 lines:

```typescript
import { defineServer, defineTool, cachePlugin, timeoutPlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'weather-api',
  transport: { type: 'sse', port: 3510 },
  use: [timeoutPlugin(5000), cachePlugin({ ttlMs: 300_000 })],
  tools: [
    defineTool('get_weather', {
      description: 'Get current weather for a city',
      params: { city: 'string' },
      handler: async ({ city }) => {
        const res = await fetch(`https://wttr.in/${city}?format=j1`);
        const data = await res.json();
        return {
          city,
          temp: data.current_condition[0].temp_C + '°C',
          desc: data.current_condition[0].weatherDesc[0].value,
        };
      },
    }),
  ],
});
server.start();
```

### Note Manager with Persistent Storage

```typescript
import { defineServer, defineTool, createStorage, onShutdown } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/notes' });

const server = defineServer({
  name: 'notes',
  tools: [
    defineTool('create_note', {
      params: { title: 'string', content: 'string', tags: 'string?' },
      handler: async ({ title, content, tags }) => {
        const id = `n_${Date.now()}`;
        await store.set('notes', id, { id, title, content, tags: tags?.split(',') ?? [], createdAt: new Date().toISOString() });
        return { id, message: `"${title}" created` };
      },
    }),
    defineTool('search_notes', {
      params: { query: 'string' },
      handler: async ({ query }) => {
        const entries = await store.entries('notes');
        return entries.filter(e => e.value.title.includes(query) || e.value.content.includes(query))
                      .map(e => ({ id: e.key, title: e.value.title }));
      },
    }),
    defineTool('list_notes', {
      handler: async () => {
        const entries = await store.entries('notes');
        return { count: entries.length, notes: entries.map(e => ({ id: e.key, title: e.value.title, tags: e.value.tags })) };
      },
    }),
  ],
});

onShutdown(async () => { await store.close(); });
server.start();
```

### Connect to Claude Desktop

```bash
# Register the server
npx @airmcp-dev/cli connect claude-desktop

# Or manually add to claude_desktop_config.json:
```

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

### Connect to Local LLM (Ollama)

air servers work with any MCP-compatible client. With Ollama, use the tool definitions as function calling:

```typescript
// 1. Define tools in air
const server = defineServer({
  name: 'my-tools',
  tools: [
    defineTool('calc', {
      params: { a: 'number', op: 'string', b: 'number?' },
      handler: async ({ a, op, b }) => { /* ... */ },
    }),
  ],
});

// 2. Send tool definitions to Ollama API
const response = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama3.1',
    messages: [{ role: 'user', content: 'What is 42 * 58?' }],
    tools: [{ type: 'function', function: { name: 'calc', parameters: { ... } } }],
  }),
});

// 3. Execute tool calls through air
const toolCall = response.message.tool_calls[0];
const result = await server.callTool(toolCall.function.name, toolCall.function.arguments);
```

## 19 Built-in Plugins

Add to the `use` array. Order matters — first plugin runs first.

```typescript
use: [
  authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),  // auth first
  sanitizerPlugin(),
  timeoutPlugin(10_000),
  retryPlugin({ maxRetries: 3 }),
  cachePlugin({ ttlMs: 60_000 }),
  queuePlugin({ concurrency: { 'heavy-task': 3, '*': 10 } }),
]
```

| Category | Plugins |
|----------|---------|
| **Stability** | timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin |
| **Performance** | cachePlugin, dedupPlugin, queuePlugin |
| **Security** | authPlugin, sanitizerPlugin, validatorPlugin |
| **Network** | corsPlugin, webhookPlugin |
| **Data** | transformPlugin, i18nPlugin |
| **Monitoring** | jsonLoggerPlugin, perUserRateLimitPlugin |
| **Dev/Test** | dryrunPlugin |

## Transport

```typescript
transport: { type: 'stdio' }             // Claude Desktop (default)
transport: { type: 'sse', port: 3510 }   // Remote SSE
transport: { type: 'http', port: 3510 }  // Streamable HTTP
```

Auto-detection: piped stdin → stdio, terminal → http.

## Storage

```typescript
const store = await createStorage({ type: 'memory' });              // In-memory (default)
const store = await createStorage({ type: 'file', path: '.air/data' }); // JSON + JSONL

await store.set('users', 'u1', { name: 'Alice' }, 3600);  // TTL in seconds
await store.get('users', 'u1');                             // { name: 'Alice' }
await store.append('logs', { action: 'login' });            // Append-only log
await store.query('logs', { limit: 50, filter: { action: 'login' } });
```

## CLI

```
npx @airmcp-dev/cli create <name>        Create project (templates: basic, api, crud, agent)
npx @airmcp-dev/cli dev --console        Dev mode with hot reload
npx @airmcp-dev/cli connect <client>     Register with Claude Desktop, Cursor, VS Code, etc.
npx @airmcp-dev/cli status               Show running servers
npx @airmcp-dev/cli inspect <tool>       Inspect tool schema
```

Supported clients: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## Packages

| Package | Description | License |
|---------|-------------|---------|
| [@airmcp-dev/core](https://www.npmjs.com/package/@airmcp-dev/core) | Server, tools, 19 plugins, storage, transport | Apache-2.0 |
| [@airmcp-dev/cli](https://www.npmjs.com/package/@airmcp-dev/cli) | CLI (create, dev, connect, inspect) | Apache-2.0 |
| [@airmcp-dev/gateway](https://www.npmjs.com/package/@airmcp-dev/gateway) | Multi-server proxy, load balancing, health checks | Apache-2.0 |
| [@airmcp-dev/logger](https://www.npmjs.com/package/@airmcp-dev/logger) | Structured logging, file rotation | Apache-2.0 |
| [@airmcp-dev/meter](https://www.npmjs.com/package/@airmcp-dev/meter) | 7-layer call classification, cost tracking | Apache-2.0 |
| @airmcp-dev/shield | Threat detection, policy engine, audit log | Commercial |
| @airmcp-dev/hive | Process pool, auto-restart, multi-tenant | Commercial |

## Documentation

Full documentation: **[docs.airmcp.dev](https://docs.airmcp.dev)**

- 110 pages, English & Korean
- Source-verified API reference
- 9 real-world examples
- Plugin detailed guides
- Architecture diagrams
- Troubleshooting & FAQ

## Tests

```bash
pnpm install
npx vitest run    # 17 files, 165 tests
```

## License

Open source packages: [Apache-2.0](LICENSE)
Enterprise packages (shield, hive): Commercial License

---

Built by [CodePedia Labs](https://labs.codepedia.kr) · [Docs](https://docs.airmcp.dev) · [npm](https://www.npmjs.com/org/airmcp-dev)
