// @airmcp-dev/gateway — gateway/upstream.ts
//
// 하위(upstream) MCP 서버와의 통신.
//   - call(): JSON-RPC 요청 하나를 보내고 응답을 받는다. stream 옵션이면 Accept: text/event-stream으로
//     보내고, 서버가 SSE로 답하면 이벤트(알림·서버발 요청)를 onEvent로 흘린 뒤 최종 응답을 돌려준다.
//   - reply(): 서버발 요청(elicitation 등)에 대한 클라이언트의 JSON-RPC 응답을 그대로 전달한다.
//   - discover(): tools/resources/prompts 목록을 한 번에 가져온다.
// Streamable HTTP 서버(air http transport 등)만 지원한다. 레거시 SSE/stdio 서버는 아직 미지원.

import type { HttpConnection } from '../types.js';
import { readSseStream } from './sse.js';

export interface UpstreamCallOptions {
  /** true면 Accept에 text/event-stream을 포함해 스트리밍 응답을 허용한다 */
  stream?: boolean;
  /** 스트림 중간 메시지(JSON-RPC 알림·요청). 최종 응답은 여기로 오지 않는다 */
  onEvent?: (message: any) => void | Promise<void>;
  /** 요청 타임아웃 (ms). 스트리밍이면 "첫 바이트까지"가 아니라 전체 시간 */
  timeoutMs?: number;
  /** 전달할 MCP-Protocol-Version 헤더 */
  protocolVersion?: string;
  signal?: AbortSignal;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface UpstreamDiscovery {
  tools: Array<{ name: string; description?: string; inputSchema?: any; [k: string]: any }>;
  resources: Array<{ uri: string; name?: string; [k: string]: any }>;
  prompts: Array<{ name: string; description?: string; arguments?: any[]; [k: string]: any }>;
}

let seq = 0;

export class UpstreamClient {
  constructor(private readonly connection: HttpConnection) {}

  get url(): string {
    return this.connection.url;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.connection.headers ?? {}),
      ...extra,
    };
  }

  /** JSON-RPC 요청 하나를 보낸다. 응답이 SSE면 이벤트를 흘리고 최종 응답을 돌려준다. */
  async call(
    method: string,
    params: Record<string, any> | undefined,
    options: UpstreamCallOptions = {},
  ): Promise<JsonRpcResponse> {
    const id = `up-${++seq}`;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const timer = setTimeout(() => controller.abort(new Error(`Upstream timeout after ${timeoutMs}ms (${method})`)), timeoutMs);
    const onOuterAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onOuterAbort, { once: true });

    try {
      const res = await fetch(this.connection.url, {
        method: 'POST',
        headers: this.headers({
          Accept: options.stream ? 'application/json, text/event-stream' : 'application/json',
          ...(options.protocolVersion ? { 'MCP-Protocol-Version': options.protocolVersion } : {}),
        }),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw Object.assign(new Error(`Upstream ${this.connection.url} answered ${res.status}: ${text.slice(0, 200)}`), {
          code: -32000,
          status: res.status,
        });
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const json = (await res.json()) as JsonRpcResponse;
        return json;
      }

      // SSE: 알림/서버발 요청은 onEvent로, id가 우리 요청 id인 응답은 최종 결과
      let final: JsonRpcResponse | undefined;
      if (!res.body) throw new Error('Upstream SSE response has no body');
      await readSseStream(
        res.body,
        async (event) => {
          let message: any;
          try { message = JSON.parse(event.data); } catch { return; }
          if (message && !('method' in message) && message.id === id) {
            final = message;
            return;
          }
          await options.onEvent?.(message);
        },
        controller.signal,
      );
      if (!final) throw new Error(`Upstream SSE stream ended without a response to ${method}`);
      return final;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onOuterAbort);
    }
  }

  /** 서버발 요청에 대한 클라이언트 응답을 그대로 전달한다 (JSON-RPC response → 202 기대). */
  async reply(response: { id: string | number; result?: any; error?: any }): Promise<void> {
    const res = await fetch(this.connection.url, {
      method: 'POST',
      headers: this.headers({ Accept: 'application/json' }),
      body: JSON.stringify({ jsonrpc: '2.0', ...response }),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`Upstream ${this.connection.url} rejected the client response: ${res.status}`);
    }
  }

  /** 알림(응답 없음)을 전달한다. */
  async notify(method: string, params?: Record<string, any>): Promise<void> {
    await fetch(this.connection.url, {
      method: 'POST',
      headers: this.headers({ Accept: 'application/json' }),
      body: JSON.stringify({ jsonrpc: '2.0', method, ...(params ? { params } : {}) }),
    }).catch(() => {});
  }

  /** tools/resources/prompts 목록을 가져온다. 지원하지 않는 메서드는 빈 배열. */
  async discover(timeoutMs = 10_000): Promise<UpstreamDiscovery> {
    const list = async (method: string, key: string) => {
      try {
        const res = await this.call(method, {}, { timeoutMs });
        return Array.isArray(res.result?.[key]) ? res.result[key] : [];
      } catch {
        return [];
      }
    };
    const [tools, resources, prompts] = await Promise.all([
      list('tools/list', 'tools'),
      list('resources/list', 'resources'),
      list('prompts/list', 'prompts'),
    ]);
    return { tools, resources, prompts };
  }
}
