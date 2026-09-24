// @airmcp-dev/shield — policy/engine.ts
//
// 정책 엔진. RuleStore + Evaluator를 조합하여
// 도구 호출에 대한 allow/deny/scope 결정을 내린다.

import type { PolicyRule, PolicyDecision, PolicyCondition, PolicySchedule } from '../types.js';
import { RuleStore, defineRule } from './rules.js';
import { evaluate } from './evaluator.js';

export class PolicyEngine {
  private store = new RuleStore();

  /** 규칙을 추가한다 */
  addRule(rule: PolicyRule): void {
    this.store.add(rule);
  }

  /** 간편 규칙 생성 + 추가 */
  allow(name: string, target: string, priority?: number): PolicyRule {
    const rule = defineRule(name, target, 'allow', { priority });
    this.store.add(rule);
    return rule;
  }

  deny(name: string, target: string, priority?: number): PolicyRule {
    const rule = defineRule(name, target, 'deny', { priority });
    this.store.add(rule);
    return rule;
  }

  /** 조건부 deny — 파라미터 조건이 충족될 때만 차단 */
  denyIf(name: string, target: string, condition: PolicyCondition, priority?: number): PolicyRule {
    const rule = defineRule(name, target, 'deny', { priority });
    rule.condition = condition;
    this.store.add(rule);
    return rule;
  }

  /** 시간 기반 deny — 특정 시간대에만 차단 */
  denyDuring(name: string, target: string, schedule: PolicySchedule, priority?: number): PolicyRule {
    const rule = defineRule(name, target, 'deny', { priority });
    rule.schedule = schedule;
    this.store.add(rule);
    return rule;
  }

  /** 시간 기반 allow — 특정 시간대에만 허용 (나머지는 기본 정책 따름) */
  allowDuring(name: string, target: string, schedule: PolicySchedule, priority?: number): PolicyRule {
    const rule = defineRule(name, target, 'allow', { priority });
    rule.schedule = schedule;
    this.store.add(rule);
    return rule;
  }

  /** 도구 호출을 평가한다 */
  check(toolName: string, params?: Record<string, any>): PolicyDecision {
    const rules = this.store.findByTarget(toolName);
    return evaluate(rules, toolName, params);
  }

  /** 규칙을 제거한다 */
  removeRule(id: string): boolean {
    return this.store.remove(id);
  }

  /** 전체 규칙 목록 */
  listRules(): PolicyRule[] {
    return this.store.listAll();
  }
}
