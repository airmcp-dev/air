// my-mcp-server — src/index.ts
//
// MCP server template built with air.
// defineServer + defineTool creates a ready-to-run MCP server.
//
// Transport options:
//   type: 'stdio'  → Direct execution by Claude Desktop, etc. (default)
//   type: 'sse'    → HTTP SSE server for remote connections
//   type: 'http'   → Streamable HTTP server
//
// Change the port below if needed.

import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '0.1.0',
  description: 'My first MCP server built with air',

  // ── Transport ──
  // Local: use 'stdio' (default, no config needed)
  // Remote: change to 'sse' and set a port
  // transport: { type: 'sse', port: 3510 },

  tools: [
    defineTool('hello', {
      description: 'Say hello',
      params: {
        name: { type: 'string', description: 'Your name' },
      },
      handler: async ({ name }) => {
        return `Hello, ${name}!`;
      },
    }),
  ],
});

server.start();
