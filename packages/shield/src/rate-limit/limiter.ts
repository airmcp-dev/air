// @airmcp-dev/shield — rate-limit/limiter.ts
//
// 도구별/에이전트별 호출 횟수를 제한한다.
// 슬라이딩 윈도우 방식.

import type { RateLimitConfig, RateLimitResult } from '../types.js';

interface WindowEntry {
  timestamps: number[];
  config: RateLimitConfig;
}

export class RateLimiter {
  private windows = new Map<string, WindowEntry>();

  /**
   * 레이트 리밋 규칙을 추가한다.
   */
  addRule(config: RateLimitConfig): void {
    this.windows.set(config.target, {
      timestamps: [],
      config,
    });
  }

  /**
   * 규칙을 제거한다.
   */
  removeRule(target: string): void {
    this.windows.delete(target);
  }

  /**
   * 호출이 허용되는지 확인하고, 허용되면 카운트를 증가시킨다.
   * burst 제한도 함께 검사한다.
   */
  check(target: string): RateLimitResult {
    const entry = this.windows.get(target) || this.windows.get('*');
    if (!entry) {
      // 규칙 없으면 무제한
      return { allowed: true, remaining: Infinity, resetAt: new Date() };
    }

    const now = Date.now();
    const windowStart = now - entry.config.windowMs;

    // 윈도우 밖의 오래된 타임스탬프 제거
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const remaining = entry.config.maxCalls - entry.timestamps.length;
    const resetAt = new Date(
      entry.timestamps.length > 0
        ? entry.timestamps[0] + entry.config.windowMs
        : now + entry.config.windowMs,
    );

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt };
    }

    // burst 체크 — 짧은 시간 내 연속 호출 제한
    const burstLimit = entry.config.burstLimit ?? entry.config.maxCalls;
    const burstWindowMs = entry.config.burstWindowMs ?? 1000;
    const burstStart = now - burstWindowMs;
    const burstCount = entry.timestamps.filter((t) => t > burstStart).length;

    if (burstCount >= burstLimit) {
      return { allowed: false, remaining, resetAt, burstLimited: true };
    }

    // 카운트 증가
    entry.timestamps.push(now);

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  /**
   * 특정 대상의 현재 사용량을 조회한다.
   */
  usage(target: string): { used: number; max: number; windowMs: number } | null {
    const entry = this.windows.get(target);
    if (!entry) return null;

    const now = Date.now();
    const windowStart = now - entry.config.windowMs;
    const active = entry.timestamps.filter((t) => t > windowStart);

    return {
      used: active.length,
      max: entry.config.maxCalls,
      windowMs: entry.config.windowMs,
    };
  }

  /** 전체 규칙 초기화 */
  reset(): void {
    for (const entry of this.windows.values()) {
      entry.timestamps = [];
    }
  }
}
