// @airmcp-dev/core — transport/http-adapter.ts
// Streamable HTTP transport 래퍼

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { TransportConfig } from '../types/transport.js';

export function createHttpTransport(config?: TransportConfig): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
}
