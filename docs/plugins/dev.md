# Dev / Test Plugins

## dryrunPlugin

Skips handler execution and returns parameter validation + expected result info. For testing, CI, and schema verification.

```typescript
import { dryrunPlugin } from '@airmcp-dev/core';

// Global mode — all calls are dry-run
use: [dryrunPlugin({ enabled: true })]

// Environment variable control
use: [dryrunPlugin({ enabled: process.env.DRY_RUN === 'true' })]

// Per-call mode — only calls with _dryrun parameter
use: [dryrunPlugin({ perCall: true })]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Global dry-run activation |
| `perCall` | `boolean` | `true` | Only dry-run calls with `_dryrun: true` param |
| `mockResponse` | `(toolName, params) => any` | — | Custom dry-run response generator |

### Default dry-run response

```json
{
  "dryrun": true,
  "tool": "search",
  "params": { "query": "hello" },
  "description": "Search documents",
  "schema": [
    { "name": "query", "type": "string", "provided": true, "value": "hello" },
    { "name": "limit", "type": "number", "provided": false, "value": null }
  ],
  "message": "[Dryrun] \"search\" would be called with: {\"query\":\"hello\"}"
}
```

### Custom response

```typescript
use: [dryrunPlugin({
  enabled: true,
  mockResponse: (toolName, params) => {
    if (toolName === 'search') return { results: [], total: 0 };
    return `[Mock] ${toolName} would run`;
  },
})]
```

### perCall mode caveat

`perCall` mode only works with `server.callTool()` direct calls:

```typescript
// ✅ Works — callTool passes through middleware chain as-is
server.callTool('search', { query: 'hello', _dryrun: true });

// ❌ Doesn't work — MCP SDK strips params not in schema
// Claude Desktop → server calls won't have _dryrun param
```

For MCP client calls, use `enabled: true` global mode or environment variables.
