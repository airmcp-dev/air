# Error Handling

air converts all errors to MCP protocol format automatically. You can also throw custom errors with specific codes.

## How errors flow

```
Tool handler throws → onError middleware runs → MCP error response returned
```

The built-in `errorBoundaryMiddleware` catches every unhandled error and converts it to MCP format:

```json
{
  "content": [{ "type": "text", "text": "[-32603] Internal error: something broke" }],
  "isError": true
}
```

## MCP error codes

air uses standard JSON-RPC error codes plus custom codes for security:

| Code | Constant | When |
|------|----------|------|
| -32601 | `toolNotFound` | Tool name doesn't exist |
| -32602 | `invalidParams` | Param validation failed (Zod) |
| -32603 | `internal` | Unhandled error in handler |
| -32000 | `forbidden` | Access denied |
| -32001 | `rateLimited` | Rate limit exceeded |
| -32002 | `threatDetected` | Threat pattern matched |
| -32003 | `timeout` | Tool execution timed out |

## Throwing errors in handlers

### Simple error

```typescript
defineTool('divide', {
  params: { a: 'number', b: 'number' },
  handler: async ({ a, b }) => {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  },
});
// → { content: [{ type: 'text', text: '[-32603] Internal error: Division by zero' }], isError: true }
```

### AirError with code

```typescript
import { AirError } from '@airmcp-dev/core';

defineTool('admin-action', {
  handler: async (params, context) => {
    if (!context.state.isAdmin) {
      throw new AirError('Admin access required', -32000, { role: 'user' });
    }
    // ...
  },
});
// → { content: [{ type: 'text', text: '[-32000] Admin access required' }], isError: true }
```

### McpErrors factory

```typescript
import { McpErrors } from '@airmcp-dev/core';

// Predefined error factories
throw McpErrors.toolNotFound('missing-tool');
throw McpErrors.invalidParams('email must be valid');
throw McpErrors.internal('Database connection failed');
throw McpErrors.forbidden('Access denied by policy');
throw McpErrors.rateLimited('search', 30000);
throw McpErrors.threatDetected('prompt_injection', 'high');
throw McpErrors.timeout('slow-tool', 10000);
```

## AirError class

```typescript
class AirError extends Error {
  code: number;                        // MCP error code
  details?: Record<string, any>;       // Additional metadata

  constructor(message: string, code?: number, details?: Record<string, any>);
}
```

### Examples

```typescript
// Custom business logic error
throw new AirError('Insufficient credits', -32010, {
  required: 100,
  available: 42,
});

// Validation error with details
throw new AirError('Invalid date range', -32602, {
  field: 'startDate',
  reason: 'startDate must be before endDate',
});
```

## Custom error middleware

You can add your own error handling middleware:

```typescript
const errorReporter: AirMiddleware = {
  name: 'error-reporter',
  onError: async (ctx, error) => {
    // Send to error tracking service
    await reportToSentry({
      error: error.message,
      tool: ctx.tool.name,
      params: ctx.params,
      requestId: ctx.requestId,
    });

    // Return undefined to let the next error middleware handle it
    // Return a value to use it as the response
    return undefined;
  },
};

defineServer({
  middleware: [errorReporter],
  // ...
});
```

## Error handling order

```
handler throws
  → plugin onError middleware (in reverse order)
  → user onError middleware
  → errorBoundaryMiddleware (always last, catches everything)
```

If any `onError` middleware returns a value, that value becomes the response and remaining error middleware is skipped.
