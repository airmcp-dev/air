// @airmcp-dev/gateway — types.ts
//
// Gateway 전체 타입 정의.
// proxy, registry, router에서 공통으로 사용.

/** MCP 서버 등록 정보 */
export interface ServerEntry {
  /** 고유 식별자 */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 서버 transport 타입 */
  transport: 'stdio' | 'http' | 'sse';
  /** stdio: command + args, http/sse: url */
  connection: StdioConnection | HttpConnection;
  /** 서버가 제공하는 도구 목록 (발견 후 채워짐) */
  tools: ToolEntry[];
  /** 서버 상태 */
  status: ServerStatus;
  /** 마지막 헬스체크 시각 */
  lastHealthCheck?: Date;
  /** 서버 메타데이터 */
  metadata?: Record<string, any>;
}

export interface StdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface HttpConnection {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

export type ServerConnection = StdioConnection | HttpConnection;

export type ServerStatus = 'registered' | 'connecting' | 'connected' | 'error' | 'stopped';

/** 도구 인덱스 엔트리 */
export interface ToolEntry {
  /** 도구 이름 */
  name: string;
  /** 도구 설명 */
  description?: string;
  /** 이 도구를 제공하는 서버 ID */
  serverId: string;
  /** 입력 스키마 (JSON Schema) */
  inputSchema?: Record<string, any>;
}

/** 라우팅 요청 */
export interface RouteRequest {
  /** 호출할 도구 이름 */
  toolName: string;
  /** 도구 파라미터 */
  params: Record<string, any>;
  /** 요청 메타데이터 */
  meta?: {
    clientId?: string;
    sessionId?: string;
    priority?: number;
  };
}

/** 라우팅 결과 */
export interface RouteResult {
  /** 라우팅된 서버 */
  server: ServerEntry;
  /** 도구 정보 */
  tool: ToolEntry;
}

/** 헬스체크 결과 */
export interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}

/** 로드밸런서 전략 */
export type BalancerStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';

/** Gateway 설정 */
export interface GatewayConfig {
  /** 게이트웨이 이름 */
  name?: string;
  /** HTTP 리스닝 포트 */
  port?: number;
  /** 헬스체크 주기 (ms) */
  healthCheckInterval?: number;
  /** 로드밸런서 전략 */
  balancer?: BalancerStrategy;
  /** 요청 타임아웃 (ms) */
  requestTimeout?: number;
}
