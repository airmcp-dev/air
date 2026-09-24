// @airmcp-dev/shield — pii/redactor.ts
//
// PII Redactor — 통합 인터페이스.
//
// 모드:
//   strict  — 모든 활성 타입 마스킹/토큰화
//   report  — 인프라 정보(IP, DB, API_KEY, SECRET, SERVER_PORT)만 마스킹,
//             고객사·사람 이름은 통과 (리포트·보고서 작성용)
//   off     — 패스스루 (탐지만 하고 치환 안 함)
//
// 사용법:
//   const redactor = new PIIRedactor({ mode: 'strict', ... });
//   const { text, mappings } = redactor.redact(inputText);
//   // ... LLM에 text 전송 ...
//   const restored = redactor.restore(llmResponse, mappings);

import type {
  PIIMode,
  PIIRedactorConfig,
  PIIStrategyMap,
  PIIEntityType,
  RedactResult,
  DetokenizeResult,
  TokenMapping,
  DictionaryEntry,
} from './types.js';
import { PIIDetector } from './detector.js';
import { PIITokenizer } from './tokenizer.js';

/** report 모드에서 마스킹할 인프라 타입 */
const INFRA_TYPES: Set<PIIEntityType> = new Set([
  'IP', 'CIDR', 'MAC', 'INTERNAL_DOMAIN', 'DB_CONN',
  'API_KEY', 'SECRET', 'PRIVATE_KEY', 'ENV_SECRET',
  'GIT_CREDENTIAL', 'SERVER_PORT', 'HOST',
]);

export class PIIRedactor {
  private mode: PIIMode;
  private detector: PIIDetector;
  private tokenizer: PIITokenizer;

  constructor(config?: PIIRedactorConfig) {
    this.mode = config?.mode ?? 'strict';

    this.detector = new PIIDetector(config?.detector);

    // 모드에 따라 전략 오버라이드
    const strategies = this.buildStrategies(this.mode, config?.strategies);
    this.tokenizer = new PIITokenizer(this.detector, strategies);
  }

  /**
   * 텍스트에서 PII를 탐지하고 모드에 따라 처리한다.
   */
  redact(text: string): RedactResult {
    // off 모드: 탐지만 하고 원본 반환
    if (this.mode === 'off') {
      const entities = this.detector.detect(text);
      return {
        text,
        mappings: [],
        entities,
        mode: this.mode,
      };
    }

    const entities = this.detector.detect(text);
    const { text: redactedText, mappings } = this.tokenizer.tokenize(text);

    return {
      text: redactedText,
      mappings,
      entities,
      mode: this.mode,
    };
  }

  /**
   * 토큰화된 텍스트를 원본으로 복원한다.
   */
  restore(text: string, mappings?: TokenMapping[]): DetokenizeResult {
    return this.tokenizer.detokenize(text, mappings);
  }

  /**
   * 운영 모드를 변경한다.
   * 모드 변경 시 토큰화 전략이 재구성된다.
   */
  setMode(mode: PIIMode): void {
    this.mode = mode;
    const strategies = this.buildStrategies(mode);
    // 새 tokenizer 생성 (기존 매핑은 유지하기 위해 리셋하지 않음)
    this.tokenizer = new PIITokenizer(this.detector, strategies);
  }

  /**
   * 현재 모드를 반환한다.
   */
  getMode(): PIIMode {
    return this.mode;
  }

  /**
   * 사전에 항목을 추가한다.
   */
  addDictionaryEntry(entry: DictionaryEntry): void {
    this.detector.getDictionary().add(entry);
  }

  /**
   * 사전에서 항목을 제거한다.
   */
  removeDictionaryEntry(value: string): boolean {
    return this.detector.getDictionary().remove(value);
  }

  /**
   * 사전 항목 목록을 반환한다.
   */
  listDictionary(): DictionaryEntry[] {
    return this.detector.getDictionary().list();
  }

  /**
   * 현재 세션의 전체 매핑 테이블을 반환한다.
   */
  getMappings(): TokenMapping[] {
    return this.tokenizer.getMappings();
  }

  /**
   * 세션 초기화 (매핑 테이블·카운터 리셋).
   */
  resetSession(): void {
    this.tokenizer.reset();
  }

  /**
   * 모드에 따른 전략 맵 구성.
   */
  private buildStrategies(
    mode: PIIMode,
    overrides?: PIIStrategyMap,
  ): PIIStrategyMap {
    if (mode === 'off') {
      // 전부 skip
      return {
        COMPANY: 'skip', PERSON: 'skip', PHONE: 'skip',
        IP: 'skip', HOST: 'skip', DB_CONN: 'skip',
        API_KEY: 'skip', SECRET: 'skip', SERVER_PORT: 'skip',
        CUSTOM: 'skip',
        ...overrides,
      };
    }

    if (mode === 'report') {
      // 인프라만 tokenize, 나머지 skip
      const strategies: PIIStrategyMap = {};
      const allTypes: PIIEntityType[] = [
        'COMPANY', 'PERSON', 'PHONE', 'IP', 'CIDR', 'MAC',
        'HOST', 'INTERNAL_DOMAIN', 'DB_CONN', 'API_KEY', 'SECRET',
        'PRIVATE_KEY', 'ENV_SECRET', 'GIT_CREDENTIAL', 'SERVER_PORT', 'CUSTOM',
      ];
      for (const type of allTypes) {
        strategies[type] = INFRA_TYPES.has(type) ? 'tokenize' : 'skip';
      }
      // 민감 시크릿 류는 report에서도 비가역 마스킹
      strategies['API_KEY'] = 'mask';
      strategies['SECRET'] = 'mask';
      strategies['PRIVATE_KEY'] = 'mask';
      strategies['ENV_SECRET'] = 'mask';
      strategies['GIT_CREDENTIAL'] = 'mask';
      return { ...strategies, ...overrides };
    }

    // strict — 기본 전략 (tokenizer 내부 기본값 사용)
    return { ...overrides };
  }
}
