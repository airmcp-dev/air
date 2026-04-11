# Monitoring Plugins

## jsonLoggerPlugin

Structured JSON logging for tool calls. Compatible with ELK, Datadog, CloudWatch, and other log collectors.

```typescript
import { jsonLoggerPlugin } from '@airmcp-dev/core';
use: [jsonLoggerPlugin({ output: 'stderr', logParams: true })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `output` | `'stderr' \| 'stdout'` | `'stderr'` | Output target |
| `logParams` | `boolean` | `false` | Include params in log entries |
| `extraFields` | `Record<string, any>` | `{}` | Extra fields added to every log entry |

### Output format

Success:

```json
{"level":"info","event":"tool.call","tool":"search","duration_ms":45,"request_id":"a1b2c3d4-...","server":"my-server","timestamp":"2025-01-01T00:00:00.000Z"}
```

Error:

```json
{"level":"error","event":"tool.error","tool":"search","error":"Connection refused","request_id":"a1b2c3d4-...","server":"my-server","timestamp":"2025-01-01T00:00:00.000Z"}
```

With `extraFields`:

```typescript
use: [jsonLoggerPlugin({ extraFields: { env: 'production', region: 'ap-northeast-2' } })]
// → env, region added to every log entry
```

## perUserRateLimitPlugin

Per-user/session rate limiting. Extracts user ID from params for individual tracking.

```typescript
import { perUserRateLimitPlugin } from '@airmcp-dev/core';
use: [perUserRateLimitPlugin({ maxCalls: 10, windowMs: 60_000, identifyBy: '_userId' })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxCalls` | `number` | `10` | Max calls per window |
| `windowMs` | `number` | `60000` | Window size (ms) |
| `identifyBy` | `string` | `'_userId'` | User identification parameter name |

Internal: tracks timestamp arrays keyed by `userId:toolName`. Expired timestamps auto-pruned.

When limit exceeded:

```
[RateLimit] User "user-123" exceeded 10 calls per 60s for "search".
```

If `_userId` param is missing, user is treated as `'anonymous'`.
