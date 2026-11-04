# Gateway

Gateway puts one Streamable HTTP endpoint in front of several MCP servers. Clients see a single MCP server; behind it, Gateway aggregates the tool, resource and prompt lists, routes each call to a backend, load-balances replicated tools, excludes unhealthy backends, and passes streaming notifications and elicitation through unchanged.

## Overview

```
Client → Gateway (:4000/mcp) → search-1   (:3510, http)
                             → search-2   (:3511, http)   ← replica of search-1, round-robin
                             → files      (:3512, http)
```

Backends must speak Streamable HTTP (air `transport: { type: 'http' }`). Legacy SSE and stdio backends are not supported as upstreams yet.

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
  host: '127.0.0.1',            // '0.0.0.0' in a container
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

gateway.register({ id: 'search-1', name: 'search', connection: { type: 'http', url: 'http://localhost:3510/mcp' } });
gateway.register({ id: 'search-2', name: 'search', connection: { type: 'http', url: 'http://localhost:3511/mcp' } });
gateway.register({ id: 'files',    name: 'files',  connection: { type: 'http', url: 'http://localhost:3512/mcp' } });

await gateway.start();   // discovers tools/resources/prompts, starts health checks, listens
```

Point any MCP client at `http://localhost:4000/mcp`.

## GatewayOptions

```typescript
interface GatewayOptions {
  name?: string;                  // serverInfo.name shown to clients (default: 'air-gateway')
  port?: number;                  // default: 4000 (0 = random; read gateway.port after start)
  host?: string;                  // default: '127.0.0.1'
  endpoint?: string;              // default: '/mcp'
  allowedOrigins?: string[];      // browser Origins allowed besides loopback; '*' for all
  healthCheckInterval?: number;   // ms, default: 15000
  balancer?: BalancerStrategy;    // 'round-robin' | 'random' | 'weighted'
  requestTimeout?: number;        // ms per upstream call, default: 30000
  discoverOnStart?: boolean;      // default: true
  secret?: string;                // HMAC key for elicitation ids; share it across gateway instances
  registration?: { token?: string; staleAfterMs?: number; enabled?: boolean };  // backend self-registration (/registry)
}
```

## Registering backends

```typescript
gateway.register({
  id: 'search-2',                 // unique
  name: 'search',                 // display name
  connection: { type: 'http', url: 'http://localhost:3511/mcp', headers: { Authorization: 'Bearer …' } },
  weight: 2,                      // for the 'weighted' balancer
});

gateway.unregister('search-2');
await gateway.discover();         // re-read tools/resources/prompts from every backend
await gateway.discover('files');  // one backend
```

`register()` throws for `stdio` and `sse` connections.

## Self-registration (push)

Instead of listing backends in the Gateway, let backends announce themselves. An air server with a `gateway` section registers on start, sends a heartbeat every `heartbeatMs`, and deregisters on `stop()`:

```typescript
// backend
defineServer({
  name: 'search',
  transport: { type: 'http', port: 3510, host: '0.0.0.0' },
  gateway: {
    url: 'http://gw.internal:4000',   // or an array — registers with every gateway listed
    token: process.env.GATEWAY_TOKEN,
    heartbeatMs: 5_000,               // must be shorter than the gateway's staleAfterMs
    advertiseUrl: 'http://10.0.0.5:3510/mcp', // optional; default http://<host>:<port>/mcp (hostname when host is 0.0.0.0)
    id: 'search-1',                   // optional; default: name
    weight: 2,                        // optional, for the weighted balancer
  },
  tools: [...],
});

// gateway
new Gateway({ port: 4000, registration: { token: process.env.GATEWAY_TOKEN, staleAfterMs: 30_000 } });
```

Gateway endpoints: `POST /registry` (register or heartbeat; `201` when new, `200` on heartbeat), `DELETE /registry/:id`, `GET /registry` (list). All require `Authorization: Bearer <token>` when a token is configured. A backend whose heartbeat stops is removed after `staleAfterMs`; a backend that re-announces the same id with a new URL replaces the old entry (restarts with a new port). Statically registered and self-registered backends coexist; both are health-checked. If the gateway is down when a backend starts, the backend still starts and keeps retrying quietly.

## What Gateway answers itself vs. forwards

| Method | Handling |
|--------|----------|
| `initialize`, `ping` | Answered by Gateway. Client capabilities are remembered and forwarded to backends on every `tools/call` (in `_meta`), so backends know whether the client supports elicitation. |
| `tools/list`, `resources/list`, `resources/templates/list`, `prompts/list` | Aggregated from the lists discovered at `start()` / `discover()`. A tool name that appears on several backends is listed once and treated as replicated. |
| `tools/call` | Routed by tool name → load balancer → backend. Streamed when the client accepts SSE (below). |
| `resources/read`, `resources/subscribe`, `prompts/get`, `completion/complete` | Forwarded to a backend that listed that URI / prompt (resource templates are matched too). |
| `logging/setLevel` | Forwarded to every backend. |
| Notifications from the client | Accepted with `202`, not forwarded. |
| JSON-RPC batch | Rejected (`-32600`). |

## Streaming passthrough

When a client sends `tools/call` with `Accept: text/event-stream`, Gateway calls the backend the same way and relays every event on the backend's SSE stream to the client's stream: `notifications/progress`, `notifications/message`, and server-initiated requests such as `elicitation/create`. The final JSON-RPC response ends the stream.

Server-initiated requests get a Gateway id of the form `gw.<backend>.<id>.<hmac>` that carries the backend and the original id, signed with `secret`. The client answers by `POST`ing the JSON-RPC response to the Gateway endpoint, exactly as it would to a single server; Gateway verifies the signature and forwards the response to the backend that asked. Nothing is stored, so with a shared `secret` any Gateway instance can handle the reply.

Clients that only accept `application/json` get the final result; the backend is called in JSON mode, so it sends no notifications and sees `ctx.elicit` as `undefined`.

If the client disconnects mid-call, the upstream request is aborted.

## Load balancing

Replicated tools (same name on several backends) are balanced per call:

| Strategy | Description |
|----------|-------------|
| `round-robin` | Alternate in order (default) |
| `random` | Random selection |
| `weighted` | Proportional to `weight` given at `register()` |
| `least-connections` | Accepted but currently falls back to round-robin |

Backends whose status is not `connected` are skipped. If no backend for a tool is healthy, the call fails with `-32601`.

## Health checks

Every `healthCheckInterval` ms Gateway fetches `/health` at each backend's origin (an air server answers it). A failing or slow (> 5 s) check moves the backend to `error`; a passing check moves it back to `connected`. The first check runs after a 10 s grace period so cold-starting backends aren't marked down.

```typescript
gateway.healthChecker.getAllResults();  // [{ serverId, healthy, latencyMs, error?, checkedAt }]
await gateway.healthChecker.checkAll(); // run one round now
```

`GET /` and `GET /health` on the Gateway itself return its status (servers, tools, pending requests, health results).

## Failover

1. A backend goes down → in-flight calls to it fail or time out.
2. The next health check marks it `error`; it is excluded from routing.
3. Calls to replicated tools keep flowing to the remaining backends; calls to tools that only it provided fail with "no healthy server".
4. The backend comes back → health check passes → `connected` → back in rotation.

## Embedding

`gateway.handleRequest(req, res)` is public, so the endpoint can be mounted inside an existing `node:http` server instead of `start()` listening on its own port.

## Lower-level pieces

`ServerRegistry`, `ToolIndex`, `RequestRouter`, `LoadBalancer`, `HealthChecker` and `UpstreamClient` are exported for building a custom front. `McpProxy` (in-process `callTool()` routing without an HTTP front) is kept for compatibility.
