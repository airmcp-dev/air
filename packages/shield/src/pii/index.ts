// @airmcp-dev/shield — pii/index.ts
// re-export only.

export { PIIDetector } from './detector.js';
export { PIITokenizer } from './tokenizer.js';
export { PIIDictionary } from './dictionary.js';
export { PIIRedactor } from './redactor.js';
export { BUILTIN_PII_PATTERNS } from './patterns.js';

export type {
  PIIEntityType,
  PIIEntity,
  PIIStrategy,
  PIIStrategyMap,
  TokenMapping,
  TokenizeResult,
  DetokenizeResult,
  DictionaryEntry,
  DictionaryConfig,
  PIIDetectorConfig,
  PIIMode,
  PIIRedactorConfig,
  RedactResult,
} from './types.js';
