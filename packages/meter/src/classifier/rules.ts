// @airmcp-dev/meter — classifier/rules.ts
//
// 도구 호출을 7계층으로 분류하는 규칙.
// 도구명, 파라미터 패턴, 메타데이터 기반 휴리스틱.

import type { Layer } from '../types.js';

export interface ClassificationRule {
  /** 매칭 조건 */
  match: (toolName: string, params?: Record<string, any>) => boolean;
  /** 분류 결과 */
  layer: Layer;
  /** 신뢰도 (0~1) */
  confidence: number;
  /** 이유 */
  reason: string;
}

/** 내장 분류 규칙 */
export const BUILTIN_RULES: ClassificationRule[] = [
  // L1: 캐시/상수 반환
  {
    match: (name) => /^(ping|health|version|echo)$/i.test(name),
    layer: 'L1',
    confidence: 0.95,
    reason: 'Static response tool',
  },

  // L2: 단순 조회
  {
    match: (name) => /^(get|read|find|lookup|list|show|fetch_local)$/i.test(name),
    layer: 'L2',
    confidence: 0.8,
    reason: 'Simple data lookup',
  },

  // L3: 변환
  {
    match: (name) => /^(convert|transform|format|parse|encode|decode)$/i.test(name),
    layer: 'L3',
    confidence: 0.8,
    reason: 'Data transformation',
  },

  // L4: 연산
  {
    match: (name) => /^(compute|calculate|aggregate|analyze|summarize|count)$/i.test(name),
    layer: 'L4',
    confidence: 0.75,
    reason: 'Computation/analysis',
  },

  // L5: 외부 API
  {
    match: (name, params) => {
      if (/^(fetch|request|call_api|webhook|http|post|put|delete)$/i.test(name)) return true;
      // URL 파라미터가 있으면 외부 호출로 판단
      if (params) {
        const vals = Object.values(params).map(String);
        return vals.some((v) => /^https?:\/\//.test(v));
      }
      return false;
    },
    layer: 'L5',
    confidence: 0.85,
    reason: 'External API call',
  },

  // L6: LLM 추론
  {
    match: (name) => /^(generate|complete|chat|embed|infer|predict|classify_ai)$/i.test(name),
    layer: 'L6',
    confidence: 0.9,
    reason: 'LLM inference',
  },

  // L7: 에이전트
  {
    match: (name) => /^(agent|think|plan|execute|reason|chain|orchestrate)$/i.test(name),
    layer: 'L7',
    confidence: 0.85,
    reason: 'Multi-step agent operation',
  },
];
