// @airmcp-dev/core — transport/index.ts (re-export only)

export { detectTransport } from './auto-detect.js';
export { createWorkersFetchHandler } from './workers-adapter.js';
export type { WorkersTransportConfig } from './workers-adapter.js';
export { AirSSETransport, AirSSESessionManager } from './air-sse-transport.js';
export type { AirSSETransportOptions, AirSSESessionManagerOptions } from './air-sse-transport.js';

// Protocol-native transports (SDK-free)
export { AirStdioTransport } from '../protocol/stdio-transport.js';
export { AirHttpTransport } from '../protocol/http-transport.js';
export type { AirHttpTransportOptions } from '../protocol/http-transport.js';
