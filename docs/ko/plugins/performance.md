# 성능 플러그인

## cachePlugin

파라미터 해시 기반으로 도구 결과를 캐싱합니다. 같은 파라미터로 같은 도구를 호출하면 캐시된 결과를 반환합니다.

```typescript
import { cachePlugin } from '@airmcp-dev/core';

use: [cachePlugin({ ttlMs: 60_000 })]   // 60초 캐시
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `ttlMs` | `number` | `60000` | 캐시 TTL (밀리초) |
| `maxEntries` | `number` | `1000` | 최대 캐시 항목 수 (초과 시 가장 오래된 항목 삭제) |
| `exclude` | `string[]` | `[]` | 캐시 제외 도구 이름 목록 |

캐시 키: `${toolName}:${JSON.stringify(params, sorted_keys)}`

```typescript
// 특정 도구는 캐시에서 제외
use: [cachePlugin({
  ttlMs: 30_000,
  maxEntries: 500,
  exclude: ['write_db', 'send_email'],
})]
```

내부 동작:
- `before`: 캐시에서 조회. 히트 → `abort: true` + 캐시된 결과 반환
- `after`: 결과를 캐시에 저장. `maxEntries` 초과 시 FIFO 삭제
- 만료된 항목은 매 호출마다 `evictExpired()`로 정리

## dedupPlugin

동시 동일 호출을 중복 제거합니다. 같은 도구를 같은 파라미터로 동시에 호출하면, 첫 번째 호출의 결과를 나머지가 공유합니다 (Request Coalescing).

```typescript
import { dedupPlugin } from '@airmcp-dev/core';

use: [dedupPlugin()]
use: [dedupPlugin({ windowMs: 2000 })]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `windowMs` | `number` | `1000` | 중복 제거 윈도우 (밀리초) |

내부 동작:
- `before`: 동일 키로 진행 중인 호출이 있으면 그 Promise를 대기 → 결과 공유 → `abort: true`
- `after`: 진행 중 호출의 Promise를 resolve하고 `windowMs` 후 제거
- 만료된 inflight 항목은 `windowMs * 5` 주기로 자동 정리

## queuePlugin

도구별 동시 실행 수를 제한합니다. 초과 호출은 대기열에서 순차 처리됩니다.

```typescript
import { queuePlugin } from '@airmcp-dev/core';

use: [queuePlugin({
  concurrency: {
    'db_query': 3,     // DB 쿼리는 동시 3개
    'fetch_api': 5,    // API 호출은 동시 5개
    '*': 10,           // 나머지는 동시 10개 (기본)
  },
})]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `concurrency` | `Record<string, number>` | `{ '*': 10 }` | 도구별 동시 실행 수. `'*'`는 기본값 |
| `maxQueueSize` | `number` | `100` | 대기열 최대 크기 (초과 시 즉시 에러) |
| `queueTimeoutMs` | `number` | `30000` | 대기 타임아웃 (초과 시 에러) |

에러 메시지:
- 대기열 가득: `[Queue] Queue full for "db_query" (max: 100)`
- 대기 타임아웃: `[Queue] Timeout waiting for "db_query" (30000ms)`
