// @airmcp-dev/shield — pii/types.ts
//
// PII(개인식별정보) 탐지·토큰화 관련 타입 정의.

// ═══════════════════════════════════════════════════
// Entity
// ═══════════════════════════════════════════════════

/** PII 엔티티 카테고리 */
export type PIIEntityType =
  | 'COMPANY'          // 고객사·회사명     (사전 기반)
  | 'PERSON'           // 사람 이름         (사전 기반)
  | 'PHONE'            // 전화번호          (정규식)
  | 'IP'               // IPv4/IPv6         (정규식)
  | 'CIDR'             // CIDR 네트워크 대역 (정규식)
  | 'MAC'              // MAC 주소          (정규식)
  | 'HOST'             // 호스트명·도메인    (사전 + 정규식)
  | 'INTERNAL_DOMAIN'  // 내부 도메인        (정규식)
  | 'DB_CONN'          // DB 접속 문자열     (정규식)
  | 'API_KEY'          // API 키·토큰        (정규식)
  | 'SECRET'           // 비밀번호·시크릿    (정규식)
  | 'PRIVATE_KEY'      // SSH·PEM 개인키     (정규식)
  | 'ENV_SECRET'       // 환경변수 시크릿    (정규식)
  | 'GIT_CREDENTIAL'   // Git credential URL (정규식)
  | 'SERVER_PORT'      // host:port          (정규식)
  | 'CUSTOM';          // 사용자 정의

/** 탐지된 PII 엔티티 하나 */
export interface PIIEntity {
  /** 엔티티 타입 */
  type: PIIEntityType;
  /** 원본 값 */
  value: string;
  /** 텍스트 내 시작 위치 */
  start: number;
  /** 텍스트 내 끝 위치 (exclusive) */
  end: number;
  /** 탐지 신뢰도 (0~1, 사전=1.0, 정규식=0.9 등) */
  confidence: number;
  /** 탐지 방법 */
  source: 'regex' | 'dictionary' | 'custom';
}

// ═══════════════════════════════════════════════════
// Strategy
// ═══════════════════════════════════════════════════

/** 엔티티별 처리 전략 */
export type PIIStrategy = 'tokenize' | 'mask' | 'skip';

/** 엔티티 타입별 전략 설정 */
export type PIIStrategyMap = Partial<Record<PIIEntityType, PIIStrategy>>;

// ═══════════════════════════════════════════════════
// Tokenizer
// ═══════════════════════════════════════════════════

/** 토큰-원본 매핑 항목 */
export interface TokenMapping {
  /** 토큰 (예: {{COMPANY_1}}) */
  token: string;
  /** 원본 값 */
  original: string;
  /** 엔티티 타입 */
  type: PIIEntityType;
}

/** 토큰화 결과 */
export interface TokenizeResult {
  /** 토큰화된 텍스트 */
  text: string;
  /** 매핑 테이블 */
  mappings: TokenMapping[];
  /** 탐지된 엔티티 수 */
  entityCount: number;
}

/** 복원 결과 */
export interface DetokenizeResult {
  /** 복원된 텍스트 */
  text: string;
  /** 복원된 토큰 수 */
  restoredCount: number;
  /** 복원 실패한 토큰 (매핑 없음) */
  unresolvedTokens: string[];
}

// ═══════════════════════════════════════════════════
// Dictionary
// ═══════════════════════════════════════════════════

/** 사전 항목 */
export interface DictionaryEntry {
  /** 원본 값 */
  value: string;
  /** 엔티티 타입 */
  type: PIIEntityType;
  /** 대소문자 무시 여부 (기본: true) */
  ignoreCase?: boolean;
  /** 별칭 목록 (예: 삼성전자 → ['삼성', 'Samsung']) */
  aliases?: string[];
}

/** 사전 설정 */
export interface DictionaryConfig {
  /** 사전 항목 목록 */
  entries: DictionaryEntry[];
}

// ═══════════════════════════════════════════════════
// Detector Config
// ═══════════════════════════════════════════════════

/** PII 탐지기 설정 */
export interface PIIDetectorConfig {
  /** 활성화할 엔티티 타입 (기본: 전부) */
  enabledTypes?: PIIEntityType[];
  /** 사전 설정 */
  dictionary?: DictionaryConfig;
  /** 사용자 정의 정규식 패턴 */
  customPatterns?: Array<{
    type: PIIEntityType;
    pattern: RegExp;
    confidence?: number;
  }>;
  /** 최소 신뢰도 임계값 (기본: 0.5) */
  minConfidence?: number;
}

// ═══════════════════════════════════════════════════
// Redactor (통합 인터페이스)
// ═══════════════════════════════════════════════════

/** 운영 모드 */
export type PIIMode = 'strict' | 'report' | 'off';

/** PIIRedactor 설정 */
export interface PIIRedactorConfig {
  /** 운영 모드 (기본: 'strict') */
  mode?: PIIMode;
  /** 엔티티별 전략 */
  strategies?: PIIStrategyMap;
  /** 탐지기 설정 */
  detector?: PIIDetectorConfig;
}

/** Redactor 처리 결과 */
export interface RedactResult {
  /** 처리된 텍스트 */
  text: string;
  /** 토큰 매핑 (tokenize 전략인 항목만) */
  mappings: TokenMapping[];
  /** 탐지된 전체 엔티티 */
  entities: PIIEntity[];
  /** 적용된 모드 */
  mode: PIIMode;
}
