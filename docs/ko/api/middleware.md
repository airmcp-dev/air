# 미들웨어 & 에러 레퍼런스

## AirMiddleware

```typescript
interface AirMiddleware {
  name: string;
  before?: (ctx: MiddlewareContext) => Promise<MiddlewareResult | void>;
  after?: (ctx: MiddlewareContext & { result: any; duration: number }) => Promise<void>;
  onError?: (ctx: MiddlewareContext, error: Error) => Promise<any>;
}
```

세 가지 훅 모두 선택. 필요한 것만 구현.

### MiddlewareContext

```typescript
interface MiddlewareContext {
  tool: AirToolDef;              // 호출되는 도구
  params: Record<string, any>;   // 요청 파라미터 (before에서 수정 가능)
  requestId: string;             // UUID
  serverName: string;
  startedAt: number;             // Date.now()
  meta: Record<string, any>;     // 미들웨어 간 공유 데이터
}
```

### MiddlewareResult (before 반환값)

```typescript
interface MiddlewareResult {
  params?: Record<string, any>;  // 변경된 파라미터
  abort?: boolean;               // true → 나머지 + 핸들러 건너뛰기
  abortResponse?: any;           // 중단 시 응답 (normalizeResult 거침)
  meta?: Record<string, any>;    // 메타데이터 추가
}
```

### 사용 예제

```typescript
// 파라미터 수정
const limiter: AirMiddleware = {
  name: 'limiter',
  before: async (ctx) => ({
    params: { ...ctx.params, limit: Math.min(ctx.params.limit || 100, 100) },
  }),
};

// 조기 중단
const blocker: AirMiddleware = {
  name: 'blocker',
  before: async (ctx) => {
    if (ctx.params.blocked) return { abort: true, abortResponse: 'Blocked' };
  },
};

// 에러 복구
const graceful: AirMiddleware = {
  name: 'graceful',
  onError: async (ctx, error) => {
    if (error.message.includes('ECONNREFUSED'))
      return 'Service unavailable';
    return undefined;  // 다음 핸들러로 전달
  },
};
```

### 체인 실행 흐름

```
before 미들웨어 (순서대로)
  ↓ abort → normalizeResult(abortResponse) 반환
  ↓ params 수정 → 이후 미들웨어/핸들러에 적용
handler()
  ↓ 에러 → onError 미들웨어 순서대로 (값 반환 시 정상 응답으로 전환)
after 미들웨어 (순서대로, 에러 시 무시)
  ↓
normalizeResult(result)
```

## AirError

```typescript
class AirError extends Error {
  code: number;                        // MCP 에러 코드
  details?: Record<string, any>;       // 추가 메타데이터

  constructor(message: string, code?: number, details?: Record<string, any>);
}
```

```typescript
import { AirError } from '@airmcp-dev/core';

throw new AirError('크레딧 부족', -32010, { required: 100, available: 42 });
```

## McpErrors

표준 에러 팩토리:

```typescript
import { McpErrors } from '@airmcp-dev/core';

McpErrors.toolNotFound(name: string): AirError;
// code: -32601, "Tool "name" not found"

McpErrors.invalidParams(message: string, params?: Record<string, any>): AirError;
// code: -32602, "Invalid params: message"

McpErrors.internal(message: string, cause?: Error): AirError;
// code: -32603, "Internal error: message"

McpErrors.forbidden(message: string): AirError;
// code: -32000, details: { type: 'forbidden' }

McpErrors.rateLimited(tool: string, retryAfterMs?: number): AirError;
// code: -32001, details: { tool, retryAfterMs }

McpErrors.timeout(tool: string, timeoutMs: number): AirError;
// code: -32003, details: { tool, timeoutMs }
```

### MCP 에러 코드 표

| 코드 | 팩토리 | 의미 |
|------|--------|------|
| -32601 | `toolNotFound` | 도구 없음 |
| -32602 | `invalidParams` | 파라미터 검증 실패 |
| -32603 | `internal` | 내부 에러 |
| -32000 | `forbidden` | 접근 거부 |
| -32001 | `rateLimited` | 레이트 리밋 초과 |
| -32003 | `timeout` | 타임아웃 |

### 에러 응답 형식

```typescript
{
  content: [{ type: 'text', text: '[-32603] Internal error: something broke' }],
  isError: true,
}
```

## 내장 미들웨어

### errorBoundaryMiddleware

모든 에러를 포착 → MCP 형식 변환. stderr로 에러 로그.

### validationMiddleware

`params` 정의 → Zod 스키마 변환 → 매 호출 검증. 성공 시 `result.data`로 params 교체 (`.passthrough()` 적용). 실패 시 필드별 상세 에러:

```
[Validation] Invalid parameters for "search":
  - query: Expected string, received number (expected: string, got: number)
Expected schema:
  - query: string
  - limit: number (optional)
```
