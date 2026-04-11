# Logging

air has built-in logging that works out of the box. Customize levels, format, and add external transports.

## Default behavior

Every `defineServer` automatically registers a builtin logger plugin:

- **Development** (`NODE_ENV !== 'production'`): pretty-printed to stdout
- **Production**: JSON to stdout

```
[air] 12:34:56 INFO  search called { query: 'hello' }
[air] 12:34:56 INFO  search completed (45ms)
```

## Configuration

```typescript
defineServer({
  logging: {
    level: 'debug',     // 'debug' | 'info' | 'warn' | 'error' | 'silent'
    format: 'json',     // 'json' | 'pretty'
  },
});
```

### Log levels

| Level | Description | Shows |
|-------|-------------|-------|
| `debug` | Verbose, all details | debug + info + warn + error |
| `info` | Normal operations (default) | info + warn + error |
| `warn` | Potential issues | warn + error |
| `error` | Failures only | error |
| `silent` | No output | nothing |

### Format examples

**pretty** (default in dev):
```
[air] 12:34:56 INFO  greet called { name: 'World' }
[air] 12:34:56 INFO  greet → "Hello, World!" (2ms)
```

**json** (default in prod):
```json
{"level":"info","tool":"greet","event":"call","params":{"name":"World"},"timestamp":"2025-01-01T00:00:00.000Z"}
{"level":"info","tool":"greet","event":"complete","duration":2,"timestamp":"2025-01-01T00:00:00.000Z"}
```

## jsonLoggerPlugin

For more control, use the `jsonLoggerPlugin` alongside or instead of the builtin logger:

```typescript
import { defineServer, jsonLoggerPlugin } from '@airmcp-dev/core';

defineServer({
  logging: { level: 'silent' },  // Disable builtin logger
  use: [
    jsonLoggerPlugin({
      logParams: true,
      logResult: false,
      output: 'stdout',
    }),
  ],
});
```

## @airmcp-dev/logger package

For advanced use cases (file rotation, remote transport), use the standalone logger:

```typescript
import { createLogger } from '@airmcp-dev/logger';

const logger = createLogger({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
  file: {
    path: './logs/server.log',
    maxSizeMb: 10,
    maxFiles: 5,
  },
});

// Use in tool handlers
defineTool('search', {
  handler: async (params, context) => {
    logger.info('Search started', { query: params.query });
    const results = await doSearch(params.query);
    logger.debug('Search results', { count: results.length });
    return results;
  },
});
```

### Remote transport

Send logs to a centralized logging service:

```typescript
const logger = createLogger({
  level: 'info',
  format: 'json',
  transports: ['console', 'remote'],
  remote: {
    url: 'https://logs.example.com/ingest',
    batchSize: 100,
    flushIntervalMs: 5000,
    headers: { 'Authorization': 'Bearer xxx' },
  },
});
```

## Logging in middleware

Access the server name and request ID for structured logs:

```typescript
const auditMiddleware: AirMiddleware = {
  name: 'audit',
  before: async (ctx) => {
    console.log(JSON.stringify({
      event: 'tool.call',
      tool: ctx.tool.name,
      requestId: ctx.requestId,
      server: ctx.serverName,
      timestamp: new Date().toISOString(),
    }));
  },
  after: async (ctx) => {
    console.log(JSON.stringify({
      event: 'tool.complete',
      tool: ctx.tool.name,
      requestId: ctx.requestId,
      duration: ctx.duration,
      timestamp: new Date().toISOString(),
    }));
  },
};
```

## Environment variable

```bash
# Override log level without changing code
AIR_LOG_LEVEL=debug node dist/index.js
```

::: tip
When using `stdio` transport, all logs go to **stderr** (not stdout). stdout is reserved for the MCP protocol. air handles this automatically.
:::
