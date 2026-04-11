# Plugins

air ships 19 built-in plugins. Add them to the `use` array — they execute in array order.

## Usage

```typescript
import {
  defineServer,
  cachePlugin,
  retryPlugin,
  authPlugin,
  timeoutPlugin,
} from '@airmcp-dev/core';

defineServer({
  use: [
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
    timeoutPlugin(10_000),
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [ /* ... */ ],
});
```

Order matters. Above: auth → timeout → retry on failure → cache result.

## Plugin vs Factory

Plugins can be passed in two forms:

```typescript
// 1. Factory function (accepts options, returns plugin) — most built-in plugins
use: [cachePlugin({ ttlMs: 60_000 })]

// 2. Plugin object directly
use: [myPlugin]
```

Internally, `resolvePlugin` calls factory functions to produce `AirPlugin` objects. Omitting options uses defaults:

```typescript
use: [cachePlugin()]   // ttlMs: 60_000 (default)
```

## Plugin validation

Every plugin is validated on registration. `meta.name` is required:

```typescript
// ✅ OK
const myPlugin: AirPlugin = {
  meta: { name: 'my-plugin', version: '1.0.0' },
  middleware: [ /* ... */ ],
};

// ❌ Error: plugin.meta.name is required
const badPlugin: AirPlugin = {
  meta: {} as any,
  middleware: [],
};
```

## Plugin categories

### Stability

| Plugin | Description |
|--------|-------------|
| [`timeoutPlugin`](/plugins/stability#timeoutplugin) | Abort calls exceeding time limit (default: 30s) |
| [`retryPlugin`](/plugins/stability#retryplugin) | Retry failed calls with exponential backoff (default: 3 retries, 200ms) |
| [`circuitBreakerPlugin`](/plugins/stability#circuitbreakerplugin) | Stop calling after consecutive failures (default: 5 failures, 30s reset) |
| [`fallbackPlugin`](/plugins/stability#fallbackplugin) | Return fallback value on error |

### Performance

| Plugin | Description |
|--------|-------------|
| [`cachePlugin`](/plugins/performance#cacheplugin) | Cache results by param hash (default: 60s TTL, max 1000 entries) |
| [`dedupPlugin`](/plugins/performance#dedupplugin) | Deduplicate concurrent identical calls |
| [`queuePlugin`](/plugins/performance#queueplugin) | Limit concurrent executions (default: 10) |

### Security

| Plugin | Description |
|--------|-------------|
| [`authPlugin`](/plugins/security#authplugin) | API key or Bearer token auth |
| [`sanitizerPlugin`](/plugins/security#sanitizerplugin) | Strip HTML/scripts from input (default: max 10000 chars) |
| [`validatorPlugin`](/plugins/security#validatorplugin) | Custom validation rules |

### Network

| Plugin | Description |
|--------|-------------|
| [`corsPlugin`](/plugins/network#corsplugin) | CORS headers for HTTP/SSE transport |
| [`webhookPlugin`](/plugins/network#webhookplugin) | Send tool results to a webhook URL |

### Data

| Plugin | Description |
|--------|-------------|
| [`transformPlugin`](/plugins/data#transformplugin) | Transform params or results |
| [`i18nPlugin`](/plugins/data#i18nplugin) | Localize tool responses |

### Monitoring

| Plugin | Description |
|--------|-------------|
| [`jsonLoggerPlugin`](/plugins/monitoring#jsonloggerplugin) | Structured JSON logging |
| [`perUserRateLimitPlugin`](/plugins/monitoring#peruserratelimitplugin) | Per-user rate limiting |

### Dev / Test

| Plugin | Description |
|--------|-------------|
| [`dryrunPlugin`](/plugins/dev#dryrunplugin) | Skip handler execution (middleware testing) |

## Builtin plugins (always active)

Two plugins are auto-registered — don't add them to `use`:

### builtinLoggerPlugin

Auto-logs every tool call. Level controlled by `logging.level`.

Output format:

```
12:34:56.789 search (45ms) [a1b2c3d4-e5f6-...]
```

On error:

```
12:34:56.789 search ERROR: Connection refused [a1b2c3d4-e5f6-...]
```

### builtinMetricsPlugin

Auto-collects per-tool call count, error count, total duration, average duration, and last called timestamp.

```typescript
import { getMetrics, resetMetrics } from '@airmcp-dev/core';

const metrics = getMetrics();
// {
//   search: {
//     calls: 150,
//     errors: 3,
//     totalDuration: 6750,
//     avgDuration: 45,
//     lastCalledAt: 1710000000000,
//   },
//   greet: {
//     calls: 50,
//     errors: 0,
//     totalDuration: 100,
//     avgDuration: 2,
//     lastCalledAt: 1710000001000,
//   },
// }

resetMetrics();  // Clear all metrics
```

## Plugin execution order

```
Request arrives
  ↓
  errorBoundaryMiddleware.before   (builtin — error boundary)
  validationMiddleware.before      (builtin — input validation)
  builtinLoggerPlugin.before       (builtin)
  builtinMetricsPlugin.before      (builtin)
  ↓
  use[0].before (authPlugin)       ← user plugins in order
  use[1].before (timeoutPlugin)
  use[2].before (retryPlugin)
  use[3].before (cachePlugin)
  ↓
  handler()                        ← tool handler
  ↓
  use[3].after (cachePlugin)       ← same order (NOT reverse)
  use[2].after (retryPlugin)
  use[1].after (timeoutPlugin)
  use[0].after (authPlugin)
  builtinMetricsPlugin.after       (builtin)
  builtinLoggerPlugin.after        (builtin)
  ↓
Response returned
```

::: info
After middleware runs in **registration order**, not reverse. This differs from Express.
:::

## Lifecycle hooks

Plugins can hook into server lifecycle:

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;     // After server init
  onStart?: (ctx: PluginContext) => Promise<void> | void;    // On server.start()
  onStop?: (ctx: PluginContext) => Promise<void> | void;     // On server.stop()
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;  // On tool registration (sync)
}
```

Execution order: `onInit` → `onStart` → (server running) → `onStop`. Multiple plugins' same hooks run in registration order.

`onToolRegister` is **synchronous**. Return a modified tool object to change it, or `undefined` to leave it unchanged.

### PluginContext

```typescript
interface PluginContext {
  serverName: string;
  config: Record<string, any>;
  state: Record<string, any>;          // Same as server.state
  log: (level: string, message: string, data?: any) => void;
}
```

Using `ctx.log`:

```typescript
hooks: {
  onInit: (ctx) => {
    ctx.log('info', 'Plugin initialized', { serverName: ctx.serverName });
    // [air:plugin] Plugin initialized { serverName: 'my-server' }
  },
}
```

## Custom plugins

See [Custom Plugins](/plugins/custom) for details.
