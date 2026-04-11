# Configuration

air loads configuration from three sources, in priority order:

1. `air.config.ts` — TypeScript config file (recommended)
2. `air.config.json` — JSON config file
3. `package.json` `"air"` field — inline config

If none exist, defaults are used. Internally, `loadConfig()` looks for files in this order and merges the first found config with defaults.

## air.config.ts (recommended)

Leverage TypeScript type checking and autocompletion:

```typescript
// air.config.ts
import type { AirConfig } from '@airmcp-dev/core';

const config: AirConfig = {
  name: 'my-server',
  version: '1.0.0',
  description: 'Production MCP server',

  transport: {
    type: 'sse',
    port: 3510,
    host: 'localhost',
  },

  storage: {
    type: 'file',
    path: '.air/data',
  },

  logging: {
    level: 'info',
    format: 'json',
  },

  dev: {
    hotReload: true,
    port: 3100,
  },
};

export default config;
```

## air.config.json

When TypeScript config is unnecessary or you prefer JSON:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "transport": {
    "type": "sse",
    "port": 3510
  },
  "storage": {
    "type": "file",
    "path": ".air/data"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## package.json "air" field

Inline config without a separate file:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@airmcp-dev/core": "^0.1.3"
  },
  "air": {
    "transport": { "type": "sse", "port": 3510 },
    "logging": { "level": "info" }
  }
}
```

::: tip
Use only one source. If multiple exist, only the highest priority is applied (`air.config.ts` > `air.config.json` > `package.json`).
:::

## Default values

These defaults are defined in `@airmcp-dev/core`'s `DEFAULT_CONFIG`:

```typescript
// packages/core/src/config/defaults.ts
{
  version: '0.1.0',
  transport: { type: 'auto' },       // Auto-selects stdio or http based on environment
  storage: { type: 'memory' },       // In-memory (lost on restart)
  logging: { level: 'info', format: 'pretty' },
  metrics: { enabled: true, layerClassification: false },
  dev: { hotReload: true, port: 3100 },
}
```

`transport.type: 'auto'` behavior:
- stdin is TTY (running directly in terminal) → `http`
- stdin is piped (launched by MCP client) → `stdio`

## Full AirConfig reference

```typescript
interface AirConfig {
  // ── Required ──
  name: string;                   // Server name (MCP registration name)

  // ── Optional — fields with defaults ──
  version?: string;               // Default: '0.1.0'
  description?: string;

  transport?: {
    type?: 'stdio' | 'sse' | 'http' | 'auto';  // Default: 'auto'
    port?: number;                // HTTP/SSE port
    host?: string;                // Default: 'localhost'
    basePath?: string;            // Default: '/'
  };

  storage?: {
    type: 'memory' | 'file';      // Default: 'memory'
    path?: string;                // Path for file type (default: '.air/data/')
    defaultTtl?: number;          // TTL in seconds (0 = no expiry)
  };

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // Default: 'info'
    format?: 'json' | 'pretty';   // Default: dev=pretty, prod=json
  };

  meter?: MeterConfig;            // See Meter guide

  dev?: {
    hotReload?: boolean;          // Default: true
    port?: number;                // Default: 3100
  };

  telemetry?: {
    enabled?: boolean;            // Default: false (opt-in)
    endpoint?: string;            // Default: 'https://telemetry.airmcp.dev/v1/collect'
  };

  registry?: {
    url?: string;                 // Default: 'https://plugins.airmcp.dev/api/v1'
    apiKey?: string;              // Required for plugin publishing
  };
}
```

## loadConfig usage

`loadConfig()` finds a config file and returns the result merged with defaults:

```typescript
import { loadConfig } from '@airmcp-dev/core';

const config = await loadConfig();            // Load from cwd
const config = await loadConfig('/path/to');  // Load from specific directory

console.log(config.name);          // 'my-server'
console.log(config.transport);     // { type: 'sse', port: 3510 }
console.log(config.logging);       // { level: 'info', format: 'json' }
```

Internal behavior:
1. Check for `air.config.ts` → load via ESM dynamic import
2. If not found, check `air.config.json` → load via JSON.parse
3. If not found, check `package.json` `"air"` field
4. If none found, use `{ name: 'air-server' }`
5. Deep merge found config with `DEFAULT_CONFIG`

## Config vs defineServer

`air.config.ts` holds **infrastructure settings** (port, storage, log level). `defineServer()` holds **business logic** (tools, plugins):

```typescript
// air.config.ts — infrastructure
export default {
  name: 'my-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },
  storage: { type: 'file', path: '.air/data' },
  logging: { level: 'info', format: 'json' },
};
```

```typescript
// src/index.ts — business logic
import config from '../air.config.js';
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  ...config,                        // Spread infrastructure settings
  use: [cachePlugin({ ttlMs: 60_000 })],
  tools: [
    defineTool('search', {
      params: { query: 'string' },
      handler: async ({ query }) => doSearch(query),
    }),
  ],
});

server.start();
```

Benefits:
- Infrastructure config can be swapped per environment (dev/staging/prod)
- Business logic stays identical regardless of config changes
- In CI/CD, swap only `air.config.ts` to switch deployment environments

## Environment-based config patterns

### Branch in a single file

```typescript
// air.config.ts
const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    transport: { type: 'sse' as const, port: 3510 },
    logging: { level: 'debug' as const, format: 'pretty' as const },
    storage: { type: 'memory' as const },
  },
  staging: {
    transport: { type: 'http' as const, port: 3510 },
    logging: { level: 'info' as const, format: 'json' as const },
    storage: { type: 'file' as const, path: '.air/data' },
  },
  production: {
    transport: { type: 'http' as const, port: 3510 },
    logging: { level: 'warn' as const, format: 'json' as const },
    storage: { type: 'file' as const, path: '/var/air/data' },
  },
};

export default {
  name: 'my-server',
  version: '1.0.0',
  ...configs[env as keyof typeof configs] || configs.development,
};
```

### Environment variables

```typescript
// air.config.ts
export default {
  name: process.env.SERVER_NAME || 'my-server',
  transport: {
    type: (process.env.TRANSPORT_TYPE || 'sse') as 'stdio' | 'sse' | 'http',
    port: parseInt(process.env.PORT || '3510'),
    host: process.env.HOST || 'localhost',
  },
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
};
```

```bash
# Development
PORT=3510 LOG_LEVEL=debug node dist/index.js

# Production
PORT=8080 LOG_LEVEL=warn TRANSPORT_TYPE=http node dist/index.js
```
