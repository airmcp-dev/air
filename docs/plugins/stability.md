# Stability Plugins

## timeoutPlugin

Warns when tool execution exceeds the time limit.

```typescript
import { timeoutPlugin } from '@airmcp-dev/core';
use: [timeoutPlugin(5_000)]   // 5 seconds
```

**Signature**: `timeoutPlugin(timeoutMs?: number)` — default: `30000` (30s)

Internal: sets `meta._timeoutMs` in before, checks elapsed time in after. Over-limit calls get a stderr warning:

```
[air:timeout] search took 12500ms (limit: 5000ms)
```

## retryPlugin

Retries failed calls with exponential backoff.

```typescript
import { retryPlugin } from '@airmcp-dev/core';
use: [retryPlugin({ maxRetries: 3, delayMs: 200 })]
// 200ms → 400ms → 800ms
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Max retry attempts |
| `delayMs` | `number` | `200` | Initial delay (doubles each retry) |
| `retryOn` | `(error: Error) => boolean` | `() => true` | Error filter |

```typescript
use: [retryPlugin({
  maxRetries: 3,
  retryOn: (error) => error.message.includes('ECONNREFUSED'),
})]
```

Internal: `onError` hook tracks `meta._retryCount`, re-invokes handler directly.

## circuitBreakerPlugin

Blocks calls after consecutive failures (prevents cascade failure).

```typescript
import { circuitBreakerPlugin } from '@airmcp-dev/core';
use: [circuitBreakerPlugin({ failureThreshold: 5, resetTimeoutMs: 30_000, perTool: true })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | `number` | `5` | Consecutive failures before open |
| `resetTimeoutMs` | `number` | `30000` | Time before half-open |
| `perTool` | `boolean` | `true` | Independent circuit per tool (false = global) |

States: **Closed** (normal) → **Open** (all rejected) → **Half-Open** (1 test call).

## fallbackPlugin

Calls an alternate tool when the primary fails. Maps tool name → fallback tool name.

```typescript
import { fallbackPlugin } from '@airmcp-dev/core';
use: [fallbackPlugin({
  'search_primary': 'search_backup',
  'fetch_api': 'fetch_cached',
})]
```

**Signature**: `fallbackPlugin(fallbacks: Record<string, string>)`

```
[air:fallback] "search_primary" failed, trying "search_backup"
```
