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

### GatewayOptions

```typescript
interface GatewayOptions {
  name?: string;                  // default: 'air-gateway'
  port?: number;                  // default: 4000 (0 = random)
  host?: string;                  // default: '127.0.0.1'
  endpoint?: string;              // default: '/mcp'
  allowedOrigins?: string[];      // extra browser Origins; '*' for all
  healthCheckInterval?: number;   // ms, default: 15000
  balancer?: BalancerStrategy;    // default: 'round-robin'
  requestTimeout?: number;        // ms per upstream call, default: 30000
  discoverOnStart?: boolean;      // default: true
  secret?: string;                // HMAC key for elicitation ids; share it across gateway instances
  registration?: { token?: string; staleAfterMs?: number; enabled?: boolean };  // backend self-registration (/registry)
}
```

### Methods

```typescript
class Gateway {
  register(entry: { id: string; name: string; connection: HttpConnection; weight?: number }): ServerEntry;
  unregister(id: string): void;
  discover(id?: string): Promise<void>;      // (re)read tools/resources/prompts from backends
  start(): Promise<void>;                    // discover → health checks → listen
  stop(): Promise<void>;
  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;  // mount in your own http server
  status(): { name; servers; tools; pendingRequests; health };
  readonly port: number;                     // actual listen port
  readonly registry: ServerRegistry;
  readonly toolIndex: ToolIndex;
  readonly router: RequestRouter;
  readonly balancer: LoadBalancer;
  readonly healthChecker: HealthChecker;
}
```

Only `connection.type === 'http'` (Streamable HTTP) backends are accepted.

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
