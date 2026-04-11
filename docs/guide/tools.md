# Tools

Tools are the primary way MCP clients (like Claude) interact with your server. Define them with `defineTool`.

## What is a tool?

In MCP, a Tool is a function that AI calls to **perform an action**. Unlike Resources (read-only data), tools can have side effects.

- Tools: write to DB, send email, call API, create files
- Resources: read config, check status, view files — see [Resources guide](/guide/resources)

## Basic tool

```typescript
import { defineTool } from '@airmcp-dev/core';

const greet = defineTool('greet', {
  description: 'Say hello',
  params: { name: 'string' },
  handler: async ({ name }) => `Hello, ${name}!`,
});
```

## defineTool API

```typescript
function defineTool(name: string, options: {
  description?: string;       // Description (LLM uses this to select the tool)
  params?: AirToolParams;     // Parameter definitions
  handler: AirToolHandler;    // Handler function
  layer?: number;             // L1-L7 Meter classification hint
  tags?: string[];            // Tags for filtering
}): AirToolDef;
```

### Writing good descriptions

`description` is the only text LLM uses to decide when to call your tool. Better descriptions → more accurate tool selection.

```typescript
// ❌ Too vague — AI can't tell when to use this
defineTool('search', {
  description: 'Search',
  // ...
});

// ✅ Specific — AI understands the purpose
defineTool('search', {
  description: 'Search documents by keyword. Full-text search across titles and body, results sorted by relevance.',
  // ...
});
```

## Parameter types

Three ways to define parameters. All three can be mixed in the same params object.

### Shorthand strings

Simplest. Append `?` for optional.

```typescript
params: {
  query: 'string',           // required string
  limit: 'number?',          // optional number
  verbose: 'boolean?',       // optional boolean
  metadata: 'object',        // required object
  options: 'object?',        // optional object
}
```

Shorthand to Zod conversion:

| Shorthand | Zod Schema |
|-----------|-----------|
| `'string'` | `z.string()` |
| `'string?'` | `z.string().optional()` |
| `'number'` | `z.number()` |
| `'number?'` | `z.number().optional()` |
| `'boolean'` | `z.boolean()` |
| `'boolean?'` | `z.boolean().optional()` |
| `'object'` | `z.record(z.any())` |
| `'object?'` | `z.record(z.any()).optional()` |

### Object format

Explicit control over description and optional flag. The `description` is used by MCP clients as parameter help text.

```typescript
params: {
  query: { type: 'string', description: 'Search query' },
  limit: { type: 'number', description: 'Max results', optional: true },
  includeArchived: { type: 'boolean', description: 'Include archived items', optional: true },
}
```

Object format `description` is converted to Zod's `.describe()`.

### Zod schemas

Full Zod power for complex validation.

```typescript
import { z } from 'zod';

params: {
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  tags: z.array(z.string()).optional(),
  role: z.enum(['admin', 'user', 'guest']),
}
```

### Mixing formats

```typescript
params: {
  query: 'string',                                    // shorthand
  limit: { type: 'number', description: 'Max', optional: true },  // object
  tags: z.array(z.string()).optional(),                // Zod
}
```

### Tools without params

Omit `params` to create a tool callable without arguments:

```typescript
defineTool('now', {
  description: 'Return current time',
  handler: async () => new Date().toISOString(),
});
```

## Handler function

The handler receives two arguments: parsed params and a context object.

```typescript
handler: async (params, context) => {
  console.log(context.requestId);    // UUID v4 (crypto.randomUUID())
  console.log(context.serverName);   // Server name
  console.log(context.startedAt);    // Timestamp (ms)
  console.log(context.state);        // Global server state
  return 'result';
}
```

### AirToolContext

```typescript
interface AirToolContext {
  requestId: string;          // Generated via crypto.randomUUID()
  serverName: string;         // From defineServer name
  startedAt: number;          // Date.now()
  state: Record<string, any>; // Same reference as server.state
}
```

### Sync and async

Handlers can be async (return Promise) or synchronous:

```typescript
// Async
handler: async ({ query }) => {
  const results = await db.search(query);
  return results;
}

// Sync
handler: ({ a, b }) => a + b
```

## Response types

Handlers can return various types. air's `normalizeResult` function auto-converts them to MCP content format.

### Conversion rules

| Return value | MCP result |
|-------------|-----------|
| `string` | `[{ type: 'text', text: '...' }]` |
| `number` | `[{ type: 'text', text: '42' }]` (String conversion) |
| `boolean` | `[{ type: 'text', text: 'true' }]` (String conversion) |
| `null` / `undefined` | `[{ type: 'text', text: '' }]` (empty text) |
| `Array` | `[{ type: 'text', text: '...' }]` (JSON.stringify, pretty) |
| `Object` | `[{ type: 'text', text: '...' }]` (JSON.stringify, pretty) |
| `{ text: string }` | `[{ type: 'text', text: '...' }]` |
| `{ image: string, mimeType? }` | `[{ type: 'image', data: '...', mimeType: '...' }]` |
| `{ content: McpContent[] }` | Passed through as-is (already MCP format) |

### Examples

```typescript
// String
handler: async () => 'hello'

// Number → string
handler: async () => 42

// null → empty text
handler: async () => null

// Object → pretty JSON
handler: async () => ({ name: 'Alice', age: 30 })
// → [{ type: 'text', text: '{\n  "name": "Alice",\n  "age": 30\n}' }]

// Array → pretty JSON
handler: async () => [1, 2, 3]
// → [{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]

// Explicit text
handler: async () => ({ text: 'formatted result' })

// Image
handler: async () => ({
  image: 'base64-encoded-png-data',
  mimeType: 'image/png',
})

// Already MCP format — multiple content blocks
handler: async () => ({
  content: [
    { type: 'text', text: 'Image description:' },
    { type: 'image', data: 'base64...', mimeType: 'image/png' },
  ],
})
```

## Layer hints

The `layer` property hints the [Meter](/guide/meter) classifier:

```typescript
defineTool('cache-lookup', { layer: 1, handler: async ({ key }) => cache.get(key) });
defineTool('db-query', { layer: 3, handler: async ({ sql }) => db.query(sql) });
defineTool('ai-summarize', { layer: 6, handler: async ({ text }) => llm.summarize(text) });
defineTool('ai-agent', { layer: 7, handler: async ({ task }) => agentLoop(task) });
```

Omit `layer` and Meter auto-classifies based on execution time.

## Tags

Metadata for grouping and filtering:

```typescript
defineTool('user-search', { tags: ['user', 'read'], handler: async ({ query }) => db.users.find(query) });
defineTool('user-create', { tags: ['user', 'write'], handler: async ({ data }) => db.users.create(data) });

const readTools = server.tools().filter(t => t.tags?.includes('read'));
```

## Runtime tool addition

```typescript
server.addTool(defineTool('dynamic-tool', {
  description: 'Added at runtime',
  handler: async () => 'works!',
}));
```

`addTool` passes through plugin `onToolRegister` hooks.

## Helpers

### paramsToZodSchema

Converts shorthand params to a Zod schema. Internally applies `.passthrough()` so undefined keys pass through.

```typescript
import { paramsToZodSchema } from '@airmcp-dev/core';

const schema = paramsToZodSchema({ query: 'string', limit: 'number?' });
// → z.object({ query: z.string(), limit: z.number().optional() }).passthrough()

paramsToZodSchema(undefined);  // → undefined
paramsToZodSchema({});          // → undefined
```

### paramsToJsonSchema

Converts to JSON Schema for MCP tool registration:

```typescript
import { paramsToJsonSchema } from '@airmcp-dev/core';

const jsonSchema = paramsToJsonSchema({
  query: { type: 'string', description: 'Search query' },
  limit: 'number?',
});
// → { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] }
```

### normalizeResult

Converts handler return values to MCP content array:

```typescript
import { normalizeResult } from '@airmcp-dev/core';

normalizeResult('hello');           // → [{ type: 'text', text: 'hello' }]
normalizeResult(42);                // → [{ type: 'text', text: '42' }]
normalizeResult(null);              // → [{ type: 'text', text: '' }]
normalizeResult({ name: 'Alice' }); // → [{ type: 'text', text: '{\n  "name": "Alice"\n}' }]
normalizeResult([1, 2, 3]);         // → [{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]
```
