# @airmcp-dev/gateway

Reverse proxy for multiple MCP servers. Route tool calls, balance load, auto-failover.

## Install

```bash
npm install @airmcp-dev/gateway
```

## Quick Example

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
});

gateway.register({
  id: 'search-1',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});

gateway.register({
  id: 'search-2',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3511' },
});

await gateway.start();
```

## Features

- **Tool routing** — auto-discover tools from registered servers
- **Load balancing** — round-robin, least-connections, weighted, random
- **Health checks** — periodic checks, auto-exclude/restore unhealthy servers
- **Multi-transport** — SSE and stdio servers behind one endpoint

## Documentation

Full docs: **[docs.airmcp.dev](https://docs.airmcp.dev)**

## License

Apache-2.0 — [GitHub](https://github.com/airmcp-dev/air)
