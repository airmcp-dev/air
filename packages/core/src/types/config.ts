// @airmcp-dev/core — types/config.ts
// AirConfig: air.config.ts 파일 스키마

import type { TransportConfig } from './transport.js';
import type { AirPluginMeta } from './plugin.js';
import type { StoreOptions } from './storage.js';

/** Shield(보안) 설정 */
export interface ShieldConfig {
  /** 보안 기능 활성화 (기본: false) */
  enabled?: boolean;

  /** 정책 규칙 */
  policies?: Array<{
    name: string;
    target: string;
    action: 'allow' | 'deny';
    priority?: number;
  }>;

  /** 위협 탐지 활성화 (기본: true when shield enabled) */
  threatDetection?: boolean;

  /** 레이트 리밋 설정 */
  rateLimit?: {
    /** 도구별 윈도우 (ms, 기본: 60000) */
    windowMs?: number;
    /** 윈도우 내 최대 호출 수 (기본: 100) */
    maxCalls?: number;
    /** 도구별 개별 설정 */
    perTool?: Record<string, { windowMs?: number; maxCalls: number }>;
  };

  /** 감사 로그 활성화 (기본: true when shield enabled) */
  audit?: boolean;
}

/** Meter(측정) 설정 */
export interface MeterConfig {
  /** 메트릭 수집 활성화 (기본: true) */
  enabled?: boolean;

  /** 7-Layer 분류 활성화 (기본: true) */
  classify?: boolean;

  /** 호출 추적 활성화 (기본: true) */
  trackCalls?: boolean;

  /** 토큰 추적 활성화 (기본: false, 수동 기록 필요) */
  trackTokens?: boolean;

  /** 예산 설정 */
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}

/** 게이트웨이 자기 등록 설정 */
export interface GatewayRegistrationConfig {
  /** 게이트웨이 주소. 하나 또는 여러 개 (피어 전부에 등록) */
  url: string | string[];
  /** 게이트웨이 registration.token과 같은 값 */
  token?: string;
  /** 하트비트 간격 ms (기본: 5000). 게이트웨이의 staleAfterMs보다 짧아야 한다 */
  heartbeatMs?: number;
  /**
   * 게이트웨이가 이 서버를 부를 주소. 기본은 `http://<host>:<port>/mcp`이며,
   * host가 0.0.0.0이면 os.hostname()을 쓴다. 컨테이너/NAT에서는 직접 지정한다.
   */
  advertiseUrl?: string;
  /** 레지스트리 id (기본: 서버 name) */
  id?: string;
  /** weighted 밸런서용 가중치 */
  weight?: number;
}

export interface AirConfig {
  /** 서버 이름 (MCP 등록명) */
  name: string;
  /** 서버 버전 */
  version?: string;
  /** 서버 설명 */
  description?: string;

  /** Transport 설정 (기본: auto-detect) */
  transport?: TransportConfig;

  /**
   * 게이트웨이 자기 등록 (http transport 전용).
   * 서버가 뜨면 게이트웨이의 POST /registry에 자신을 알리고 heartbeatMs마다 하트비트를 보낸다.
   * 게이트웨이가 꺼져 있어도 서버는 정상 기동하며 등록을 계속 재시도한다.
   */
  gateway?: GatewayRegistrationConfig;

  /** SSE 최대 동시 세션 수 (기본: 200, 초과 시 503) */
  maxSseSessions?: number;

  /** SSE 세션 idle timeout ms (기본: 600000 = 10분, 초과 시 자동 종료) */
  sseIdleTimeoutMs?: number;

  /** SSE 하트비트 간격 ms (기본: 30000, 0이면 비활성) */
  sseHeartbeatMs?: number;

  /** SSE 재전송 버퍼 크기 — 최근 N개 메시지 보관 (기본: 100) */
  sseReplayBufferSize?: number;

  /** SSE 재전송 버퍼 TTL ms — 이 시간 지난 메시지 폐기 (기본: 300000 = 5분) */
  sseReplayTtlMs?: number;

  /** 스토리지 설정 (기본: memory) */
  storage?: StoreOptions;

  /** 플러그인 목록 */
  plugins?: AirPluginMeta[];

  /** 개발 모드 */
  dev?: {
    /** 핫리로드 활성화 (기본: true) */
    hotReload?: boolean;
    /** 개발 서버 포트 (HTTP transport 시) */
    port?: number;
  };

  /** 로깅 설정 */
  logging?: {
    /** 로그 레벨 (기본: info) */
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    /** 포맷 (기본: pretty in dev, json in prod) */
    format?: 'json' | 'pretty';
  };

  /** 보안 설정 */
  shield?: ShieldConfig;

  /** 측정 설정 */
  meter?: MeterConfig;

  /** 플러그인 레지스트리 설정 */
  registry?: {
    /** 레지스트리 URL (기본: https://plugins.airmcp.dev/api/v1) */
    url?: string;
    /** API 키 (publish 시 필요) */
    apiKey?: string;
  };

  /** 텔레메트리 설정 (opt-in, 익명 사용 통계) */
  telemetry?: {
    /** 텔레메트리 활성화 (기본: false) */
    enabled?: boolean;
    /** 수집 엔드포인트 */
    endpoint?: string;
  };

  /** @deprecated metrics 대신 meter 사용 */
  metrics?: {
    enabled?: boolean;
    layerClassification?: boolean;
  };
}
