# 로깅

air는 별도 설정 없이 바로 동작하는 내장 로깅을 제공합니다. 레벨, 포맷을 커스터마이즈하고 외부 트랜스포트를 추가할 수 있습니다.

## 기본 동작

`defineServer`는 자동으로 내장 로거 플러그인을 등록합니다:

- **개발** (`NODE_ENV !== 'production'`): pretty-print으로 stdout 출력
- **프로덕션**: JSON으로 stdout 출력

```
[air] 12:34:56 INFO  search called { query: 'hello' }
[air] 12:34:56 INFO  search completed (45ms)
```

## 설정

```typescript
defineServer({
  logging: {
    level: 'debug',     // 'debug' | 'info' | 'warn' | 'error' | 'silent'
    format: 'json',     // 'json' | 'pretty'
  },
});
```

### 로그 레벨

| 레벨 | 설명 | 표시 |
|------|------|------|
| `debug` | 상세, 모든 정보 | debug + info + warn + error |
| `info` | 일반 동작 (기본) | info + warn + error |
| `warn` | 잠재적 문제 | warn + error |
| `error` | 실패만 | error |
| `silent` | 출력 없음 | 없음 |

### 포맷 예시

**pretty** (개발 기본):
```
[air] 12:34:56 INFO  greet called { name: 'World' }
[air] 12:34:56 INFO  greet → "Hello, World!" (2ms)
```

**json** (프로덕션 기본):
```json
{"level":"info","tool":"greet","event":"call","params":{"name":"World"},"timestamp":"2025-01-01T00:00:00.000Z"}
{"level":"info","tool":"greet","event":"complete","duration":2,"timestamp":"2025-01-01T00:00:00.000Z"}
```

## jsonLoggerPlugin

더 세밀한 제어를 위해 `jsonLoggerPlugin`을 사용합니다:

```typescript
import { defineServer, jsonLoggerPlugin } from '@airmcp-dev/core';

defineServer({
  logging: { level: 'silent' },  // 내장 로거 비활성화
  use: [
    jsonLoggerPlugin({
      logParams: true,
      logResult: false,
      output: 'stdout',
    }),
  ],
});
```

## @airmcp-dev/logger 패키지

파일 로테이션, 원격 전송 등 고급 기능이 필요하면 독립 로거를 사용합니다:

```typescript
import { createLogger } from '@airmcp-dev/logger';

const logger = createLogger({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
  file: {
    path: './logs/server.log',
    maxSizeMb: 10,
    maxFiles: 5,
  },
});

// 도구 핸들러에서 사용
defineTool('search', {
  handler: async (params, context) => {
    logger.info('검색 시작', { query: params.query });
    const results = await doSearch(params.query);
    logger.debug('검색 결과', { count: results.length });
    return results;
  },
});
```

### 원격 트랜스포트

중앙화된 로깅 서비스로 로그 전송:

```typescript
const logger = createLogger({
  transports: ['console', 'remote'],
  remote: {
    url: 'https://logs.example.com/ingest',
    batchSize: 100,
    flushIntervalMs: 5000,
    headers: { 'Authorization': 'Bearer xxx' },
  },
});
```

## 미들웨어에서 로깅

```typescript
const auditMiddleware: AirMiddleware = {
  name: 'audit',
  before: async (ctx) => {
    console.log(JSON.stringify({
      event: 'tool.call',
      tool: ctx.tool.name,
      requestId: ctx.requestId,
      server: ctx.serverName,
      timestamp: new Date().toISOString(),
    }));
  },
  after: async (ctx) => {
    console.log(JSON.stringify({
      event: 'tool.complete',
      tool: ctx.tool.name,
      requestId: ctx.requestId,
      duration: ctx.duration,
      timestamp: new Date().toISOString(),
    }));
  },
};
```

## 환경 변수

```bash
# 코드 수정 없이 로그 레벨 오버라이드
AIR_LOG_LEVEL=debug node dist/index.js
```

::: tip
`stdio` 트랜스포트 사용 시 모든 로그는 **stderr**로 출력됩니다. stdout은 MCP 프로토콜 전용입니다. air가 이를 자동으로 처리합니다.
:::
