// @airmcp-dev/shield — policy/evaluator.ts
//
// 규칙을 평가하여 허용/차단 결정을 내린다.
// 조건부 규칙(condition)과 시간 기반 정책(schedule)을 지원한다.

import type { PolicyRule, PolicyDecision, PolicyCondition, PolicySchedule } from '../types.js';

/** 조건이 충족되는지 검사 */
function matchesCondition(condition: PolicyCondition, params: Record<string, any>): boolean {
  // paramEquals
  if (condition.paramEquals) {
    for (const [key, value] of Object.entries(condition.paramEquals)) {
      if (params[key] !== value) return false;
    }
  }

  // paramGreaterThan
  if (condition.paramGreaterThan) {
    for (const [key, threshold] of Object.entries(condition.paramGreaterThan)) {
      if (typeof params[key] !== 'number' || params[key] <= threshold) return false;
    }
  }

  // paramLessThan
  if (condition.paramLessThan) {
    for (const [key, threshold] of Object.entries(condition.paramLessThan)) {
      if (typeof params[key] !== 'number' || params[key] >= threshold) return false;
    }
  }

  // paramExists
  if (condition.paramExists) {
    for (const key of condition.paramExists) {
      if (!(key in params)) return false;
    }
  }

  // custom
  if (condition.custom) {
    if (!condition.custom(params)) return false;
  }

  return true;
}

/** 현재 시간이 스케줄 내인지 검사 */
function matchesSchedule(schedule: PolicySchedule): boolean {
  const now = new Date();

  // 요일 체크
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    if (!schedule.daysOfWeek.includes(now.getDay())) return false;
  }

  // 시간대 체크
  if (schedule.startTime || schedule.endTime) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (schedule.startTime) {
      const [h, m] = schedule.startTime.split(':').map(Number);
      if (currentMinutes < h * 60 + m) return false;
    }

    if (schedule.endTime) {
      const [h, m] = schedule.endTime.split(':').map(Number);
      if (currentMinutes > h * 60 + m) return false;
    }
  }

  return true;
}

/**
 * 매칭된 규칙 목록에서 최종 결정을 내린다.
 * 우선순위가 높은 규칙이 먼저 평가됨 (이미 정렬된 상태 가정).
 * deny가 allow보다 우선.
 */
export function evaluate(
  rules: PolicyRule[],
  toolName: string,
  params?: Record<string, any>,
): PolicyDecision {
  if (rules.length === 0) {
    // 규칙이 없으면 기본 허용
    return { allowed: true, reason: 'No matching rules — default allow' };
  }

  for (const rule of rules) {
    // 조건부 규칙 체크 — 조건 불충족이면 이 규칙 스킵
    if (rule.condition && params) {
      if (!matchesCondition(rule.condition, params)) continue;
    }

    // 시간 기반 정책 체크 — 스케줄 밖이면 이 규칙 스킵
    if (rule.schedule) {
      if (!matchesSchedule(rule.schedule)) continue;
    }

    if (rule.action === 'deny') {
      return { allowed: false, rule, reason: `Denied by rule "${rule.name}"` };
    }

    if (rule.action === 'scope' && rule.scope && params) {
      // scope 규칙: 파라미터 제한 체크
      if (rule.scope.deniedParams) {
        for (const denied of rule.scope.deniedParams) {
          if (denied in params) {
            return {
              allowed: false,
              rule,
              reason: `Parameter "${denied}" denied by scope rule "${rule.name}"`,
            };
          }
        }
      }

      if (rule.scope.allowedParams) {
        for (const key of Object.keys(params)) {
          if (!rule.scope.allowedParams.includes(key)) {
            return {
              allowed: false,
              rule,
              reason: `Parameter "${key}" not in allowed list of rule "${rule.name}"`,
            };
          }
        }
      }
    }

    if (rule.action === 'allow') {
      return { allowed: true, rule, reason: `Allowed by rule "${rule.name}"` };
    }
  }

  // 모든 규칙 통과 → 허용
  return { allowed: true, reason: 'All rules passed' };
}
