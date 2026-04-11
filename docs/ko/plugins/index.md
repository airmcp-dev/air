# 플러그인 개요

air는 19개의 내장 플러그인을 제공합니다. `use` 배열에 추가하면 배열 순서대로 실행됩니다.

```typescript
import { defineServer, cachePlugin, retryPlugin } from '@airmcp-dev/core';

defineServer({
  use: [retryPlugin({ maxRetries: 3 }), cachePlugin({ ttlMs: 60_000 })],
});
```

## 카테고리별 목록

### [안정성](/ko/plugins/stability)

| 플러그인 | 설명 |
|----------|------|
| `timeoutPlugin` | 시간 초과 경고 (기본: 30초) |
| `retryPlugin` | 지수 백오프 재시도 (기본: 3회, 200ms) |
| `circuitBreakerPlugin` | 연속 실패 시 호출 차단 (기본: 5회, 30초) |
| `fallbackPlugin` | 실패 시 대체 도구 호출 |

### [성능](/ko/plugins/performance)

| 플러그인 | 설명 |
|----------|------|
| `cachePlugin` | 파라미터 해시 기반 캐싱 (기본: 60초, 1000개) |
| `dedupPlugin` | 동시 동일 호출 중복 제거 (기본: 1초 윈도우) |
| `queuePlugin` | 동시 실행 수 제한 (기본: 10, 도구별 설정 가능) |

### [보안](/ko/plugins/security)

| 플러그인 | 설명 |
|----------|------|
| `authPlugin` | API 키 또는 Bearer 토큰 인증 |
| `sanitizerPlugin` | HTML/제어문자 제거 (기본: 10000자) |
| `validatorPlugin` | 커스텀 검증 규칙 |

### [네트워크](/ko/plugins/network)

| 플러그인 | 설명 |
|----------|------|
| `corsPlugin` | HTTP/SSE CORS 헤더 |
| `webhookPlugin` | 도구 이벤트를 웹훅 URL로 전송 |

### [데이터](/ko/plugins/data)

| 플러그인 | 설명 |
|----------|------|
| `transformPlugin` | 입출력 선언적 변환 (도구별/글로벌) |
| `i18nPlugin` | 응답 다국어 변환 (`{{key}}` 치환) |

### [모니터링](/ko/plugins/monitoring)

| 플러그인 | 설명 |
|----------|------|
| `jsonLoggerPlugin` | 구조화 JSON 로깅 (ELK/Datadog 호환) |
| `perUserRateLimitPlugin` | 사용자별 레이트 리밋 |

### [개발/테스트](/ko/plugins/dev)

| 플러그인 | 설명 |
|----------|------|
| `dryrunPlugin` | 핸들러 건너뛰기 (스키마 확인/미들웨어 테스트) |

### [커스텀 플러그인](/ko/plugins/custom)

나만의 플러그인 만들기 — meta, middleware, hooks, tools.
