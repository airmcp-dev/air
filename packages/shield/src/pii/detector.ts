// @airmcp-dev/shield — pii/detector.ts
//
// PII 탐지 엔진.
// 정규식(patterns) + 사전(dictionary) + 사용자 정의 패턴을 조합하여
// 텍스트에서 PII 엔티티를 탐지한다.

import type { PIIEntity, PIIEntityType, PIIDetectorConfig } from './types.js';
import { BUILTIN_PII_PATTERNS } from './patterns.js';
import type { PIIPattern } from './patterns.js';
import { PIIDictionary } from './dictionary.js';

export class PIIDetector {
  private patterns: PIIPattern[];
  private dictionary: PIIDictionary;
  private enabledTypes: Set<PIIEntityType> | null;
  private minConfidence: number;

  constructor(config?: PIIDetectorConfig) {
    this.minConfidence = config?.minConfidence ?? 0.5;

    // 활성 타입 필터
    this.enabledTypes = config?.enabledTypes
      ? new Set(config.enabledTypes)
      : null; // null = 전부 활성

    // 내장 패턴 + 사용자 정의 패턴
    this.patterns = [...BUILTIN_PII_PATTERNS];
    if (config?.customPatterns) {
      for (const cp of config.customPatterns) {
        this.patterns.push({
          type: cp.type,
          name: `custom-${cp.type}-${this.patterns.length}`,
          regex: cp.pattern,
          confidence: cp.confidence ?? 0.85,
          maskValue: '***CUSTOM***',
        });
      }
    }

    // 사전
    this.dictionary = new PIIDictionary(config?.dictionary);
  }

  /**
   * 텍스트에서 PII 엔티티를 탐지한다.
   *
   * @returns 탐지된 엔티티 목록 (위치순 정렬, 중복 제거)
   */
  detect(text: string): PIIEntity[] {
    const entities: PIIEntity[] = [];

    // ── 1. 정규식 패턴 탐지 ──
    for (const pattern of this.patterns) {
      if (this.enabledTypes && !this.enabledTypes.has(pattern.type)) continue;

      // g 플래그 보장
      const flags = pattern.regex.flags.includes('g')
        ? pattern.regex.flags
        : pattern.regex.flags + 'g';
      const globalRegex = new RegExp(pattern.regex.source, flags);

      let match: RegExpExecArray | null;
      while ((match = globalRegex.exec(text)) !== null) {
        if (pattern.confidence >= this.minConfidence) {
          entities.push({
            type: pattern.type,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: pattern.confidence,
            source: 'regex',
          });
        }
      }
    }

    // ── 2. 사전 기반 탐지 ──
    const dictEntities = this.dictionary.detect(text);
    for (const entity of dictEntities) {
      if (this.enabledTypes && !this.enabledTypes.has(entity.type)) continue;
      if (entity.confidence >= this.minConfidence) {
        entities.push(entity);
      }
    }

    // ── 3. 중복 제거 + 정렬 ──
    return this.dedup(entities);
  }

  /**
   * 사전 접근자 — 런타임에 사전 항목 추가/제거 가능.
   */
  getDictionary(): PIIDictionary {
    return this.dictionary;
  }

  /**
   * 특정 패턴의 마스킹 값을 반환한다.
   */
  getMaskValue(type: PIIEntityType): string {
    const pattern = this.patterns.find((p) => p.type === type);
    return pattern?.maskValue ?? '***REDACTED***';
  }

  /**
   * 엔티티 중복 제거.
   * 같은 위치에 여러 패턴이 매칭되면 신뢰도 높은 쪽, 길이 긴 쪽 우선.
   */
  private dedup(entities: PIIEntity[]): PIIEntity[] {
    // 시작 위치 → 신뢰도 → 길이 순 정렬
    entities.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return (b.end - b.start) - (a.end - a.start);
    });

    const result: PIIEntity[] = [];
    let lastEnd = -1;

    for (const entity of entities) {
      // 이전 엔티티와 겹치면 스킵 (더 높은 우선순위가 이미 포함됨)
      if (entity.start < lastEnd) continue;
      result.push(entity);
      lastEnd = entity.end;
    }

    return result;
  }
}
