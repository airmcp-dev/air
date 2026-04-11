# Meter

Meter auto-classifies every MCP call into 7 layers and tracks call volume, latency, and success rate. Included in `@airmcp-dev/core` — no separate install needed.

## Enable Meter

```typescript
defineServer({
  meter: { classify: true, trackCalls: true },
});
```

Meter is enabled by default (`meter.enabled` defaults to `true`). The meter middleware is automatically added to the chain.

## 7-Layer auto-classification

Meter classifies calls based on tool name patterns:

| Layer | Matching patterns | Description |
|-------|------------------|-------------|
| L1 | `ping`, `health`, `version`, `echo` | Static response, near-zero cost |
| L2 | `get`, `read`, `find`, `lookup`, `list`, `show` | Simple lookup |
| L3 | `convert`, `transform`, `format`, `parse`, `encode`, `decode` | Data transformation |
| L4 | `compute`, `calculate`, `aggregate`, `analyze`, `summarize` | Aggregation/computation (default) |
| L5 | `fetch`, `request`, `call_api`, `webhook`, `http`, `post`, `put`, `delete` | External API call |
| L6 | `generate`, `complete`, `chat`, `embed`, `infer`, `predict` | LLM call |
| L7 | `agent`, `think`, `plan`, `execute`, `reason`, `chain`, `orchestrate` | Agent chain |

L5 also matches when any parameter value contains `http://` or `https://`.

**Tools that don't match any pattern default to L4.**

### Manual classification

Override auto-classification with the `layer` property on `defineTool`:

```typescript
defineTool('my-cache', {
  layer: 1,   // Force L1
  handler: async ({ key }) => cache.get(key),
});

defineTool('custom-llm-call', {
  layer: 6,   // Force L6
  handler: async ({ prompt }) => callMyLLM(prompt),
});
```

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;        // Default: true
  classify?: boolean;       // 7-layer classification (default: true)
  trackCalls?: boolean;     // Call tracking (default: true)
  trackTokens?: boolean;    // Token usage tracking (default: false)
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## Metrics access

```typescript
import { getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

const snapshot = getMetricsSnapshot();
// {
//   totalCalls: 1500,
//   successRate: 0.98,
//   avgLatencyMs: 45.2,
//   layerDistribution: {
//     L1: 200, L2: 400, L3: 100, L4: 300,
//     L5: 250, L6: 200, L7: 50,
//   },
//   toolCounts: { search: 500, greet: 300, fetch: 250 },
// }

resetMetricsHistory();
```

### Return value details

| Field | Type | Description |
|-------|------|-------------|
| `totalCalls` | `number` | Total call count |
| `successRate` | `number` | Success rate (0–1) |
| `avgLatencyMs` | `number` | Overall average latency (ms) |
| `layerDistribution` | `Record<Layer, number>` | Calls per layer |
| `toolCounts` | `Record<string, number>` | Calls per tool |

## Internal storage

Meter uses a Ring Buffer (max 10,000 records) for call history. O(1) push, oldest records auto-evicted. Constant memory usage.

## Error behavior

Failed tool calls are still recorded (`success: false`). Meter does not handle errors — it passes them to the next middleware.

## Practical usage

### Layer monitoring

```typescript
const snapshot = getMetricsSnapshot();
const heavyRatio = (snapshot.layerDistribution.L6 + snapshot.layerDistribution.L7) / snapshot.totalCalls;
if (heavyRatio > 0.3) {
  console.warn(`Heavy call ratio: ${(heavyRatio * 100).toFixed(1)}%`);
}
```

### Periodic reporting

```typescript
setInterval(() => {
  const s = getMetricsSnapshot();
  console.log(JSON.stringify({
    totalCalls: s.totalCalls,
    successRate: s.successRate,
    avgLatencyMs: s.avgLatencyMs,
    layers: s.layerDistribution,
  }));
}, 60_000);
```
