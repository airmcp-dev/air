// @airmcp-dev/meter — metrics/exporter.ts
//
// 메트릭을 외부 형식으로 내보낸다.
// Prometheus 텍스트 포맷 + JSON.

import type { AggregatedMetrics, Layer } from '../types.js';

const LAYERS: Layer[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export class MetricsExporter {
  /**
   * JSON 형식으로 내보낸다.
   */
  toJSON(metrics: AggregatedMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Prometheus 텍스트 형식으로 내보낸다.
   * Prometheus의 /metrics 엔드포인트에서 사용.
   */
  toPrometheus(metrics: AggregatedMetrics): string {
    const lines: string[] = [];

    // 총 호출 수
    lines.push('# HELP air_tool_calls_total Total number of tool calls');
    lines.push('# TYPE air_tool_calls_total counter');
    lines.push(`air_tool_calls_total ${metrics.totalCalls}`);

    // 성공률
    lines.push('# HELP air_tool_success_rate Tool call success rate');
    lines.push('# TYPE air_tool_success_rate gauge');
    lines.push(`air_tool_success_rate ${metrics.successRate.toFixed(4)}`);

    // 평균 지연시간
    lines.push('# HELP air_tool_latency_avg_ms Average tool call latency in ms');
    lines.push('# TYPE air_tool_latency_avg_ms gauge');
    lines.push(`air_tool_latency_avg_ms ${metrics.avgLatencyMs.toFixed(2)}`);

    // 총 토큰
    lines.push('# HELP air_tokens_total Total tokens consumed');
    lines.push('# TYPE air_tokens_total counter');
    lines.push(`air_tokens_total ${metrics.totalTokens}`);

    // 총 비용
    lines.push('# HELP air_cost_total Total estimated cost in USD');
    lines.push('# TYPE air_cost_total counter');
    lines.push(`air_cost_total ${metrics.totalCost.toFixed(6)}`);

    // 계층별 분포
    lines.push('# HELP air_layer_calls Tool calls by layer');
    lines.push('# TYPE air_layer_calls gauge');
    for (const layer of LAYERS) {
      lines.push(`air_layer_calls{layer="${layer}"} ${metrics.layerDistribution[layer] || 0}`);
    }

    // 도구별 호출 수
    lines.push('# HELP air_tool_calls Tool calls by tool name');
    lines.push('# TYPE air_tool_calls gauge');
    for (const [tool, count] of Object.entries(metrics.toolCounts)) {
      lines.push(`air_tool_calls{tool="${tool}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}
