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

### GatewayOptions

```typescript
interface GatewayOptions {
  name?: string;                  // 기본: 'air-gateway'
  port?: number;                  // 기본: 4000 (0 = 임의 포트)
  host?: string;                  // 기본: '127.0.0.1'
  endpoint?: string;              // 기본: '/mcp'
  allowedOrigins?: string[];      // 추가 허용 브라우저 Origin. '*'는 전부
  healthCheckInterval?: number;   // ms, 기본: 15000
  balancer?: BalancerStrategy;    // 기본: 'round-robin'
  requestTimeout?: number;        // upstream 호출당 ms, 기본: 30000
  discoverOnStart?: boolean;      // 기본: true
  secret?: string;                // elicitation id 서명 키. 게이트웨이를 여러 대 띄우면 같은 값으로
  registration?: { token?: string; staleAfterMs?: number; enabled?: boolean };  // 백엔드 자기 등록 (/registry)
}
```

### 메서드

```typescript
class Gateway {
  register(entry: { id: string; name: string; connection: HttpConnection; weight?: number }): ServerEntry;
  unregister(id: string): void;
  discover(id?: string): Promise<void>;      // 백엔드의 도구/리소스/프롬프트 (재)발견
  start(): Promise<void>;                    // discover → 헬스체크 → 리슨
  stop(): Promise<void>;
  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;  // 기존 http 서버에 끼우기
  status(): { name; servers; tools; pendingRequests; health };
  readonly port: number;                     // 실제 리슨 포트
  readonly registry: ServerRegistry;
  readonly toolIndex: ToolIndex;
  readonly router: RequestRouter;
  readonly balancer: LoadBalancer;
  readonly healthChecker: HealthChecker;
}
```

`connection.type === 'http'`(Streamable HTTP) 백엔드만 받습니다.

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
