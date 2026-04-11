# Middleware

Middleware intercepts tool calls at three stages: before (pre-execution), after (post-execution), and onError (on failure).

## Structure

```typescript
interface AirMiddleware {
  name: string;
  before?: (ctx: MiddlewareContext) => Promise<MiddlewareResult | void>;
  after?: (ctx: MiddlewareContext & { result: any; duration: number }) => Promise<void>;
  onError?: (ctx: MiddlewareContext, error: Error) => Promise<any>;
}
```

All three hooks are optional. Implement only what you need.

## MiddlewareContext

```typescript
interface MiddlewareContext {
  tool: AirToolDef;              // Tool being called
  params: Record<string, any>;   // Request params (modifiable in before)
  requestId: string;             // Unique request ID (UUID)
  serverName: string;            // Server name
  startedAt: number;             // Call start timestamp (ms)
  meta: Record<string, any>;     // Shared metadata between middleware
}
```

`meta` starts as an empty object. Use it to pass data between middleware.

## before — pre-execution

Called **before** the tool handler runs. Can modify params, abort the call, or add metadata.

### MiddlewareResult

```typescript
interface MiddlewareResult {
  params?: Record<string, any>;  // Modified params (undefined = keep original)
  abort?: boolean;               // true = skip remaining middleware + handler
  abortResponse?: any;           // Response when aborting (passed through normalizeResult)
  meta?: Record<string, any>;    // Add to shared metadata
}
```

### Modify params

```typescript
const limitMiddleware: AirMiddleware = {
  name: 'limit-enforcer',
  before: async (ctx) => {
    return {
      params: {
        ...ctx.params,
        limit: Math.min(ctx.params.limit || 100, 100),
      },
    };
  },
};
```

::: info
When you return `params`, all subsequent middleware and the handler receive the **modified params**. This also applies to the builtin validation middleware — after Zod validation passes, params are replaced with `result.data` (the parsed/cleaned data).
:::

### Abort early

```typescript
const blockMiddleware: AirMiddleware = {
  name: 'blocker',
  before: async (ctx) => {
    if (ctx.params.blocked) {
      return {
        abort: true,
        abortResponse: 'Request blocked',
      };
    }
  },
};
```

When `abort: true`, all remaining before middleware, the handler, and after middleware are skipped. `abortResponse` is passed through `normalizeResult()` and returned as the MCP response.

### Add metadata

```typescript
const timingMiddleware: AirMiddleware = {
  name: 'timing',
  before: async (ctx) => {
    ctx.meta.startTime = performance.now();
  },
  after: async (ctx) => {
    const elapsed = performance.now() - ctx.meta.startTime;
    console.log(`${ctx.tool.name}: ${elapsed.toFixed(1)}ms`);
  },
};
```

## after — post-execution

Called after the handler **completes successfully**. `ctx` includes `result` (handler return value) and `duration` (execution time in ms).

```typescript
const auditMiddleware: AirMiddleware = {
  name: 'audit',
  after: async (ctx) => {
    console.log(JSON.stringify({
      tool: ctx.tool.name,
      requestId: ctx.requestId,
      duration: ctx.duration,
      timestamp: new Date().toISOString(),
    }));
  },
};
```

::: warning
Errors thrown in after middleware are **silently ignored**. The result is already finalized, so after errors cannot affect the response.
:::

## onError — error handling

Called when the handler or a before middleware throws an error.

```typescript
const errorReporter: AirMiddleware = {
  name: 'error-reporter',
  onError: async (ctx, error) => {
    await reportToSentry({
      error: error.message,
      tool: ctx.tool.name,
      requestId: ctx.requestId,
    });

    // undefined → pass to next onError middleware
    return undefined;
  },
};
```

### Error recovery

If `onError` **returns a value**, that value becomes the normal response (error is recovered):

```typescript
const gracefulMiddleware: AirMiddleware = {
  name: 'graceful',
  onError: async (ctx, error) => {
    if (error.message.includes('ECONNREFUSED')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    return undefined;  // Pass to next handler
  },
};
```

### Error handling order

```
Handler throws
  → Run registered middleware onError in order
  → If any returns a value → used as normal response (rest skipped)
  → If all return undefined → errorBoundaryMiddleware returns error message
```

## Builtin middleware

Auto-registered by `defineServer()`. Don't add these manually.

### errorBoundaryMiddleware

Catches all errors and converts to MCP protocol format. Sits at the outermost layer of the chain.

```typescript
// Error response format
{
  content: [{ type: 'text', text: '[-32603] Internal error: something broke' }],
  isError: true,
}
```

Error logs go to **stderr**:

```
[air:error] search (a1b2c3d4-...): Connection refused
```

### validationMiddleware

Converts tool `params` definitions to Zod schemas and validates every call.

On validation failure, returns a detailed error message:

```
[Validation] Invalid parameters for "search":
  - query: Expected string, received number (expected: string, got: number)
  - limit: Expected number, received string (expected: number, got: string)

Expected schema:
  - query: string
  - limit: number (optional)
```

On success, params are replaced with Zod's **parsed data** (`result.data`). Since `.passthrough()` is used, extra fields not in the schema pass through.

## Register in server

```typescript
defineServer({
  middleware: [timingMiddleware, auditMiddleware],
});
```

`middleware` array runs **after all plugin middleware**. Put reusable logic in `use` (plugins), server-specific logic in `middleware`.

## MCP error codes

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

McpErrors.toolNotFound('missing');        // -32601
McpErrors.invalidParams('bad email');     // -32602
McpErrors.internal('db failed');          // -32603
McpErrors.forbidden('not allowed');       // -32000
McpErrors.rateLimited('search', 30000);  // -32001
McpErrors.threatDetected('injection', 'high');  // -32002
McpErrors.timeout('slow', 10000);        // -32003

// Custom error
throw new AirError('Insufficient credits', -32010, { required: 100, available: 42 });
```

## Full execution flow

```
Request arrives
  ↓
errorBoundaryMiddleware.before     (error capture)
validationMiddleware.before        (validate + clean params)
  ↓
builtinLoggerPlugin.before
builtinMetricsPlugin.before
  ↓
use[0].before → use[1].before → ...   (plugin middleware)
  ↓
middleware[0].before → middleware[1].before → ...   (user middleware)
  ↓
handler()                          (tool handler)
  ↓
middleware[0].after → middleware[1].after → ...
use[0].after → use[1].after → ...
builtinMetricsPlugin.after         (record calls, latency)
builtinLoggerPlugin.after          (log output)
  ↓
normalizeResult()                  (convert return value → MCP content)
  ↓
Response returned
```
