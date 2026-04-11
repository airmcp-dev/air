# Network Plugins

## corsPlugin

Adds CORS settings for HTTP/SSE transports. Stores config in `state._cors` via `onInit` hook.

```typescript
import { corsPlugin } from '@airmcp-dev/core';
use: [corsPlugin({ origins: ['https://app.example.com'] })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origins` | `string[]` | `['*']` | Allowed origins |
| `methods` | `string[]` | `['GET', 'POST', 'OPTIONS']` | Allowed methods |
| `headers` | `string[]` | `['Content-Type', 'Authorization']` | Allowed headers |
| `credentials` | `boolean` | `false` | Allow credentials |

::: tip
SSE/HTTP transports already set `Access-Control-Allow-Origin: *` by default. Use `corsPlugin` only when you need finer control. No effect on `stdio`.
:::

## webhookPlugin

Sends tool call events to an external URL. For monitoring, Slack notifications, log collection.

```typescript
import { webhookPlugin } from '@airmcp-dev/core';
use: [webhookPlugin({
  url: 'https://hooks.slack.com/services/xxx',
  events: ['tool.call', 'tool.error'],
})]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | Webhook URL (required) |
| `events` | `Array<'tool.call' \| 'tool.error' \| 'tool.slow'>` | `['tool.call']` | Event types to send |
| `slowThresholdMs` | `number` | `5000` | Latency threshold for `tool.slow` events |
| `headers` | `Record<string, string>` | — | Custom request headers |
| `batchSize` | `number` | `1` | Batch size (1 = immediate) |

### Payload format

```typescript
// tool.call
{ event: 'tool.call', tool: 'search', duration: 45, timestamp: '...', server: 'my-server' }

// tool.error
{ event: 'tool.error', tool: 'search', error: 'Connection refused', timestamp: '...', server: 'my-server' }

// tool.slow (duration > slowThresholdMs)
{ event: 'tool.slow', tool: 'search', duration: 12500, threshold: 5000, timestamp: '...' }
```

When `batchSize > 1`, payloads are batched as `{ events: [...] }`. Send failures are logged to stderr and ignored (no impact on server).
