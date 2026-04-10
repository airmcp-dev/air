// @airmcp-dev/gateway — proxy/index.ts
// re-export only.

export { McpProxy } from './mcp-proxy.js';
export { SessionPool } from './session-pool.js';
export type { Session } from './session-pool.js';
export {
  buildToolCallRequest,
  buildListToolsRequest,
  extractResult,
  resolveTransportMethod,
} from './protocol-adapter.js';
