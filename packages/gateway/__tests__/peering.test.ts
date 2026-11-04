// @airmcp-dev/gateway — __tests__/peering.test.ts
//
// 게이트웨이 피어링(gossip):
//   - A에만 등록된 백엔드를 B가 /peers/state로 배워서 라우팅한다 (발견 목록 복사, 재발견 없음)
//   - 피어 전파는 직접 아는 백엔드만 (피어에게 배운 건 재전파 X)
//   - A에서 백엔드가 빠지면 B도 잠시 뒤 제거
//   - B에서 받은 elicitation 응답이 (공유 secret) 백엔드까지 간다
//   - 토큰 없으면 401

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { defineServer, defineTool } from '@airmcp-dev/core';
import { Gateway } from '../src/index.js';

const PORT = 22_000 + Math.floor(Math.random() * 7_000);
const rpc = (id: number, method: string, params?: any) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

async function until(cond: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 25));
  }
}

function post(port: number, body: unknown, accept = 'application/json', onEvent?: (e: any) => void): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', Accept: accept } }, (res) => {
      const events: any[] = []; let buf = '';
      const isSse = String(res.headers['content-type']).includes('text/event-stream');
      res.setEncoding('utf-8');
      res.on('data', (c: string) => {
        buf += c; if (!isSse) return;
        let i: number;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = block.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue;
          const ev = JSON.parse(line.slice(6)); events.push(ev); onEvent?.(ev);
        }
      });
      res.on('end', () => { if (!isSse && buf) events.push(JSON.parse(buf)); resolve(events); });
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}

describe('Gateway — peering', () => {
  const backend = defineServer({
    name: 'peered',
    transport: { type: 'http', port: PORT },
    tools: [
      defineTool('shared', { params: {}, handler: async () => 'from peered backend' }),
      defineTool('ask', { params: {}, handler: async (_p, ctx) => {
        if (!ctx.elicit) return 'no-elicit';
        const r = await ctx.elicit('ok?', { ok: { type: 'boolean' } });
        return `${r.action}`;
      } }),
    ],
    prompts: [],
  });
  const A = new Gateway({ name: 'A', port: 0, healthCheckInterval: 60_000, secret: 's', registration: { token: 'tk' } });
  let B: Gateway;

  beforeAll(async () => {
    await backend.start();
    await until(() => true);
    A.register({ id: 'peered', name: 'peered', connection: { type: 'http', url: `http://127.0.0.1:${PORT}/mcp` } });
    await A.start();
    B = new Gateway({ name: 'B', port: 0, healthCheckInterval: 60_000, secret: 's', registration: { token: 'tk' }, peers: [`http://127.0.0.1:${A.port}`], peerSyncMs: 150, discoverOnStart: false });
    await B.start();
  }, 20_000);

  afterAll(async () => {
    await Promise.all([A.stop(), B.stop()]);
    await backend.stop();
  });

  it('should learn the backend from the peer and route calls to it', async () => {
    await until(() => B.toolIndex.has('shared'));
    expect(B.registry.get('peered')!.metadata?.origin).toBe('peer');
    const [res] = await post(B.port, rpc(1, 'tools/call', { name: 'shared', arguments: {} }));
    expect(res.result.content[0].text).toBe('from peered backend');
    expect((B.status() as any).peers[`http://127.0.0.1:${A.port}`]).toBe('up');
  });

  it('should not re-propagate peer-learned backends', () => {
    expect(B.peerStateSnapshot()).toEqual([]);
    expect(A.peerStateSnapshot().map((b) => b.id)).toEqual(['peered']);
  });

  it('should relay elicitation replies received by the peer', async () => {
    await post(B.port, rpc(0, 'initialize', { protocolVersion: '2025-11-25', capabilities: { elicitation: {} }, clientInfo: { name: 't', version: '0' } }));
    const events = await post(B.port, rpc(2, 'tools/call', { name: 'ask', arguments: {} }), 'application/json, text/event-stream', (ev) => {
      if (ev.method === 'elicitation/create') void post(A.port, { jsonrpc: '2.0', id: ev.id, result: { action: 'accept', content: { ok: true } } });
    });
    expect(events.at(-1).result.content[0].text).toBe('accept');
  });

  it('should require the token on /peers/state', async () => {
    const res = await fetch(`http://127.0.0.1:${A.port}/peers/state`);
    expect(res.status).toBe(401);
  });

  it('should drop the learned backend once the peer no longer lists it', async () => {
    A.unregister('peered');
    await until(() => !B.toolIndex.has('shared'), 3_000);
    expect(B.registry.get('peered')).toBeUndefined();
  });
});
