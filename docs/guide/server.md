# Define a Server

`defineServer()` is the entry point. It takes a single options object and returns an `AirServer` instance.

## Basic usage

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  tools: [
    defineTool('ping', {
      description: 'Health check',
      handler: async () => 'pong',
    }),
  ],
});

server.start();
```

## Options

`defineServer` accepts `AirServerOptions`:

```typescript
interface AirServerOptions {
  name: string;                           // Server name (MCP registration name)
  version?: string;                       // Version (default: '0.1.0')
  description?: string;                   // Description

  tools?: AirToolDef[];                   // Tool definitions
  resources?: AirResourceDef[];           // Resource definitions
  prompts?: AirPromptDef[];               // Prompt definitions

  use?: Array<AirPlugin | AirPluginFactory>;  // Plugins (array order = execution order)
  middleware?: AirMiddleware[];            // Custom middleware (runs after plugins)

  transport?: TransportConfig;            // Transport config
  storage?: StoreOptions;                 // Storage config
  meter?: MeterConfig;                    // Metering config

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format?: 'json' | 'pretty';
  };

  dev?: {
    hotReload?: boolean;                  // Default: true
    port?: number;                        // Default: 3100
  };
}
```

## AirServer instance

The object returned by `defineServer()`:

```typescript
interface AirServer {
  readonly name: string;

  start(): Promise<void>;               // Start the server
  stop(): Promise<void>;                // Graceful shutdown
  status(): AirServerStatus;            // Current status

  tools(): AirToolDef[];                // Registered tools
  resources(): AirResourceDef[];        // Registered resources

  callTool(name: string, params?: Record<string, any>): Promise<any>;

  addTool(tool: AirToolDef): void;      // Add tool at runtime
  addMiddleware(mw: AirMiddleware): void;  // Add middleware at runtime
  addPlugin(plugin: AirPlugin): void;   // Add plugin at runtime

  state: Record<string, any>;           // Global state
}
```

## server.start()

Starts the server. Internally runs plugin `onInit` → `onStart` hooks, then connects the transport.

```typescript
await server.start();
```

Terminal output:

```
[air] Starting "my-server" (sse transport, 3 tools)
[air] SSE server listening on port 3510
```

## server.stop()

Stops the server. Runs plugin `onStop` hooks, then closes the MCP connection.

```typescript
await server.stop();
// [air] "my-server" stopped
```

## server.status()

```typescript
const s = server.status();
// {
//   name: 'my-server',
//   version: '0.1.0',
//   state: 'running',        // idle | starting | running | stopping | stopped | error
//   uptime: 12345,           // ms
//   toolCount: 3,
//   resourceCount: 0,
//   transport: 'sse'
// }
```

## server.callTool()

Calls a tool through the full middleware chain (validation, error handling, all plugins). Runs the exact same path as production, making it suitable for testing.

```typescript
const result = await server.callTool('search', { query: 'hello' });
```

Internal steps:
1. Find the tool by name (throws `McpErrors.toolNotFound` if missing)
2. Create request context (requestId, serverName, startedAt, state)
3. Execute middleware chain (before → handler → after)
4. Extract the first text result from the MCP content array and return it

```typescript
// Calling a nonexistent tool
await server.callTool('nonexistent', {});
// → throws AirError: Tool "nonexistent" not found (code: -32601)
```

## server.addTool()

Adds a tool at runtime. The tool passes through plugin `onToolRegister` hooks.

```typescript
server.addTool(defineTool('dynamic', {
  description: 'Added at runtime',
  handler: async () => 'works!',
}));

// If a plugin has an onToolRegister hook, it's applied
// e.g., adding tags, modifying description
```

## server.addMiddleware()

Adds middleware to the end of the chain at runtime.

```typescript
server.addMiddleware({
  name: 'late-logger',
  after: async (ctx) => {
    console.log(`${ctx.tool.name} completed in ${ctx.duration}ms`);
  },
});
```

## server.addPlugin()

Registers a plugin at runtime. The plugin's middleware is dynamically added to the chain.

```typescript
server.addPlugin(webhookPlugin({
  url: 'https://hooks.example.com/events',
}));
// → registers plugin + collects middleware + adds to chain
```

## Global state

`state` is a shared object accessible from every tool handler via `context.state`.

```typescript
// Set at server level
server.state.db = myDatabaseConnection;
server.state.config = { maxResults: 100 };

// Access in tool handler
defineTool('query', {
  params: { sql: 'string' },
  handler: async ({ sql }, context) => {
    const db = context.state.db;
    const limit = context.state.config.maxResults;
    return db.query(sql).limit(limit);
  },
});
```

## onShutdown

Register cleanup functions that run on SIGTERM/SIGINT. Use for closing DB connections, removing temp files, etc.

```typescript
import { onShutdown } from '@airmcp-dev/core';

// Close DB connection
onShutdown(async () => {
  await db.close();
  console.log('Database connection closed');
});

// Clean temp files
onShutdown(async () => {
  await fs.rm('.air/tmp', { recursive: true, force: true });
});
```

Multiple handlers run in registration order. If one fails, the rest still execute.

Terminal output on signal:

```
[air] SIGTERM received — shutting down...
Database connection closed
[air] "my-server" stopped
```

## defineServer internal order

When you call `defineServer()`, the framework does the following in order:

1. **Create middleware chain** — registers `errorBoundaryMiddleware` + `validationMiddleware`
2. **Meter middleware** — if `meter` config is present (enabled by default), adds metering middleware
3. **Builtin plugins** — registers `builtinLoggerPlugin` (based on log level) + `builtinMetricsPlugin`
4. **User plugins** — registers plugins from the `use` array, collects their middleware into the chain
5. **User middleware** — appends the `middleware` array to the end of the chain
6. **Register tools** — `tools` array + plugin-provided tools are registered with MCP SDK. Each tool passes through `onToolRegister` hooks
7. **Register resources** — `resources` array is registered with MCP SDK
8. **Register prompts** — `prompts` array is registered with MCP SDK
9. **Return AirServer** — the object with start, stop, callTool, etc.

## Full example

```typescript
import {
  defineServer, defineTool, defineResource, definePrompt,
  cachePlugin, retryPlugin, authPlugin, onShutdown,
} from '@airmcp-dev/core';

const db = await connectDatabase();

const server = defineServer({
  name: 'production-server',
  version: '1.0.0',
  description: 'Production MCP server',

  transport: { type: 'sse', port: 3510 },
  storage: { type: 'file', path: '.air/data' },
  logging: { level: 'info', format: 'json' },
  meter: { classify: true, trackCalls: true },

  use: [
    authPlugin({ type: 'api-key', keys: [process.env.API_KEY!] }),
    cachePlugin({ ttlMs: 60_000 }),
    retryPlugin({ maxRetries: 3 }),
  ],

  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      handler: async ({ query, limit }, context) => {
        const db = context.state.db;
        return db.search(query, limit || 10);
      },
    }),
  ],

  resources: [
    defineResource('config://app', {
      name: 'app-config',
      description: 'Server configuration',
      handler: async () => ({
        version: '1.0.0',
        tools: server.tools().map(t => t.name),
      }),
    }),
  ],

  prompts: [
    definePrompt('summarize', {
      description: 'Summarize text',
      arguments: [{ name: 'text', required: true }],
      handler: ({ text }) => [
        { role: 'user', content: `Please summarize:\n\n${text}` },
      ],
    }),
  ],
});

server.state.db = db;

onShutdown(async () => {
  await db.close();
});

server.start();
```
