# Middleware & Errors Reference

## AirMiddleware

```typescript
interface AirMiddleware {
  name: string;
  before?: (ctx: MiddlewareContext) => Promise<MiddlewareResult | void>;
  after?: (ctx: MiddlewareContext & { result: any; duration: number }) => Promise<void>;
  onError?: (ctx: MiddlewareContext, error: Error) => Promise<any>;
}
```

### MiddlewareContext

```typescript
interface MiddlewareContext {
  tool: AirToolDef;
  params: Record<string, any>;
  requestId: string;
  serverName: string;
  startedAt: number;
  meta: Record<string, any>;
}
```

### MiddlewareResult

```typescript
interface MiddlewareResult {
  params?: Record<string, any>;
  abort?: boolean;
  abortResponse?: any;           // Passed through normalizeResult
  meta?: Record<string, any>;
}
```

### Chain execution flow

```
before middleware (in order)
  ↓ abort → normalizeResult(abortResponse)
  ↓ params modification → applied to subsequent middleware/handler
handler()
  ↓ error → onError middleware in order (return value = normal response)
after middleware (in order, errors silently ignored)
  ↓
normalizeResult(result)
```

## AirError

```typescript
class AirError extends Error {
  code: number;
  details?: Record<string, any>;
  constructor(message: string, code?: number, details?: Record<string, any>);
}
```

## McpErrors

```typescript
McpErrors.toolNotFound(name): AirError;                    // -32601
McpErrors.invalidParams(message, params?): AirError;       // -32602
McpErrors.internal(message, cause?): AirError;             // -32603
McpErrors.forbidden(message): AirError;                    // -32000
McpErrors.rateLimited(tool, retryAfterMs?): AirError;      // -32001
McpErrors.timeout(tool, timeoutMs): AirError;              // -32003
```

## Built-in middleware

**errorBoundaryMiddleware**: catches all errors → MCP format. Logs to stderr.

**validationMiddleware**: params → Zod schema → validate every call. On success, replaces params with `result.data` (`.passthrough()` applied).
