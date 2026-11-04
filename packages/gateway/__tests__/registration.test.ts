// @airmcp-dev/gateway — __tests__/registration.test.ts
//
// 백엔드 자기 등록(push registration):
//   - air 서버가 `gateway: { url, token }`으로 뜨면 게이트웨이에 스스로 등록되고 도구가 발견된다
//   - 하트비트가 끊기면(서버 정지) staleAfterMs 뒤 제거된다
//   - 토큰이 틀리면 401, 본문이 이상하면 400
//   - 같은 id가 새 url로 오면 교체된다 (재시작)

import { describe, it, expect, afterAll } from 'vitest';
import { defineServer, defineTool } from '@airmcp-dev/core';
import { Gateway } from '../src/index.js';

const basePort = 21_000 + Math.floor(Math.random() * 8_000);

const rpc = (id: number, method: string, params?: any) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

async function call(port: number, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
}

async function until(cond: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('Gateway — backend self-registration', () => {
  const gateway = new Gateway({
    name: 'gw-reg', port: 0, healthCheckInterval: 60_000, discoverOnStart: false,
    registration: { token: 't0k', staleAfterMs: 600 },
  });
  const stops: Array<() => Promise<void>> = [];

  afterAll(async () => {
    await Promise.all(stops.map((s) => s()));
    await gateway.stop();
  });

  it('should register a backend that announces itself and discover its tools', async () => {
    await gateway.start();
    const port = basePort;
    const backend = defineServer({
      name: 'announcer',
      transport: { type: 'http', port },
      gateway: { url: `http://127.0.0.1:${gateway.port}`, token: 't0k', heartbeatMs: 100, id: 'ann-1' },
      tools: [defineTool('hello', { params: {}, handler: async () => 'hi from announcer' })],
    });
    await backend.start();
    stops.push(() => backend.stop());

    await until(() => gateway.toolIndex.has('hello'));
    const entry = gateway.registry.get('ann-1')!;
    expect(entry.name).toBe('announcer');
    expect((entry.connection as any).url).toBe(`http://127.0.0.1:${port}/mcp`);
    expect(entry.metadata?.selfRegistered).toBe(true);

    const res = await call(gateway.port, rpc(1, 'tools/call', { name: 'hello', arguments: {} }));
    expect(res.result.content[0].text).toBe('hi from announcer');

    const list = await fetch(`http://127.0.0.1:${gateway.port}/registry`, { headers: { Authorization: 'Bearer t0k' } }).then((r) => r.json()) as any;
    expect(list.servers.map((s: any) => s.id)).toContain('ann-1');
  });

  it('should drop a self-registered backend once its heartbeat stops', async () => {
    const port = basePort + 1;
    const backend = defineServer({
      name: 'short-lived',
      transport: { type: 'http', port },
      gateway: { url: `http://127.0.0.1:${gateway.port}`, token: 't0k', heartbeatMs: 100 },
      tools: [defineTool('bye', { params: {}, handler: async () => 'bye' })],
    });
    await backend.start();
    await until(() => gateway.toolIndex.has('bye'));

    // stop()은 DELETE /registry/:id를 보내므로 즉시 빠진다 — 하트비트 끊김만 보려고 DELETE 없이 하트비트를 멈추기 어렵다.
    // 그래서 여기선 stop() 경로(명시적 해제)를 확인하고, stale 제거는 아래 raw 테스트에서 본다.
    await backend.stop();
    await until(() => !gateway.toolIndex.has('bye'));
    expect(gateway.registry.get('short-lived')).toBeUndefined();
  });

  it('should sweep a backend that stops sending heartbeats', async () => {
    // 하트비트를 한 번만 보내는 raw 등록
    const res = await fetch(`http://127.0.0.1:${gateway.port}/registry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t0k' },
      body: JSON.stringify({ id: 'ghost', name: 'ghost', url: `http://127.0.0.1:${basePort}/mcp` }),
    });
    expect(res.status).toBe(201);
    expect(gateway.registry.get('ghost')).toBeDefined();
    await until(() => gateway.registry.get('ghost') === undefined, 3_000);
  });

  it('should reject a bad token and a malformed payload', async () => {
    const bad = await fetch(`http://127.0.0.1:${gateway.port}/registry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nope' },
      body: JSON.stringify({ id: 'x', name: 'x', url: 'http://127.0.0.1:1/mcp' }),
    });
    expect(bad.status).toBe(401);
    const malformed = await fetch(`http://127.0.0.1:${gateway.port}/registry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t0k' },
      body: JSON.stringify({ id: 'x' }),
    });
    expect(malformed.status).toBe(400);
  });

  it('should replace the connection when the same id announces a new url', async () => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer t0k' };
    const first = await fetch(`http://127.0.0.1:${gateway.port}/registry`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'mover', name: 'mover', url: `http://127.0.0.1:${basePort}/mcp` }) });
    expect(first.status).toBe(201);
    const same = await fetch(`http://127.0.0.1:${gateway.port}/registry`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'mover', name: 'mover', url: `http://127.0.0.1:${basePort}/mcp` }) });
    expect(same.status).toBe(200); // heartbeat
    const moved = await fetch(`http://127.0.0.1:${gateway.port}/registry`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'mover', name: 'mover', url: `http://127.0.0.1:${basePort + 5}/mcp` }) });
    expect(moved.status).toBe(201);
    expect((gateway.registry.get('mover')!.connection as any).url).toBe(`http://127.0.0.1:${basePort + 5}/mcp`);
    await fetch(`http://127.0.0.1:${gateway.port}/registry/mover`, { method: 'DELETE', headers: h });
    expect(gateway.registry.get('mover')).toBeUndefined();
  });
});
