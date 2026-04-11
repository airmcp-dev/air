# 도구 레퍼런스

## defineTool(name, options)

```typescript
import { defineTool } from '@airmcp-dev/core';

const tool = defineTool('search', {
  description: '문서 검색',
  params: { query: 'string', limit: 'number?' },
  handler: async ({ query, limit }) => doSearch(query, limit),
  layer: 4,
  tags: ['search', 'read'],
});
```

### 시그니처

```typescript
function defineTool(name: string, options: {
  description?: string;
  params?: AirToolParams;
  handler: AirToolHandler;
  layer?: number;             // L1-L7 Meter 힌트
  tags?: string[];
}): AirToolDef;
```

### AirToolDef

```typescript
interface AirToolDef {
  name: string;
  description?: string;
  params?: AirToolParams;
  handler: AirToolHandler;
  layer?: number;
  tags?: string[];
}
```

## 파라미터 타입

### AirToolParams

세 가지 형식을 혼합 가능:

```typescript
type AirToolParams = Record<string, ParamShorthand | ParamObjectDef | z.ZodType>;
```

### ParamShorthand

```typescript
type ParamShorthand = 'string' | 'string?' | 'number' | 'number?' | 'boolean' | 'boolean?' | 'object' | 'object?';
```

변환 규칙:

| 단축 | Zod |
|------|-----|
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

### 혼합 예제

```typescript
params: {
  query: 'string',                                    // 단축
  limit: { type: 'number', description: '최대', optional: true },  // 객체
  email: z.string().email(),                           // Zod
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
  startedAt: number;          // Date.now()
  state: Record<string, any>; // server.state 참조
}
```

## paramsToZodSchema(params?)

단축/객체 파라미터를 Zod 스키마로 변환. `.passthrough()` 적용.

```typescript
import { paramsToZodSchema } from '@airmcp-dev/core';

const schema = paramsToZodSchema({ query: 'string', limit: 'number?' });
// → z.object({ query: z.string(), limit: z.number().optional() }).passthrough()

paramsToZodSchema(undefined);  // → undefined
paramsToZodSchema({});          // → undefined
```

## paramsToJsonSchema(params?)

MCP 도구 등록용 JSON Schema로 변환.

```typescript
import { paramsToJsonSchema } from '@airmcp-dev/core';

paramsToJsonSchema({ query: 'string', limit: 'number?' });
// → { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] }
```

## normalizeResult(value)

핸들러 반환값을 MCP content 배열로 변환.

```typescript
import { normalizeResult } from '@airmcp-dev/core';
```

### 변환 규칙

| 입력 | 출력 |
|------|------|
| `'hello'` | `[{ type: 'text', text: 'hello' }]` |
| `42` | `[{ type: 'text', text: '42' }]` |
| `true` | `[{ type: 'text', text: 'true' }]` |
| `null` / `undefined` | `[{ type: 'text', text: '' }]` |
| `[1, 2, 3]` | `[{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]` |
| `{ name: 'A' }` | `[{ type: 'text', text: '{\n  "name": "A"\n}' }]` |
| `{ text: 'hi' }` | `[{ type: 'text', text: 'hi' }]` |
| `{ image: 'b64', mimeType: 'image/png' }` | `[{ type: 'image', data: 'b64', mimeType: 'image/png' }]` |
| `{ content: [...] }` | 그대로 반환 |

### McpContent

```typescript
interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}
```
