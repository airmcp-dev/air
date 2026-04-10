// @airmcp-dev/core — plugin/index.ts (re-export only)

export { PluginManager } from './plugin-manager.js';
export { PluginHookRunner } from './plugin-hook.js';
export { resolvePlugin, validatePlugin } from './plugin-schema.js';

// ── Builtin Plugins (19) ──
// 내부 (자동 등록)
export { builtinLoggerPlugin } from './builtin/logger.js';
export { builtinMetricsPlugin, getMetrics, resetMetrics } from './builtin/metrics.js';

// 안정성
export { timeoutPlugin } from './builtin/timeout.js';
export { retryPlugin } from './builtin/retry.js';
export { circuitBreakerPlugin } from './builtin/circuit-breaker.js';
export { fallbackPlugin } from './builtin/fallback.js';

// 성능
export { cachePlugin } from './builtin/cache.js';
export { dedupPlugin } from './builtin/dedup.js';
export { queuePlugin } from './builtin/queue.js';

// 보안/인증
export { authPlugin } from './builtin/auth.js';
export { sanitizerPlugin } from './builtin/sanitizer.js';
export { validatorPlugin } from './builtin/validator.js';

// 네트워크
export { corsPlugin } from './builtin/cors.js';
export { webhookPlugin } from './builtin/webhook.js';

// 데이터 변환
export { transformPlugin } from './builtin/transform.js';
export { i18nPlugin } from './builtin/i18n.js';

// 모니터링
export { jsonLoggerPlugin } from './builtin/logger-json.js';
export { perUserRateLimitPlugin } from './builtin/ratelimit-per-user.js';

// 개발/테스트
export { dryrunPlugin } from './builtin/dryrun.js';
