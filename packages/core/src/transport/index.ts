// @airmcp-dev/core — transport/index.ts (re-export only)

export { detectTransport } from './auto-detect.js';
export { createStdioTransport } from './stdio-adapter.js';
export { createHttpTransport } from './http-adapter.js';
export { createSseTransport } from './sse-adapter.js';
export { createWorkersFetchHandler } from './workers-adapter.js';
export type { WorkersTransportConfig } from './workers-adapter.js';
export { AirSSETransport, AirSSESessionManager } from './air-sse-transport.js';
export type { AirSSETransportOptions, AirSSESessionManagerOptions } from './air-sse-transport.js';
