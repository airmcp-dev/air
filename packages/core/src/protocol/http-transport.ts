// @airmcp-dev/core — protocol/http-transport.ts
//
// air 자체 Streamable HTTP transport.
// MCP 2026-07-28 stateless 프로토콜을 구현한다.
// SDK의 StreamableHTTPServerTransport를 대체.
//
// 특징:
//   - Stateless: 세션 없음, 매 요청이 독립적
//   - Mcp-Method / Mcp-Name 헤더 지원
//   - MCP-Protocol-Version 헤더로 프로토콜 버전 전달
//   - 단순 요청은 JSON 응답, 스트리밍이 필요하면 SSE 응답
//   - 레거시 클라이언트(initialize)도 폴백 지원

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpProtocolEngine, JsonRpcRequest } from './mcp-protocol.js';
import { PROTOCOL_VERSIONS } from './mcp-protocol.js';

export interface AirHttpTransportOptions {
  /** MCP 엔드포인트 경로 (기본: '/mcp') */
  endpoint?: string;
  /** CORS origin (기본: '*') */
  corsOrigin?: string;
}

export class AirHttpTransport {
  private engine: McpProtocolEngine;
  private endpoint: string;
  private corsOrigin: string;

  constructor(engine: McpProtocolEngine, options?: AirHttpTransportOptions) {
    this.engine = engine;
    this.endpoint = options?.endpoint ?? '/mcp';
    this.corsOrigin = options?.corsOrigin ?? '*';
  }

  /**
   * HTTP 요청을 처리한다.
   * server-runner의 HTTP 서버에서 호출됨.
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', this.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Accept');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    // POST /mcp — MCP 메시지 처리
    if (req.method === 'POST' && url.pathname === this.endpoint) {
      await this.handlePost(req, res);
      return;
    }

    // GET /mcp — server/discover 단축
    if (req.method === 'GET' && url.pathname === this.endpoint) {
      const discoverResponse = await this.engine.handleMessage({
        jsonrpc: '2.0',
        method: 'server/discover',
        id: 'discover-' + Date.now(),
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': PROTOCOL_VERSIONS.MODERN,
      });
      res.end(JSON.stringify(discoverResponse));
      return;
    }

    // GET / — 서버 상태
    if (req.method === 'GET' && url.pathname === '/') {
      const discoverResponse = await this.engine.handleMessage({
        jsonrpc: '2.0',
        method: 'server/discover',
        id: 'status',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(discoverResponse.result || discoverResponse));
      return;
    }

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // DELETE — stateless이므로 405
    if (req.method === 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'DELETE not supported in stateless mode' }));
      return;
    }

    res.writeHead(404).end();
  }

  /** POST 요청 본문을 파싱하고 프로토콜 엔진에 전달한다. */
  private async handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 본문 읽기
    let body: any;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0', id: null,
        error: { code: -32700, message: 'Parse error: invalid JSON' },
      }));
      return;
    }

    // MCP 헤더 검증 (2026-07-28)
    const mcpVersion = req.headers['mcp-protocol-version'] as string | undefined;
    const mcpMethod = req.headers['mcp-method'] as string | undefined;

    // 프로토콜 버전 응답 헤더 설정
    const responseVersion = mcpVersion === PROTOCOL_VERSIONS.MODERN
      ? PROTOCOL_VERSIONS.MODERN
      : PROTOCOL_VERSIONS.LEGACY;

    // 배치 요청 처리
    if (Array.isArray(body)) {
      const responses = await Promise.all(
        body.map((msg: JsonRpcRequest) => this.engine.handleMessage(msg)),
      );
      const filtered = responses.filter(r => r.id !== null);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': responseVersion,
      });
      res.end(JSON.stringify(filtered));
      return;
    }

    // 단일 요청
    const message = body as JsonRpcRequest;

    // Mcp-Method 헤더 검증 (2026-07-28에서 필수)
    if (mcpVersion === PROTOCOL_VERSIONS.MODERN && mcpMethod && mcpMethod !== message.method) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': responseVersion,
      });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: {
          code: -32020,
          message: `Header mismatch: Mcp-Method "${mcpMethod}" != body method "${message.method}"`,
        },
      }));
      return;
    }

    // notification (id 없음)
    if (message.id === undefined) {
      await this.engine.handleMessage(message);
      res.writeHead(202).end();
      return;
    }

    // 일반 요청
    const response = await this.engine.handleMessage(message);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': responseVersion,
    });
    res.end(JSON.stringify(response));
  }
}
