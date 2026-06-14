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
  outputSchema?: AirToolParams;       // MCP 2025-06-18 구조화된 출력
  annotations?: AirToolAnnotations;   // MCP 2025-03-26 도구 어노테이션
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
  outputSchema?: AirToolParams;
  annotations?: AirToolAnnotations;
  handler: AirToolHandler;
  layer?: number;
  tags?: string[];
}
```

## 도구 어노테이션 <Badge text="0.2.0" />

MCP 2025-03-26 스펙. 도구 동작에 대한 힌트를 클라이언트에 전달합니다. 모든 필드 선택.

```typescript
defineTool('delete_user', {
  description: '사용자를 영구 삭제합니다',
  params: { userId: 'string' },
  annotations: {
    title: '사용자 삭제',
    readOnlyHint: false,        // 데이터 변경 있음
    destructiveHint: true,      // 파괴적 작업
    idempotentHint: false,      // 멱등성 없음
    openWorldHint: true,        // 외부 시스템 상호작용
  },
  handler: async ({ userId }) => { /* ... */ },
});
```

### AirToolAnnotations

```typescript
interface AirToolAnnotations {
  title?: string;            // 사람이 읽을 수 있는 제목
  readOnlyHint?: boolean;    // 읽기 전용 (데이터 변경 없음)
  destructiveHint?: boolean; // 파괴적 작업 (삭제, 덮어쓰기 등)
  idempotentHint?: boolean;  // 멱등성 (같은 입력 → 같은 결과)
  openWorldHint?: boolean;   // 외부 시스템과 상호작용
}
```

## 구조화된 출력 <Badge text="0.2.0" />

MCP 2025-06-18 스펙. 출력 스키마를 정의하면 핸들러 결과가 자동으로 `structuredContent`로 변환됩니다.

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

`outputSchema`는 `params`와 동일한 `AirToolParams` 형식 (단축, 객체, zod 혼합 가능).
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
  signal?: AbortSignal;       // 요청 취소 시그널 (0.2.0)
  elicit?: (message: string, schema: AirElicitSchema) => Promise<AirElicitResult>;  // (0.2.0)
}
```

### Elicitation (사용자 입력 요청) <Badge text="0.2.0" />

MCP 2025-06-18 스펙. 도구 실행 중 사용자에게 입력을 요청합니다. 클라이언트가 elicitation을 지원할 때만 사용 가능합니다.

```typescript
defineTool('deploy', {
  params: { env: 'string' },
  annotations: { destructiveHint: true },
  handler: async ({ env }, ctx) => {
    if (env === 'production' && ctx.elicit) {
      const confirm = await ctx.elicit('프로덕션에 배포합니다. 확인해주세요.', {
        confirmed: { type: 'boolean', description: '배포 확인' },
      });
      if (confirm.action !== 'accept') return '배포 취소됨';
    }
    return `${env} 배포 완료`;
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
  content?: Record<string, any>;  // accept 시 사용자 입력 값
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
| `{ resource: { uri, name?, ... } }` | `[{ type: 'resource_link', uri, name?, ... }]` |
| `{ content: [...] }` | 그대로 반환 |

### 리소스 링크 <Badge text="0.2.0" />

MCP 2025-06-18 스펙. 데이터를 직접 포함하지 않고 리소스 URI를 참조로 반환합니다.

```typescript
defineTool('get_report', {
  params: { reportId: 'string' },
  handler: async ({ reportId }) => ({
    resource: {
      uri: `report://reports/${reportId}`,
      name: `리포트 ${reportId}`,
      description: '분기 보고서',
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
  uri?: string;          // resource_link 전용
  name?: string;         // resource_link 전용
  description?: string;  // resource_link 전용
}
```
