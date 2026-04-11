# 설정 파일

air는 세 가지 소스에서 설정을 로드합니다 (우선순위 순):

1. `air.config.ts` — TypeScript 설정 파일 (권장)
2. `air.config.json` — JSON 설정 파일
3. `package.json`의 `"air"` 필드 — 인라인 설정

모두 없으면 기본값이 사용됩니다. 내부적으로 `loadConfig()` 함수가 위 순서대로 파일을 찾고, 첫 번째 발견된 설정을 기본값과 병합합니다.

## air.config.ts (권장)

TypeScript의 타입 체크와 자동완성을 활용할 수 있습니다:

```typescript
// air.config.ts
import type { AirConfig } from '@airmcp-dev/core';

const config: AirConfig = {
  name: 'my-server',
  version: '1.0.0',
  description: '프로덕션 MCP 서버',

  transport: {
    type: 'sse',
    port: 3510,
    host: 'localhost',
  },

  storage: {
    type: 'file',
    path: '.air/data',
  },

  logging: {
    level: 'info',
    format: 'json',
  },

  dev: {
    hotReload: true,
    port: 3100,
  },
};

export default config;
```

## air.config.json

TypeScript 설정이 불필요하거나 JSON을 선호할 때:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "transport": {
    "type": "sse",
    "port": 3510
  },
  "storage": {
    "type": "file",
    "path": ".air/data"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## package.json의 "air" 필드

별도 파일 없이 package.json에 인라인으로 작성:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@airmcp-dev/core": "^0.1.3"
  },
  "air": {
    "transport": { "type": "sse", "port": 3510 },
    "logging": { "level": "info" }
  }
}
```

::: tip
세 가지 소스 중 하나만 사용하세요. 여러 개 존재하면 우선순위가 높은 것만 적용됩니다 (`air.config.ts` > `air.config.json` > `package.json`).
:::

## 기본값

필드를 생략하면 다음 기본값이 적용됩니다. 이 값들은 `@airmcp-dev/core`의 `DEFAULT_CONFIG`에 정의되어 있습니다:

```typescript
// packages/core/src/config/defaults.ts
{
  version: '0.1.0',
  transport: { type: 'auto' },       // 환경에 따라 stdio 또는 http 자동 선택
  storage: { type: 'memory' },       // 인메모리 (재시작 시 소멸)
  logging: { level: 'info', format: 'pretty' },
  metrics: { enabled: true, layerClassification: false },
  dev: { hotReload: true, port: 3100 },
}
```

`transport.type: 'auto'`의 동작:
- stdin이 TTY(터미널에서 직접 실행) → `http`
- stdin이 파이프(MCP 클라이언트가 실행) → `stdio`

## 전체 AirConfig 레퍼런스

```typescript
interface AirConfig {
  // ── 필수 ──
  name: string;                   // 서버 이름 (MCP 등록명)

  // ── 선택 — 기본값이 있는 필드 ──
  version?: string;               // 기본: '0.1.0'
  description?: string;           // 서버 설명

  transport?: {
    type?: 'stdio' | 'sse' | 'http' | 'auto';  // 기본: 'auto'
    port?: number;                // HTTP/SSE 포트
    host?: string;                // 기본: 'localhost'
    basePath?: string;            // 기본: '/'
  };

  storage?: {
    type: 'memory' | 'file';      // 기본: 'memory'
    path?: string;                // file 타입 시 경로 (기본: '.air/data/')
    defaultTtl?: number;          // TTL 초 단위 (0 = 무제한)
  };

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // 기본: 'info'
    format?: 'json' | 'pretty';   // 기본: 개발=pretty, 프로덕션=json
  };

  meter?: MeterConfig;            // Meter 가이드 참고

  dev?: {
    hotReload?: boolean;          // 기본: true
    port?: number;                // 기본: 3100
  };

  telemetry?: {
    enabled?: boolean;            // 기본: false (opt-in)
    endpoint?: string;            // 기본: 'https://telemetry.airmcp.dev/v1/collect'
  };

  registry?: {
    url?: string;                 // 기본: 'https://plugins.airmcp.dev/api/v1'
    apiKey?: string;              // 플러그인 배포 시 필요
  };
}
```

## loadConfig 사용법

`loadConfig()`는 설정 파일을 찾아 기본값과 병합한 결과를 반환합니다:

```typescript
import { loadConfig } from '@airmcp-dev/core';

// 현재 디렉토리에서 설정 로드
const config = await loadConfig();

// 특정 디렉토리에서 로드
const config = await loadConfig('/path/to/project');

console.log(config.name);          // 'my-server'
console.log(config.transport);     // { type: 'sse', port: 3510 }
console.log(config.logging);       // { level: 'info', format: 'json' }
```

`loadConfig`의 내부 동작:
1. `air.config.ts` 파일이 있으면 ESM dynamic import로 로드
2. 없으면 `air.config.json`을 JSON.parse로 로드
3. 없으면 `package.json`의 `"air"` 필드를 읽음
4. 세 곳 모두 없으면 `{ name: 'air-server' }`를 사용
5. 찾은 설정을 `DEFAULT_CONFIG`와 깊은 병합(deep merge)

## 설정 파일 vs defineServer

`air.config.ts`는 **인프라 설정**(어떤 포트, 어떤 스토리지, 어떤 로그 레벨)을, `defineServer()`는 **비즈니스 로직**(어떤 도구, 어떤 플러그인)을 담당합니다:

```typescript
// air.config.ts — 인프라 설정
export default {
  name: 'my-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },
  storage: { type: 'file', path: '.air/data' },
  logging: { level: 'info', format: 'json' },
};
```

```typescript
// src/index.ts — 비즈니스 로직
import config from '../air.config.js';
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  ...config,                        // 인프라 설정 스프레드
  use: [cachePlugin({ ttlMs: 60_000 })],
  tools: [
    defineTool('search', {
      params: { query: 'string' },
      handler: async ({ query }) => doSearch(query),
    }),
  ],
});

server.start();
```

이렇게 분리하면:
- 인프라 설정은 환경별로 교체 가능 (dev/staging/prod)
- 비즈니스 로직은 설정 변경 없이 동일하게 유지
- CI/CD에서 `air.config.ts`만 교체하여 배포 환경 전환

## 환경별 설정 패턴

### 단일 파일에서 분기

```typescript
// air.config.ts
const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    transport: { type: 'sse' as const, port: 3510 },
    logging: { level: 'debug' as const, format: 'pretty' as const },
    storage: { type: 'memory' as const },
  },
  staging: {
    transport: { type: 'http' as const, port: 3510 },
    logging: { level: 'info' as const, format: 'json' as const },
    storage: { type: 'file' as const, path: '.air/data' },
  },
  production: {
    transport: { type: 'http' as const, port: 3510 },
    logging: { level: 'warn' as const, format: 'json' as const },
    storage: { type: 'file' as const, path: '/var/air/data' },
  },
};

export default {
  name: 'my-server',
  version: '1.0.0',
  ...configs[env as keyof typeof configs] || configs.development,
};
```

### 환경 변수 활용

```typescript
// air.config.ts
export default {
  name: process.env.SERVER_NAME || 'my-server',
  transport: {
    type: (process.env.TRANSPORT_TYPE || 'sse') as 'stdio' | 'sse' | 'http',
    port: parseInt(process.env.PORT || '3510'),
    host: process.env.HOST || 'localhost',
  },
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
};
```

```bash
# 개발
PORT=3510 LOG_LEVEL=debug node dist/index.js

# 프로덕션
PORT=8080 LOG_LEVEL=warn TRANSPORT_TYPE=http node dist/index.js
```
