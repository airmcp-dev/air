# Performance Plugins

## cachePlugin

Caches tool results by parameter hash. Same tool + same params = cached result.

```typescript
import { cachePlugin } from '@airmcp-dev/core';
use: [cachePlugin({ ttlMs: 60_000 })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlMs` | `number` | `60000` | Cache TTL (ms) |
| `maxEntries` | `number` | `1000` | Max cached items (FIFO eviction) |
| `exclude` | `string[]` | `[]` | Tool names to exclude from caching |

Cache key: `${toolName}:${JSON.stringify(params, sorted_keys)}`

```typescript
use: [cachePlugin({ ttlMs: 30_000, maxEntries: 500, exclude: ['write_db', 'send_email'] })]
```

Internal: `before` checks cache (hit → abort + return cached), `after` stores result. Expired entries cleaned via `evictExpired()` on each call.

## dedupPlugin

Deduplicates concurrent identical calls. If the same tool is called with the same params simultaneously, the second call waits for the first result (Request Coalescing).

```typescript
import { dedupPlugin } from '@airmcp-dev/core';
use: [dedupPlugin({ windowMs: 2000 })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `windowMs` | `number` | `1000` | Dedup window (ms) |

Internal: `before` checks inflight map → if match, await its Promise → abort. `after` resolves the Promise. Expired entries auto-cleaned every `windowMs * 5`.

## queuePlugin

Limits concurrent tool executions per tool. Excess calls wait in a queue.

```typescript
import { queuePlugin } from '@airmcp-dev/core';
use: [queuePlugin({
  concurrency: { 'db_query': 3, 'fetch_api': 5, '*': 10 },
})]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `Record<string, number>` | `{ '*': 10 }` | Per-tool concurrency. `'*'` is default |
| `maxQueueSize` | `number` | `100` | Max queue size (exceeds → immediate error) |
| `queueTimeoutMs` | `number` | `30000` | Queue wait timeout (exceeds → error) |

Error messages:
- Queue full: `[Queue] Queue full for "db_query" (max: 100)`
- Timeout: `[Queue] Timeout waiting for "db_query" (30000ms)`
