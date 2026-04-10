# air

Build, run, and manage MCP servers.

air is a TypeScript framework for building Model Context Protocol (MCP) servers. Define tools, resources, and prompts with simple functions. Add security, caching, retry logic, and monitoring with built-in plugins. Deploy with stdio, SSE, or HTTP transport.

## Quick Start

```bash
npx @airmcp-dev/cli create my-server
cd my-server
npm install
npx @airmcp-dev/cli dev --console -p 3510
```

## Define a Server

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('greet', {
      description: 'Say hello',
      params: {
        name: { type: 'string', description: 'Name' },
      },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

## Plugins

19 built-in plugins. Add them to the `use` array:

```typescript
import {
  defineServer,
  timeoutPlugin,
  retryPlugin,
  cachePlugin,
  authPlugin,
} from '@airmcp-dev/core';

defineServer({
  name: 'my-server',
  use: [
    timeoutPlugin(10_000),
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: ['sk-xxx'] }),
  ],
  tools: [ ... ],
});
```

### Plugin List

**Stability:** timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin
**Performance:** cachePlugin, dedupPlugin, queuePlugin
**Security:** authPlugin, sanitizerPlugin, validatorPlugin
**Network:** corsPlugin, webhookPlugin
**Data:** transformPlugin, i18nPlugin
**Monitoring:** jsonLoggerPlugin, perUserRateLimitPlugin
**Dev/Test:** dryrunPlugin

## Built-in Security

```typescript
defineServer({
  shield: {
    enabled: true,
    policies: [
      { name: 'block-admin', target: 'admin_*', action: 'deny', priority: 10 },
    ],
    threatDetection: true,
    rateLimit: { perTool: { search: { maxCalls: 100, windowMs: 60_000 } } },
    audit: true,
  },
  meter: { classify: true, trackCalls: true },
});
```

8 threat patterns (prompt injection, path traversal, command injection, tool poisoning).
MCP error codes (-32000 to -32003, -32601 to -32603).

## CLI

```
airmcp-dev create <name>              Create a new MCP server project
airmcp-dev add tool <name>            Add tool/resource/prompt scaffold
airmcp-dev dev [--console]            Dev mode with hot reload + test console
airmcp-dev start                      Production mode (background)
airmcp-dev stop                       Stop server
airmcp-dev status                     Show status
airmcp-dev list                       List tools/resources/prompts
airmcp-dev inspect <tool>             Inspect tool schema
airmcp-dev connect <client>           Register with Claude Desktop, Cursor, etc.
airmcp-dev disconnect <client>        Unregister
airmcp-dev check                      Diagnose project health
```

## Transport

```typescript
// stdio (default) -- Claude Desktop direct
transport: { type: 'stdio' }

// SSE -- remote connection via mcp-proxy
transport: { type: 'sse', port: 3510 }

// Streamable HTTP
transport: { type: 'http', port: 3510 }
```

## Storage

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// Memory (default)
const store = new MemoryStore();

// File-based (JSON + append-only logs)
const store = new FileStore('.air/data');

// Factory
const store = await createStorage({ type: 'file', path: '.air/data' });
```

## Packages

| Package | License | Description |
|---------|---------|-------------|
| @airmcp-dev/core | Apache-2.0 | Server, tools, plugins, storage, transport |
| air (CLI) | Apache-2.0 | CLI commands (create, dev, connect, etc.) |
| @airmcp-dev/gateway | Apache-2.0 | Multi-server proxy, load balancing |
| @airmcp-dev/logger | Apache-2.0 | Structured logging |
| @airmcp-dev/meter | Apache-2.0 | 7-layer classification, cost tracking |
| @airmcp-dev/shield | Commercial | OWASP MCP Top 10, advanced threat detection |
| @airmcp-dev/hive | Commercial | Process pool, auto-restart, multi-tenant |

## Tests

```bash
pnpm install
npx vitest run    # 17 files, 165 tests
```

## License

Open source packages: Apache-2.0
Enterprise packages (@airmcp-dev/shield, @airmcp-dev/hive): Commercial License

---

Built by [CodePedia Labs](https://labs.codepedia.kr)
