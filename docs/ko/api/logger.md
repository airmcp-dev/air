# @airmcp-dev/logger

다중 트랜스포트를 갖춘 구조화 로깅.

## 설치

```bash
npm install @airmcp-dev/logger
```

## createLogger

```typescript
import { createLogger } from '@airmcp-dev/logger';

const logger = createLogger(options);
```

### LoggerOptions

```typescript
interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // 기본: 'info'
  format?: 'json' | 'pretty';    // 기본: 'pretty'
  transports?: Array<'console' | 'file' | 'remote'>;  // 기본: ['console']
  file?: {
    path: string;               // 로그 파일 경로
    maxSizeMb?: number;         // 파일 크기 제한 (MB)
    maxFiles?: number;          // 로테이션 파일 수
  };
  remote?: {
    url: string;                // 원격 수집 엔드포인트
    batchSize?: number;         // 배치 크기 (기본: 100)
    flushIntervalMs?: number;   // 전송 주기 (기본: 5000)
    headers?: Record<string, string>;
  };
}
```

## Logger 인스턴스

```typescript
interface Logger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
}
```

## 사용 예제

```typescript
const logger = createLogger({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
  file: { path: './logs/server.log', maxSizeMb: 10, maxFiles: 5 },
});

logger.info('서버 시작됨', { port: 3510 });
logger.warn('높은 지연시간', { tool: 'search', ms: 500 });
logger.error('도구 실패', { error: 'Connection refused' });
logger.debug('파라미터 수신', { params: { query: 'hello' } });
```

## 로그 레벨

`debug` < `info` < `warn` < `error` < `silent`

설정된 레벨보다 낮은 로그는 무시됩니다. `silent`은 모든 로그를 비활성화합니다.

## 트랜스포트

### console

```typescript
createLogger({ transports: ['console'] });
```

### file

```typescript
createLogger({
  transports: ['file'],
  file: {
    path: './logs/app.log',
    maxSizeMb: 10,     // 10MB 초과 시 로테이션
    maxFiles: 5,        // 최대 5개 파일 유지
  },
});
```

### remote

```typescript
createLogger({
  transports: ['remote'],
  remote: {
    url: 'https://logs.example.com/ingest',
    batchSize: 100,
    flushIntervalMs: 5000,
    headers: { 'Authorization': `Bearer ${process.env.LOG_TOKEN}` },
  },
});
```

### 복수 트랜스포트

```typescript
createLogger({
  transports: ['console', 'file', 'remote'],
  file: { path: './logs/app.log' },
  remote: { url: 'https://logs.example.com/ingest' },
});
```

## defineServer와 함께

`@airmcp-dev/core`의 내장 로거 플러그인이 `@airmcp-dev/logger`를 내부적으로 사용합니다. `logging` 옵션으로 설정:

```typescript
defineServer({
  logging: {
    level: 'debug',
    format: 'json',
  },
});
```

→ [로깅 가이드](/ko/guide/logging)
