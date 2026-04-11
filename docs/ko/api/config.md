# 설정 & 트랜스포트 레퍼런스

## loadConfig(cwd?)

설정 파일을 찾아 기본값과 병합. 우선순위: `air.config.ts` > `air.config.json` > `package.json "air"`.

```typescript
import { loadConfig } from '@airmcp-dev/core';

const config = await loadConfig();              // cwd에서 로드
const config = await loadConfig('/path/to');    // 특정 디렉토리
```

내부 동작:
1. `air.config.ts` → ESM dynamic import
2. 없으면 `air.config.json` → JSON.parse
3. 없으면 `package.json`의 `"air"` 필드
4. 모두 없으면 `{ name: 'air-server' }`
5. 찾은 설정을 `DEFAULT_CONFIG`와 깊은 병합

## AirConfig

```typescript
interface AirConfig {
  name: string;                   // 필수

  version?: string;               // 기본: '0.1.0'
  description?: string;

  transport?: TransportConfig;
  storage?: StoreOptions;
  meter?: MeterConfig;

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format?: 'json' | 'pretty';
  };

  dev?: {
    hotReload?: boolean;
    port?: number;
  };

  telemetry?: {
    enabled?: boolean;            // 기본: false (opt-in)
    endpoint?: string;
  };

  registry?: {
    url?: string;                 // 기본: 'https://plugins.airmcp.dev/api/v1'
    apiKey?: string;
  };
}
```

## DEFAULT_CONFIG

```typescript
const DEFAULT_CONFIG = {
  version: '0.1.0',
  transport: { type: 'auto' },
  storage: { type: 'memory' },
  logging: { level: 'info', format: 'pretty' },
  metrics: { enabled: true, layerClassification: false },
  dev: { hotReload: true, port: 3100 },
};
```

## TransportConfig

```typescript
interface TransportConfig {
  type?: 'stdio' | 'sse' | 'http' | 'auto';  // 기본: 'auto'
  port?: number;
  host?: string;                               // 기본: 'localhost'
  basePath?: string;                           // 기본: '/'
}
```

## detectTransport(config?)

환경에 따라 트랜스포트 타입을 자동 감지.

```typescript
import { detectTransport } from '@airmcp-dev/core';

detectTransport();                          // auto 감지
detectTransport({ type: 'sse' });          // → 'sse' (명시)
detectTransport({ type: 'auto' });         // → 환경 감지
```

감지 순서:
1. `config.type`이 `'auto'`가 아니면 그대로 반환
2. `MCP_TRANSPORT` 환경변수 확인 (`stdio` / `http` / `sse`)
3. `process.stdin.isTTY` 체크:
   - TTY 아님 (파이프) → `'stdio'` (MCP 클라이언트가 spawn)
   - TTY (터미널) → `'http'` (개발자 직접 실행)

### 포트 결정 순서

```typescript
transport.port → dev.port → 3100 (하드코딩 기본값)
```

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;          // 기본: true
  classify?: boolean;         // 7계층 자동 분류 (기본: true)
  trackCalls?: boolean;       // 호출 추적 (기본: true)
  trackTokens?: boolean;      // 토큰 사용 추적 (기본: false)
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## 전체 타입 export

```typescript
import type {
  // 설정
  AirConfig, MeterConfig, TransportType, TransportConfig,
  // 도구
  ParamShorthand, AirToolParams, AirToolHandler, AirToolContext, AirToolResponse, AirToolDef,
  // 리소스
  AirResourceDef, AirResourceContext, AirResourceContent,
  // 프롬프트
  AirPromptDef, AirPromptArg, AirPromptMessage,
  // 미들웨어
  MiddlewareContext, MiddlewareResult, AirMiddleware,
  // 스토리지
  StorageAdapter, QueryOptions, StoreOptions,
  // 플러그인
  AirPluginMeta, PluginHooks, PluginContext, AirPlugin, AirPluginFactory,
  // 서버
  AirServerOptions, AirServer, AirServerStatus,
} from '@airmcp-dev/core';
```
