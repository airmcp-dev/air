// @airmcp-dev/core — __tests__/outbound-channel.test.ts
//
// 서버 → 클라이언트 채널 (MCP 스펙 utilities/progress, utilities/logging, client/elicitation):
//   - Streamable HTTP: Accept: text/event-stream인 tools/call은 SSE 스트림으로 응답하고,
//     실행 중 notifications/progress·notifications/message를 흘린 뒤 최종 응답으로 닫는다
//   - elicitation/create: 스트림으로 요청을 보내고, 클라이언트의 별도 POST(JSON-RPC response)로 답을 받는다
//   - progressToken이 없으면 progress는 보내지 않고, logging/setLevel보다 낮은 로그는 거른다
//   - Accept에 SSE가 없으면 JSON 한 덩어리로 응답하고 알림은 버린다 (에러 없음)
//   - PendingRequests: id 매칭, 에러 응답, 채널 종료 시 거부

import { describe, it, expect, afterEach } from 'vitest';
import http, { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AirHttpTransport } from '../src/protocol/http-transport.js';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';
import { createRequestContext, toElicitJsonSchema } from '../src/context/request-context.js';
import { PendingRequests, isJsonRpcResponse, type AirOutbound } from '../src/protocol/outbound.js';
import type { AirToolContext } from '../src/types/tool.js';

const servers: Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

/** 엔진 + Streamable HTTP transport를 띄운다. 도구 핸들러는 createRequestContext로 만든 ctx를 받는다. */
async function startServer(handler: (params: any, ctx: AirToolContext) => Promise<any>) {
  const engine = new McpProtocolEngine({
    name: 'channel-test',
    version: '1.0.0',
    tools: [{ name: 'work', params: {}, handler: async () => 'unused' }],
    resources: [],
    prompts: [],
    callTool: async (_name, params, _meta, _inputResponses, channel) => {
      const ctx = createRequestContext('channel-test', {}, {
        outbound: channel?.outbound,
        progressToken: channel?.progressToken,
        clientSupportsElicitation: channel?.clientSupportsElicitation,
        getLogLevel: channel?.getLogLevel,
      });
      const result = await handler(params, ctx);
      return [{ type: 'text', text: String(result) }];
    },
  });
  const transport = new AirHttpTransport(engine, { endpoint: '/mcp' });
  const server = createServer((req, res) => transport.handleRequest(req, res));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { port: (server.address() as AddressInfo).port };
}

interface SseResult {
  status: number;
  contentType: string;
  events: any[];
}

/** POST를 보내고 응답을 끝까지 읽는다. SSE면 data: 줄들을 전부 파싱한다. onEvent로 중간 이벤트에 반응할 수 있다. */
function post(
  port: number,
  body: unknown,
  headers: Record<string, string> = {},
  onEvent?: (event: any) => void,
): Promise<SseResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1', port, path: '/mcp', method: 'POST', agent: false,
        headers: { 'Content-Type': 'application/json', ...headers },
      },
      (res) => {
        const events: any[] = [];
        let buf = '';
        res.setEncoding('utf-8');
        const isSse = String(res.headers['content-type']).includes('text/event-stream');
        res.on('data', (chunk: string) => {
          buf += chunk;
          if (!isSse) return;
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const data = block.split('\n').find((l) => l.startsWith('data: '));
            if (!data) continue;
            const event = JSON.parse(data.slice(6));
            events.push(event);
            onEvent?.(event);
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

const sse = { Accept: 'application/json, text/event-stream' };
const call = (meta?: Record<string, any>, args: Record<string, any> = {}) => ({
  jsonrpc: '2.0', id: 7, method: 'tools/call',
  params: { name: 'work', arguments: args, ...(meta ? { _meta: meta } : {}) },
});

describe('Streamable HTTP — progress and log notifications', () => {
  it('should stream progress and log notifications before the final response', async () => {
    const { port } = await startServer(async (_p, ctx) => {
      ctx.progress(0, 100);
      ctx.log('info', 'started', 'test');
      await new Promise((r) => setTimeout(r, 10));
      ctx.progress(100, 100, 'done');
      return 'ok';
    });
    const res = await post(port, call({ progressToken: 'tok-1' }), sse);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/event-stream');
    expect(res.events.map((e) => e.method ?? 'response')).toEqual([
      'notifications/progress', 'notifications/message', 'notifications/progress', 'response',
    ]);
    expect(res.events[0].params).toEqual({ progressToken: 'tok-1', progress: 0, total: 100 });
    expect(res.events[1].params).toEqual({ level: 'info', logger: 'test', data: 'started' });
    expect(res.events[2].params).toEqual({ progressToken: 'tok-1', progress: 100, total: 100, message: 'done' });
    expect(res.events[3]).toEqual({ jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'ok' }] } });
  });

  it('should not send progress without a progressToken', async () => {
    const { port } = await startServer(async (_p, ctx) => {
      ctx.progress(50, 100);
      return 'ok';
    });
    const res = await post(port, call(), sse);
    expect(res.events.map((e) => e.method ?? 'response')).toEqual(['response']);
  });

  it('should drop logs below the level set by logging/setLevel', async () => {
    const { port } = await startServer(async (_p, ctx) => {
      ctx.log('debug', 'hidden');
      ctx.log('warning', 'shown');
      return 'ok';
    });
    await post(port, { jsonrpc: '2.0', id: 1, method: 'logging/setLevel', params: { level: 'warning' } });
    const res = await post(port, call(), sse);
    expect(res.events.filter((e) => e.method === 'notifications/message').map((e) => e.params.data)).toEqual(['shown']);
  });

  it('should answer with plain JSON and discard notifications when the client does not accept SSE', async () => {
    const { port } = await startServer(async (_p, ctx) => {
      ctx.progress(1, 2);
      ctx.log('info', 'x');
      return 'ok';
    });
    const res = await post(port, call({ progressToken: 't' }), { Accept: 'application/json' });
    expect(res.contentType).toContain('application/json');
    expect(res.events).toEqual([{ jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'ok' }] } }]);
  });
});

describe('Streamable HTTP — elicitation round trip', () => {
  it('should send elicitation/create on the stream and resume when the client posts the response', async () => {
    const { port } = await startServer(async (_p, ctx) => {
      const r = await ctx.elicit!('Your name?', { name: { type: 'string', required: true } });
      return `${r.action}:${r.content?.name}`;
    });
    // 레거시 핸드셰이크로 elicitation 능력 선언
    await post(port, {
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: { elicitation: {} }, clientInfo: { name: 't', version: '0' } },
    });

    const res = await post(port, call(), sse, (event) => {
      if (event.method !== 'elicitation/create') return;
      expect(event.params).toEqual({
        message: 'Your name?',
        requestedSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      });
      // 클라이언트 응답은 별도 POST
      void post(port, { jsonrpc: '2.0', id: event.id, result: { action: 'accept', content: { name: 'Ada' } } });
    });

    expect(res.events.map((e) => e.method ?? 'response')).toEqual(['elicitation/create', 'response']);
    expect(res.events[1].result.content[0].text).toBe('accept:Ada');
  });

  it('should accept the client response POST with 202', async () => {
    const { port } = await startServer(async () => 'ok');
    const res = await post(port, { jsonrpc: '2.0', id: 'nope', result: {} });
    expect(res.status).toBe(202);
  });

  it('should leave ctx.elicit undefined when the client did not declare the capability', async () => {
    const { port } = await startServer(async (_p, ctx) => String(ctx.elicit === undefined));
    await post(port, {
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    });
    const res = await post(port, call(), sse);
    expect(res.events.at(-1).result.content[0].text).toBe('true');
  });
});

describe('createRequestContext without a channel', () => {
  it('should make progress/log no-ops and elicit undefined', () => {
    const ctx = createRequestContext('s', {});
    expect(() => ctx.progress(1)).not.toThrow();
    expect(() => ctx.log('info', 'x')).not.toThrow();
    expect(ctx.elicit).toBeUndefined();
  });

  it('should prefer an injected elicit over the channel', async () => {
    const outbound: AirOutbound = { notify: () => {}, request: async () => ({ action: 'decline' }) };
    const ctx = createRequestContext('s', {}, {
      outbound,
      elicit: async () => ({ action: 'accept', content: { v: 1 } }),
    });
    expect(await ctx.elicit!('m', {})).toEqual({ action: 'accept', content: { v: 1 } });
  });
});

describe('toElicitJsonSchema', () => {
  it('should convert the shorthand and keep default/enum', () => {
    expect(toElicitJsonSchema({
      name: { type: 'string', required: true, default: 'x' },
      status: { type: 'string', enum: ['a', 'b'] },
    })).toEqual({
      type: 'object',
      properties: { name: { type: 'string', default: 'x' }, status: { type: 'string', enum: ['a', 'b'] } },
      required: ['name'],
    });
  });

  it('should pass a full object schema through', () => {
    const schema = { type: 'object' as const, properties: { a: { type: 'array', items: { type: 'string' } } } };
    expect(toElicitJsonSchema(schema)).toBe(schema);
  });
});

describe('PendingRequests', () => {
  it('should resolve the matching request and ignore unknown ids', async () => {
    const pending = new PendingRequests({ prefix: 't' });
    const sent: any[] = [];
    const p = pending.send('elicitation/create', { message: 'm' }, (msg) => sent.push(msg));
    expect(sent).toEqual([{ jsonrpc: '2.0', id: 't-1', method: 'elicitation/create', params: { message: 'm' } }]);
    expect(pending.resolve({ id: 'other', result: {} })).toBe(false);
    expect(pending.resolve({ id: 't-1', result: { action: 'cancel' } })).toBe(true);
    await expect(p).resolves.toEqual({ action: 'cancel' });
    expect(pending.size).toBe(0);
  });

  it('should reject on an error response and on channel close', async () => {
    const pending = new PendingRequests({ prefix: 't' });
    const a = pending.send('a', undefined, () => {});
    const b = pending.send('b', undefined, () => {});
    pending.resolve({ id: 't-1', error: { code: -1, message: 'nope' } });
    await expect(a).rejects.toMatchObject({ message: 'nope', code: -1 });
    pending.rejectAll('closed');
    await expect(b).rejects.toThrow('closed (t-2)');
  });

  it('should reject when the write throws', async () => {
    const pending = new PendingRequests({ prefix: 't' });
    await expect(pending.send('x', undefined, () => { throw new Error('stream closed'); })).rejects.toThrow('stream closed');
    expect(pending.size).toBe(0);
  });

  it('isJsonRpcResponse should recognise responses only', () => {
    expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 1, result: {} })).toBe(true);
    expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 1, error: { code: 1, message: 'x' } })).toBe(true);
    expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 1, method: 'ping' })).toBe(false);
    expect(isJsonRpcResponse({ jsonrpc: '2.0', method: 'notifications/x' })).toBe(false);
    expect(isJsonRpcResponse(null)).toBe(false);
  });
});
