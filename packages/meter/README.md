# @airmcp-dev/meter

7-layer call classification and cost tracking for air MCP servers.

## Install

```bash
npm install @airmcp-dev/meter
```

## Quick Example

```typescript
import { defineServer } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  meter: { classify: true, trackCalls: true },
  tools: [
    defineTool('cached_lookup', {
      layer: 1,  // L1: cache hit, near-zero cost
      handler: async () => getCachedData(),
    }),
    defineTool('ai_chain', {
      layer: 7,  // L7: multi-step agent, heavy token usage
      handler: async () => runAgentChain(),
    }),
  ],
});
```

## 7-Layer Classification

| Layer | Type | Cost |
|-------|------|------|
| L1 | Cache / Static | Minimal |
| L2 | Direct lookup | Low |
| L3 | Simple transform | Low |
| L4 | Computation | Medium |
| L5 | External API | Medium-High |
| L6 | LLM single call | High |
| L7 | Agent chain | Very High |

## Features

- **Auto-classification** based on execution time if no `layer` hint
- **Token cost tracking** with daily/monthly budgets
- **Ring buffer** metrics (10,000 records, constant memory)
- **getMetrics()** / **getMetricsSnapshot()** for per-tool and aggregate stats

## Documentation

Full docs: **[docs.airmcp.dev](https://docs.airmcp.dev)**

## License

Apache-2.0 — [GitHub](https://github.com/airmcp-dev/air)
