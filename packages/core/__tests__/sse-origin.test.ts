// @airmcp-dev/core — __tests__/sse-origin.test.ts
//
// 이전 HTTP+SSE transport(GET /sse, POST /message)의 Origin 검증.
// MCP 스펙 2024-11-05 basic/transports, HTTP with SSE의 Security Warning:
//   "Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks"
// 규칙은 Streamable HTTP와 같다: Origin 없음, 루프백 출처, transport.allowedOrigins만 받고 나머지는 모든 경로에서 403.

import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { defineServer } from '../src/server/define-server.js';
import { defineTool } from '../src/tool/define-tool.js';

const realListen = http.Server.prototype.listen;
const servers: http.Server[] = [];
const streams: http.ClientRequest[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of streams.splice(0)) s.destroy();
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise((r) => {
          s.closeAllConnections();
          s.close(r);
        }),
    ),
  );
});

/** SSE 서버를 127.0.0.1 임시 포트에 띄우고 도구 호출을 기록한다 */
async function startSse(transport: Record<string, any> = {}) {
  let server: http.Server | undefined;
  // transport.port 대신 임시 포트(0)로 열고 서버 핸들을 잡는다
  vi.spyOn(http.Server.prototype, 'listen').mockImplementation(function (
    this: http.Server,
    ...args: any[]
  ) {
    server = this;
    servers.push(this);
    return realListen.call(
      this,
      0,
      '127.0.0.1',
      args.find((a) => typeof a === 'function'),
    );
  });
  const calls: string[] = [];
  await defineServer({
    name: 'sse-origin-test',
    logging: { level: 'silent' },
    transport: { type: 'sse', port: 39200, ...transport },
    tools: [
      defineTool('echo', {
        params: { text: 'string' },
        handler: async ({ text }) => {
          calls.push(text);
          return text;
        },
      }),
    ],
  }).start();
  await new Promise<void>((r) => (server!.listening ? r() : server!.once('listening', () => r())));
  return { port: (server!.address() as AddressInfo).port, calls };
}

/** 일반 요청 (Origin 같은 헤더를 그대로 보낸다) */
function request(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers, agent: false },
      (res) => {
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, text: data }));
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

/** GET /sse를 열고 상태 코드와 (열렸으면) endpoint 이벤트의 경로, 이후 이벤트를 돌려준다 */
function openSse(
  port: number,
  headers: Record<string, string> = {},
): Promise<{ status: number; endpoint?: string; text?: string; events: string[] }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/sse', method: 'GET', headers, agent: false },
      (res) => {
        res.setEncoding('utf-8');
        if (res.statusCode !== 200) {
          let data = '';
          res.on('data', (d) => (data += d));
          res.on('end', () => resolve({ status: res.statusCode!, text: data, events: [] }));
          return;
        }
        const events: string[] = [];
        let buf = '';
        let resolved = false;
        res.on('data', (d: string) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            events.push(block);
            const m = /^event: endpoint\ndata: (.+)$/m.exec(block);
            if (m && !resolved) {
              resolved = true;
              resolve({ status: 200, endpoint: m[1], events });
            }
          }
        });
      },
    );
    streams.push(req);
    req.on('error', reject);
    req.end();
  });
}

const jsonHeaders = { 'Content-Type': 'application/json' };
const echoCall = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'echo', arguments: { text: 'hi' } },
};

describe('SSE transport — Origin validation', () => {
  it('should reject a foreign Origin on GET /sse with 403 and open no session', async () => {
    const { port } = await startSse();
    const res = await openSse(port, { Origin: 'http://evil.example' });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.text!).error.message).toContain('http://evil.example');
    const health = await request(port, 'GET', '/health');
    expect(JSON.parse(health.text).sessions).toBe(0);
  });

  it('should reject a foreign Origin on POST /message without running the tool', async () => {
    const { port, calls } = await startSse();
    const stream = await openSse(port); // Origin 없는 클라이언트가 연 세션
    expect(stream.status).toBe(200);

    const forbidden = await request(
      port,
      'POST',
      stream.endpoint!,
      { ...jsonHeaders, Origin: 'http://evil.example' },
      echoCall,
    );
    expect(forbidden.status).toBe(403);
    expect(calls).toEqual([]);

    const ok = await request(port, 'POST', stream.endpoint!, jsonHeaders, echoCall);
    expect(ok.status).toBe(202);
    await vi.waitFor(() => expect(calls).toEqual(['hi']));
  });

  it('should reject a foreign Origin on every path, including /health and preflight', async () => {
    const { port } = await startSse();
    const origin = { Origin: 'http://evil.example' };
    expect((await request(port, 'GET', '/health', origin)).status).toBe(403);
    expect((await request(port, 'GET', '/', origin)).status).toBe(403);
    const preflight = await request(port, 'OPTIONS', '/message', origin);
    expect(preflight.status).toBe(403);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should reject an opaque "null" Origin', async () => {
    const { port } = await startSse();
    expect((await openSse(port, { Origin: 'null' })).status).toBe(403);
  });

  it('should accept requests without Origin and from loopback origins', async () => {
    const { port } = await startSse();
    expect((await openSse(port)).status).toBe(200);
    for (const origin of ['http://localhost:6274', 'http://127.0.0.1:3000', 'http://[::1]:8080']) {
      expect((await openSse(port, { Origin: origin })).status).toBe(200);
    }
  });

  it('should accept origins listed in transport.allowedOrigins', async () => {
    const { port } = await startSse({ allowedOrigins: ['https://app.example.com'] });
    expect((await openSse(port, { Origin: 'https://app.example.com' })).status).toBe(200);
    expect((await openSse(port, { Origin: 'https://other.example.com' })).status).toBe(403);
  });
});
