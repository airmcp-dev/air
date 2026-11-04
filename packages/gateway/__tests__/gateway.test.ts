// @airmcp-dev/gateway — __tests__/gateway.test.ts
//
// Gateway 프론트 E2E: 실제 air 서버 두 대를 Streamable HTTP로 띄우고 게이트웨이를 앞에 둔다.
//   - initialize / tools·resources·prompts 집계
//   - tools/call 라우팅 + 복제본 로드밸런싱(round-robin)
//   - SSE 패스스루: progress/log 알림이 클라이언트 스트림까지 온다
//   - elicitation: 하위 서버의 요청이 게이트웨이 id로 바뀌어 오고, 클라이언트 응답이 하위 서버로 되돌아간다
//   - JSON 모드(Accept에 SSE 없음)는 최종 결과만
//   - resources/read · prompts/get 소유 서버로 전달

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';
import { Gateway } from '../src/index.js';

// 고정 포트 대신 20000~29999 사이 임의 포트 (core의 http transport는 port 0을 기본값으로 바꿔버린다)
const basePort = 20_000 + Math.floor(Math.random() * 9_000);
const PORT_A = basePort;
const PORT_B = basePort + 1;

function backend(label: string, port: number) {
  return defineServer({
    name: `backend-${label}`,
    version: '1.0.0',
    transport: { type: 'http', port },
    tools: [
      defineTool('echo', {
        description: 'Echo with backend label',
        params: { text: 'string' },
        handler: async ({ text }) => `${label}:${text}`,
      }),
      ...(label === 'A'
        ? [
            defineTool('work', {
              description: 'Progress, log, then elicit',
              params: { ask: 'boolean?' },
              handler: async ({ ask }, ctx) => {
                ctx.progress(1, 3);
                ctx.log('info', 'working', 'work');
                ctx.progress(3, 3);
                if (ask) {
                  if (!ctx.elicit) return 'no-elicit';
                  const r = await ctx.elicit('Confirm?', { ok: { type: 'boolean', required: true } });
                  return `${r.action}:${r.content?.ok}`;
                }
                return 'done';
              },
            }),
          ]
        : [
            defineTool('b-only', { description: 'Only on B', params: {}, handler: async () => 'b' }),
          ]),
    ],
    resources: [
      defineResource(`mem://${label}/info`, { description: `${label} info`, handler: async () => `info from ${label}` }),
    ],
    prompts: [
      definePrompt(`greet-${label}`, { arguments: [{ name: 'who', required: true }], handler: ({ who }) => [{ role: 'user', content: `${label} greets ${who}` }] }),
    ],
  });
}

async function waitHealthy(port: number) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`backend on ${port} did not come up`);
}

interface Result { status: number; contentType: string; events: any[] }

/** 게이트웨이에 POST. SSE면 이벤트 전부, JSON이면 응답 하나가 events에 담긴다. */
function post(port: number, body: unknown, accept = 'application/json, text/event-stream', onEvent?: (e: any) => void): Promise<Result> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/mcp', method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', Accept: accept } },
      (res) => {
        const events: any[] = [];
        let buf = '';
        const isSse = String(res.headers['content-type']).includes('text/event-stream');
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          buf += chunk;
          if (!isSse) return;
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = block.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const ev = JSON.parse(line.slice(6));
            events.push(ev);
            onEvent?.(ev);
          }
        });
        res.on('end', () => {
          if (!isSse && buf) events.push(JSON.parse(buf));
          resolve({ status: res.statusCode!, contentType: String(res.headers['content-type']), events });
        });
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

const rpc = (id: number, method: string, params?: any) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

describe('Gateway — Streamable HTTP front', () => {
  const A = backend('A', PORT_A);
  const B = backend('B', PORT_B);
  const gateway = new Gateway({ name: 'gw-test', port: 0, healthCheckInterval: 60_000, requestTimeout: 5_000 });

  beforeAll(async () => {
    await Promise.all([A.start(), B.start()]);
    await Promise.all([waitHealthy(PORT_A), waitHealthy(PORT_B)]);
    gateway.register({ id: 'a', name: 'A', connection: { type: 'http', url: `http://127.0.0.1:${PORT_A}/mcp` } });
    gateway.register({ id: 'b', name: 'B', connection: { type: 'http', url: `http://127.0.0.1:${PORT_B}/mcp` } });
    await gateway.start();
  }, 20_000);

  afterAll(async () => {
    await gateway.stop();
    await Promise.all([A.stop(), B.stop()]);
  });

  it('should answer initialize itself and remember client capabilities', async () => {
    const res = await post(gateway.port, rpc(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: { elicitation: {} }, clientInfo: { name: 't', version: '0' } }));
    expect(res.events[0].result.serverInfo.name).toBe('gw-test');
    expect(res.events[0].result.capabilities.logging).toEqual({});
  });

  it('should aggregate tools, resources and prompts from both backends', async () => {
    const tools = (await post(gateway.port, rpc(2, 'tools/list'))).events[0].result.tools;
    expect(tools.map((t: any) => t.name).sort()).toEqual(['b-only', 'echo', 'work']);
    expect(tools.find((t: any) => t.name === 'echo').inputSchema.properties.text).toEqual({ type: 'string' });
    expect(tools.every((t: any) => t.serverId === undefined)).toBe(true);

    const resources = (await post(gateway.port, rpc(3, 'resources/list'))).events[0].result.resources;
    expect(resources.map((r: any) => r.uri).sort()).toEqual(['mem://A/info', 'mem://B/info']);

    const prompts = (await post(gateway.port, rpc(4, 'prompts/list'))).events[0].result.prompts;
    expect(prompts.map((p: any) => p.name).sort()).toEqual(['greet-A', 'greet-B']);
  });

  it('should round-robin replicated tools across backends', async () => {
    const labels = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const res = await post(gateway.port, rpc(10 + i, 'tools/call', { name: 'echo', arguments: { text: 'x' } }), 'application/json');
      labels.add(res.events[0].result.content[0].text.split(':')[0]);
    }
    expect([...labels].sort()).toEqual(['A', 'B']);
  });

  it('should route a tool that exists on one backend only', async () => {
    const res = await post(gateway.port, rpc(20, 'tools/call', { name: 'b-only', arguments: {} }), 'application/json');
    expect(res.events[0].result.content[0].text).toBe('b');
  });

  it('should stream progress and log notifications through to the client', async () => {
    const res = await post(gateway.port, rpc(30, 'tools/call', { name: 'work', arguments: {}, _meta: { progressToken: 'p1' } }));
    expect(res.contentType).toContain('text/event-stream');
    expect(res.events.map((e) => e.method ?? 'response')).toEqual([
      'notifications/progress', 'notifications/message', 'notifications/progress', 'response',
    ]);
    expect(res.events[0].params).toEqual({ progressToken: 'p1', progress: 1, total: 3 });
    expect(res.events[3]).toEqual({ jsonrpc: '2.0', id: 30, result: { content: [{ type: 'text', text: 'done' }] } });
  });

  it('should relay elicitation: rewrite the id and forward the client reply to the backend', async () => {
    const res = await post(gateway.port, rpc(40, 'tools/call', { name: 'work', arguments: { ask: true } }), undefined, (ev) => {
      if (ev.method !== 'elicitation/create') return;
      expect(String(ev.id)).toMatch(/^gw-\d+$/);
      expect(ev.params.message).toBe('Confirm?');
      void post(gateway.port, { jsonrpc: '2.0', id: ev.id, result: { action: 'accept', content: { ok: true } } }, 'application/json');
    });
    const methods = res.events.map((e) => e.method ?? 'response');
    expect(methods).toContain('elicitation/create');
    expect(res.events.at(-1).result.content[0].text).toBe('accept:true');
    expect(gateway.status().pendingRequests).toBe(0);
  });

  it('should answer in plain JSON (no notifications) when the client does not accept SSE', async () => {
    const res = await post(gateway.port, rpc(50, 'tools/call', { name: 'work', arguments: {}, _meta: { progressToken: 'p' } }), 'application/json');
    expect(res.contentType).toContain('application/json');
    expect(res.events).toEqual([{ jsonrpc: '2.0', id: 50, result: { content: [{ type: 'text', text: 'done' }] } }]);
  });

  it('should forward resources/read and prompts/get to the owning backend', async () => {
    const r = await post(gateway.port, rpc(60, 'resources/read', { uri: 'mem://B/info' }));
    expect(r.events[0].result.contents[0].text).toBe('info from B');
    const p = await post(gateway.port, rpc(61, 'prompts/get', { name: 'greet-A', arguments: { who: 'you' } }));
    expect(p.events[0].result.messages[0].content.text).toBe('A greets you');
  });

  it('should return JSON-RPC errors for unknown tools and methods', async () => {
    const t = await post(gateway.port, rpc(70, 'tools/call', { name: 'nope', arguments: {} }));
    expect(t.events[0].error.code).toBe(-32601);
    const m = await post(gateway.port, rpc(71, 'something/else'));
    expect(m.events[0].error.code).toBe(-32601);
  });

  it('should accept an unknown client response with 202', async () => {
    const res = await post(gateway.port, { jsonrpc: '2.0', id: 'gw-999999', result: {} }, 'application/json');
    expect(res.status).toBe(202);
  });

  it('should probe /health at the backend origin even when the url includes /mcp', async () => {
    const results = await gateway.healthChecker.checkAll();
    expect(results.map((r) => [r.serverId, r.healthy]).sort()).toEqual([['a', true], ['b', true]]);
  });

  it('should exclude a backend that goes down and keep serving from the other', async () => {
    gateway.registry.updateStatus('a', 'error');
    for (let i = 0; i < 3; i++) {
      const res = await post(gateway.port, rpc(80 + i, 'tools/call', { name: 'echo', arguments: { text: 'y' } }), 'application/json');
      expect(res.events[0].result.content[0].text).toBe('B:y');
    }
    const t = await post(gateway.port, rpc(90, 'tools/call', { name: 'work', arguments: {} }), 'application/json');
    expect(t.events[0].error.message).toContain('no healthy server');
    gateway.registry.updateStatus('a', 'connected');
  });
});
