# Resources

Resources expose data to MCP clients. Clients read them by URI.

## Tools vs Resources

MCP has two primitives — Tools and Resources:

| | Tool | Resource |
|---|---|---|
| **Purpose** | Perform actions (side effects) | Read data (read-only) |
| **Invocation** | Name + params | URI |
| **Examples** | Write to DB, send email, call API | Read config, check status, view files |
| **AI perspective** | "Execute this" | "Show me this data" |

Simple rule: **modifies data → Tool**, **reads data → Resource**.

## Basic resource

```typescript
import { defineResource } from '@airmcp-dev/core';

const config = defineResource('config://app', {
  name: 'app-config',
  description: 'Application configuration',
  handler: async () => ({ version: '1.0.0', env: process.env.NODE_ENV }),
});
```

## defineResource API

Two calling styles:

```typescript
// Style 1: URI + options
defineResource('config://app', {
  name: 'app-config',
  handler: async (uri, context) => { /* ... */ },
});

// Style 2: Single object
defineResource({
  uri: 'config://app',
  name: 'app-config',
  handler: async (uri, context) => { /* ... */ },
});
```

### AirResourceDef

```typescript
interface AirResourceDef {
  uri: string;                  // Resource URI (e.g. "config://app")
  name: string;                 // Display name
  description?: string;         // Description
  mimeType?: string;            // MIME type (default: text/plain)
  handler: (uri: string, context: AirResourceContext) => Promise<AirResourceContent>;
}
```

## Handler

The handler receives the requested URI and a context object:

```typescript
interface AirResourceContext {
  requestId: string;    // crypto.randomUUID()
  serverName: string;   // From defineServer name
}
```

Example:

```typescript
defineResource('status://server', {
  name: 'server-status',
  handler: async (uri, context) => {
    return {
      text: JSON.stringify({
        server: context.serverName,
        requestId: context.requestId,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }),
      mimeType: 'application/json',
    };
  },
});
```

## Response types

```typescript
// String → text/plain
handler: async () => 'plain text content'

// Text with MIME
handler: async () => ({
  text: '{"key": "value"}',
  mimeType: 'application/json',
})

// Binary (base64)
handler: async () => ({
  blob: 'base64-encoded-data',
  mimeType: 'image/png',
})
```

Type definition:

```typescript
type AirResourceContent =
  | string                                          // → text/plain
  | { text: string; mimeType?: string }            // → specified MIME
  | { blob: string; mimeType: string };            // → binary
```

## URI templates

Use `{variable}` syntax for dynamic URIs. When a client requests an actual URI (e.g., `file:///readme.md`), extract variables in the handler.

```typescript
import { matchTemplate } from '@airmcp-dev/core';

defineResource('file:///{path}', {
  name: 'file-reader',
  description: 'Read a file by path',
  handler: async (uri) => {
    const vars = matchTemplate('file:///{path}', uri);
    if (!vars) return 'File not found';
    return readFile(vars.path, 'utf-8');
  },
});
```

Multiple variables:

```typescript
defineResource('db:///{database}/{table}', {
  name: 'db-table',
  handler: async (uri) => {
    const vars = matchTemplate('db:///{database}/{table}', uri);
    if (!vars) return 'Not found';
    return JSON.stringify(await db.query(vars.database, vars.table));
  },
});
```

### Template helpers

```typescript
import { extractTemplateVars, matchTemplate } from '@airmcp-dev/core';

extractTemplateVars('file:///{path}');           // → ['path']
extractTemplateVars('db:///{database}/{table}'); // → ['database', 'table']

matchTemplate('user:///{id}/profile', 'user:///42/profile');   // → { id: '42' }
matchTemplate('user:///{id}/profile', 'user:///42/settings');  // → null
```

Internal implementation: `{variable}` is converted to regex `(?<variable>[^/]+)` for matching.

## Register in server

```typescript
defineServer({
  resources: [
    defineResource('config://app', {
      name: 'app-config',
      handler: async () => ({ version: '1.0.0', env: 'production' }),
    }),
    defineResource('db:///{table}', {
      name: 'db-table',
      mimeType: 'application/json',
      handler: async (uri) => {
        const { table } = matchTemplate('db:///{table}', uri)!;
        return JSON.stringify(await db.query(`SELECT * FROM ${table} LIMIT 10`));
      },
    }),
    defineResource('logo://app', {
      name: 'app-logo',
      mimeType: 'image/png',
      handler: async () => ({
        blob: await readFile('assets/logo.png', 'base64'),
        mimeType: 'image/png',
      }),
    }),
  ],
});
```

## Query registered resources

```typescript
const resources = server.resources();
// [
//   { uri: 'config://app', name: 'app-config', ... },
//   { uri: 'db:///{table}', name: 'db-table', ... },
// ]
```
