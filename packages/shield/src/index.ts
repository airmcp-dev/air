// @airmcp-dev/shield — index.ts
// re-export only. 로직 없음.

// ── Policy ──
export { PolicyEngine } from './policy/index.js';
export { RuleStore, defineRule } from './policy/index.js';
export { evaluate } from './policy/index.js';

// ── Threat ──
export { ThreatDetector } from './threat/index.js';
export { BUILTIN_PATTERNS, calculateThreatScore } from './threat/index.js';

// ── Audit ──
export { AuditLogger } from './audit/index.js';
export { AuditQueryEngine } from './audit/index.js';

// ── Sandbox ──
export { Isolator } from './sandbox/index.js';
export { ScopeLimiter } from './sandbox/index.js';
export { DEFAULT_SANDBOX_CONFIG } from './sandbox/index.js';

// ── Rate Limit ──
export { RateLimiter } from './rate-limit/index.js';

// ── OWASP MCP Top 10 ──
export { RugPullDetector } from './owasp/index.js';
export { DeputyGuard } from './owasp/index.js';
export { ContextOvershareGuard } from './owasp/index.js';
export { SSRFGuard } from './owasp/index.js';
export { SupplyChainVerifier } from './owasp/index.js';

// ── PII ──
export { PIIDetector, PIITokenizer, PIIDictionary, PIIRedactor, BUILTIN_PII_PATTERNS } from './pii/index.js';
export type {
  PIIEntityType, PIIEntity, PIIStrategy, PIIStrategyMap,
  TokenMapping, TokenizeResult, DetokenizeResult,
  DictionaryEntry, DictionaryConfig, PIIDetectorConfig,
  PIIMode, PIIRedactorConfig, RedactResult,
} from './pii/index.js';

// ── License ──
export { LicenseGuard, generateMachineId, requireShieldLicense, getShieldGuard } from './license/index.js';
export type { LicenseKey, LicenseValidation } from './license/index.js';

// ── Types ──
export type {
  PolicyRule, ScopeConfig, PolicyDecision,
  ThreatResult, ThreatItem, ThreatType,
  AuditEntry, AuditQuery,
  SandboxConfig,
  RateLimitConfig, RateLimitResult,
  ToolIntegritySnapshot, RugPullResult, RugPullSeverity,
  DeputyPolicy,
  OvershareConfig,
  SSRFConfig,
} from './types.js';
