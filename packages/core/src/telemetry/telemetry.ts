// @airmcp-dev/core — telemetry/telemetry.ts
//
// 텔레메트리 모듈 — opt-in 익명 사용 통계 수집.
// 개인 정보 일절 수집하지 않음.
//
// 수집 항목:
//   - 서버 시작/중지 이벤트
//   - 등록된 도구/리소스/프롬프트 수
//   - 사용 중인 플러그인 이름 (설정값 X)
//   - transport 타입
//   - Node.js 버전
//   - OS 플랫폼
//   - air 프레임워크 버전
//
// 수집하지 않는 것:
//   - 도구 파라미터, 응답 내용
//   - IP 주소 (서버 사이드에서도 저장 안 함)
//   - 사용자 식별 정보
//   - 서버 이름, 도구 이름 (해시만 전송)

import { platform, release, arch } from 'node:os';
import { createHash } from 'node:crypto';

/** 텔레메트리 설정 */
export interface TelemetryConfig {
  /** 활성화 여부 (기본: false, opt-in) */
  enabled: boolean;
  /** 수집 엔드포인트 (기본: https://telemetry.airmcp.dev/v1/collect) */
  endpoint?: string;
}

/** 텔레메트리 이벤트 */
export interface TelemetryEvent {
  /** 이벤트 타입 */
  event: 'server.start' | 'server.stop';
  /** 익명 서버 ID (서버 이름 SHA-256 해시의 앞 12자) */
  serverId: string;
  /** air 프레임워크 버전 */
  airVersion: string;
  /** 도구 수 */
  toolCount: number;
  /** 리소스 수 */
  resourceCount: number;
  /** 프롬프트 수 */
  promptCount: number;
  /** 활성 플러그인 이름 목록 */
  plugins: string[];
  /** transport 타입 */
  transport: string;
  /** Node.js 버전 */
  nodeVersion: string;
  /** OS */
  os: string;
  /** 아키텍처 */
  arch: string;
  /** 타임스탬프 */
  timestamp: string;
}

const DEFAULT_ENDPOINT = 'https://telemetry.airmcp.dev/v1/collect';

/** 서버 이름을 익명 해시로 변환 */
function anonymize(name: string): string {
  return createHash('sha256').update(name).digest('hex').slice(0, 12);
}

/** 텔레메트리 매니저 */
export class TelemetryManager {
  private config: TelemetryConfig;
  private endpoint: string;

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
    };
    this.endpoint = config?.endpoint ?? DEFAULT_ENDPOINT;
  }

  /** 텔레메트리 이벤트 전송 (비동기, 실패해도 무시) */
  async send(event: TelemetryEvent): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch {
      // 텔레메트리 실패는 무시 — 서버 동작에 영향 없음
    }
  }

  /** 서버 시작 이벤트 생성 */
  createStartEvent(options: {
    serverName: string;
    airVersion: string;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    plugins: string[];
    transport: string;
  }): TelemetryEvent {
    return {
      event: 'server.start',
      serverId: anonymize(options.serverName),
      airVersion: options.airVersion,
      toolCount: options.toolCount,
      resourceCount: options.resourceCount,
      promptCount: options.promptCount,
      plugins: options.plugins,
      transport: options.transport,
      nodeVersion: process.version,
      os: `${platform()}-${release()}`,
      arch: arch(),
      timestamp: new Date().toISOString(),
    };
  }

  /** 서버 중지 이벤트 생성 */
  createStopEvent(serverName: string, airVersion: string): TelemetryEvent {
    return {
      event: 'server.stop',
      serverId: anonymize(serverName),
      airVersion,
      toolCount: 0,
      resourceCount: 0,
      promptCount: 0,
      plugins: [],
      transport: '',
      nodeVersion: process.version,
      os: `${platform()}-${release()}`,
      arch: arch(),
      timestamp: new Date().toISOString(),
    };
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }
}
