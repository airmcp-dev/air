// @airmcp-dev/core — transport/index.ts (re-export only)

export { detectTransport } from './auto-detect.js';
export { createStdioTransport } from './stdio-adapter.js';
export { createHttpTransport } from './http-adapter.js';
export { createSseTransport } from './sse-adapter.js';
