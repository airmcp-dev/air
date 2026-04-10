// @airmcp-dev/meter — metrics/collector.ts
//
// 메트릭 수집기. CallTracker + TokenTracker의 데이터를 모아서
// 집계 가능한 형태로 관리.

import type { CallMetric, TokenUsage, AggregatedMetrics, Layer } from '../types.js';
import { CallTracker } from '../cost/call-tracker.js';
import { TokenTracker } from '../cost/token-tracker.js';

export class MetricsCollector {
  readonly calls: CallTracker;
  readonly tokens: TokenTracker;

  constructor() {
    this.calls = new CallTracker();
    this.tokens = new TokenTracker();
  }

  /**
   * 도구 호출을 기록한다 (호출 메트릭 + 토큰 사용 동시).
   */
  recordCall(
    toolName: string,
    layer: Layer,
    latencyMs: number,
    success: boolean,
    tokenUsage?: { input: number; output: number; costPerToken?: number },
    serverId?: string,
  ): void {
    this.calls.record(toolName, layer, latencyMs, success, serverId);

    if (tokenUsage) {
      this.tokens.record(
        toolName,
        tokenUsage.input,
        tokenUsage.output,
        tokenUsage.costPerToken || 0,
      );
    }
  }

  /**
   * 현재 시점의 스냅샷을 반환한다.
   */
  snapshot(): {
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCost: number;
    layerDistribution: Record<Layer, number>;
  } {
    return {
      totalCalls: this.calls.totalCalls(),
      successRate: this.calls.successRate(),
      avgLatencyMs: this.calls.avgLatency(),
      totalTokens: this.tokens.totalTokens(),
      totalCost: this.tokens.totalCost(),
      layerDistribution: this.calls.layerDistribution(),
    };
  }
}
