// air SSE 실제 통합 테스트
// MCP SDK Client + SSEClientTransport로 실제 연결하여 검증
//
// 1. air defineServer SSE 모드 시작
// 2. MCP SDK 클라이언트로 연결
// 3. initialize → tools/list → tools/call 전체 플로우
// 4. 리소스/프롬프트 등록 + 조회
// 5. 연결 종료

import { defineServer, defineTool, defineResource, definePrompt } from '../src/index.js';

const PORT = 13580;

// ── 서버 정의 ──
const server = defineServer({
  name: 'integration-test',
  version: '1.0.0',
  transport: { type: 'sse', port: PORT },
  tools: [
    defineTool('greet', {
      description: 'Greet someone',
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
    defineTool('multiply', {
      description: 'Multiply two numbers',
      params: { a: 'number', b: 'number' },
      handler: async ({ a, b }) => ({ product: a * b }),
    }),
    defineTool('no_params', {
      description: 'Tool with no parameters',
      handler: async () => 'works without params',
    }),
  ],
  resources: [
    defineResource('config://app/version', {
      name: 'app-version',
      description: 'Application version',
      mimeType: 'text/plain',
      handler: async () => '1.0.0-test',
    }),
  ],
  prompts: [
    definePrompt('code_review', {
      description: 'Review code',
      arguments: [{ name: 'code', required: true }],
      handler: ({ code }) => [
        { role: 'user', content: `Please review this code:\n${code}` },
      ],
    }),
  ],
});

async function runIntegrationTest() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  air SSE — MCP SDK Client 통합 테스트  ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 서버 시작
  console.log('[1/8] 서버 시작...');
  await server.start();
  await sleep(500);
  ok('서버 시작 완료');

  // MCP SDK Client 동적 import
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

  let client: InstanceType<typeof Client> | null = null;

  try {
    // ── 클라이언트 연결 ──
    console.log('\n[2/8] MCP SDK 클라이언트 연결...');
    const transport = new SSEClientTransport(new URL(`http://localhost:${PORT}/sse`));
    client = new Client({ name: 'integration-test-client', version: '1.0.0' });
    await client.connect(transport);
    ok('MCP 클라이언트 연결 성공');

    // ── tools/list ──
    console.log('\n[3/8] tools/list 호출...');
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    console.log(`  도구 ${toolsResult.tools.length}개: ${toolNames.join(', ')}`);
    assert(toolsResult.tools.length === 3, `Expected 3 tools, got ${toolsResult.tools.length}`);
    assert(toolNames.includes('greet'), 'Missing greet tool');
    assert(toolNames.includes('multiply'), 'Missing multiply tool');
    assert(toolNames.includes('no_params'), 'Missing no_params tool');
    ok('tools/list 정상');

    // ── tools/call — 문자열 반환 ──
    console.log('\n[4/8] tools/call — greet...');
    const greetResult = await client.callTool({ name: 'greet', arguments: { name: 'air' } });
    const greetText = (greetResult.content as any[])[0]?.text;
    console.log(`  결과: ${greetText}`);
    assert(greetText === 'Hello, air!', `Expected "Hello, air!", got "${greetText}"`);
    ok('greet 도구 호출 정상');

    // ── tools/call — 객체 반환 ──
    console.log('\n[5/8] tools/call — multiply...');
    const mulResult = await client.callTool({ name: 'multiply', arguments: { a: 7, b: 8 } });
    const mulText = (mulResult.content as any[])[0]?.text;
    const mulParsed = JSON.parse(mulText);
    console.log(`  결과: ${JSON.stringify(mulParsed)}`);
    assert(mulParsed.product === 56, `Expected 56, got ${mulParsed.product}`);
    ok('multiply 도구 호출 정상');

    // ── tools/call — 파라미터 없는 도구 ──
    console.log('\n[6/8] tools/call — no_params...');
    const noParamsResult = await client.callTool({ name: 'no_params', arguments: {} });
    const noParamsText = (noParamsResult.content as any[])[0]?.text;
    console.log(`  결과: ${noParamsText}`);
    assert(noParamsText === 'works without params', `Unexpected: "${noParamsText}"`);
    ok('파라미터 없는 도구 호출 정상');

    // ── resources/list ──
    console.log('\n[7/8] resources/list 호출...');
    const resourcesResult = await client.listResources();
    console.log(`  리소스 ${resourcesResult.resources.length}개`);
    if (resourcesResult.resources.length > 0) {
      console.log(`  첫 번째: ${resourcesResult.resources[0].name} (${resourcesResult.resources[0].uri})`);
    }
    assert(resourcesResult.resources.length >= 1, 'Expected at least 1 resource');
    ok('resources/list 정상');

    // ── prompts/list ──
    console.log('\n[8/8] prompts/list 호출...');
    const promptsResult = await client.listPrompts();
    console.log(`  프롬프트 ${promptsResult.prompts.length}개`);
    if (promptsResult.prompts.length > 0) {
      console.log(`  첫 번째: ${promptsResult.prompts[0].name}`);
    }
    assert(promptsResult.prompts.length >= 1, 'Expected at least 1 prompt');
    ok('prompts/list 정상');

    // ── 완료 ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ ALL INTEGRATION TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err: any) {
    console.error(`\n  ❌ FAILED: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    if (client) await client.close().catch(() => {});
    await server.stop();
    // 잠깐 대기 후 종료 (소켓 정리)
    await sleep(200);
    process.exit(process.exitCode ?? 0);
  }
}

// ── 유틸 ──
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}
function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

runIntegrationTest();
