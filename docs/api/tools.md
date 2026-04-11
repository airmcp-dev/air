# Tools Reference

## defineTool(name, options)

```typescript
import { defineTool } from '@airmcp-dev/core';

const tool = defineTool('search', {
  description: 'Search documents',
  params: { query: 'string', limit: 'number?' },
  handler: async ({ query, limit }) => doSearch(query, limit),
  layer: 4,
  tags: ['search', 'read'],
});
```

### Signature

```typescript
function defineTool(name: string, options: {
  description?: string;
  params?: AirToolParams;
  handler: AirToolHandler;
  layer?: number;
  tags?: string[];
}): AirToolDef;
```

## Parameter types

### AirToolParams

Three formats, mixable:

```typescript
type AirToolParams = Record<string, ParamShorthand | ParamObjectDef | z.ZodType>;
```

### ParamShorthand

| Shorthand | Zod |
|-----------|-----|
| `'string'` | `z.string()` |
| `'string?'` | `z.string().optional()` |
| `'number'` | `z.number()` |
| `'number?'` | `z.number().optional()` |
| `'boolean'` | `z.boolean()` |
| `'boolean?'` | `z.boolean().optional()` |
| `'object'` | `z.record(z.any())` |
| `'object?'` | `z.record(z.any()).optional()` |

### ParamObjectDef

```typescript
interface ParamObjectDef {
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;      // → Zod .describe()
  optional?: boolean;         // → Zod .optional()
}
```

## AirToolHandler

```typescript
type AirToolHandler = (
  params: Record<string, any>,
  context: AirToolContext,
) => Promise<AirToolResponse> | AirToolResponse;
```

### AirToolContext

```typescript
interface AirToolContext {
  requestId: string;          // crypto.randomUUID()
  serverName: string;
  startedAt: number;
  state: Record<string, any>;
}
```

## paramsToZodSchema(params?)

Convert shorthand to Zod. Applies `.passthrough()`. Returns `undefined` if empty.

```typescript
paramsToZodSchema({ query: 'string', limit: 'number?' });
// → z.object({ query: z.string(), limit: z.number().optional() }).passthrough()
```

## paramsToJsonSchema(params?)

Convert to JSON Schema for MCP registration.

```typescript
paramsToJsonSchema({ query: 'string', limit: 'number?' });
// → { type: 'object', properties: { ... }, required: ['query'] }
```

## normalizeResult(value)

Convert handler return to MCP content array.

| Input | Output |
|-------|--------|
| `'hello'` | `[{ type: 'text', text: 'hello' }]` |
| `42` | `[{ type: 'text', text: '42' }]` |
| `null` | `[{ type: 'text', text: '' }]` |
| `[1,2,3]` | `[{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]` |
| `{ text: 'hi' }` | `[{ type: 'text', text: 'hi' }]` |
| `{ image: 'b64', mimeType: '...' }` | `[{ type: 'image', data: 'b64', mimeType: '...' }]` |
| `{ content: [...] }` | Passthrough |

### McpContent

```typescript
interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}
```
