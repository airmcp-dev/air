# @airmcp-dev/logger

Structured logging with multiple transports.

## Installation

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
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // Default: 'info'
  format?: 'json' | 'pretty';    // Default: 'pretty'
  transports?: Array<'console' | 'file' | 'remote'>;  // Default: ['console']
  file?: {
    path: string;
    maxSizeMb?: number;
    maxFiles?: number;
  };
  remote?: {
    url: string;
    batchSize?: number;         // Default: 100
    flushIntervalMs?: number;   // Default: 5000
    headers?: Record<string, string>;
  };
}
```

## Logger instance

```typescript
interface Logger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
}
```

## Usage

```typescript
const logger = createLogger({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
  file: { path: './logs/server.log', maxSizeMb: 10, maxFiles: 5 },
});

logger.info('Server started', { port: 3510 });
logger.warn('High latency', { tool: 'search', ms: 500 });
logger.error('Tool failed', { error: 'Connection refused' });
logger.debug('Params received', { params: { query: 'hello' } });
```

## Log levels

`debug` < `info` < `warn` < `error` < `silent`

Logs below the configured level are ignored. `silent` disables all output.

## Transports

### console

```typescript
createLogger({ transports: ['console'] });
```

### file

```typescript
createLogger({
  transports: ['file'],
  file: { path: './logs/app.log', maxSizeMb: 10, maxFiles: 5 },
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

### Multiple transports

```typescript
createLogger({
  transports: ['console', 'file', 'remote'],
  file: { path: './logs/app.log' },
  remote: { url: 'https://logs.example.com/ingest' },
});
```

## With defineServer

The builtin logger plugin uses `@airmcp-dev/logger` internally. Configure via `logging`:

```typescript
defineServer({ logging: { level: 'debug', format: 'json' } });
```

→ [Logging guide](/guide/logging)
