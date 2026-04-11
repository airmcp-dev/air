# 미들웨어

미들웨어는 도구 호출을 세 단계에서 가로챕니다: before(실행 전), after(실행 후), onError(에러 시).

## 구조

```typescript
interface AirMiddleware {
  name: string;
  before?: (ctx: MiddlewareContext) => Promise<MiddlewareResult | void>;
  after?: (ctx: MiddlewareContext & { result: any; duration: number }) => Promise<void>;
  onError?: (ctx: MiddlewareContext, error: Error) => Promise<any>;
}
```

세 가지 훅 모두 선택 사항입니다. 필요한 훅만 구현하세요.

## MiddlewareContext

```typescript
interface MiddlewareContext {
  tool: AirToolDef;              // 호출되는 도구 정의
  params: Record<string, any>;   // 요청 파라미터 (before에서 수정 가능)
  requestId: string;             // 고유 요청 ID (UUID)
  serverName: string;            // 서버 이름
  startedAt: number;             // 호출 시작 타임스탬프 (ms)
  meta: Record<string, any>;     // 미들웨어 간 공유 메타데이터
}
```

`meta`는 빈 객체로 시작하며, 미들웨어끼리 데이터를 전달하는 용도입니다.

## before — 실행 전

도구 핸들러가 실행되기 **전에** 호출됩니다. 파라미터를 수정하거나, 호출을 중단하거나, 메타데이터를 추가할 수 있습니다.

### MiddlewareResult

```typescript
interface MiddlewareResult {
  params?: Record<string, any>;  // 변경된 파라미터 (undefined = 원본 유지)
  abort?: boolean;               // true = 나머지 미들웨어 + 핸들러 건너뛰기
  abortResponse?: any;           // 중단 시 반환할 응답 (normalizeResult로 변환됨)
  meta?: Record<string, any>;    // 메타데이터 추가
}
```

### 파라미터 수정

```typescript
const limitMiddleware: AirMiddleware = {
  name: 'limit-enforcer',
  before: async (ctx) => {
    // limit을 최대 100으로 제한
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
`params`를 반환하면 이후 미들웨어와 핸들러는 **수정된 params**를 받습니다. 이것은 내장 검증 미들웨어도 마찬가지입니다 — Zod 검증 통과 후 `result.data`(정제된 데이터)로 params가 교체됩니다.
:::

### 조기 중단

```typescript
const blockMiddleware: AirMiddleware = {
  name: 'blocker',
  before: async (ctx) => {
    if (ctx.params.blocked) {
      return {
        abort: true,
        abortResponse: '요청이 차단되었습니다',
      };
    }
  },
};
```

`abort: true`이면 이후 모든 before 미들웨어, 핸들러, after 미들웨어를 건너뛰고, `abortResponse`가 `normalizeResult()`를 거쳐 MCP 응답으로 반환됩니다.

### 메타데이터 추가

```typescript
const timingMiddleware: AirMiddleware = {
  name: 'timing',
  before: async (ctx) => {
    ctx.meta.startTime = performance.now();
    // 또는 return { meta: { startTime: performance.now() } };
  },
  after: async (ctx) => {
    const elapsed = performance.now() - ctx.meta.startTime;
    console.log(`${ctx.tool.name}: ${elapsed.toFixed(1)}ms`);
  },
};
```

## after — 실행 후

핸들러가 **성공적으로 완료된 후** 호출됩니다. `ctx`에 `result`(핸들러 반환값)와 `duration`(실행 시간 ms)이 추가됩니다.

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
after 미들웨어에서 에러가 발생해도 **무시됩니다**. 결과는 이미 확정되었으므로 after 에러가 응답에 영향을 주지 않습니다.
:::

## onError — 에러 처리

핸들러 또는 before 미들웨어에서 에러가 발생하면 호출됩니다.

```typescript
const errorReporter: AirMiddleware = {
  name: 'error-reporter',
  onError: async (ctx, error) => {
    // 에러 트래킹 서비스 전송
    await reportToSentry({
      error: error.message,
      tool: ctx.tool.name,
      requestId: ctx.requestId,
    });

    // undefined 반환 → 다음 onError 미들웨어로 전달
    return undefined;
  },
};
```

### 에러 복구

`onError`에서 **값을 반환**하면 그 값이 정상 응답으로 사용됩니다 (에러가 복구됨):

```typescript
const gracefulMiddleware: AirMiddleware = {
  name: 'graceful',
  onError: async (ctx, error) => {
    if (error.message.includes('ECONNREFUSED')) {
      // 에러를 복구하고 대체 응답 반환
      return '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    // undefined → 다음 onError 핸들러로 전달
    return undefined;
  },
};
```

### 에러 처리 순서

```
핸들러에서 throw
  → 등록된 미들웨어의 onError를 순서대로 실행
  → 하나라도 값을 반환하면 → 정상 응답으로 사용 (나머지 건너뜀)
  → 모두 undefined 반환하면 → errorBoundaryMiddleware가 에러 메시지 반환
```

## 내장 미들웨어

`defineServer()`가 자동으로 등록하는 미들웨어입니다. 직접 추가하지 마세요.

### errorBoundaryMiddleware

모든 에러를 포착하여 MCP 프로토콜 형식으로 변환합니다. 체인의 가장 바깥에 위치합니다.

```typescript
// 에러 발생 시 반환되는 형식
{
  content: [{ type: 'text', text: '[-32603] Internal error: something broke' }],
  isError: true,
}
```

에러 로그는 **stderr**로 출력됩니다:

```
[air:error] search (a1b2c3d4-...): Connection refused
```

### validationMiddleware

도구의 `params` 정의를 Zod 스키마로 변환하고 모든 호출을 검증합니다.

검증 실패 시 상세 에러 메시지를 반환합니다:

```
[Validation] Invalid parameters for "search":
  - query: Expected string, received number (expected: string, got: number)
  - limit: Expected number, received string (expected: number, got: string)

Expected schema:
  - query: string
  - limit: number (optional)
```

검증 성공 시 Zod가 파싱한 **정제된 데이터**로 params가 교체됩니다. 예를 들어 `.passthrough()`로 인해 정의되지 않은 추가 필드도 통과합니다.

## 서버에 등록

```typescript
defineServer({
  middleware: [timingMiddleware, auditMiddleware],
  // ...
});
```

`middleware` 배열의 미들웨어는 **플러그인 미들웨어 이후에** 실행됩니다. 플러그인에서 재사용할 로직은 `use`(플러그인)로, 이 서버 전용 로직은 `middleware`로 분리하세요.

## MCP 에러 코드

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

// 에러 팩토리
McpErrors.toolNotFound('missing');        // -32601: 도구 없음
McpErrors.invalidParams('bad email');     // -32602: 파라미터 오류
McpErrors.internal('db failed');          // -32603: 내부 에러
McpErrors.forbidden('not allowed');       // -32000: 접근 거부
McpErrors.rateLimited('search', 30000);  // -32001: 레이트 리밋
McpErrors.threatDetected('injection', 'high');  // -32002: 위협 탐지
McpErrors.timeout('slow', 10000);        // -32003: 타임아웃

// 커스텀 에러
throw new AirError('크레딧 부족', -32010, { required: 100, available: 42 });
```

## 전체 실행 흐름

```
요청 도착
  ↓
errorBoundaryMiddleware.before     (에러 포착 준비)
validationMiddleware.before        (params 검증 + 정제)
  ↓
builtinLoggerPlugin.before
builtinMetricsPlugin.before
  ↓
use[0].before → use[1].before → ...   (플러그인 미들웨어)
  ↓
middleware[0].before → middleware[1].before → ...   (사용자 미들웨어)
  ↓
handler()                          (도구 핸들러 실행)
  ↓
middleware[0].after → middleware[1].after → ...
use[0].after → use[1].after → ...
builtinMetricsPlugin.after         (호출 수, 지연시간 기록)
builtinLoggerPlugin.after          (로그 출력)
  ↓
normalizeResult()                  (반환값 → MCP content 변환)
  ↓
응답 반환
```
