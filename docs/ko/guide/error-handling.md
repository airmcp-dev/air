# 에러 처리

air는 모든 에러를 MCP 프로토콜 형식으로 자동 변환합니다. 특정 코드를 가진 커스텀 에러를 던질 수도 있습니다.

## 에러 흐름

```
도구 핸들러에서 throw → onError 미들웨어 실행 → MCP 에러 응답 반환
```

내장 `errorBoundaryMiddleware`가 모든 미처리 에러를 잡아 MCP 형식으로 변환합니다:

```json
{
  "content": [{ "type": "text", "text": "[-32603] Internal error: something broke" }],
  "isError": true
}
```

## MCP 에러 코드

| 코드 | 상수 | 상황 |
|------|------|------|
| -32601 | `toolNotFound` | 도구 이름이 존재하지 않음 |
| -32602 | `invalidParams` | 파라미터 검증 실패 (Zod) |
| -32603 | `internal` | 핸들러에서 미처리 에러 |
| -32000 | `forbidden` | 접근 거부 |
| -32001 | `rateLimited` | 레이트 리밋 초과 |
| -32002 | `threatDetected` | 위협 패턴 매칭 |
| -32003 | `timeout` | 도구 실행 시간 초과 |

## 핸들러에서 에러 던지기

### 단순 에러

```typescript
defineTool('divide', {
  params: { a: 'number', b: 'number' },
  handler: async ({ a, b }) => {
    if (b === 0) throw new Error('0으로 나눌 수 없습니다');
    return a / b;
  },
});
```

### 코드가 있는 AirError

```typescript
import { AirError } from '@airmcp-dev/core';

defineTool('admin-action', {
  handler: async (params, context) => {
    if (!context.state.isAdmin) {
      throw new AirError('관리자 권한이 필요합니다', -32000, { role: 'user' });
    }
  },
});
```

### McpErrors 팩토리

```typescript
import { McpErrors } from '@airmcp-dev/core';

throw McpErrors.toolNotFound('missing-tool');
throw McpErrors.invalidParams('이메일 형식이 올바르지 않습니다');
throw McpErrors.internal('데이터베이스 연결 실패');
throw McpErrors.forbidden('정책에 의해 접근이 거부되었습니다');
throw McpErrors.rateLimited('search', 30000);
throw McpErrors.threatDetected('prompt_injection', 'high');
throw McpErrors.timeout('slow-tool', 10000);
```

## AirError 클래스

```typescript
class AirError extends Error {
  code: number;                        // MCP 에러 코드
  details?: Record<string, any>;       // 추가 메타데이터

  constructor(message: string, code?: number, details?: Record<string, any>);
}
```

### 예제

```typescript
// 비즈니스 로직 에러
throw new AirError('크레딧이 부족합니다', -32010, {
  required: 100,
  available: 42,
});

// 상세 검증 에러
throw new AirError('날짜 범위가 올바르지 않습니다', -32602, {
  field: 'startDate',
  reason: 'startDate는 endDate보다 이전이어야 합니다',
});
```

## 커스텀 에러 미들웨어

```typescript
const errorReporter: AirMiddleware = {
  name: 'error-reporter',
  onError: async (ctx, error) => {
    // 에러 트래킹 서비스로 전송
    await reportToSentry({
      error: error.message,
      tool: ctx.tool.name,
      params: ctx.params,
      requestId: ctx.requestId,
    });

    // undefined 반환 → 다음 에러 미들웨어가 처리
    // 값 반환 → 그 값이 응답이 됨
    return undefined;
  },
};

defineServer({
  middleware: [errorReporter],
});
```

## 에러 처리 순서

```
핸들러에서 throw
  → 플러그인 onError 미들웨어 (역순)
  → 사용자 onError 미들웨어
  → errorBoundaryMiddleware (항상 마지막, 모든 에러 포착)
```

`onError` 미들웨어가 값을 반환하면 그 값이 응답이 되고, 남은 에러 미들웨어는 건너뜁니다.
