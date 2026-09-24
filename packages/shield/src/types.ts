// @airmcp-dev/shield — types.ts
//
// Shield 전체 타입 정의.

/** 정책 규칙 */
export interface PolicyRule {
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 적용 대상: 도구명, 패턴('*' 와일드카드), 또는 서버 ID */
  target: string;
  /** 허용/차단/범위제한 */
  action: 'allow' | 'deny' | 'scope';
  /** scope일 때 허용 범위 */
  scope?: ScopeConfig;
  /** 우선순위 (높을수록 먼저 평가) */
  priority: number;
  /** 활성화 여부 */
  enabled: boolean;
  /** 조건부 규칙 — 파라미터 기반 조건 (모두 충족해야 적용) */
  condition?: PolicyCondition;
  /** 시간 기반 정책 — 허용 시간대 */
  schedule?: PolicySchedule;
}

/** 조건부 규칙: 파라미터 값에 따라 규칙 적용 여부 결정 */
export interface PolicyCondition {
  /** 파라미터 값이 특정 값과 일치해야 함 */
  paramEquals?: Record<string, any>;
  /** 파라미터 값이 특정 값을 초과하면 적용 */
  paramGreaterThan?: Record<string, number>;
  /** 파라미터 값이 특정 값 미만이면 적용 */
  paramLessThan?: Record<string, number>;
  /** 파라미터에 특정 키가 존재해야 함 */
  paramExists?: string[];
  /** 커스텀 조건 함수 */
  custom?: (params: Record<string, any>) => boolean;
}

/** 시간 기반 정책: 특정 시간대에만 규칙 적용 */
export interface PolicySchedule {
  /** 허용 요일 (0=일, 6=토) — 비어있으면 모든 요일 */
  daysOfWeek?: number[];
  /** 허용 시작 시각 (HH:mm, 24h) */
  startTime?: string;
  /** 허용 종료 시각 (HH:mm, 24h) */
  endTime?: string;
  /** 타임존 (기본: 시스템 타임존) */
  timezone?: string;
}

export interface ScopeConfig {
  /** 허용 파라미터 목록 */
  allowedParams?: string[];
  /** 차단 파라미터 목록 */
  deniedParams?: string[];
  /** 허용 경로/패턴 */
  allowedPaths?: string[];
  /** 최대 응답 크기 (bytes) */
  maxResponseSize?: number;
}

/** 정책 평가 결과 */
export interface PolicyDecision {
  allowed: boolean;
  rule?: PolicyRule;
  reason?: string;
}

/** 위협 탐지 결과 */
export interface ThreatResult {
  detected: boolean;
  threats: ThreatItem[];
  score: number;
}

export interface ThreatItem {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence?: string;
}

export type ThreatType =
  | 'prompt-injection'
  | 'tool-poisoning'
  | 'path-traversal'
  | 'command-injection'
  | 'data-exfiltration'
  | 'resource-abuse'
  | 'rug-pull'
  | 'confused-deputy'
  | 'context-oversharing'
  | 'ssrf'
  | 'sql-injection'
  | 'shadow-mcp'
  | 'unknown';

/** 감사 로그 엔트리 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: 'tool-call' | 'policy-check' | 'threat-detect' | 'rate-limit' | 'sandbox-event';
  toolName?: string;
  serverId?: string;
  clientId?: string;
  decision?: 'allowed' | 'denied' | 'rate-limited';
  details?: Record<string, any>;
}

/** 감사 로그 조회 필터 */
export interface AuditQuery {
  from?: Date;
  to?: Date;
  action?: string;
  toolName?: string;
  decision?: string;
  limit?: number;
}

/** 샌드박스 설정 */
export interface SandboxConfig {
  /** CPU 시간 제한 (ms) */
  cpuLimit?: number;
  /** 메모리 제한 (bytes) */
  memoryLimit?: number;
  /** 네트워크 접근 허용 여부 */
  networkAccess?: boolean;
  /** 파일시스템 접근 허용 경로 */
  allowedPaths?: string[];
  /** 실행 타임아웃 (ms) */
  timeout?: number;
}

/** 레이트 리밋 설정 */
export interface RateLimitConfig {
  /** 대상: 도구명, 서버ID, 클라이언트ID, 또는 '*' */
  target: string;
  /** 윈도우 크기 (ms) */
  windowMs: number;
  /** 윈도우 내 최대 호출 수 */
  maxCalls: number;
  /** 순간 burst 허용 수 — 연속 호출 제한 (기본: maxCalls와 동일) */
  burstLimit?: number;
  /** burst 윈도우 ms (기본: 1000) */
  burstWindowMs?: number;
}

/** 레이트 리밋 체크 결과 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** burst 제한에 걸린 경우 */
  burstLimited?: boolean;
}

// ═══════════════════════════════════════════════════
// OWASP MCP Top 10 관련 타입
// ═══════════════════════════════════════════════════

/** 도구 무결성 스냅샷 (Rug Pull 감지용) */
export interface ToolIntegritySnapshot {
  toolName: string;
  descriptionHash: string;
  paramsHash: string;
  /** annotations 해시 (MCP 2025-03-26+) */
  annotationsHash?: string;
  /** outputSchema 해시 (MCP 2025-06-18+) */
  outputSchemaHash?: string;
  capturedAt: Date;
}

/** Rug Pull 변경 감지 심각도 */
export type RugPullSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Rug Pull 감지 결과 */
export interface RugPullResult {
  detected: boolean;
  changes: Array<{
    toolName: string;
    field: 'description' | 'params' | 'annotations' | 'outputSchema';
    previousHash: string;
    currentHash: string;
    severity: RugPullSeverity;
  }>;
}

/** Confused Deputy 정책 */
export interface DeputyPolicy {
  /** 도구가 호출할 수 있는 다른 도구 목록 (빈 배열 = 격리) */
  allowedCallees: string[];
  /** 접근 가능한 리소스 패턴 */
  allowedResources?: string[];
  /** 접근 가능한 네트워크 대상 */
  allowedHosts?: string[];
}

/** Context Over-sharing 설정 */
export interface OvershareConfig {
  /** 응답 최대 크기 (bytes, 기본: 100KB) */
  maxResponseSize?: number;
  /** 민감 데이터 패턴 (정규식) */
  sensitivePatterns?: string[];
  /** PII 마스킹 활성화 */
  maskPII?: boolean;
}

/** SSRF 방지 설정 */
export interface SSRFConfig {
  /** 허용 호스트 목록 (화이트리스트) */
  allowedHosts?: string[];
  /** 차단 호스트 목록 (블랙리스트) */
  blockedHosts?: string[];
  /** 내부 IP 접근 차단 (기본: true) */
  blockInternalIPs?: boolean;
  /** 차단 포트 */
  blockedPorts?: number[];
  /** DNS resolve로 rebinding 탐지 (기본: true) */
  dnsResolve?: boolean;
}
