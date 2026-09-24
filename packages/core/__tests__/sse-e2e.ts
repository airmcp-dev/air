// air SSE 모드 E2E 테스트
// defineServer로 SSE 서버 실행 → MCP 클라이언트로 연결 → 도구 호출까지 검증

import { defineServer, defineTool } from '../src/index.js';

const PORT = 13579;

// ── 1. 서버 정의 ──
const server = defineServer({
  name: 'sse-e2e-test',
  version: '0.1.0',
  transport: { type: 'sse', port: PORT },
  tools: [
    defineTool('echo', {
      description: 'Echo back the input',
      params: { message: 'string' },
      handler: async ({ message }) => `echo: ${message}`,
    }),
    defineTool('add', {
      description: 'Add two numbers',
      params: { a: 'number', b: 'number' },
      handler: async ({ a, b }) => ({ result: a + b }),
    }),
    defineTool('ping', {
      description: 'Health check',
      handler: async () => 'pong',
    }),
  ],
});

async function runTest() {
  console.log('[E2E] Starting SSE server...');
  await server.start();

  // 잠깐 대기 — 서버 바인딩 완료
  await new Promise(r => setTimeout(r, 500));

  try {
    // ── 2. 상태 확인 ──
    console.log('\n[E2E] Testing GET / (status)...');
    const statusRes = await fetch(`http://localhost:${PORT}/`);
    const status = await statusRes.json() as Record<string, any>;
    console.log('  Status:', JSON.stringify(status));
    assert(status.name === 'sse-e2e-test', 'Server name should match');
    assert(status.toolCount === 3, 'Should have 3 tools');
    console.log('  ✅ Status OK');

    // ── 3. 헬스체크 ──
    console.log('\n[E2E] Testing GET /health...');
    const healthRes = await fetch(`http://localhost:${PORT}/health`);
    const health = await healthRes.json() as Record<string, any>;
    console.log('  Health:', JSON.stringify(health));
    assert(health.status === 'ok', 'Health should be ok');
    console.log('  ✅ Health OK');

    // ── 4. SSE 연결 ──
    console.log('\n[E2E] Connecting SSE...');
    const sseController = new AbortController();
    const sseRes = await fetch(`http://localhost:${PORT}/sse`, {
      signal: sseController.signal,
    });
    assert(sseRes.status === 200, 'SSE should return 200');
    assert(sseRes.headers.get('content-type')?.includes('text/event-stream'), 'Should be SSE content type');

    // endpoint 이벤트 읽기
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId = '';

    // 첫 이벤트(endpoint) 읽기
    while (!sessionId) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/sessionId=([a-f0-9-]+)/);
      if (match) sessionId = match[1];
    }

    assert(sessionId, 'Should receive sessionId from endpoint event');
    console.log(`  SessionId: ${sessionId}`);
    console.log('  ✅ SSE Connected');

    // ── 5. MCP Initialize ──
    console.log('\n[E2E] Sending initialize...');
    const initMsg = {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    };

    let postRes = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initMsg),
    });
    assert(postRes.status === 202, 'Initialize POST should return 202');

    // SSE에서 응답 읽기
    let initResponse = await readNextSSEMessage(reader, decoder, buffer);
    buffer = initResponse.remaining;
    console.log('  Init response:', JSON.stringify(initResponse.message));
    assert(initResponse.message?.result?.serverInfo?.name === 'sse-e2e-test', 'Server name in init response');
    console.log('  ✅ Initialize OK');

    // ── 6. notifications/initialized ──
    console.log('\n[E2E] Sending initialized notification...');
    postRes = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
    assert(postRes.status === 202, 'Initialized notification should return 202');
    console.log('  ✅ Initialized notification sent');

    // ── 7. tools/list ──
    console.log('\n[E2E] Sending tools/list...');
    postRes = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2,
      }),
    });
    assert(postRes.status === 202, 'tools/list should return 202');

    const toolsResponse = await readNextSSEMessage(reader, decoder, buffer);
    buffer = toolsResponse.remaining;
    const tools = toolsResponse.message?.result?.tools;
    console.log(`  Tools (${tools?.length}):`, tools?.map((t: any) => t.name).join(', '));
    assert(tools?.length === 3, 'Should have 3 tools');
    assert(tools.some((t: any) => t.name === 'echo'), 'Should have echo tool');
    assert(tools.some((t: any) => t.name === 'add'), 'Should have add tool');
    assert(tools.some((t: any) => t.name === 'ping'), 'Should have ping tool');
    console.log('  ✅ tools/list OK');

    // ── 8. tools/call — echo ──
    console.log('\n[E2E] Calling echo tool...');
    postRes = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 3,
        params: {
          name: 'echo',
          arguments: { message: 'hello air!' },
        },
      }),
    });
    assert(postRes.status === 202, 'tools/call should return 202');

    const echoResponse = await readNextSSEMessage(reader, decoder, buffer);
    buffer = echoResponse.remaining;
    const echoContent = echoResponse.message?.result?.content?.[0]?.text;
    console.log(`  Echo result: ${echoContent}`);
    assert(echoContent === 'echo: hello air!', 'Echo should return correct message');
    console.log('  ✅ echo tool call OK');

    // ── 9. tools/call — add ──
    console.log('\n[E2E] Calling add tool...');
    postRes = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 4,
        params: {
          name: 'add',
          arguments: { a: 17, b: 25 },
        },
      }),
    });

    const addResponse = await readNextSSEMessage(reader, decoder, buffer);
    buffer = addResponse.remaining;
    const addResult = JSON.parse(addResponse.message?.result?.content?.[0]?.text || '{}');
    console.log(`  Add result: ${JSON.stringify(addResult)}`);
    assert(addResult.result === 42, 'Add should return 42');
    console.log('  ✅ add tool call OK');

    // ── 10. 헬스체크 세션 수 확인 ──
    console.log('\n[E2E] Checking session count...');
    const health2 = await (await fetch(`http://localhost:${PORT}/health`)).json() as Record<string, any>;
    console.log(`  Active sessions: ${health2.sessions}`);
    assert(health2.sessions === 1, 'Should have 1 active session');
    console.log('  ✅ Session count OK');

    // 정리
    sseController.abort();
    reader.cancel().catch(() => {});

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ ALL E2E TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err: any) {
    console.error('\n  ❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await server.stop();
    process.exit(0);
  }
}

// ── 헬퍼 ──

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function readNextSSEMessage(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  buffer: string,
): Promise<{ message: any; remaining: string }> {
  const timeout = setTimeout(() => {
    throw new Error('Timeout waiting for SSE message');
  }, 10_000);

  while (true) {
    // 버퍼에서 완전한 이벤트 찾기
    const eventEnd = buffer.indexOf('\n\n');
    if (eventEnd !== -1) {
      const eventBlock = buffer.slice(0, eventEnd);
      const remaining = buffer.slice(eventEnd + 2);

      // data 라인 추출
      for (const line of eventBlock.split('\n')) {
        if (line.startsWith('data: ')) {
          clearTimeout(timeout);
          try {
            return { message: JSON.parse(line.slice(6)), remaining };
          } catch {
            // JSON 아닌 data는 스킵 (endpoint 이벤트 등)
            buffer = remaining;
            continue;
          }
        }
      }
      buffer = remaining;
      continue;
    }

    // 더 읽기
    const { value, done } = await reader.read();
    if (done) {
      clearTimeout(timeout);
      throw new Error('SSE stream ended unexpectedly');
    }
    buffer += decoder.decode(value, { stream: true });
  }
}

runTest();
