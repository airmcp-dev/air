// @airmcp-dev/core — transport/stdio-adapter.ts
// STDIO transport 래퍼 — MCP SDK의 StdioServerTransport를 감싸서 라이프사이클 통합

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createStdioTransport(): StdioServerTransport {
  return new StdioServerTransport();
}
