// my-mcp-server — src/index.ts
//
// air 기반 MCP 서버 기본 템플릿.
// defineServer + defineTool로 즉시 실행 가능한 MCP 서버를 만듭니다.
//
// transport 설정:
//   type: 'stdio'  → Claude Desktop 등에서 직접 실행 (기본값)
//   type: 'sse'    → HTTP SSE 서버로 실행 (리모트 연결)
//   type: 'http'   → Streamable HTTP 서버로 실행
//
// 포트 변경은 아래 port 값을 수정하세요.

import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '0.1.0',
  description: 'air로 만든 첫 번째 MCP 서버',

  // ── Transport 설정 ──
  // 로컬 사용: type을 'stdio'로 (기본값, 아래 주석 해제 불필요)
  // 리모트 사용: type을 'sse'로 변경하고 port를 지정하세요
  // transport: { type: 'sse', port: 3510 },

  tools: [
    defineTool('hello', {
      description: '인사하기',
      params: {
        name: { type: 'string', description: '이름' },
      },
      handler: async ({ name }) => {
        return `안녕하세요, ${name}님!`;
      },
    }),
  ],
});

server.start();
