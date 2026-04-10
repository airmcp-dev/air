// @airmcp-dev/meter — metrics/aggregator.ts
//
// 시간별 메트릭 집계.
// 분/시간/일 단위로 집계하여 추세 분석 가능.

import type { AggregatedMetrics, Layer } from '../types.js';
import { MetricsCollector } from './collector.js';

export class MetricsAggregator {
  private collector: MetricsCollector;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * 지정 기간의 집계 메트릭을 반환한다.
   */
  aggregate(from: Date, to: Date = new Date()): AggregatedMetrics {
    const calls = this.collector.calls.since(from);
    const tokens = this.collector.tokens.since(from);

    const totalCalls = calls.length;
    const successCount = calls.filter((c) => c.success).length;
    const avgLatency = totalCalls > 0 ? calls.reduce((s, c) => s + c.latencyMs, 0) / totalCalls : 0;

    const layerDist = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0 } as Record<Layer, number>;
    for (const c of calls) {
      layerDist[c.layer]++;
    }

    const toolCounts: Record<string, number> = {};
    for (const c of calls) {
      toolCounts[c.toolName] = (toolCounts[c.toolName] || 0) + 1;
    }

    return {
      totalCalls,
      successRate: totalCalls > 0 ? successCount / totalCalls : 1,
      avgLatencyMs: avgLatency,
      totalTokens: tokens.reduce((s, t) => s + t.totalTokens, 0),
      totalCost: tokens.reduce((s, t) => s + t.estimatedCost, 0),
      layerDistribution: layerDist,
      toolCounts,
      from,
      to,
    };
  }

  /** 최근 1시간 집계 */
  lastHour(): AggregatedMetrics {
    return this.aggregate(new Date(Date.now() - 3600_000));
  }

  /** 오늘 집계 */
  today(): AggregatedMetrics {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.aggregate(start);
  }
}
