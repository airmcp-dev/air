# @airmcp-dev/gateway

여러 MCP 서버를 하나의 엔드포인트로 묶는 리버스 프록시. 서버 레지스트리, 도구 인덱스, 요청 라우팅, 헬스 체크, 로드밸런싱.

## 설치

```bash
npm install @airmcp-dev/gateway
```

## Gateway

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway(config);
```

### GatewayConfig

```typescript
interface GatewayConfig {
  name?: string;
  port?: number;
  healthCheckInterval?: number;   // ms, 기본: 15000
  balancer?: BalancerStrategy;    // 기본: 'round-robin'
  requestTimeout?: number;        // ms
}
```

### 메서드

```typescript
class Gateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  register(server: ServerEntry): void;
  unregister(id: string): void;
  list(): ServerEntry[];
}
```

## ServerEntry

```typescript
interface ServerEntry {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  connection: StdioConnection | HttpConnection;
  tools: ToolEntry[];             // 연결 후 자동 채워짐
  status: ServerStatus;
  lastHealthCheck?: Date;
  metadata?: Record<string, any>;
}
```

### 연결 타입

```typescript
interface StdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface HttpConnection {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}
```

### ServerStatus

```typescript
type ServerStatus = 'registered' | 'connecting' | 'connected' | 'error' | 'stopped';
```

## ToolEntry

```typescript
interface ToolEntry {
  name: string;
  description?: string;
  serverId: string;
  inputSchema?: Record<string, any>;
}
```

## BalancerStrategy

```typescript
type BalancerStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';
```

| 전략 | 설명 |
|------|------|
| `round-robin` | 순서대로 번갈아 (기본) |
| `least-connections` | 현재 연결이 가장 적은 서버 |
| `weighted` | 가중치 기반 분배 |
| `random` | 무작위 |

## HealthCheckResult

```typescript
interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}
```

→ [Gateway 가이드](/ko/guide/gateway)
