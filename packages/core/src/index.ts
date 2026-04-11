// @airmcp-dev/core — index.ts
// 공개 API (re-export only)
//
// 사용자가 import하는 모든 것은 이 파일을 통해 접근한다.
// 로직 없음. import/export만.

// ── 서버 ──
export { defineServer } from './server/index.js';
export { onShutdown } from './server/index.js';

// ── 도구 ──
export { defineTool } from './tool/index.js';
export { paramsToZodSchema, paramsToJsonSchema } from './tool/index.js';
export { normalizeResult } from './tool/index.js';

// ── 리소스 ──
export { defineResource } from './resource/index.js';
export { extractTemplateVars, matchTemplate } from './resource/index.js';

// ── 프롬프트 ──
export { definePrompt } from './prompt/index.js';

// ── 미들웨어 ──
export { MiddlewareChain } from './middleware/index.js';
export { validationMiddleware } from './middleware/index.js';
export { loggingMiddleware } from './middleware/index.js';
export { errorBoundaryMiddleware } from './middleware/index.js';
export { AirError, McpErrors } from './middleware/index.js';
export { createShieldMiddleware, getAuditLog, clearAuditLog } from './middleware/index.js';
export type { ShieldMiddleware, AuditEntry } from './middleware/index.js';
export { createMeterMiddleware, getMetricsSnapshot, resetMetricsHistory } from './middleware/index.js';

// ── 설정 ──
export { loadConfig } from './config/index.js';
export { DEFAULT_CONFIG } from './config/index.js';

// ── Transport ──
export { detectTransport } from './transport/index.js';

// ── 컨텍스트 ──
export { createRequestContext } from './context/index.js';
export { ServerContext } from './context/index.js';

// ── 스토리지 ──
export { createStorage } from './storage/index.js';
export { MemoryStore } from './storage/index.js';
export { FileStore } from './storage/index.js';

// ── 플러그인 (19개) ──
export { PluginManager } from './plugin/index.js';
export { builtinLoggerPlugin } from './plugin/index.js';
export { builtinMetricsPlugin, getMetrics, resetMetrics } from './plugin/index.js';
export { timeoutPlugin } from './plugin/index.js';
export { retryPlugin } from './plugin/index.js';
export { circuitBreakerPlugin } from './plugin/index.js';
export { fallbackPlugin } from './plugin/index.js';
export { cachePlugin } from './plugin/index.js';
export { dedupPlugin } from './plugin/index.js';
export { queuePlugin } from './plugin/index.js';
export { authPlugin } from './plugin/index.js';
export { sanitizerPlugin } from './plugin/index.js';
export { validatorPlugin } from './plugin/index.js';
export { corsPlugin } from './plugin/index.js';
export { webhookPlugin } from './plugin/index.js';
export { transformPlugin } from './plugin/index.js';
export { i18nPlugin } from './plugin/index.js';
export { jsonLoggerPlugin } from './plugin/index.js';
export { perUserRateLimitPlugin } from './plugin/index.js';
export { dryrunPlugin } from './plugin/index.js';

// ── 텔레메트리 ──
export { TelemetryManager } from './telemetry/index.js';
export type { TelemetryConfig, TelemetryEvent } from './telemetry/index.js';

// ── 타입 ──
export type {
  AirConfig,
  ShieldConfig,
  MeterConfig,
  TransportType,
  TransportConfig,
  ParamShorthand,
  AirToolParams,
  AirToolHandler,
  AirToolContext,
  AirToolResponse,
  AirToolDef,
  AirResourceDef,
  AirResourceContext,
  AirResourceContent,
  AirPromptDef,
  AirPromptArg,
  AirPromptMessage,
  MiddlewareContext,
  MiddlewareResult,
  BeforeMiddleware,
  AfterMiddleware,
  ErrorMiddleware,
  AirMiddleware,
  StorageAdapter,
  QueryOptions,
  StoreOptions,
  AirPluginMeta,
  PluginHooks,
  PluginContext,
  AirPlugin,
  AirPluginFactory,
  AirPluginManifest,
  PluginCategory,
  PluginRegistryEntry,
  PluginRegistryConfig,
  DEFAULT_REGISTRY_URL,
  AirServerOptions,
  AirServer,
  AirServerStatus,
} from './types/index.js';
