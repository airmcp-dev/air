// @airmcp-dev/shield — threat/detector.ts
//
// 도구 호출 파라미터에서 위협을 탐지한다.
// 내장 패턴 + 사용자 정의 패턴을 모두 검사.

import type { ThreatResult, ThreatItem } from '../types.js';
import { BUILTIN_PATTERNS, type ThreatPattern } from './patterns.js';
import { calculateThreatScore } from './scorer.js';

/** 유니코드 혼동 문자를 ASCII로 정규화 (호모글리프 우회 방지) */
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i',
  '\u0458': 'j', '\u04BB': 'h', '\u0455': 's', '\u0442': 't',
  '\u043C': 'm', '\u043D': 'n', '\u043A': 'k', '\u0432': 'v',
  '\u0431': 'b', '\u0434': 'd', '\u0433': 'r', '\u0437': 'z',
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\uFF41': 'a', '\uFF42': 'b', '\uFF43': 'c', '\uFF44': 'd',
  '\uFF45': 'e', '\uFF46': 'f', '\uFF47': 'g', '\uFF48': 'h',
  '\uFF49': 'i', '\uFF4A': 'j', '\uFF4B': 'k', '\uFF4C': 'l',
  '\uFF4D': 'm', '\uFF4E': 'n', '\uFF4F': 'o', '\uFF50': 'p',
  '\uFF51': 'q', '\uFF52': 'r', '\uFF53': 's', '\uFF54': 't',
  '\uFF55': 'u', '\uFF56': 'v', '\uFF57': 'w', '\uFF58': 'x',
  '\uFF59': 'y', '\uFF5A': 'z',
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
};

function normalizeText(text: string): string {
  // 1. 호모글리프 치환
  let normalized = '';
  for (const char of text) {
    normalized += HOMOGLYPH_MAP[char] ?? char;
  }
  // 2. 연속 공백/제로폭 문자 정규화
  normalized = normalized.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  // 3. URL 인코딩 디코드
  try { normalized = decodeURIComponent(normalized); } catch { /* invalid encoding, keep as-is */ }
  return normalized;
}

export class ThreatDetector {
  private patterns: ThreatPattern[];

  constructor(customPatterns?: ThreatPattern[]) {
    this.patterns = [...BUILTIN_PATTERNS, ...(customPatterns || [])];
  }

  /**
   * 파라미터 값들을 검사하여 위협을 탐지한다.
   * 유니코드 호모글리프/URL 인코딩 우회를 정규화 후 검사.
   */
  scan(params: Record<string, any>): ThreatResult {
    const threats: ThreatItem[] = [];

    // 모든 파라미터 값을 문자열로 펼쳐서 검사
    const values = this.flattenValues(params);

    for (const rawValue of values) {
      // 원본 + 정규화 버전 둘 다 검사
      const normalized = normalizeText(rawValue);
      const targets = rawValue === normalized ? [rawValue] : [rawValue, normalized];

      for (const value of targets) {
        for (const pattern of this.patterns) {
          if (pattern.pattern.test(value)) {
            // 중복 방지 — 같은 type+evidence 조합은 스킵
            const evidence = value.slice(0, 200);
            const isDuplicate = threats.some(
              t => t.type === pattern.type && t.evidence === evidence,
            );
            if (!isDuplicate) {
              threats.push({
                type: pattern.type,
                severity: pattern.severity,
                description: pattern.description,
                evidence,
              });
            }
          }
          // 정규식 lastIndex 리셋 (global flag 대응)
          pattern.pattern.lastIndex = 0;
        }
      }
    }

    return {
      detected: threats.length > 0,
      threats,
      score: calculateThreatScore(threats),
    };
  }

  /** 패턴을 추가한다 */
  addPattern(pattern: ThreatPattern): void {
    this.patterns.push(pattern);
  }

  /** 재귀적으로 모든 문자열 값을 추출한다 */
  private flattenValues(obj: any): string[] {
    const result: string[] = [];

    if (typeof obj === 'string') {
      result.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        result.push(...this.flattenValues(item));
      }
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        result.push(...this.flattenValues(value));
      }
    }

    return result;
  }
}
