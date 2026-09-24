// @airmcp-dev/core — __tests__/air-sse-transport.test.ts
//
// AirSSETransport + AirSSESessionManager 유닛 테스트
// 실제 HTTP 서버를 띄워서 SSE 연결 → 메시지 송수신 → 재연결 복구까지 검증

import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { AirSSETransport, AirSSESessionManager } from '../src/transport/air-sse-transport.js';

// ── 헬퍼: 테스트용 HTTP 서버 ──

interface TestServer {
  server: Server;
  port: number;
  url: string;
  sessionManager: AirSSESessionManager;
  transports: Map<string, AirSSETransport>;
  close: () => Promise<void>;
}

async function createTestServer(): Promise<TestServer> {
  const sessionManager = new AirSSESessionManager({
    maxSessions: 10,
    idleTimeoutMs: 5000,
    cleanupIntervalMs: 1000,
  });
  const transports = new Map<string, AirSSETransport>();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost`);

    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new AirSSETransport(res, {
        endpoint: '/message',
        heartbeatIntervalMs: 0, // 테스트에서는 하트비트 비활성
        replayBufferSize: 50,
        replayTtlMs: 60_000,
      });

      if (!sessionManager.add(transport)) {
        res.writeHead(503).end('Max sessions');
        return;
      }

      transports.set(transport.id, transport);

      transport.onclose = () => {
        transports.delete(transport.id);
        sessionManager.remove(transport.id);
      };

      const lastEventId = req.headers['last-event-id'] as string | undefined;
      await transport.start(lastEventId);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/message') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400).end('Missing sessionId');
        return;
      }
      const transport = sessionManager.get(sessionId);
      if (!transport) {
        res.writeHead(404).end('Session not found');
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address()!;
  const port = typeof addr === 'string' ? 0 : addr.port;

  return {
    server,
    port,
    url: `http://localhost:${port}`,
    sessionManager,
    transports,
    close: async () => {
      await sessionManager.closeAll();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** SSE 스트림을 읽어서 이벤트 파싱 */
async function readSSEEvents(url: string, headers?: Record<string, string>): Promise<{
  events: Array<{ event?: string; data?: string; id?: string }>;
  sessionId: string;
  abort: () => void;
}> {
  const controller = new AbortController();
  const res = await fetch(url, {
    signal: controller.signal,
    headers: headers || {},
  });

  const events: Array<{ event?: string; data?: string; id?: string }> = [];
  let sessionId = '';

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // 첫 몇 이벤트만 읽기 (endpoint 이벤트 포함)
  const readSome = async (count: number) => {
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 이벤트 파싱
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;
        const evt: Record<string, string> = {};
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) evt.event = line.slice(7);
          else if (line.startsWith('data: ')) evt.data = line.slice(6);
          else if (line.startsWith('id: ')) evt.id = line.slice(4);
        }
        if (Object.keys(evt).length > 0) {
          events.push(evt);
          // endpoint 이벤트에서 sessionId 추출
          if (evt.event === 'endpoint' && evt.data) {
            const match = evt.data.match(/sessionId=([^&]+)/);
            if (match) sessionId = match[1];
          }
        }
      }
    }
  };

  await readSome(1); // 최소 endpoint 이벤트 1개

  return {
    events,
    sessionId,
    abort: () => {
      controller.abort();
      reader.cancel().catch(() => {});
    },
  };
}

// ── 테스트 ──

let testServer: TestServer | null = null;

afterEach(async () => {
  if (testServer) {
    await testServer.close();
    testServer = null;
  }
});

describe('AirSSETransport', () => {
  it('should establish SSE connection and receive endpoint event', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);

    expect(sse.events.length).toBeGreaterThanOrEqual(1);
    expect(sse.events[0].event).toBe('endpoint');
    expect(sse.events[0].data).toContain('/message?sessionId=');
    expect(sse.sessionId).toBeTruthy();

    sse.abort();
  });

  it('should register session in manager', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);

    expect(testServer.sessionManager.size).toBe(1);
    const transport = testServer.sessionManager.get(sse.sessionId);
    expect(transport).toBeDefined();
    expect(transport!.isConnected).toBe(true);

    sse.abort();
  });

  it('should accept POST messages and forward via onmessage', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);

    // onmessage 콜백 설정
    const transport = testServer.transports.get(sse.sessionId)!;
    const received: any[] = [];
    transport.onmessage = (msg: any) => {
      received.push(msg);
    };

    // JSON-RPC 메시지 전송
    const message = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
    };

    const postRes = await fetch(`${testServer.url}/message?sessionId=${sse.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    expect(postRes.status).toBe(202);
    expect(received.length).toBe(1);
    expect(received[0].method).toBe('tools/list');

    sse.abort();
  });

  it('should send messages with id for replay support', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);

    const transport = testServer.transports.get(sse.sessionId)!;

    // 서버에서 클라이언트로 메시지 전송
    await transport.send({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
    await transport.send({ jsonrpc: '2.0', id: 2, result: { resources: [] } });

    // 버퍼 확인 — 내부 상태 검증
    // @ts-expect-error — private 필드 접근 (테스트용)
    expect(transport._replayBuffer.length).toBe(2);
    // @ts-expect-error
    expect(transport._replayBuffer[0].id).toBe('1');
    // @ts-expect-error
    expect(transport._replayBuffer[1].id).toBe('2');

    sse.abort();
  });

  it('should reject POST to unknown session', async () => {
    testServer = await createTestServer();

    const res = await fetch(`${testServer.url}/message?sessionId=nonexistent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(res.status).toBe(404);
  });

  it('should reject POST without sessionId', async () => {
    testServer = await createTestServer();

    const res = await fetch(`${testServer.url}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(res.status).toBe(400);
  });

  it('should reject invalid JSON in POST body', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);

    const res = await fetch(`${testServer.url}/message?sessionId=${sse.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });

    expect(res.status).toBe(400);

    sse.abort();
  });
});

describe('AirSSESessionManager', () => {
  it('should enforce max sessions', async () => {
    testServer = await createTestServer(); // maxSessions: 10
    const connections: Array<{ abort: () => void }> = [];

    // 10개 세션 생성
    for (let i = 0; i < 10; i++) {
      const sse = await readSSEEvents(`${testServer.url}/sse`);
      connections.push(sse);
    }

    expect(testServer.sessionManager.size).toBe(10);

    // 11번째는 503
    const res = await fetch(`${testServer.url}/sse`);
    expect(res.status).toBe(503);

    connections.forEach(c => c.abort());
  });

  it('should cleanup disconnected sessions', async () => {
    testServer = await createTestServer();

    const sse1 = await readSSEEvents(`${testServer.url}/sse`);
    const sse2 = await readSSEEvents(`${testServer.url}/sse`);

    expect(testServer.sessionManager.size).toBe(2);

    // transport.close()로 서버 측에서 명시적 종료 → onclose 콜백이 세션 제거
    const transport1 = testServer.transports.get(sse1.sessionId)!;
    await transport1.close();

    // onclose 콜백에서 이미 remove됨 — size로 확인
    expect(testServer.sessionManager.size).toBe(1);
    expect(testServer.sessionManager.get(sse1.sessionId)).toBeUndefined();
    expect(testServer.sessionManager.get(sse2.sessionId)).toBeDefined();

    sse1.abort();
    sse2.abort();
  });

  it('should track lastActivityAt on message', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);
    const transport = testServer.transports.get(sse.sessionId)!;

    const beforeActivity = transport.lastActivityAt;
    await new Promise(r => setTimeout(r, 50));

    // POST 메시지 → lastActivityAt 갱신
    transport.onmessage = () => {};
    await fetch(`${testServer.url}/message?sessionId=${sse.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(transport.lastActivityAt).toBeGreaterThan(beforeActivity);

    sse.abort();
  });

  it('should close all sessions on closeAll', async () => {
    testServer = await createTestServer();

    await readSSEEvents(`${testServer.url}/sse`);
    await readSSEEvents(`${testServer.url}/sse`);
    await readSSEEvents(`${testServer.url}/sse`);

    expect(testServer.sessionManager.size).toBe(3);

    await testServer.sessionManager.closeAll();

    expect(testServer.sessionManager.size).toBe(0);
  });
});

describe('AirSSETransport — heartbeat', () => {
  it('should send ping comments when heartbeat is enabled', async () => {
    // 하트비트 활성 서버 생성
    const sessionManager = new AirSSESessionManager({ maxSessions: 5 });
    const transports = new Map<string, AirSSETransport>();

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/sse') {
        const transport = new AirSSETransport(res, {
          endpoint: '/message',
          heartbeatIntervalMs: 100, // 100ms 하트비트
          replayBufferSize: 50,
        });
        sessionManager.add(transport);
        transports.set(transport.id, transport);
        transport.onclose = () => {
          transports.delete(transport.id);
          sessionManager.remove(transport.id);
        };
        await transport.start();
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>(r => server.listen(0, r));
    const port = (server.address() as any).port;

    const controller = new AbortController();
    const res = await fetch(`http://localhost:${port}/sse`, {
      signal: controller.signal,
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';

    // 300ms 동안 데이터 수집 → ping이 최소 1회 포함되어야 함
    const start = Date.now();
    while (Date.now() - start < 400) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }

    controller.abort();
    reader.cancel().catch(() => {});

    expect(raw).toContain(': ping');

    await sessionManager.closeAll();
    await new Promise<void>(r => server.close(() => r()));
  });
});

describe('AirSSETransport — replay buffer', () => {
  it('should replay messages after Last-Event-ID reconnection', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);
    const transport = testServer.transports.get(sse.sessionId)!;

    // 메시지 3개 전송 → replay buffer에 쌓임
    await transport.send({ jsonrpc: '2.0', id: 1, result: 'msg1' });
    await transport.send({ jsonrpc: '2.0', id: 2, result: 'msg2' });
    await transport.send({ jsonrpc: '2.0', id: 3, result: 'msg3' });

    // @ts-expect-error — private 필드 접근
    const buffer = transport._replayBuffer;
    expect(buffer.length).toBe(3);
    expect(buffer[0].id).toBe('1');
    expect(buffer[2].id).toBe('3');

    // _replayFrom 내부 메서드 검증 — id '1' 이후 메시지(2,3)를 재전송해야 함
    // @ts-expect-error
    const idx = buffer.findIndex((m: any) => m.id === '1');
    expect(idx).toBe(0);
    const toReplay = buffer.slice(idx + 1);
    expect(toReplay.length).toBe(2);
    expect(toReplay[0].id).toBe('2');
    expect(toReplay[1].id).toBe('3');

    sse.abort();
  });

  it('should evict old messages from replay buffer by size', async () => {
    testServer = await createTestServer();
    const sse = await readSSEEvents(`${testServer.url}/sse`);
    const transport = testServer.transports.get(sse.sessionId)!;

    // replayBufferSize는 50 — 60개 전송하면 최초 10개는 퇴출
    for (let i = 0; i < 60; i++) {
      await transport.send({ id: i, data: `msg-${i}` });
    }

    // @ts-expect-error
    const buffer = transport._replayBuffer;
    expect(buffer.length).toBe(50);
    // 첫 번째 메시지의 id는 11이어야 함 (1~10이 퇴출됨)
    expect(buffer[0].id).toBe('11');

    sse.abort();
  });
});
