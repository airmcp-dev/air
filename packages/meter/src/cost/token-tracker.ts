// @airmcp-dev/meter — cost/token-tracker.ts
//
// 도구 호출별 토큰 사용량을 추적한다.

import type { TokenUsage } from '../types.js';

export class TokenTracker {
  private history: TokenUsage[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 10_000) {
    this.maxHistory = maxHistory;
  }

  /** 토큰 사용을 기록한다 */
  record(toolName: string, input: number, output: number, costPerToken: number = 0): TokenUsage {
    const usage: TokenUsage = {
      toolName,
      inputTokens: input,
      outputTokens: output,
      totalTokens: input + output,
      estimatedCost: (input + output) * costPerToken,
      timestamp: new Date(),
    };

    this.history.push(usage);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    return usage;
  }

  /** 총 토큰 사용량 */
  totalTokens(): number {
    return this.history.reduce((sum, u) => sum + u.totalTokens, 0);
  }

  /** 총 추정 비용 */
  totalCost(): number {
    return this.history.reduce((sum, u) => sum + u.estimatedCost, 0);
  }

  /** 도구별 토큰 사용량 */
  byTool(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const u of this.history) {
      result[u.toolName] = (result[u.toolName] || 0) + u.totalTokens;
    }
    return result;
  }

  /** 기간별 필터 */
  since(date: Date): TokenUsage[] {
    return this.history.filter((u) => u.timestamp >= date);
  }

  /** 오늘 사용량 */
  today(): TokenUsage[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.since(start);
  }
}
