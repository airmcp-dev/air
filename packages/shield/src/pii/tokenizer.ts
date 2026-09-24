// @airmcp-dev/shield — pii/tokenizer.ts
//
// 가역적 PII 토큰화·복원 엔진.
//
// 탐지된 엔티티를 {{TYPE_N}} 형태의 토큰으로 치환하고,
// 매핑 테이블을 로컬에 보관하여 나중에 원본을 복원한다.
//
// 흐름:
//   tokenize("삼성전자 서버 192.168.1.1에서 장애")
//     → text: "{{COMPANY_1}} 서버 {{IP_1}}에서 장애"
//     → mappings: [{token:"{{COMPANY_1}}", original:"삼성전자", type:"COMPANY"}, ...]
//
//   detokenize("{{COMPANY_1}} 서버 {{IP_1}}의 장애 보고서...", mappings)
//     → text: "삼성전자 서버 192.168.1.1의 장애 보고서..."

import type {
  PIIEntity,
  PIIEntityType,
  PIIStrategy,
  PIIStrategyMap,
  TokenMapping,
  TokenizeResult,
  DetokenizeResult,
} from './types.js';
import { PIIDetector } from './detector.js';

/** 기본 전략: 모든 타입 tokenize, 시크릿 류는 비가역 mask */
const DEFAULT_STRATEGIES: PIIStrategyMap = {
  COMPANY:         'tokenize',
  PERSON:          'tokenize',
  PHONE:           'tokenize',
  IP:              'tokenize',
  CIDR:            'tokenize',
  MAC:             'tokenize',
  HOST:            'tokenize',
  INTERNAL_DOMAIN: 'tokenize',
  DB_CONN:         'tokenize',
  API_KEY:         'mask',      // API 키는 기본 비가역 마스킹
  SECRET:          'mask',      // 시크릿도 비가역
  PRIVATE_KEY:     'mask',      // 개인키 비가역
  ENV_SECRET:      'mask',      // 환경변수 시크릿 비가역
  GIT_CREDENTIAL:  'mask',      // Git credential 비가역
  SERVER_PORT:     'tokenize',
  CUSTOM:          'tokenize',
};

export class PIITokenizer {
  private detector: PIIDetector;
  private strategies: PIIStrategyMap;
  /** 타입별 카운터 — 세션 내 고유 토큰 번호 부여 */
  private counters: Map<PIIEntityType, number> = new Map();
  /** 값→토큰 캐시 — 같은 값은 같은 토큰으로 치환 */
  private valueToToken: Map<string, string> = new Map();
  /** 전체 매핑 테이블 */
  private allMappings: TokenMapping[] = [];

  constructor(detector: PIIDetector, strategies?: PIIStrategyMap) {
    this.detector = detector;
    this.strategies = { ...DEFAULT_STRATEGIES, ...strategies };
  }

  /**
   * 텍스트에서 PII를 탐지하여 토큰으로 치환한다.
   *
   * 같은 원본 값은 같은 토큰으로 일관되게 치환된다.
   * (예: "삼성전자"가 두 번 나오면 둘 다 {{COMPANY_1}})
   */
  tokenize(text: string): TokenizeResult {
    const entities = this.detector.detect(text);
    const mappings: TokenMapping[] = [];

    if (entities.length === 0) {
      return { text, mappings: [], entityCount: 0 };
    }

    // 뒤에서부터 치환해야 인덱스가 밀리지 않음
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    let result = text;

    for (const entity of sorted) {
      const strategy = this.getStrategy(entity.type);

      if (strategy === 'skip') continue;

      if (strategy === 'mask') {
        // 비가역 마스킹
        const maskValue = this.detector.getMaskValue(entity.type);
        result = result.slice(0, entity.start) + maskValue + result.slice(entity.end);
        continue;
      }

      // tokenize (가역)
      const token = this.getOrCreateToken(entity);
      result = result.slice(0, entity.start) + token + result.slice(entity.end);

      const mapping: TokenMapping = {
        token,
        original: entity.value,
        type: entity.type,
      };
      mappings.push(mapping);

      // 전체 매핑 테이블에 추가 (중복 방지)
      if (!this.allMappings.some((m) => m.token === token)) {
        this.allMappings.push(mapping);
      }
    }

    return {
      text: result,
      mappings,
      entityCount: entities.length,
    };
  }

  /**
   * 토큰화된 텍스트를 원본으로 복원한다.
   *
   * @param text - 토큰이 포함된 텍스트
   * @param mappings - 매핑 테이블 (생략 시 내부 전체 매핑 사용)
   */
  detokenize(text: string, mappings?: TokenMapping[]): DetokenizeResult {
    const map = mappings || this.allMappings;
    let result = text;
    let restoredCount = 0;
    const unresolvedTokens: string[] = [];

    // 텍스트에서 {{TYPE_N}} 패턴 찾기
    const tokenPattern = /\{\{([A-Z_]+)_(\d+)\}\}/g;
    const foundTokens = [...text.matchAll(tokenPattern)].map((m) => m[0]);
    const uniqueTokens = [...new Set(foundTokens)];

    for (const token of uniqueTokens) {
      const mapping = map.find((m) => m.token === token);
      if (mapping) {
        // 모든 등장을 복원
        result = result.split(token).join(mapping.original);
        restoredCount++;
      } else {
        unresolvedTokens.push(token);
      }
    }

    return { text: result, restoredCount, unresolvedTokens };
  }

  /**
   * 현재 세션의 전체 매핑 테이블을 반환한다.
   */
  getMappings(): TokenMapping[] {
    return [...this.allMappings];
  }

  /**
   * 세션 초기화 — 카운터, 캐시, 매핑 테이블 모두 리셋.
   */
  reset(): void {
    this.counters.clear();
    this.valueToToken.clear();
    this.allMappings = [];
  }

  /**
   * 같은 값은 같은 토큰을 반환, 새 값이면 카운터 증가.
   */
  private getOrCreateToken(entity: PIIEntity): string {
    const cacheKey = `${entity.type}:${entity.value}`;
    const existing = this.valueToToken.get(cacheKey);
    if (existing) return existing;

    const count = (this.counters.get(entity.type) || 0) + 1;
    this.counters.set(entity.type, count);

    const token = `{{${entity.type}_${count}}}`;
    this.valueToToken.set(cacheKey, token);
    return token;
  }

  /**
   * 엔티티 타입의 전략을 반환한다.
   */
  private getStrategy(type: PIIEntityType): PIIStrategy {
    return this.strategies[type] ?? 'tokenize';
  }
}
