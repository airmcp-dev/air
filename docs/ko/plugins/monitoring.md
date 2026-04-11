# 모니터링 플러그인

## jsonLoggerPlugin

구조화된 JSON 형태로 도구 호출을 로깅합니다. ELK, Datadog, CloudWatch 등 로그 수집기와 호환됩니다.

```typescript
import { jsonLoggerPlugin } from '@airmcp-dev/core';

use: [jsonLoggerPlugin({ output: 'stderr', logParams: true })]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `output` | `'stderr' \| 'stdout'` | `'stderr'` | 출력 대상 |
| `logParams` | `boolean` | `false` | 파라미터를 로그에 포함 |
| `extraFields` | `Record<string, any>` | `{}` | 모든 로그 항목에 추가할 필드 |

### 출력 형식

성공:

```json
{"level":"info","event":"tool.call","tool":"search","duration_ms":45,"request_id":"a1b2c3d4-...","server":"my-server","timestamp":"2025-01-01T00:00:00.000Z"}
```

에러:

```json
{"level":"error","event":"tool.error","tool":"search","error":"Connection refused","request_id":"a1b2c3d4-...","server":"my-server","timestamp":"2025-01-01T00:00:00.000Z"}
```

`extraFields` 사용:

```typescript
use: [jsonLoggerPlugin({
  extraFields: { env: 'production', region: 'ap-northeast-2' },
})]
// → 모든 로그에 env, region 필드 추가
```

## perUserRateLimitPlugin

사용자/세션별로 호출 횟수를 제한합니다. 파라미터에서 사용자 ID를 추출하여 개별 추적합니다.

```typescript
import { perUserRateLimitPlugin } from '@airmcp-dev/core';

use: [perUserRateLimitPlugin({
  maxCalls: 10,
  windowMs: 60_000,
  identifyBy: '_userId',
})]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `maxCalls` | `number` | `10` | 윈도우 내 최대 호출 수 |
| `windowMs` | `number` | `60000` | 윈도우 크기 (밀리초) |
| `identifyBy` | `string` | `'_userId'` | 사용자 식별 파라미터 이름 |

내부 동작: `사용자ID:도구이름` 조합으로 타임스탬프 배열을 관리. 윈도우 밖의 타임스탬프는 자동 만료.

제한 초과 시 응답:

```
[RateLimit] User "user-123" exceeded 10 calls per 60s for "search".
```

파라미터에 `_userId`가 없으면 `'anonymous'`로 처리됩니다.
