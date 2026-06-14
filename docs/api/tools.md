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
  outputSchema?: AirToolParams;       // MCP 2025-06-18 Structured Output
  annotations?: AirToolAnnotations;   // MCP 2025-03-26 Tool Annotations
  handler: AirToolHandler;
  layer?: number;
  tags?: string[];
}): AirToolDef;
```

## Tool Annotations <Badge text="0.2.0" />

MCP 2025-03-26 spec. Hints for clients about tool behavior. All fields optional.

```typescript
defineTool('delete_user', {
  description: 'Delete a user permanently',
  params: { userId: 'string' },
  annotations: {
    title: 'Delete User',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async ({ userId }) => { /* ... */ },
});
```

### AirToolAnnotations

```typescript
interface AirToolAnnotations {
  title?: string;            // Human-readable title
  readOnlyHint?: boolean;    // No data modification
  destructiveHint?: boolean; // Deletes, overwrites, etc.
  idempotentHint?: boolean;  // Same input → same result
  openWorldHint?: boolean;   // Interacts with external systems
}
```

## Structured Output <Badge text="0.2.0" />

MCP 2025-06-18 spec. Define output schema — handler result auto-converts to `structuredContent`.

```typescript
defineTool('get_user', {
  params: { userId: 'string' },
  outputSchema: { name: 'string', email: 'string', age: 'number?' },
  handler: async ({ userId }) => ({
    name: 'Alice',
    email: 'alice@example.com',
    age: 30,
  }),
});
```

`outputSchema` uses the same `AirToolParams` format as `params`.

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
  signal?: AbortSignal;       // Request cancellation (0.2.0)
  elicit?: (message: string, schema: AirElicitSchema) => Promise<AirElicitResult>;  // (0.2.0)
}
```

### Elicitation <Badge text="0.2.0" />

MCP 2025-06-18 spec. Request user input mid-execution. Available when the client supports elicitation.

```typescript
defineTool('deploy', {
  params: { env: 'string' },
  annotations: { destructiveHint: true },
  handler: async ({ env }, ctx) => {
    if (env === 'production' && ctx.elicit) {
      const confirm = await ctx.elicit('Deploy to production?', {
        confirmed: { type: 'boolean', description: 'Confirm deployment' },
      });
      if (confirm.action !== 'accept') return 'Deployment cancelled';
    }
    return `Deployed to ${env}`;
  },
});
```

```typescript
interface AirElicitSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required?: boolean;
  };
}

interface AirElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, any>;
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
| `{ resource: { uri, name?, ... } }` | `[{ type: 'resource_link', uri, name?, ... }]` |
| `{ content: [...] }` | Passthrough |

### Resource Links <Badge text="0.2.0" />

MCP 2025-06-18 spec. Return a reference to a resource instead of inlining data.

```typescript
defineTool('get_report', {
  params: { reportId: 'string' },
  handler: async ({ reportId }) => ({
    resource: {
      uri: `report://reports/${reportId}`,
      name: `Report ${reportId}`,
      description: 'Quarterly report',
      mimeType: 'application/pdf',
    },
  }),
});
```

### McpContent

```typescript
interface McpContent {
  type: 'text' | 'image' | 'resource' | 'resource_link';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;          // resource_link only
  name?: string;         // resource_link only
  description?: string;  // resource_link only
}
```
