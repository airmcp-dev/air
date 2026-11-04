// air CLI — __tests__/bridge.test.ts
//
// air bridge: stdio ↔ 게이트웨이 페일오버.
//   - 요청을 첫 게이트웨이로 보내고 응답을 한 줄 JSON으로 돌려준다
//   - tools/call의 progress 알림과 elicitation 요청이 stdout으로 흘러오고, stdin의 응답이 되돌아간다
//   - 첫 게이트웨이가 죽으면 다음 게이트웨이로 넘어가 재시도한다 (initialize 재전송 포함)
// 게이트웨이는 @airmcp-dev/gateway 워크스페이스 빌드를, 백엔드는 core를 쓴다.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PassThrough } from 'node:stream';
import { defineServer, defineTool } from '@airmcp-dev/core';
import { Gateway } from '@airmcp-dev/gateway';
import { GatewayBridge } from '../src/utils/bridge.js';

const PORT = 24_000 + Math.floor(Math.random() * 5_000);

function makeBridge(gateways: string[]) {
  const input = new PassThrough();
  const output = new PassThrough();
  const lines: any[] = [];
  const logs: string[] = [];
  let buf = '';
  output.setEncoding('utf-8');
  output.on('data', (c: string) => {
    buf += c;
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      lines.push(JSON.parse(buf.slice(0, nl)));
      buf = buf.slice(nl + 1);
    }
  });
  const bridge = new GatewayBridge({ gateways, failbackProbeMs: 60_000, log: (l) => logs.push(l) }, input, output);
  bridge.start();
  const send = (m: any) => input.write(JSON.stringify(m) + '\n');
  const waitFor = async (pred: (l: any) => boolean, timeoutMs = 5_000) => {
    const deadline = Date.now() + timeoutMs;
    while (!lines.some(pred)) {
      if (Date.now() > deadline) throw new Error(`timeout; got ${JSON.stringify(lines)}`);
      await new Promise((r) => setTimeout(r, 15));
    }
    return lines.find(pred);
  };
  return { bridge, send, lines, logs, waitFor, stop: () => { bridge.stop(); input.end(); } };
}

describe('air bridge', () => {
  const backend = defineServer({
    name: 'bridged',
    transport: { type: 'http', port: PORT },
    tools: [
      defineTool('echo', { params: { text: 'string' }, handler: async ({ text }) => `echo:${text}` }),
      defineTool('ask', { params: {}, handler: async (_p, ctx) => {
        ctx.progress(1, 1);
        if (!ctx.elicit) return 'no-elicit';
        const r = await ctx.elicit('name?', { name: { type: 'string' } });
        return `hello ${r.content?.name}`;
      } }),
    ],
  });
  const g1 = new Gateway({ name: 'g1', port: 0, healthCheckInterval: 60_000, secret: 's' });
  const g2 = new Gateway({ name: 'g2', port: 0, healthCheckInterval: 60_000, secret: 's' });

  beforeAll(async () => {
    await backend.start();
    for (const g of [g1, g2]) g.register({ id: 'bridged', name: 'bridged', connection: { type: 'http', url: `http://127.0.0.1:${PORT}/mcp` } });
    await Promise.all([g1.start(), g2.start()]);
  }, 20_000);

  afterAll(async () => {
    await Promise.all([g1.stop(), g2.stop()]);
    await backend.stop();
  });

  it('should forward requests and relay streamed events and elicitation replies', async () => {
    const b = makeBridge([`http://127.0.0.1:${g1.port}`, `http://127.0.0.1:${g2.port}`]);
    try {
      b.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: { elicitation: {} }, clientInfo: { name: 'c', version: '0' } } });
      const init = await b.waitFor((l) => l.id === 1);
      expect(init.result.serverInfo.name).toBe('g1');

      b.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ask', arguments: {}, _meta: { progressToken: 'p' } } });
      const elicit = await b.waitFor((l) => l.method === 'elicitation/create');
      expect(b.lines.some((l) => l.method === 'notifications/progress')).toBe(true);
      b.send({ jsonrpc: '2.0', id: elicit.id, result: { action: 'accept', content: { name: 'Mina' } } });
      const final = await b.waitFor((l) => l.id === 2);
      expect(final.result.content[0].text).toBe('hello Mina');
    } finally {
      b.stop();
    }
  });

  it('should fail over to the next gateway when the first one is down', async () => {
    // 죽은 포트를 첫 번째로
    const b = makeBridge(['http://127.0.0.1:1', `http://127.0.0.1:${g2.port}`]);
    try {
      b.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '0' } } });
      const init = await b.waitFor((l) => l.id === 1);
      expect(init.result.serverInfo.name).toBe('g2');
      expect(b.bridge.activeGateway).toBe(`http://127.0.0.1:${g2.port}`);
      expect(b.logs.some((l) => l.includes('switched to'))).toBe(true);

      b.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo', arguments: { text: 'x' } } });
      const res = await b.waitFor((l) => l.id === 2);
      expect(res.result.content[0].text).toBe('echo:x');
    } finally {
      b.stop();
    }
  });

  it('should return a JSON-RPC error when every gateway is down', async () => {
    const b = makeBridge(['http://127.0.0.1:1', 'http://127.0.0.1:2']);
    try {
      b.send({ jsonrpc: '2.0', id: 9, method: 'tools/list' });
      const res = await b.waitFor((l) => l.id === 9);
      expect(res.error.code).toBe(-32000);
    } finally {
      b.stop();
    }
  });
});
