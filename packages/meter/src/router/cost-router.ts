// @airmcp-dev/meter — router/cost-router.ts
//
// 최소 비용 경로 라우팅.
// 같은 도구를 여러 서버가 제공할 때, 계층(L1~L7) 기반으로
// 가장 비용 효율적인 서버를 선택한다.
// Pylon-7의 핵심: "최소 비용으로 목적 달성."

import type { Layer } from '../types.js';
import { LAYER_DEFINITIONS } from '../classifier/layer-defs.js';

export interface CostCandidate {
  serverId: string;
  toolName: string;
  layer: Layer;
  /** 최근 평균 지연시간 (ms) */
  avgLatencyMs?: number;
  /** 최근 성공률 (0~1) */
  successRate?: number;
}

export interface CostRouteResult {
  selected: CostCandidate;
  reason: string;
  score: number;
}

/**
 * 후보들 중 최소 비용 경로를 선택한다.
 *
 * 점수 = costWeight × (1 / successRate) × latencyFactor
 * → 낮을수록 좋음
 */
export function selectCheapest(candidates: CostCandidate[]): CostRouteResult {
  if (candidates.length === 0) {
    throw new Error('No candidates for cost routing');
  }

  if (candidates.length === 1) {
    return {
      selected: candidates[0],
      reason: 'Only one candidate',
      score: 0,
    };
  }

  const scored = candidates.map((c) => {
    const layerDef = LAYER_DEFINITIONS[c.layer];
    const costWeight = layerDef.costWeight;
    const successFactor = 1 / (c.successRate ?? 1);
    const latencyFactor = 1 + (c.avgLatencyMs ?? 0) / 10_000; // 10초 기준 정규화

    const score = costWeight * successFactor * latencyFactor;

    return { candidate: c, score };
  });

  // 점수 오름차순 정렬 (낮을수록 좋음)
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];

  return {
    selected: best.candidate,
    reason: `Cheapest path: ${best.candidate.layer} (score: ${best.score.toFixed(2)})`,
    score: best.score,
  };
}
