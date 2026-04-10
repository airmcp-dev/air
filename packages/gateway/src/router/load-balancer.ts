// @airmcp-dev/gateway — router/load-balancer.ts
//
// 여러 후보 중 하나를 선택하는 로드밸런서.
// 전략: round-robin (기본), random, weighted.

import type { ToolEntry, BalancerStrategy } from '../types.js';

export class LoadBalancer {
  private counter = 0;
  private weights = new Map<string, number>();

  constructor(private strategy: BalancerStrategy = 'round-robin') {}

  /**
   * 후보 중 하나를 선택한다.
   */
  select(candidates: ToolEntry[]): ToolEntry {
    if (candidates.length === 0) {
      throw new Error('No candidates to balance.');
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(candidates);
      case 'random':
        return this.random(candidates);
      case 'weighted':
        return this.weighted(candidates);
      case 'least-connections':
        // least-connections는 세션 수 추적이 필요 → 향후 구현
        // fallback to round-robin
        return this.roundRobin(candidates);
      default:
        return this.roundRobin(candidates);
    }
  }

  /**
   * 서버별 가중치를 설정한다 (weighted 전략용).
   */
  setWeight(serverId: string, weight: number): void {
    this.weights.set(serverId, Math.max(0, weight));
  }

  /**
   * 전략을 변경한다.
   */
  setStrategy(strategy: BalancerStrategy): void {
    this.strategy = strategy;
    this.counter = 0;
  }

  private roundRobin(candidates: ToolEntry[]): ToolEntry {
    const idx = this.counter % candidates.length;
    this.counter++;
    return candidates[idx];
  }

  private random(candidates: ToolEntry[]): ToolEntry {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  private weighted(candidates: ToolEntry[]): ToolEntry {
    // 가중치 없는 서버는 기본 1
    const entries = candidates.map((c) => ({
      tool: c,
      weight: this.weights.get(c.serverId) ?? 1,
    }));

    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) return this.roundRobin(candidates);

    let random = Math.random() * totalWeight;
    for (const entry of entries) {
      random -= entry.weight;
      if (random <= 0) return entry.tool;
    }

    return entries[entries.length - 1].tool;
  }
}
