# Server Reference

## defineServer(options)

Create an MCP server instance.

```typescript
import { defineServer } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '1.0.0',
  tools: [ /* ... */ ],
});
```

### AirServerOptions

```typescript
interface AirServerOptions {
  name: string;                           // Required — MCP registration name
  version?: string;                       // Default: '0.1.0'
  description?: string;

  tools?: AirToolDef[];
  resources?: AirResourceDef[];
  prompts?: AirPromptDef[];

  use?: Array<AirPlugin | AirPluginFactory>;  // Array order = execution order
  middleware?: AirMiddleware[];            // Runs after plugin middleware

  transport?: TransportConfig;
  storage?: StoreOptions;
  meter?: MeterConfig;

  maxSseSessions?: number;                // Default: 200 — max concurrent SSE sessions
  sseHeartbeatMs?: number;                // Default: 30000 — ping interval (0 to disable)
  sseReplayBufferSize?: number;           // Default: 100 — messages kept for reconnection
  sseReplayTtlMs?: number;               // Default: 300000 — replay buffer TTL
  sseIdleTimeoutMs?: number;             // Default: 600000 — auto-close idle sessions

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

### AirServer

```typescript
interface AirServer {
  readonly name: string;

  start(): Promise<void>;
  stop(): Promise<void>;
  status(): AirServerStatus;

  tools(): AirToolDef[];
  resources(): AirResourceDef[];

  callTool(name: string, params?: Record<string, any>): Promise<any>;

  addTool(tool: AirToolDef): void;
  addMiddleware(mw: AirMiddleware): void;
  addPlugin(plugin: AirPlugin): void;

  state: Record<string, any>;

  /** Workers fetch handler — available when transport is 'workers' */
  fetch?: (request: Request, env?: any) => Promise<Response>;
}
```

### Method details

#### server.start()

Runs plugin `onInit` → `onStart` hooks, then connects transport.

```typescript
await server.start();
// [air] Starting "my-server" (sse transport, 3 tools)
// [air] SSE server listening on port 3510
```

#### server.stop()

Runs plugin `onStop` hooks, then closes MCP connection.

```typescript
await server.stop();
// [air] "my-server" stopped
```

#### server.status()

```typescript
const s = server.status();
```

Returns:

```typescript
interface AirServerStatus {
  name: string;
  version: string;
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;           // ms
  toolCount: number;
  resourceCount: number;
  transport: string;
}
```

#### server.callTool(name, params?)

Calls a tool through the full middleware chain (validation, error handling, plugins). Same path as production.

```typescript
const result = await server.callTool('search', { query: 'hello' });
// Missing tool → throws AirError (code: -32601)
```

Internal: find tool → create requestContext → chain.execute → extract first text from McpContent[].

#### server.addTool(tool)

Runtime tool addition. Passes through `onToolRegister` hooks.

#### server.addPlugin(plugin)

Runtime plugin registration. Middleware dynamically added to chain.

#### server.state

Shared object accessible from all handlers via `context.state`.

```typescript
server.state.db = myConnection;
// In handler: context.state.db.query(...)
```

#### server.fetch(request, env?)

Workers-only. Handles MCP JSON-RPC requests through the full middleware chain. Available regardless of transport type, but primarily used with `transport: { type: 'workers' }`.

```typescript
const server = defineServer({
  transport: { type: 'workers' },
  tools: [ /* ... */ ],
});

// In Workers fetch handler
export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'POST') {
      return server.fetch!(request);
    }
    return Response.json(server.status());
  },
};
```

Handles these JSON-RPC methods:
- `initialize` → server info + capabilities (tools, resources, prompts)
- `tools/list` → registered tool schemas
- `tools/call` → tool execution through middleware chain
- `resources/list` → registered resources
- `resources/read` → read resource content by URI (v0.4.0+)
- `prompts/list` → registered prompts
- `prompts/get` → get prompt messages by name (v0.4.0+)
- `notifications/initialized` → 204 No Content

::: tip
`server.fetch` is always defined (not just for workers transport), so you can use it for testing or custom HTTP integrations on any platform.
:::

## onShutdown(handler)

Register cleanup functions for SIGTERM/SIGINT. Multiple allowed, run in order. One failure doesn't stop the rest.

```typescript
import { onShutdown } from '@airmcp-dev/core';

onShutdown(async () => { await db.close(); });
```
