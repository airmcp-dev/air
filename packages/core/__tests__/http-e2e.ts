// air Streamable HTTP 모드 E2E 테스트
// SDK 없이 자체 AirHttpTransport 검증

import { defineServer, defineTool, defineResource, definePrompt } from '../src/index.js';

const PORT = 13581;

const server = defineServer({
  name: 'http-e2e-test',
  version: '1.0.0',
  transport: { type: 'http', port: PORT },
  tools: [
    defineTool('greet', {
      description: 'Greet someone',
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
    defineTool('multiply', {
      params: { a: 'number', b: 'number' },
      handler: async ({ a, b }) => ({ product: a * b }),
    }),
  ],
  resources: [
    defineResource('config://version', {
      name: 'version',
      mimeType: 'text/plain',
      handler: async () => '1.0.0',
    }),
  ],
  prompts: [
    definePrompt('review', {
      description: 'Code review',
      arguments: [{ name: 'code', required: true }],
      handler: ({ code }) => [{ role: 'user', content: `Review: ${code}` }],
    }),
  ],
});

async function runTest() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  air HTTP (Streamable) — E2E 테스트        ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  await server.start();
  await sleep(500);

  try {
    // ── 1. GET /health ──
    console.log('[1/8] GET /health...');
    const health = await (await fetch(`http://localhost:${PORT}/health`)).json() as any;
    assert(health.status === 'ok', 'Health should be ok');
    ok('Health OK');

    // ── 2. server/discover (2026-07-28) ──
    console.log('\n[2/8] server/discover...');
    const discoverRes = await postMcp({ jsonrpc: '2.0', method: 'server/discover', id: 1 });
    assert(discoverRes.result.supportedVersions.includes('2026-07-28'), 'Should support 2026-07-28');
    assert(discoverRes.result.supportedVersions.includes('2025-11-25'), 'Should support 2025-11-25');
    assert(discoverRes.result.resultType === 'complete', 'resultType should be complete');
    assert(discoverRes.result._meta['io.modelcontextprotocol/serverInfo'].name === 'http-e2e-test', 'Server name');
    ok('server/discover OK');

    // ── 3. 레거시 initialize ──
    console.log('\n[3/8] Legacy initialize...');
    const initRes = await postMcp({
      jsonrpc: '2.0', method: 'initialize', id: 2,
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    assert(initRes.result.protocolVersion === '2025-11-25', 'Should negotiate 2025-11-25');
    assert(initRes.result.serverInfo.name === 'http-e2e-test', 'Server name in init');
    ok('Legacy initialize OK');

    // ── 4. tools/list (modern, with _meta) ──
    console.log('\n[4/8] tools/list (modern)...');
    const toolsRes = await postMcp({
      jsonrpc: '2.0', method: 'tools/list', id: 3,
      params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
    }, { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/list' });
    assert(toolsRes.result.resultType === 'complete', 'resultType');
    assert(toolsRes.result.ttlMs > 0, 'ttlMs > 0');
    assert(toolsRes.result.cacheScope === 'public', 'cacheScope');
    assert(toolsRes.result.tools.length === 2, '2 tools');
    assert(toolsRes.result._meta['io.modelcontextprotocol/serverInfo'], 'serverInfo in _meta');
    ok('tools/list (modern) OK');

    // ── 5. tools/call — greet ──
    console.log('\n[5/8] tools/call — greet...');
    const greetRes = await postMcp({
      jsonrpc: '2.0', method: 'tools/call', id: 4,
      params: { name: 'greet', arguments: { name: 'air' } },
    });
    assert(greetRes.result.content[0].text === 'Hello, air!', 'Greet result');
    ok('greet OK');

    // ── 6. tools/call — multiply ──
    console.log('\n[6/8] tools/call — multiply...');
    const mulRes = await postMcp({
      jsonrpc: '2.0', method: 'tools/call', id: 5,
      params: { name: 'multiply', arguments: { a: 6, b: 7 } },
    });
    const mulParsed = JSON.parse(mulRes.result.content[0].text);
    assert(mulParsed.product === 42, 'Multiply result');
    ok('multiply OK');

    // ── 7. resources/read ──
    console.log('\n[7/8] resources/read...');
    const resRead = await postMcp({
      jsonrpc: '2.0', method: 'resources/read', id: 6,
      params: { uri: 'config://version' },
    });
    assert(resRead.result.contents[0].text === '1.0.0', 'Resource content');
    ok('resources/read OK');

    // ── 8. prompts/get ──
    console.log('\n[8/8] prompts/get...');
    const promptRes = await postMcp({
      jsonrpc: '2.0', method: 'prompts/get', id: 7,
      params: { name: 'review', arguments: { code: 'console.log("hi")' } },
    });
    assert(promptRes.result.messages[0].content.text === 'Review: console.log("hi")', 'Prompt content');
    ok('prompts/get OK');

    // ── 9. Mcp-Method 헤더 불일치 검증 ──
    console.log('\n[BONUS] Mcp-Method header mismatch...');
    const mismatchRes = await postMcp(
      { jsonrpc: '2.0', method: 'tools/list', id: 99 },
      { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'prompts/list' },
    );
    assert(mismatchRes.error?.code === -32020, 'Should return HeaderMismatch error');
    ok('Header mismatch detected correctly');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ ALL HTTP E2E TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err: any) {
    console.error(`\n  ❌ FAILED: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await server.stop();
    await sleep(200);
    process.exit(process.exitCode ?? 0);
  }
}

async function postMcp(body: any, extraHeaders?: Record<string, string>): Promise<any> {
  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  return res.json();
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

runTest();
