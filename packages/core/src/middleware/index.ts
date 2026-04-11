// @airmcp-dev/core — middleware/index.ts (re-export only)

export { MiddlewareChain } from './chain.js';
export { validationMiddleware } from './before-hook.js';
export { loggingMiddleware } from './after-hook.js';
export { errorBoundaryMiddleware, AirError, McpErrors } from './error-handler.js';
export { createShieldMiddleware, getAuditLog, clearAuditLog } from './shield-middleware.js';
export type { ShieldMiddleware, AuditEntry } from './shield-middleware.js';
export { createMeterMiddleware, getMetricsSnapshot, resetMetricsHistory } from './meter-middleware.js';
