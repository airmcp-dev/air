// air 통합 테스트 — SSE 클라이언트로 memo-server 호출
// MCP SDK의 SSEClientTransport를 사용

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function test() {
  console.log('\n  🧪 MCP SSE 클라이언트 연결 테스트\n');

  // ── 1. SSE 연결 ──
  const transport = new SSEClientTransport(new URL('http://localhost:3510/sse'));
  const client = new Client({ name: 'air-test-client', version: '1.0.0' });

  await client.connect(transport);
  console.log('  ✔ 연결 성공\n');

  // ── 2. 도구 목록 조회 ──
  const tools = await client.listTools();
  console.log(`  📋 도구 ${tools.tools.length}개:`);
  for (const tool of tools.tools) {
    console.log(`    - ${tool.name}: ${tool.description}`);
  }
  console.log();

  // ── 3. memo_save 호출 ──
  console.log('  ── memo_save 호출 ──\n');
  const saveResult = await client.callTool({
    name: 'memo_save',
    arguments: { title: '테스트', content: 'air MCP 프로토콜 연결 성공!' },
  });
  console.log('  결과:', (saveResult.content as any)[0]?.text);

  // ── 4. memo_save 두 번째 ──
  const saveResult2 = await client.callTool({
    name: 'memo_save',
    arguments: { title: '할일', content: '문서 작성하기' },
  });
  console.log('  결과:', (saveResult2.content as any)[0]?.text);

  // ── 5. memo_list 호출 ──
  console.log('\n  ── memo_list 호출 ──\n');
  const listResult = await client.callTool({
    name: 'memo_list',
    arguments: {},
  });
  console.log('  결과:', (listResult.content as any)[0]?.text);

  // ── 6. memo_delete 호출 ──
  console.log('\n  ── memo_delete 호출 ──\n');
  const delResult = await client.callTool({
    name: 'memo_delete',
    arguments: { title: '할일' },
  });
  console.log('  결과:', (delResult.content as any)[0]?.text);

  // ── 7. 삭제 후 목록 확인 ──
  const listResult2 = await client.callTool({
    name: 'memo_list',
    arguments: {},
  });
  console.log('  결과:', (listResult2.content as any)[0]?.text);

  console.log('\n  ✅ 모든 MCP 프로토콜 호출 성공!\n');

  await client.close();
  process.exit(0);
}

test().catch((err) => {
  console.error('  ❌ 테스트 실패:', err.message);
  process.exit(1);
});
