// @airmcp-dev/core — transport/sse-adapter.ts
// SSE transport 래퍼

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { TransportConfig } from '../types/transport.js';

export function createSseTransport(endpoint: string, response: any): SSEServerTransport {
  return new SSEServerTransport(endpoint, response);
}
