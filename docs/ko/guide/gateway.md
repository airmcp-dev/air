# Gateway

Gateway는 여러 MCP 서버를 하나의 엔드포인트로 묶는 리버스 프록시입니다. 서버 레지스트리, 도구 인덱스, 요청 라우팅, 헬스 체크, 로드밸런싱을 제공합니다.

## 개요

여러 MCP 서버가 있을 때 Gateway는 단일 진입점을 제공합니다:

```
클라이언트 → Gateway (:4000) → Server A - search   (:3510, SSE)
                              → Server B - files    (:3511, SSE)
                              → Server C - analytics (stdio)
```

클라이언트는 Gateway 하나에 연결하면 모든 서버의 도구에 접근할 수 있습니다.

## 설치

```bash
npm install @airmcp-dev/gateway
```

## 기본 사용법

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  name: 'my-gateway',
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

// 서버 등록
gateway.register({
  id: 'search-1',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});

gateway.register({
  id: 'files-1',
  name: 'files',
  transport: 'stdio',
  connection: { type: 'stdio', command: 'node', args: ['./servers/files/dist/index.js'] },
});

await gateway.start();
```

## GatewayConfig

```typescript
interface GatewayConfig {
  name?: string;                  // 게이트웨이 이름
  port?: number;                  // HTTP 리스닝 포트
  healthCheckInterval?: number;   // 헬스 체크 주기 (ms, 기본: 15000)
  balancer?: BalancerStrategy;    // 로드밸런서 전략
  requestTimeout?: number;        // 요청 타임아웃 (ms)
}
```

## ServerEntry

```typescript
interface ServerEntry {
  id: string;                     // 고유 식별자
  name: string;                   // 표시 이름
  transport: 'stdio' | 'http' | 'sse';
  connection: StdioConnection | HttpConnection;
  tools: ToolEntry[];             // 발견된 도구 목록 (자동 채워짐)
  status: ServerStatus;           // 서버 상태
  lastHealthCheck?: Date;
  metadata?: Record<string, any>;
}
```

### 연결 타입

```typescript
// stdio — 로컬 프로세스
interface StdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

// HTTP/SSE — 원격 서버
interface HttpConnection {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}
```

Gateway는 stdio, SSE, HTTP 서버를 혼합하여 등록할 수 있습니다.

### 서버 상태

```typescript
type ServerStatus = 'registered' | 'connecting' | 'connected' | 'error' | 'stopped';
```

## 서버 레지스트리

```typescript
// 등록
gateway.register({ id: 'search-1', name: 'search', ... });

// 해제
gateway.unregister('search-1');

// 목록 조회
const servers = gateway.list();
// [{ id: 'search-1', name: 'search', status: 'connected', tools: [...] }, ...]
```

## 도구 인덱스

Gateway는 등록된 서버에서 도구 목록을 자동 수집합니다:

```typescript
interface ToolEntry {
  name: string;                   // 도구 이름
  description?: string;           // 설명
  serverId: string;               // 이 도구를 제공하는 서버 ID
  inputSchema?: Record<string, any>;  // JSON Schema
}
```

클라이언트가 도구를 호출하면 Gateway가 해당 도구를 제공하는 서버로 라우팅합니다.

## 로드밸런싱

같은 이름의 서버가 여러 개 등록되면 로드밸런싱이 적용됩니다:

```typescript
const gateway = new Gateway({
  balancer: 'round-robin',  // 기본값
});

// 같은 이름의 서버 2개 등록
gateway.register({ id: 'search-1', name: 'search', ... });
gateway.register({ id: 'search-2', name: 'search', ... });
// → 도구 호출이 search-1, search-2에 번갈아 라우팅
```

### 로드밸런서 전략

```typescript
type BalancerStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';
```

| 전략 | 설명 |
|------|------|
| `round-robin` | 순서대로 번갈아 (기본) |
| `least-connections` | 현재 연결이 가장 적은 서버 |
| `weighted` | 가중치 기반 분배 |
| `random` | 무작위 |

## 헬스 체크

```typescript
const gateway = new Gateway({
  healthCheckInterval: 15_000,  // 15초마다
});
```

헬스 체크 결과:

```typescript
interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}
```

비정상 서버는 라우팅 풀에서 제외되고, 복구되면 자동으로 다시 포함됩니다.

## 장애 복구

1. 서버 다운 → 활성 요청 타임아웃 실패
2. 헬스 체크가 서버를 `error` 상태로 전환
3. 이후 요청은 나머지 정상 서버로 라우팅
4. 서버 복구 → 헬스 체크 통과 → `connected` 상태 복귀 → 라우팅 풀 복귀

## defineServer와 함께 사용

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';
import { Gateway } from '@airmcp-dev/gateway';

// 개별 서버 시작
const searchServer = defineServer({
  name: 'search',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('search', {
      description: '문서 검색',
      params: { query: 'string' },
      handler: async ({ query }) => doSearch(query),
    }),
  ],
});

const filesServer = defineServer({
  name: 'files',
  transport: { type: 'sse', port: 3511 },
  tools: [
    defineTool('read-file', {
      params: { path: 'string' },
      handler: async ({ path }) => readFile(path, 'utf-8'),
    }),
  ],
});

await searchServer.start();
await filesServer.start();

// Gateway로 묶기
const gateway = new Gateway({ port: 4000 });
gateway.register({ id: 'search', name: 'search', transport: 'sse', connection: { type: 'sse', url: 'http://localhost:3510' } });
gateway.register({ id: 'files', name: 'files', transport: 'sse', connection: { type: 'sse', url: 'http://localhost:3511' } });
await gateway.start();

// 클라이언트는 http://localhost:4000 하나로 search, read-file 모두 호출 가능
```
