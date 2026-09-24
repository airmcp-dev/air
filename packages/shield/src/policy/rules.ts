// @airmcp-dev/shield — policy/rules.ts
//
// 정책 규칙을 정의하고 관리한다.

import type { PolicyRule, ScopeConfig } from '../types.js';

/** 규칙을 간편하게 생성하는 헬퍼 */
export function defineRule(
  name: string,
  target: string,
  action: 'allow' | 'deny' | 'scope',
  opts?: { priority?: number; scope?: ScopeConfig },
): PolicyRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    target,
    action,
    scope: opts?.scope,
    priority: opts?.priority ?? 0,
    enabled: true,
  };
}

/** 규칙 저장소 */
export class RuleStore {
  private rules = new Map<string, PolicyRule>();

  add(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  remove(id: string): boolean {
    return this.rules.delete(id);
  }

  get(id: string): PolicyRule | undefined {
    return this.rules.get(id);
  }

  /** 우선순위 내림차순으로 전체 규칙 반환 */
  listAll(): PolicyRule[] {
    return Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /** 대상에 매칭되는 규칙만 반환 */
  findByTarget(target: string): PolicyRule[] {
    return this.listAll().filter((r) => {
      if (r.target === '*') return true;
      if (r.target === target) return true;
      // 와일드카드 패턴 (예: 'db-*')
      if (r.target.endsWith('*') && target.startsWith(r.target.slice(0, -1))) return true;
      return false;
    });
  }
}
