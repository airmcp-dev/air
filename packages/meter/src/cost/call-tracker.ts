// @airmcp-dev/meter — cost/call-tracker.ts
//
// 도구 호출 횟수와 지연시간을 추적한다.

import type { CallMetric, Layer } from '../types.js';

export class CallTracker {
  private metrics: CallMetric[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 10_000) {
    this.maxHistory = maxHistory;
  }

  /** 호출 메트릭을 기록한다 */
  record(
    toolName: string,
    layer: Layer,
    latencyMs: number,
    success: boolean,
    serverId?: string,
  ): CallMetric {
    const metric: CallMetric = {
      toolName,
      serverId,
      layer,
      latencyMs,
      success,
      timestamp: new Date(),
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxHistory) {
      this.metrics = this.metrics.slice(-this.maxHistory);
    }

    return metric;
  }

  /** 총 호출 수 */
  totalCalls(): number {
    return this.metrics.length;
  }

  /** 성공률 (0~1) */
  successRate(): number {
    if (this.metrics.length === 0) return 1;
    const success = this.metrics.filter((m) => m.success).length;
    return success / this.metrics.length;
  }

  /** 평균 지연시간 (ms) */
  avgLatency(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((s, m) => s + m.latencyMs, 0);
    return sum / this.metrics.length;
  }

  /** 계층별 호출 분포 */
  layerDistribution(): Record<Layer, number> {
    const dist = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0 } as Record<Layer, number>;
    for (const m of this.metrics) {
      dist[m.layer]++;
    }
    return dist;
  }

  /** 도구별 호출 수 */
  toolCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.metrics) {
      counts[m.toolName] = (counts[m.toolName] || 0) + 1;
    }
    return counts;
  }

  /** 기간별 필터 */
  since(date: Date): CallMetric[] {
    return this.metrics.filter((m) => m.timestamp >= date);
  }

  /** 전체 기록 */
  getAll(): readonly CallMetric[] {
    return this.metrics;
  }
}
