// @airmcp-dev/meter — cost/budget.ts
//
// 토큰/비용 예산 관리.
// 일일/월간 한도를 설정하고 초과 시 경고 또는 차단.

import type { BudgetConfig, BudgetCheckResult, TokenUsage } from '../types.js';
import { TokenTracker } from './token-tracker.js';

export class BudgetManager {
  private config: BudgetConfig;
  private tracker: TokenTracker;

  constructor(config: BudgetConfig, tracker: TokenTracker) {
    this.config = config;
    this.tracker = tracker;
  }

  /**
   * 호출 전에 예산 내인지 확인한다.
   * block 모드면 초과 시 차단, warn 모드면 경고만.
   */
  check(estimatedTokens?: number): BudgetCheckResult {
    // 호출당 토큰 제한
    if (this.config.maxTokensPerCall && estimatedTokens) {
      if (estimatedTokens > this.config.maxTokensPerCall) {
        return {
          allowed: this.config.onExceed !== 'block',
          remaining: this.config.maxTokensPerCall - estimatedTokens,
          limit: this.config.maxTokensPerCall,
          period: 'per-call',
        };
      }
    }

    // 일일 한도
    if (this.config.dailyLimit) {
      const todayCost = this.tracker.today().reduce((sum, u) => sum + u.estimatedCost, 0);
      const remaining = this.config.dailyLimit - todayCost;

      if (remaining <= 0) {
        return {
          allowed: this.config.onExceed !== 'block',
          remaining,
          limit: this.config.dailyLimit,
          period: 'daily',
        };
      }
    }

    // 월간 한도
    if (this.config.monthlyLimit) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthCost = this.tracker.since(monthStart).reduce((sum, u) => sum + u.estimatedCost, 0);
      const remaining = this.config.monthlyLimit - monthCost;

      if (remaining <= 0) {
        return {
          allowed: this.config.onExceed !== 'block',
          remaining,
          limit: this.config.monthlyLimit,
          period: 'monthly',
        };
      }
    }

    return {
      allowed: true,
      remaining: Infinity,
      limit: 0,
      period: 'daily',
    };
  }

  /** 설정을 업데이트한다 */
  updateConfig(config: Partial<BudgetConfig>): void {
    Object.assign(this.config, config);
  }

  /** 현재 설정을 반환한다 */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }
}
