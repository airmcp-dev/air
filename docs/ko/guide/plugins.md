# 플러그인

air는 19개의 내장 플러그인을 제공합니다. `use` 배열에 추가하면 배열 순서대로 실행됩니다.

## 사용법

```typescript
import {
  defineServer,
  cachePlugin,
  retryPlugin,
  authPlugin,
  timeoutPlugin,
} from '@airmcp-dev/core';

defineServer({
  use: [
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
    timeoutPlugin(10_000),
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [ /* ... */ ],
});
```

순서가 중요합니다. 위 예제: 인증 → 타임아웃 → 실패 시 재시도 → 결과 캐싱.

## 플러그인 vs 팩토리

플러그인은 두 가지 형태로 전달할 수 있습니다:

```typescript
// 1. 팩토리 함수 (옵션을 받아 플러그인 반환) — 대부분의 내장 플러그인
use: [cachePlugin({ ttlMs: 60_000 })]

// 2. 플러그인 객체 직접 전달
use: [myPlugin]
```

내부적으로 `resolvePlugin`이 팩토리 함수를 호출하여 `AirPlugin` 객체로 변환합니다. 팩토리에 옵션을 넘기지 않으면 기본값이 사용됩니다:

```typescript
use: [cachePlugin()]   // ttlMs: 60_000 (기본값)
```

## 플러그인 검증

모든 플러그인은 등록 시 검증됩니다. `meta.name`이 필수입니다:

```typescript
// ✅ OK
const myPlugin: AirPlugin = {
  meta: { name: 'my-plugin', version: '1.0.0' },
  middleware: [ /* ... */ ],
};

// ❌ 에러: plugin.meta.name is required
const badPlugin: AirPlugin = {
  meta: {} as any,
  middleware: [],
};
```

## 플러그인 카테고리

### 안정성

| 플러그인 | 설명 |
|----------|------|
| [`timeoutPlugin`](/ko/plugins/stability#timeoutplugin) | 시간 초과 시 호출 중단 (기본: 30초) |
| [`retryPlugin`](/ko/plugins/stability#retryplugin) | 실패한 호출 재시도 (지수 백오프, 기본: 3회, 200ms) |
| [`circuitBreakerPlugin`](/ko/plugins/stability#circuitbreakerplugin) | 연속 실패 시 호출 차단 (기본: 5회 실패 후 30초 대기) |
| [`fallbackPlugin`](/ko/plugins/stability#fallbackplugin) | 에러 시 대체 값 반환 |

### 성능

| 플러그인 | 설명 |
|----------|------|
| [`cachePlugin`](/ko/plugins/performance#cacheplugin) | 파라미터 해시 기반 결과 캐싱 (기본: 60초 TTL, 최대 1000개) |
| [`dedupPlugin`](/ko/plugins/performance#dedupplugin) | 동시 동일 호출 중복 제거 |
| [`queuePlugin`](/ko/plugins/performance#queueplugin) | 동시 실행 수 제한 (기본: 10) |

### 보안

| 플러그인 | 설명 |
|----------|------|
| [`authPlugin`](/ko/plugins/security#authplugin) | API 키 또는 Bearer 토큰 인증 |
| [`sanitizerPlugin`](/ko/plugins/security#sanitizerplugin) | 입력에서 HTML/스크립트 제거 (기본: 최대 10000자) |
| [`validatorPlugin`](/ko/plugins/security#validatorplugin) | 커스텀 검증 규칙 |

### 네트워크

| 플러그인 | 설명 |
|----------|------|
| [`corsPlugin`](/ko/plugins/network#corsplugin) | HTTP/SSE 트랜스포트 CORS 헤더 |
| [`webhookPlugin`](/ko/plugins/network#webhookplugin) | 도구 결과를 웹훅 URL로 전송 |

### 데이터

| 플러그인 | 설명 |
|----------|------|
| [`transformPlugin`](/ko/plugins/data#transformplugin) | 파라미터 또는 결과 변환 |
| [`i18nPlugin`](/ko/plugins/data#i18nplugin) | 도구 응답 현지화 |

### 모니터링

| 플러그인 | 설명 |
|----------|------|
| [`jsonLoggerPlugin`](/ko/plugins/monitoring#jsonloggerplugin) | 구조화된 JSON 로깅 |
| [`perUserRateLimitPlugin`](/ko/plugins/monitoring#peruserratelimitplugin) | 사용자별 레이트 리밋 |

### 개발/테스트

| 플러그인 | 설명 |
|----------|------|
| [`dryrunPlugin`](/ko/plugins/dev#dryrunplugin) | 핸들러 실행 건너뛰기 (미들웨어 테스트용) |

## 내장 플러그인 (항상 활성)

`use`에 추가하지 않아도 자동 등록되는 2개:

### builtinLoggerPlugin

모든 도구 호출을 자동 로깅합니다. `logging.level`로 레벨을 제어합니다.

출력 형식:

```
12:34:56.789 search (45ms) [a1b2c3d4-e5f6-...]
```

에러 발생 시:

```
12:34:56.789 search ERROR: Connection refused [a1b2c3d4-e5f6-...]
```

### builtinMetricsPlugin

도구별 호출 수, 에러 수, 총 지연시간, 평균 지연시간, 마지막 호출 시각을 자동 수집합니다.

```typescript
import { getMetrics, resetMetrics } from '@airmcp-dev/core';

const metrics = getMetrics();
// {
//   search: {
//     calls: 150,
//     errors: 3,
//     totalDuration: 6750,
//     avgDuration: 45,        // totalDuration / calls
//     lastCalledAt: 1710000000000,
//   },
//   greet: {
//     calls: 50,
//     errors: 0,
//     totalDuration: 100,
//     avgDuration: 2,
//     lastCalledAt: 1710000001000,
//   },
// }

resetMetrics();  // 모든 메트릭 초기화
```

## 플러그인 실행 순서

```
요청 도착
  ↓
  errorBoundaryMiddleware.before   (내장 — 에러 경계)
  validationMiddleware.before      (내장 — 입력 검증)
  builtinLoggerPlugin.before       (내장)
  builtinMetricsPlugin.before      (내장)
  ↓
  use[0].before (authPlugin)       ← 사용자 플러그인 순서대로
  use[1].before (timeoutPlugin)
  use[2].before (retryPlugin)
  use[3].before (cachePlugin)
  ↓
  handler()                        ← 도구 핸들러 실행
  ↓
  use[3].after (cachePlugin)       ← 역순 아님, 등록 순서대로 after 실행
  use[2].after (retryPlugin)
  use[1].after (timeoutPlugin)
  use[0].after (authPlugin)
  builtinMetricsPlugin.after       (내장)
  builtinLoggerPlugin.after        (내장)
  ↓
응답 반환
```

::: info
after 미들웨어는 역순이 아니라 **등록 순서대로** 실행됩니다. Express와 다릅니다.
:::

## 라이프사이클 훅

플러그인은 서버 라이프사이클에 끼어들 수 있습니다:

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;     // server 초기화 직후
  onStart?: (ctx: PluginContext) => Promise<void> | void;    // server.start() 호출 시
  onStop?: (ctx: PluginContext) => Promise<void> | void;     // server.stop() 호출 시
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;  // 도구 등록 시 (동기)
}
```

실행 순서: `onInit` → `onStart` → (서버 실행 중) → `onStop`. 여러 플러그인의 같은 훅은 등록 순서대로 실행됩니다.

`onToolRegister`는 **동기**입니다. 도구를 수정하려면 수정된 객체를 반환하고, 수정하지 않으면 `undefined`를 반환합니다.

### PluginContext

```typescript
interface PluginContext {
  serverName: string;                   // 서버 이름
  config: Record<string, any>;         // 서버 설정
  state: Record<string, any>;          // 글로벌 상태 (server.state)
  log: (level: string, message: string, data?: any) => void;
}
```

`ctx.log` 사용:

```typescript
hooks: {
  onInit: (ctx) => {
    ctx.log('info', 'Plugin initialized', { serverName: ctx.serverName });
    // [air:plugin] Plugin initialized { serverName: 'my-server' }
  },
}
```

## 커스텀 플러그인

자세한 내용은 [커스텀 플러그인](/ko/plugins/custom)을 참고하세요.
