# Gateway

Gateway is a reverse proxy that unifies multiple MCP servers behind a single endpoint. It provides server registry, tool indexing, request routing, health checks, and load balancing.

## Overview

When you have multiple MCP servers, Gateway provides a single entry point:

```
Client → Gateway (:4000) → Server A - search   (:3510, SSE)
                          → Server B - files    (:3511, SSE)
                          → Server C - analytics (stdio)
```

Clients connect to one Gateway and access tools from all registered servers.

## Installation

```bash
npm install @airmcp-dev/gateway
```

## Basic usage

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  name: 'my-gateway',
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

gateway.register({
  id: 'search-1',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});

gateway.register({
  id: 'files-1',
  name: 'files',
  transport: 'stdio',
  connection: { type: 'stdio', command: 'node', args: ['./servers/files/dist/index.js'] },
});

await gateway.start();
```

## GatewayConfig

```typescript
interface GatewayConfig {
  name?: string;
  port?: number;
  healthCheckInterval?: number;   // ms, default: 15000
  balancer?: BalancerStrategy;
  requestTimeout?: number;        // ms
}
```

## ServerEntry

```typescript
interface ServerEntry {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  connection: StdioConnection | HttpConnection;
  tools: ToolEntry[];             // Auto-populated after connection
  status: ServerStatus;
  lastHealthCheck?: Date;
  metadata?: Record<string, any>;
}

// Connection types
interface StdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface HttpConnection {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

type ServerStatus = 'registered' | 'connecting' | 'connected' | 'error' | 'stopped';
```

Gateway supports mixing stdio, SSE, and HTTP servers.

## Server registry

```typescript
// Register
gateway.register({ id: 'search-1', name: 'search', ... });

// Unregister
gateway.unregister('search-1');

// List all servers
const servers = gateway.list();
// [{ id: 'search-1', name: 'search', status: 'connected', tools: [...] }, ...]
```

## Tool index

Gateway auto-collects tool lists from registered servers:

```typescript
interface ToolEntry {
  name: string;
  description?: string;
  serverId: string;
  inputSchema?: Record<string, any>;
}
```

## Load balancing

When multiple servers share the same name, load balancing is applied:

```typescript
const gateway = new Gateway({
  balancer: 'round-robin',  // default
});

// Register 2 servers with the same name
gateway.register({ id: 'search-1', name: 'search', ... });
gateway.register({ id: 'search-2', name: 'search', ... });
// → tool calls are routed alternately to search-1, search-2
```

### Balancer strategies

```typescript
type BalancerStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';
```

| Strategy | Description |
|----------|-------------|
| `round-robin` | Alternate in order (default) |
| `least-connections` | Route to server with fewest active connections |
| `weighted` | Weight-based distribution |
| `random` | Random selection |

## Health checks

```typescript
const gateway = new Gateway({
  healthCheckInterval: 15_000,  // every 15 seconds
});
```

Health check result:

```typescript
interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}
```

Unhealthy servers are excluded from routing and re-included when they recover.

## Failover

1. Server down → active requests timeout
2. Health check transitions server to `error` status
3. Subsequent requests route to remaining healthy servers
4. Server recovers → health check passes → `connected` → routing pool restored

## With defineServer

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';
import { Gateway } from '@airmcp-dev/gateway';

const searchServer = defineServer({
  name: 'search',
  transport: { type: 'sse', port: 3510 },
  tools: [defineTool('search', { params: { query: 'string' }, handler: async ({ query }) => doSearch(query) })],
});

const filesServer = defineServer({
  name: 'files',
  transport: { type: 'sse', port: 3511 },
  tools: [defineTool('read-file', { params: { path: 'string' }, handler: async ({ path }) => readFile(path, 'utf-8') })],
});

await searchServer.start();
await filesServer.start();

const gateway = new Gateway({ port: 4000 });
gateway.register({ id: 'search', name: 'search', transport: 'sse', connection: { type: 'sse', url: 'http://localhost:3510' } });
gateway.register({ id: 'files', name: 'files', transport: 'sse', connection: { type: 'sse', url: 'http://localhost:3511' } });
await gateway.start();
```
