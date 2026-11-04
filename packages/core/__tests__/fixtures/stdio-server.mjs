// stdio transport 테스트용 서버 — 빌드된 dist를 불러와 실제 프로세스로 실행한다.
// (__tests__/stdio-transport.test.ts가 beforeAll에서 dist를 빌드한다)

import { defineServer, defineTool } from '../../dist/index.js';

const server = defineServer({
  name: 'stdio-test',
  version: '1.0.0',
  transport: { type: 'stdio' },
  tools: [
    defineTool('echo', {
      description: 'Echo text',
      params: { text: 'string' },
      handler: async ({ text }) => text,
    }),
  ],
});

server.start();
