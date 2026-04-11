# @airmcp-dev/meter

7-layer call classification and metrics collection for MCP servers.

## Installation

```bash
npm install @airmcp-dev/meter
```

Meter is also included in `@airmcp-dev/core` as middleware. The standalone package adds advanced features.

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;          // Default: true
  classify?: boolean;         // 7-layer auto-classification (default: true)
  trackCalls?: boolean;       // Call tracking (default: true)
  trackTokens?: boolean;      // Token usage tracking (default: false)
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## 7-Layer classification

| Layer | Matching patterns | Description |
|-------|------------------|-------------|
| L1 | `ping`, `health`, `version`, `echo` | Static response |
| L2 | `get`, `read`, `find`, `lookup`, `list`, `show` | Simple lookup |
| L3 | `convert`, `transform`, `format`, `parse`, `encode`, `decode` | Data transformation |
| L4 | `compute`, `calculate`, `aggregate`, `analyze`, `summarize` | Aggregation (default) |
| L5 | `fetch`, `request`, `call_api`, `webhook`, `http`, `post`, `put`, `delete` | External API |
| L6 | `generate`, `complete`, `chat`, `embed`, `infer`, `predict` | LLM call |
| L7 | `agent`, `think`, `plan`, `execute`, `reason`, `chain`, `orchestrate` | Agent chain |

Unmatched tools default to L4. Override with `defineTool`'s `layer` property.

## API

### getMetricsSnapshot()

```typescript
function getMetricsSnapshot(): {
  totalCalls: number;
  successRate: number;              // 0–1
  avgLatencyMs: number;
  layerDistribution: Record<'L1'|'L2'|'L3'|'L4'|'L5'|'L6'|'L7', number>;
  toolCounts: Record<string, number>;
};
```

### resetMetricsHistory()

```typescript
function resetMetricsHistory(): void;
```

## Internal storage

Ring Buffer (max 10,000 records). O(1) push, oldest records auto-evicted. Constant memory usage.

```typescript
interface CallRecord {
  tool: string;
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
  latencyMs: number;
  success: boolean;
  timestamp: number;
}
```

→ [Meter guide](/guide/meter)
