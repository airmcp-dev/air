// @airmcp-dev/shield — threat/scorer.ts
//
// 위협 항목들의 종합 위험도를 점수화한다.

import type { ThreatItem } from '../types.js';

const SEVERITY_SCORES: Record<string, number> = {
  low: 10,
  medium: 30,
  high: 60,
  critical: 100,
};

/**
 * 위협 항목들의 종합 점수를 계산한다.
 * 0 = 안전, 100 = 최대 위험.
 * 여러 위협이 있으면 가장 높은 점수 + 추가 항목당 10% 가산.
 */
export function calculateThreatScore(threats: ThreatItem[]): number {
  if (threats.length === 0) return 0;

  const scores = threats.map((t) => SEVERITY_SCORES[t.severity] || 0);
  const maxScore = Math.max(...scores);
  const bonus = (threats.length - 1) * 10;

  return Math.min(100, maxScore + bonus);
}
