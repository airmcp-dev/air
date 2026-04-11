# 안정성 플러그인

## timeoutPlugin

시간 초과 시 경고를 출력합니다.

```typescript
import { timeoutPlugin } from '@airmcp-dev/core';

use: [timeoutPlugin(5_000)]   // 5초
```

**시그니처**: `timeoutPlugin(timeoutMs?: number)` — 기본: `30000` (30초)

내부 동작:
- `before`: `meta._timeoutMs`, `meta._timeoutStart` 설정
- `after`: 실행 시간이 limit 초과 시 stderr로 경고 출력

```
[air:timeout] search took 12500ms (limit: 5000ms)
```

## retryPlugin

실패한 도구 호출을 지수 백오프(exponential backoff)로 재시도합니다.

```typescript
import { retryPlugin } from '@airmcp-dev/core';

use: [retryPlugin({ maxRetries: 3, delayMs: 200 })]
// 200ms → 400ms → 800ms 간격으로 재시도
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `maxRetries` | `number` | `3` | 최대 재시도 횟수 |
| `delayMs` | `number` | `200` | 초기 대기 시간 (매 재시도마다 2배) |
| `retryOn` | `(error: Error) => boolean` | `() => true` | 재시도 조건 필터 |

`retryOn` 사용 예제:

```typescript
use: [retryPlugin({
  maxRetries: 3,
  retryOn: (error) => {
    // 네트워크 에러만 재시도, 검증 에러는 즉시 실패
    return error.message.includes('ECONNREFUSED') ||
           error.message.includes('ETIMEDOUT');
  },
})]
```

내부 동작: `onError` 훅에서 `meta._retryCount`를 추적하고, 핸들러를 직접 재호출합니다. 재시도 초과 시 `undefined` 반환 (다음 에러 미들웨어로 전달).

## circuitBreakerPlugin

연속 실패 시 도구 호출을 차단합니다 (장애 전파 방지).

```typescript
import { circuitBreakerPlugin } from '@airmcp-dev/core';

use: [circuitBreakerPlugin({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  perTool: true,
})]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `failureThreshold` | `number` | `5` | 서킷 오픈 전 연속 실패 횟수 |
| `resetTimeoutMs` | `number` | `30000` | 오픈 → 반개방 전환 대기 시간 |
| `perTool` | `boolean` | `true` | 도구별 독립 서킷 (false=전역 서킷) |

상태 전환:

```
Closed (정상)
  ↓ failureThreshold 연속 실패
Open (전부 거부 — 에러 응답 즉시 반환)
  ↓ resetTimeoutMs 경과
Half-Open (1건 시도)
  ↓ 성공 → Closed / 실패 → Open
```

서킷 오픈 시 응답:

```
[CircuitBreaker] "search" is temporarily unavailable (circuit open). Retry in 25s.
```

## fallbackPlugin

도구 호출 실패 시 대체 도구를 자동으로 호출합니다. 도구 이름 → 대체 도구 이름 매핑.

```typescript
import { fallbackPlugin } from '@airmcp-dev/core';

use: [fallbackPlugin({
  'search_primary': 'search_backup',
  'fetch_api': 'fetch_cached',
})]
```

**시그니처**: `fallbackPlugin(fallbacks: Record<string, string>)`

내부 동작: `onError`에서 실패한 도구의 이름으로 대체 도구를 찾아 `ctx.meta._serverCallTool`로 호출합니다. 대체 도구도 실패하면 에러를 다음 미들웨어로 전달합니다.

```
[air:fallback] "search_primary" failed, trying "search_backup"
```
