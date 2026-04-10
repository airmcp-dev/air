// @airmcp-dev/meter — types.ts

/** 7-Layer 계층 정의 (Pylon-7 기반) */
export type Layer = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

/** 계층별 정보 */
export interface LayerDef {
  layer: Layer;
  name: string;
  description: string;
  /** 상대적 토큰 비용 (L1=1, L7=100) */
  costWeight: number;
  /** 위험도 (0~1) */
  riskLevel: number;
}

/** 분류 결과 */
export interface ClassificationResult {
  layer: Layer;
  confidence: number;
  reason: string;
}

/** 토큰 사용 기록 */
export interface TokenUsage {
  toolName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

/** 호출 메트릭 */
export interface CallMetric {
  toolName: string;
  serverId?: string;
  layer: Layer;
  latencyMs: number;
  success: boolean;
  timestamp: Date;
  tokenUsage?: TokenUsage;
}

/** 집계 메트릭 */
export interface AggregatedMetrics {
  /** 총 호출 수 */
  totalCalls: number;
  /** 성공률 (0~1) */
  successRate: number;
  /** 평균 지연시간 (ms) */
  avgLatencyMs: number;
  /** 총 토큰 사용량 */
  totalTokens: number;
  /** 총 추정 비용 ($) */
  totalCost: number;
  /** 계층별 호출 분포 */
  layerDistribution: Record<Layer, number>;
  /** 도구별 호출 수 */
  toolCounts: Record<string, number>;
  /** 집계 시작 시각 */
  from: Date;
  /** 집계 종료 시각 */
  to: Date;
}

/** 예산 설정 */
export interface BudgetConfig {
  /** 일일 최대 비용 ($) */
  dailyLimit?: number;
  /** 월간 최대 비용 ($) */
  monthlyLimit?: number;
  /** 호출당 최대 토큰 */
  maxTokensPerCall?: number;
  /** 예산 초과 시 동작 */
  onExceed: 'warn' | 'block';
}

/** 예산 체크 결과 */
export interface BudgetCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  period: 'daily' | 'monthly' | 'per-call';
}
