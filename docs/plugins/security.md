# Security Plugins

## authPlugin

Authenticate tool calls with API keys or Bearer tokens.

```typescript
import { authPlugin } from '@airmcp-dev/core';

// API key auth
use: [authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] })]

// Bearer token auth
use: [authPlugin({ type: 'bearer', keys: [process.env.MCP_TOKEN!] })]
```

| Option | Type | Description |
|--------|------|-------------|
| `type` | `'api-key' \| 'bearer'` | Auth type |
| `keys` | `string[]` | Valid API keys / tokens |
| `verify` | `(token: string) => boolean \| Promise<boolean>` | Custom verification (instead of keys) |
| `publicTools` | `string[]` | Tools that skip auth (default: `[]`) |
| `paramName` | `string` | Auth parameter name (default: `'_auth'`) |

Internal:
- `before`: extracts token from `paramName` → validates via `keys` or `verify` → on success removes auth param and passes through
- `publicTools` listed tools skip auth entirely

```typescript
use: [authPlugin({
  type: 'bearer',
  verify: async (token) => !!(await db.verifyToken(token)),
  publicTools: ['ping', 'health'],
})]
```

::: warning
Always manage keys via environment variables. Never hardcode in source.
:::

## sanitizerPlugin

Auto-strips dangerous characters and patterns from input params.

```typescript
import { sanitizerPlugin } from '@airmcp-dev/core';
use: [sanitizerPlugin()]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stripHtml` | `boolean` | `true` | Remove HTML tags (`<[^>]*>` pattern) |
| `stripControl` | `boolean` | `true` | Remove control chars (0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F, 0x7F) |
| `maxStringLength` | `number` | `10000` | Truncate long strings |
| `exclude` | `string[]` | `[]` | Tool names to exclude |

Recursively sanitizes all string values, including nested objects and arrays.

```typescript
sanitizerPlugin({ stripHtml: false, maxStringLength: 50_000, exclude: ['html_render'] })
```

## validatorPlugin

Add custom validation rules beyond Zod schema.

```typescript
import { validatorPlugin } from '@airmcp-dev/core';

use: [validatorPlugin({
  rules: [
    { tool: 'search', validate: (params) => {
      if (params.query.length < 2) return 'Query must be at least 2 characters';
    }},
    { tool: '*', validate: (params) => {
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.length > 5000)
          return `${key} is too long (max 5000 chars)`;
      }
    }},
  ],
})]
```

Each rule: `tool` (name or `'*'`), `validate` (return error string to reject, `undefined` to pass).
