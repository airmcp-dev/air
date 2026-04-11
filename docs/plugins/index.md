# Plugin Overview

air ships 19 built-in plugins. Add them to the `use` array — they execute in array order.

```typescript
import { defineServer, cachePlugin, retryPlugin } from '@airmcp-dev/core';

defineServer({
  use: [retryPlugin({ maxRetries: 3 }), cachePlugin({ ttlMs: 60_000 })],
});
```

## Plugins by category

### [Stability](/plugins/stability)

| Plugin | Description |
|--------|-------------|
| `timeoutPlugin` | Timeout warning (default: 30s) |
| `retryPlugin` | Exponential backoff retry (default: 3 retries, 200ms) |
| `circuitBreakerPlugin` | Block calls after consecutive failures (default: 5, 30s reset) |
| `fallbackPlugin` | Call alternate tool on failure |

### [Performance](/plugins/performance)

| Plugin | Description |
|--------|-------------|
| `cachePlugin` | Param-hash caching (default: 60s TTL, 1000 entries) |
| `dedupPlugin` | Deduplicate concurrent identical calls (default: 1s window) |
| `queuePlugin` | Limit concurrent executions (default: 10, per-tool configurable) |

### [Security](/plugins/security)

| Plugin | Description |
|--------|-------------|
| `authPlugin` | API key or Bearer token auth |
| `sanitizerPlugin` | Strip HTML/control chars (default: 10000 chars) |
| `validatorPlugin` | Custom validation rules |

### [Network](/plugins/network)

| Plugin | Description |
|--------|-------------|
| `corsPlugin` | HTTP/SSE CORS headers |
| `webhookPlugin` | Send tool events to webhook URL |

### [Data](/plugins/data)

| Plugin | Description |
|--------|-------------|
| `transformPlugin` | Declarative input/output transformation (per-tool/global) |
| `i18nPlugin` | Response localization (`{{key}}` substitution) |

### [Monitoring](/plugins/monitoring)

| Plugin | Description |
|--------|-------------|
| `jsonLoggerPlugin` | Structured JSON logging (ELK/Datadog compatible) |
| `perUserRateLimitPlugin` | Per-user rate limiting |

### [Dev / Test](/plugins/dev)

| Plugin | Description |
|--------|-------------|
| `dryrunPlugin` | Skip handler (schema check / middleware testing) |

### [Custom Plugins](/plugins/custom)

Build your own — meta, middleware, hooks, tools.
