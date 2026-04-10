// @airmcp-dev/meter — classifier/layer-classifier.ts
//
// 도구 호출을 L1~L7로 자동 분류하는 엔진.
// 내장 규칙 + 사용자 정의 규칙 평가.

import type { Layer, ClassificationResult } from '../types.js';
import { BUILTIN_RULES, type ClassificationRule } from './rules.js';

export class LayerClassifier {
  private rules: ClassificationRule[];

  constructor(customRules?: ClassificationRule[]) {
    // 사용자 규칙이 내장 규칙보다 우선
    this.rules = [...(customRules || []), ...BUILTIN_RULES];
  }

  /**
   * 도구 호출을 분류한다.
   * 첫 번째 매칭 규칙의 결과를 반환.
   * 매칭 없으면 L4(중간) 기본값.
   */
  classify(toolName: string, params?: Record<string, any>): ClassificationResult {
    for (const rule of this.rules) {
      if (rule.match(toolName, params)) {
        return {
          layer: rule.layer,
          confidence: rule.confidence,
          reason: rule.reason,
        };
      }
    }

    // 기본값: L4 (중간)
    return {
      layer: 'L4',
      confidence: 0.3,
      reason: 'No matching rule — default to L4',
    };
  }

  /** 규칙을 추가한다 (최우선) */
  addRule(rule: ClassificationRule): void {
    this.rules.unshift(rule);
  }
}
