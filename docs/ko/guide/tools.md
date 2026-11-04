# 도구

도구는 MCP 클라이언트(예: Claude)가 서버와 상호작용하는 주요 수단입니다. `defineTool`로 정의합니다.

## 도구란?

MCP에서 도구(Tool)는 AI가 **작업을 수행**하기 위해 호출하는 함수입니다. 데이터를 조회만 하는 리소스와 달리, 도구는 부수 효과(side effect)를 가질 수 있습니다.

- 도구: DB에 데이터 쓰기, 이메일 전송, API 호출, 파일 생성
- 리소스: 설정 읽기, 상태 조회 — [리소스 가이드](/ko/guide/resources) 참고

## 기본 도구

```typescript
import { defineTool } from '@airmcp-dev/core';

const greet = defineTool('greet', {
  description: '인사하기',
  params: { name: 'string' },
  handler: async ({ name }) => `안녕하세요, ${name}!`,
});
```

## defineTool API

```typescript
function defineTool(name: string, options: {
  description?: string;       // 설명 (LLM이 도구 선택 시 참고)
  params?: AirToolParams;     // 파라미터 정의
  handler: AirToolHandler;    // 핸들러 함수
  layer?: number;             // L1-L7 Meter 분류 힌트
  tags?: string[];            // 분류/필터 태그
}): AirToolDef;
```

### description 작성 팁

`description`은 LLM이 도구를 선택할 때 참고하는 유일한 텍스트입니다. 잘 쓰면 AI가 올바른 도구를 더 정확하게 선택합니다.

```typescript
// ❌ 너무 짧음 — AI가 언제 이 도구를 써야 하는지 판단 어려움
defineTool('search', {
  description: '검색',
  // ...
});

// ✅ 구체적 — AI가 용도를 정확히 이해
defineTool('search', {
  description: '키워드로 문서를 검색합니다. 제목과 본문을 대상으로 전문 검색하며, 결과는 관련도 순으로 정렬됩니다.',
  // ...
});
```

## 파라미터 타입

세 가지 방식으로 파라미터를 정의할 수 있습니다. 세 형식은 같은 params 객체에서 혼합 사용 가능합니다.

### 단축 문자열

가장 간단합니다. `?`를 붙이면 선택 사항.

```typescript
params: {
  query: 'string',           // 필수 문자열
  limit: 'number?',          // 선택 숫자
  verbose: 'boolean?',       // 선택 불리언
  metadata: 'object',        // 필수 객체
  options: 'object?',        // 선택 객체
}
```

사용 가능한 단축 표기:

| 단축 표기 | 변환되는 Zod 스키마 |
|----------|-------------------|
| `'string'` | `z.string()` |
| `'string?'` | `z.string().optional()` |
| `'number'` | `z.number()` |
| `'number?'` | `z.number().optional()` |
| `'boolean'` | `z.boolean()` |
| `'boolean?'` | `z.boolean().optional()` |
| `'object'` | `z.record(z.any())` |
| `'object?'` | `z.record(z.any()).optional()` |

### 객체 형식

설명과 선택 여부를 명시적으로 제어합니다. `description`은 MCP 클라이언트가 파라미터 설명으로 사용합니다.

```typescript
params: {
  query: { type: 'string', description: '검색어' },
  limit: { type: 'number', description: '최대 결과 수', optional: true },
  includeArchived: { type: 'boolean', description: '보관된 항목 포함', optional: true },
}
```

객체 형식의 `description`은 Zod의 `.describe()`로 변환됩니다.

### Zod 스키마

복잡한 검증이 필요할 때 Zod를 직접 사용합니다.

```typescript
import { z } from 'zod';

params: {
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  tags: z.array(z.string()).optional(),
  role: z.enum(['admin', 'user', 'guest']),
}
```

### 혼합 사용

```typescript
params: {
  query: 'string',                                    // 단축
  limit: { type: 'number', description: '최대', optional: true },  // 객체
  tags: z.array(z.string()).optional(),                // Zod
}
```

### 파라미터 없는 도구

`params`를 생략하면 파라미터 없이 호출 가능한 도구가 됩니다:

```typescript
defineTool('now', {
  description: '현재 시각 반환',
  handler: async () => new Date().toISOString(),
});
```

## 핸들러 함수

핸들러는 두 인자를 받습니다: 파싱된 파라미터와 컨텍스트 객체.

```typescript
handler: async (params, context) => {
  console.log(context.requestId);    // 고유 요청 ID (UUID v4)
  console.log(context.serverName);   // 서버 이름
  console.log(context.startedAt);    // 타임스탬프 (ms)
  console.log(context.state);        // 글로벌 서버 상태
  return 'result';
}
```

### AirToolContext

```typescript
interface AirToolContext {
  requestId: string;          // crypto.randomUUID()로 생성
  serverName: string;         // defineServer의 name
  startedAt: number;          // Date.now()
  state: Record<string, any>; // server.state와 동일 참조
  signal?: AbortSignal;       // 취소 시그널

  // 서버 → 클라이언트 채널 (v0.6.0+)
  progress: (progress: number, total?: number, message?: string) => void;
  log: (level: AirLogLevel, data: any, logger?: string) => void;
  elicit?: (message: string, schema: AirElicitSchema | AirElicitJsonSchema) => Promise<AirElicitResult>;
}
```

### 실행 중 클라이언트에 말 걸기 (v0.6.0+)

도구가 실행되는 동안 알림을 보내거나 사용자에게 입력을 요청할 수 있습니다. 요청이 들어온 연결을 그대로 씁니다: stdio 스트림, SSE 세션, Streamable HTTP는 클라이언트가 `Accept: text/event-stream`을 보냈을 때 air가 여는 SSE 응답 스트림.

```typescript
defineTool('import', {
  params: { url: 'string' },
  handler: async ({ url }, ctx) => {
    ctx.log('info', `${url} 가져오는 중`, 'import');

    for (let i = 0; i < 4; i++) {
      await step(i);
      ctx.progress(i + 1, 4, `${i + 1}단계`);   // notifications/progress
    }

    if (ctx.elicit) {                              // 클라이언트가 elicitation 미지원이면 undefined
      const answer = await ctx.elicit('기존 행을 덮어쓸까요?', {
        overwrite: { type: 'boolean', required: true, default: false },
      });
      if (answer.action !== 'accept' || !answer.content?.overwrite) return '취소됨';
    }
    return '가져오기 완료';
  },
});
```

- `ctx.progress`는 클라이언트가 요청 `_meta`에 `progressToken`을 넣었을 때만 전송되고, 아니면 no-op입니다.
- `ctx.log`는 클라이언트가 `logging/setLevel`로 정한 레벨을 따릅니다 (RFC 5424 순: `debug` < `info` < `notice` < `warning` < `error` < `critical` < `alert` < `emergency`).
- `ctx.elicit`은 transport가 양방향이고 클라이언트가 `elicitation` 능력을 선언했을 때만 정의됩니다. 단축형 스키마는 JSON Schema 객체로 변환되며, `oneOf`나 배열 같은 세부가 필요하면 `{ type: 'object', properties, required }`를 그대로 넘기세요.
- Cloudflare Workers transport에는 채널이 없습니다: `progress`/`log`는 no-op, `elicit`은 `undefined`.
- SSE를 받지 않는 클라이언트(`Accept`에 `text/event-stream` 없음)도 최종 결과는 받고, 알림만 버려집니다.

### 동기/비동기

핸들러는 `async` 함수(Promise 반환)와 동기 함수 모두 가능합니다:

```typescript
// 비동기
handler: async ({ query }) => {
  const results = await db.search(query);
  return results;
}

// 동기
handler: ({ a, b }) => a + b
```

## 응답 타입

핸들러는 다양한 타입을 반환할 수 있습니다. air의 `normalizeResult` 함수가 자동으로 MCP content 형식으로 변환합니다.

### 변환 규칙

| 반환값 | MCP 변환 결과 |
|--------|-------------|
| `string` | `[{ type: 'text', text: '...' }]` |
| `number` | `[{ type: 'text', text: '42' }]` (String 변환) |
| `boolean` | `[{ type: 'text', text: 'true' }]` (String 변환) |
| `null` / `undefined` | `[{ type: 'text', text: '' }]` (빈 텍스트) |
| `Array` | `[{ type: 'text', text: '...' }]` (JSON.stringify, pretty) |
| `Object` | `[{ type: 'text', text: '...' }]` (JSON.stringify, pretty) |
| `{ text: string }` | `[{ type: 'text', text: '...' }]` |
| `{ image: string, mimeType?: string }` | `[{ type: 'image', data: '...', mimeType: '...' }]` |
| `{ content: McpContent[] }` | 그대로 반환 (이미 MCP 형식) |

### 예제

```typescript
// 문자열
handler: async () => 'hello'

// 숫자 → 문자열로 변환
handler: async () => 42

// null → 빈 텍스트
handler: async () => null

// 객체 → JSON (들여쓰기 포함)
handler: async () => ({ name: 'Alice', age: 30 })
// MCP content: [{ type: 'text', text: '{\n  "name": "Alice",\n  "age": 30\n}' }]

// 배열 → JSON (들여쓰기 포함)
handler: async () => [1, 2, 3]
// MCP content: [{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]

// 명시적 텍스트
handler: async () => ({ text: '포맷팅된 결과' })

// 이미지
handler: async () => ({
  image: 'base64-encoded-png-data',
  mimeType: 'image/png',
})

// 이미 MCP 형식 — 복수 content 블록
handler: async () => ({
  content: [
    { type: 'text', text: '이미지 설명:' },
    { type: 'image', data: 'base64...', mimeType: 'image/png' },
  ],
})
```

## 계층 힌트

`layer` 속성으로 [Meter](/ko/guide/meter) 분류에 힌트를 줍니다:

```typescript
defineTool('cache-lookup', {
  layer: 1,   // L1: 캐시 히트, 비용 거의 없음
  handler: async ({ key }) => cache.get(key),
});

defineTool('db-query', {
  layer: 3,   // L3: 필터 쿼리
  handler: async ({ sql }) => db.query(sql),
});

defineTool('ai-summarize', {
  layer: 6,   // L6: LLM 호출, 토큰 소모
  handler: async ({ text }) => llm.summarize(text),
});

defineTool('ai-agent', {
  layer: 7,   // L7: 에이전트 체인, 높은 비용
  handler: async ({ task }) => agentLoop(task),
});
```

`layer`를 생략하면 Meter가 실행 시간 기반으로 자동 분류합니다.

## 태그

태그는 도구를 분류하고 필터링하기 위한 메타데이터입니다:

```typescript
defineTool('user-search', {
  tags: ['user', 'read'],
  handler: async ({ query }) => db.users.find(query),
});

defineTool('user-create', {
  tags: ['user', 'write'],
  handler: async ({ data }) => db.users.create(data),
});

// 태그로 필터링
const readTools = server.tools().filter(t => t.tags?.includes('read'));
const userTools = server.tools().filter(t => t.tags?.includes('user'));
```

## 런타임 도구 추가

```typescript
server.addTool(defineTool('dynamic-tool', {
  description: '런타임에 추가된 도구',
  handler: async () => 'works!',
}));
```

`addTool`은 플러그인의 `onToolRegister` 훅을 거칩니다.

## 헬퍼 함수

### paramsToZodSchema

단축 파라미터를 Zod 스키마로 변환합니다. 내부적으로 `.passthrough()`가 적용되어 정의되지 않은 키도 통과합니다.

```typescript
import { paramsToZodSchema } from '@airmcp-dev/core';

const schema = paramsToZodSchema({
  query: 'string',
  limit: 'number?',
});
// → z.object({ query: z.string(), limit: z.number().optional() }).passthrough()

// params가 없거나 빈 객체면 undefined 반환
paramsToZodSchema(undefined);  // → undefined
paramsToZodSchema({});          // → undefined
```

### paramsToJsonSchema

MCP 도구 등록용 JSON Schema로 변환합니다:

```typescript
import { paramsToJsonSchema } from '@airmcp-dev/core';

const jsonSchema = paramsToJsonSchema({
  query: { type: 'string', description: '검색어' },
  limit: 'number?',
});
// → {
//   type: 'object',
//   properties: {
//     query: { type: 'string' },
//     limit: { type: 'number' },
//   },
//   required: ['query']
// }
```

### normalizeResult

핸들러 반환값을 MCP content 배열로 변환합니다:

```typescript
import { normalizeResult } from '@airmcp-dev/core';

normalizeResult('hello');
// → [{ type: 'text', text: 'hello' }]

normalizeResult(42);
// → [{ type: 'text', text: '42' }]

normalizeResult(null);
// → [{ type: 'text', text: '' }]

normalizeResult({ name: 'Alice' });
// → [{ type: 'text', text: '{\n  "name": "Alice"\n}' }]

normalizeResult([1, 2, 3]);
// → [{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }]

normalizeResult({ image: 'base64...', mimeType: 'image/png' });
// → [{ type: 'image', data: 'base64...', mimeType: 'image/png' }]
```
