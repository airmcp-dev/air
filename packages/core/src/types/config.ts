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

export interface AirConfig {
  /** 서버 이름 (MCP 등록명) */
  name: string;
  /** 서버 버전 */
  version?: string;
  /** 서버 설명 */
  description?: string;

  /** Transport 설정 (기본: auto-detect) */
  transport?: TransportConfig;

  /** SSE 최대 동시 세션 수 (기본: 200, 초과 시 503) */
  maxSseSessions?: number;

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
