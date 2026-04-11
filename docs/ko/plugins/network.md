# 네트워크 플러그인

## corsPlugin

HTTP/SSE 트랜스포트에 CORS 설정을 추가합니다. `onInit` 훅에서 `state._cors`에 설정을 저장합니다.

```typescript
import { corsPlugin } from '@airmcp-dev/core';

use: [corsPlugin({ origins: ['https://app.example.com'] })]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `origins` | `string[]` | `['*']` | 허용 오리진 |
| `methods` | `string[]` | `['GET', 'POST', 'OPTIONS']` | 허용 메서드 |
| `headers` | `string[]` | `['Content-Type', 'Authorization']` | 허용 헤더 |
| `credentials` | `boolean` | `false` | 자격 증명 허용 |

::: tip
SSE/HTTP 트랜스포트는 기본적으로 `Access-Control-Allow-Origin: *`을 설정합니다. 더 세밀한 제어가 필요할 때만 `corsPlugin`을 사용하세요. `stdio`에서는 효과 없음.
:::

## webhookPlugin

도구 호출 이벤트를 외부 URL로 전송합니다. 모니터링, Slack 알림, 로그 수집에 사용.

```typescript
import { webhookPlugin } from '@airmcp-dev/core';

use: [webhookPlugin({
  url: 'https://hooks.slack.com/services/xxx',
  events: ['tool.call', 'tool.error'],
})]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `url` | `string` | — | 웹훅 URL (필수) |
| `events` | `Array<'tool.call' \| 'tool.error' \| 'tool.slow'>` | `['tool.call']` | 전송할 이벤트 |
| `slowThresholdMs` | `number` | `5000` | `tool.slow` 이벤트 기준 지연시간 |
| `headers` | `Record<string, string>` | — | 커스텀 요청 헤더 |
| `batchSize` | `number` | `1` | 배치 크기 (1 = 즉시 전송) |

### 전송되는 페이로드

```typescript
// tool.call
{ event: 'tool.call', tool: 'search', duration: 45, timestamp: '...', server: 'my-server' }

// tool.error
{ event: 'tool.error', tool: 'search', error: 'Connection refused', timestamp: '...', server: 'my-server' }

// tool.slow (duration > slowThresholdMs)
{ event: 'tool.slow', tool: 'search', duration: 12500, threshold: 5000, timestamp: '...' }
```

`batchSize > 1`이면 `{ events: [...] }` 형태로 묶어서 전송합니다. 전송 실패 시 stderr로 에러 출력 후 무시 (서버 동작에 영향 없음).
