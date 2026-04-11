# @airmcp-dev/gateway

Reverse proxy that unifies multiple MCP servers behind a single endpoint. Server registry, tool indexing, request routing, health checks, load balancing.

## Installation

```bash
npm install @airmcp-dev/gateway
```

## Gateway

```typescript
import { Gateway } from '@airmcp-dev/gateway';
const gateway = new Gateway(config);
```

### GatewayConfig

```typescript
interface GatewayConfig {
  name?: string;
  port?: number;
  healthCheckInterval?: number;   // ms, default: 15000
  balancer?: BalancerStrategy;    // default: 'round-robin'
  requestTimeout?: number;        // ms
}
```

### Methods

```typescript
class Gateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  register(server: ServerEntry): void;
  unregister(id: string): void;
  list(): ServerEntry[];
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
```

### Connection types

```typescript
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
```

### ServerStatus

```typescript
type ServerStatus = 'registered' | 'connecting' | 'connected' | 'error' | 'stopped';
```

## ToolEntry

```typescript
interface ToolEntry {
  name: string;
  description?: string;
  serverId: string;
  inputSchema?: Record<string, any>;
}
```

## BalancerStrategy

```typescript
type BalancerStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';
```

| Strategy | Description |
|----------|-------------|
| `round-robin` | Alternate in order (default) |
| `least-connections` | Route to server with fewest active connections |
| `weighted` | Weight-based distribution |
| `random` | Random selection |

## HealthCheckResult

```typescript
interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}
```

→ [Gateway guide](/guide/gateway)
