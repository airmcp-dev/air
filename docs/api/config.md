# Config & Transport Reference

## loadConfig(cwd?)

Find config file and merge with defaults. Priority: `air.config.ts` > `air.config.json` > `package.json "air"`.

```typescript
import { loadConfig } from '@airmcp-dev/core';

const config = await loadConfig();              // Load from cwd
const config = await loadConfig('/path/to');    // Specific directory
```

Internal steps:
1. `air.config.ts` → ESM dynamic import
2. `air.config.json` → JSON.parse
3. `package.json` `"air"` field
4. None found → `{ name: 'air-server' }`
5. Deep merge with `DEFAULT_CONFIG`

## AirConfig

```typescript
interface AirConfig {
  name: string;

  version?: string;               // Default: '0.1.0'
  description?: string;

  transport?: TransportConfig;
  storage?: StoreOptions;
  meter?: MeterConfig;

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format?: 'json' | 'pretty';
  };

  dev?: {
    hotReload?: boolean;
    port?: number;
  };

  telemetry?: {
    enabled?: boolean;            // Default: false (opt-in)
    endpoint?: string;
  };

  registry?: {
    url?: string;                 // Default: 'https://plugins.airmcp.dev/api/v1'
    apiKey?: string;
  };
}
```

## DEFAULT_CONFIG

```typescript
const DEFAULT_CONFIG = {
  version: '0.1.0',
  transport: { type: 'auto' },
  storage: { type: 'memory' },
  logging: { level: 'info', format: 'pretty' },
  metrics: { enabled: true, layerClassification: false },
  dev: { hotReload: true, port: 3100 },
};
```

## TransportConfig

```typescript
interface TransportConfig {
  type?: 'stdio' | 'sse' | 'http' | 'auto';  // Default: 'auto'
  port?: number;
  host?: string;                               // Default: 'localhost'
  basePath?: string;                           // Default: '/'
}
```

## detectTransport(config?)

Auto-detect transport type based on environment.

```typescript
import { detectTransport } from '@airmcp-dev/core';

detectTransport();                          // Auto
detectTransport({ type: 'sse' });          // → 'sse'
```

Detection order:
1. `config.type` is not `'auto'` → return as-is
2. `MCP_TRANSPORT` env variable (`stdio` / `http` / `sse`)
3. `process.stdin.isTTY`:
   - Not TTY (piped) → `'stdio'`
   - TTY (terminal) → `'http'`

### Port resolution

```
transport.port → dev.port → 3100
```

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;          // Default: true
  classify?: boolean;         // Default: true
  trackCalls?: boolean;       // Default: true
  trackTokens?: boolean;      // Default: false
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## Full type exports

```typescript
import type {
  AirConfig, MeterConfig, TransportType, TransportConfig,
  ParamShorthand, AirToolParams, AirToolHandler, AirToolContext, AirToolResponse, AirToolDef,
  AirResourceDef, AirResourceContext, AirResourceContent,
  AirPromptDef, AirPromptArg, AirPromptMessage,
  MiddlewareContext, MiddlewareResult, AirMiddleware,
  StorageAdapter, QueryOptions, StoreOptions,
  AirPluginMeta, PluginHooks, PluginContext, AirPlugin, AirPluginFactory,
  AirServerOptions, AirServer, AirServerStatus,
} from '@airmcp-dev/core';
```
