# 플러그인 레퍼런스

## AirPlugin

```typescript
interface AirPlugin {
  meta: AirPluginMeta;          // 필수: name 필수
  middleware?: AirMiddleware[];
  hooks?: PluginHooks;
  tools?: AirToolDef[];
  resources?: AirResourceDef[];
}
```

### AirPluginMeta

```typescript
interface AirPluginMeta {
  name: string;               // 필수 — 검증 시 없으면 에러
  version?: string;
  description?: string;
}
```

### PluginHooks

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;      // server 초기화
  onStart?: (ctx: PluginContext) => Promise<void> | void;     // server.start()
  onStop?: (ctx: PluginContext) => Promise<void> | void;      // server.stop()
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;  // 동기
}
```

실행 순서: `onInit` → `onStart` → (서버 실행 중) → `onStop`.
`onToolRegister`는 **동기**. 수정된 도구 반환 또는 `undefined`.

### PluginContext

```typescript
interface PluginContext {
  serverName: string;
  config: Record<string, any>;
  state: Record<string, any>;          // server.state
  log: (level: string, message: string, data?: any) => void;
}
```

`ctx.log` 출력:

```
[air:plugin] Plugin initialized { serverName: 'my-server' }
```

### AirPluginFactory

```typescript
type AirPluginFactory = () => AirPlugin;
```

팩토리가 전달되면 `resolvePlugin`이 호출하여 `AirPlugin` 반환. 검증: `meta.name` 필수.

## 내장 플러그인 시그니처

### 안정성

```typescript
timeoutPlugin(timeoutMs?: number): AirPlugin;                    // 기본: 30000
retryPlugin(options?: {
  maxRetries?: number;      // 기본: 3
  delayMs?: number;         // 기본: 200 (지수 백오프)
  retryOn?: (error: Error) => boolean;  // 기본: () => true
}): AirPlugin;
circuitBreakerPlugin(options?: {
  failureThreshold?: number;  // 기본: 5
  resetTimeoutMs?: number;    // 기본: 30000
  perTool?: boolean;          // 기본: true
}): AirPlugin;
fallbackPlugin(fallbacks: Record<string, string>): AirPlugin;    // 도구명 → 대체도구명
```

### 성능

```typescript
cachePlugin(options?: {
  ttlMs?: number;           // 기본: 60000
  maxEntries?: number;      // 기본: 1000
  exclude?: string[];       // 캐시 제외 도구
}): AirPlugin;
dedupPlugin(options?: { windowMs?: number }): AirPlugin;          // 기본: 1000
queuePlugin(options?: {
  concurrency?: Record<string, number>;  // 기본: { '*': 10 }
  maxQueueSize?: number;                 // 기본: 100
  queueTimeoutMs?: number;              // 기본: 30000
}): AirPlugin;
```

### 보안

```typescript
authPlugin(options: {
  type: 'api-key' | 'bearer';
  keys?: string[];
  verify?: (token: string) => boolean | Promise<boolean>;
  publicTools?: string[];     // 인증 불필요 도구
  paramName?: string;         // 기본: '_auth'
}): AirPlugin;
sanitizerPlugin(options?: {
  stripHtml?: boolean;        // 기본: true
  stripControl?: boolean;     // 기본: true
  maxStringLength?: number;   // 기본: 10000
  exclude?: string[];
}): AirPlugin;
validatorPlugin(options: {
  rules: Array<{ tool: string; validate: (params: any) => string | undefined }>;
}): AirPlugin;
```

### 네트워크

```typescript
corsPlugin(options?: {
  origins?: string[];         // 기본: ['*']
  methods?: string[];         // 기본: ['GET', 'POST', 'OPTIONS']
  headers?: string[];         // 기본: ['Content-Type', 'Authorization']
  credentials?: boolean;      // 기본: false
}): AirPlugin;
webhookPlugin(options: {
  url: string;
  events?: Array<'tool.call' | 'tool.error' | 'tool.slow'>;  // 기본: ['tool.call']
  slowThresholdMs?: number;   // 기본: 5000
  headers?: Record<string, string>;
  batchSize?: number;         // 기본: 1
}): AirPlugin;
```

### 데이터

```typescript
transformPlugin(options: {
  before?: Record<string, (params: any) => any>;  // 도구명 또는 '*'
  after?: Record<string, (result: any) => any>;
}): AirPlugin;
i18nPlugin(options?: {
  defaultLang?: string;       // 기본: 'en'
  translations?: Record<string, Record<string, string>>;
  langParam?: string;         // 기본: '_lang'
}): AirPlugin;
```

### 모니터링

```typescript
jsonLoggerPlugin(options?: {
  output?: 'stderr' | 'stdout';  // 기본: 'stderr'
  logParams?: boolean;            // 기본: false
  extraFields?: Record<string, any>;
}): AirPlugin;
perUserRateLimitPlugin(options?: {
  maxCalls?: number;           // 기본: 10
  windowMs?: number;           // 기본: 60000
  identifyBy?: string;        // 기본: '_userId'
}): AirPlugin;
```

### 개발

```typescript
dryrunPlugin(options?: {
  enabled?: boolean;           // 기본: false
  perCall?: boolean;           // 기본: true
  mockResponse?: (toolName: string, params: Record<string, any>) => any;
}): AirPlugin;
```

## 메트릭 접근

### getMetrics() / resetMetrics()

내장 `builtinMetricsPlugin` 데이터:

```typescript
import { getMetrics, resetMetrics } from '@airmcp-dev/core';

const m = getMetrics();
// { search: { calls: 150, errors: 3, totalDuration: 6750, avgDuration: 45, lastCalledAt: 1710... } }

resetMetrics();
```

### getMetricsSnapshot() / resetMetricsHistory()

Meter 미들웨어 데이터 (Ring Buffer 최대 10,000건):

```typescript
import { getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

const s = getMetricsSnapshot();
// { totalCalls: 1500, successRate: 0.98, avgLatencyMs: 45.2,
//   layerDistribution: { L1: 200, L2: 400, ... },
//   toolCounts: { search: 500, greet: 300 } }

resetMetricsHistory();
```
