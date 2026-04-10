import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
  const transport = new SSEClientTransport(new URL('http://localhost:3510/sse'));
  const client = new Client({ name: 'claude-test', version: '1.0.0' });
  await client.connect(transport);

  // 메모 저장
  const r1 = await client.callTool({
    name: 'memo_save',
    arguments: { title: 'Claude Desktop 연결', content: 'air 프레임워크로 만든 MCP 서버가 실제로 동작합니다!' },
  });
  console.log('save:', (r1.content as any)[0]?.text);

  // 목록 확인
  const r2 = await client.callTool({ name: 'memo_list', arguments: {} });
  console.log('list:', (r2.content as any)[0]?.text);

  await client.close();
  process.exit(0);
}
main();
