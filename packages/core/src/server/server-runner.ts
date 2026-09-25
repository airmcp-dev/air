// @airmcp-dev/core — server/server-runner.ts
//
// air 자체 프로토콜 엔진 기반 서버 런타임.
// MCP SDK 의존 없이 MCP 2026-07-28 + 레거시(2025-11-25) 듀얼 프로토콜을 지원한다.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AirToolDef } from '../types/tool.js';
import type { AirResourceDef } from '../types/resource.js';
import type { AirPromptDef } from '../types/prompt.js';
import type { AirConfig } from '../types/config.js';
import { MiddlewareChain } from '../middleware/chain.js';
import { createRequestContext } from '../context/request-context.js';
import { ServerContext } from '../context/server-context.js';
import { detectTransport } from '../transport/auto-detect.js';
import { AirSSETransport, AirSSESessionManager } from '../transport/air-sse-transport.js';
import { McpProtocolEngine } from '../protocol/mcp-protocol.js';
import { AirStdioTransport } from '../protocol/stdio-transport.js';
import { AirHttpTransport } from '../protocol/http-transport.js';
import { onShutdown } from './lifecycle.js';

export class ServerRunner {
  private engine: McpProtocolEngine;
  private config: AirConfig;
  private serverCtx: ServerContext;
  private middlewareChain: MiddlewareChain;
  private tools: AirToolDef[] = [];
  private resources: AirResourceDef[] = [];
  private prompts: AirPromptDef[] = [];
  private stdioTransport: AirStdioTransport | null = null;

  constructor(config: AirConfig, middlewareChain: MiddlewareChain) {
    this.config = config;
    this.middlewareChain = middlewareChain;
    this.serverCtx = new ServerContext(config.name, config.version || '0.1.0');

    // 프로토콜 엔진 생성 — SDK 대체
    this.engine = new McpProtocolEngine({
      name: config.name,
      version: config.version || '0.1.0',
      tools: this.tools,
      resources: this.resources,
      prompts: this.prompts,
      callTool: async (toolName, params) => {
        const tool = this.tools.find(t => t.name === toolName);
        if (!tool) throw new Error(`Tool not found: ${toolName}`);
        const reqCtx = createRequestContext(this.config.name, this.serverCtx.state);
        return this.middlewareChain.execute(tool, params, reqCtx);
      },
    });
  }

  /** 도구 등록 */
  registerTool(tool: AirToolDef) {
    this.tools.push(tool);
  }

  /** 리소스 등록 */
  registerResource(resource: AirResourceDef) {
    this.resources.push(resource);
  }

  /** 프롬프트 등록 */
  registerPrompt(prompt: AirPromptDef) {
    this.prompts.push(prompt);
  }

  /** 서버 시작 — transport 감지 + 연결 */
  async start() {
    this.serverCtx.status = 'starting';
    const transportType = detectTransport(this.config.transport);

    // stdio 모드에서는 stdout이 MCP JSON-RPC 전용이므로
    // console.log를 stderr로 리다이렉트하여 프로토콜 오염 방지
    if (transportType === 'stdio') {
      console.log = (...args: any[]) => console.error(...args);
    }

    console.log(
      `[air] Starting "${this.config.name}" (${transportType} transport, ${this.tools.length} tools)`,
    );

    if (transportType === 'stdio') {
      await this.startStdio();
    } else if (transportType === 'sse') {
      await this.startSSE();
    } else if (transportType === 'http') {
      await this.startHTTP();
    } else if (transportType === 'workers') {
      console.log(`[air] Workers mode — use server.fetch(request) or export default server`);
    }

    this.serverCtx.status = 'running';
  }

  // ── stdio transport (자체 구현) ──

  private async startStdio() {
    this.stdioTransport = new AirStdioTransport(this.engine);
    await this.stdioTransport.start();

    onShutdown(async () => {
      this.serverCtx.status = 'stopping';
      this.stdioTransport?.stop();
      this.serverCtx.status = 'stopped';
    });
  }

  // ── Streamable HTTP transport (자체 구현, stateless) ──

  private async startHTTP() {
    const { createServer } = await import('http');
    const port = this.config.transport?.port || this.config.dev?.port || 3100;
    const httpTransport = new AirHttpTransport(this.engine, {
      endpoint: '/mcp',
    });

    const server = createServer(async (req, res) => {
      await httpTransport.handleRequest(req, res);
    });

    server.listen(port, () => {
      console.log(`[air] HTTP server listening on port ${port}`);
    });

    onShutdown(async () => {
      this.serverCtx.status = 'stopping';
      server.close();
      this.serverCtx.status = 'stopped';
    });
  }

  // ── SSE transport (자체 구현 AirSSETransport) ──

  private async startSSE() {
    const { createServer } = await import('http');
    const port = this.config.transport?.port || this.config.dev?.port || 3100;
    const maxSessions = this.config.maxSseSessions ?? 200;

    const sessionManager = new AirSSESessionManager({
      maxSessions,
      idleTimeoutMs: this.config.sseIdleTimeoutMs ?? 600_000,
      cleanupIntervalMs: 60_000,
    });

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      // CORS 헤더
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers',
        'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      // GET /sse — 새 세션 생성 + SSE 연결
      if (req.method === 'GET' && url.pathname === '/sse') {
        if (sessionManager.size >= maxSessions) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Max sessions reached (${maxSessions})` }));
          return;
        }

        const transport = new AirSSETransport(res, {
          endpoint: '/message',
          heartbeatIntervalMs: this.config.sseHeartbeatMs ?? 30_000,
          replayBufferSize: this.config.sseReplayBufferSize ?? 100,
          replayTtlMs: this.config.sseReplayTtlMs ?? 300_000,
        });

        if (!sessionManager.add(transport)) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Max sessions reached' }));
          return;
        }

        console.log(`[air] SSE client connected (session: ${transport.id})`);

        // onmessage: SSE로 받은 JSON-RPC를 프로토콜 엔진에 전달 → 응답을 SSE로 전송
        transport.onmessage = async (message: any) => {
          const response = await this.engine.handleMessage(message);
          // notification(id 없음)이 아닌 경우만 응답
          if (message.id !== undefined) {
            await transport.send(response);
          }
        };

        transport.onclose = () => {
          sessionManager.remove(transport.id);
          console.log(`[air] SSE client disconnected (session: ${transport.id})`);
        };

        const lastEventId = req.headers['last-event-id'] as string | undefined;
        await transport.start(lastEventId);
        return;
      }

      // POST /message?sessionId=xxx — 메시지 수신
      if (req.method === 'POST' && url.pathname === '/message') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sessionId' }));
          return;
        }

        const transport = sessionManager.get(sessionId);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        await transport.handlePostMessage(req, res);
        return;
      }

      // GET /health
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', sessions: sessionManager.size }));
        return;
      }

      // GET /
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.status()));
        return;
      }

      res.writeHead(404).end();
    });

    httpServer.listen(port, () => {
      console.log(`[air] SSE server listening on port ${port}`);
    });

    onShutdown(async () => {
      this.serverCtx.status = 'stopping';
      await sessionManager.closeAll();
      httpServer.close();
      this.serverCtx.status = 'stopped';
    });
  }

  /**
   * Workers fetch 핸들러 — 프로토콜 엔진 기반.
   * Workers adapter도 같은 엔진을 사용하므로 동작이 통일된다.
   */
  createFetchHandler(): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      const headers = { 'Content-Type': 'application/json' };

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
          },
        });
      }

      if (request.method !== 'POST') {
        // GET → server/discover
        const discoverRes = await this.engine.handleMessage({
          jsonrpc: '2.0', method: 'server/discover', id: 'discover',
        });
        return Response.json(discoverRes, { headers });
      }

      try {
        const body = await request.json() as any;
        const response = await this.engine.handleMessage(body);
        return Response.json(response, { headers });
      } catch {
        return Response.json(
          { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
          { status: 400, headers },
        );
      }
    };
  }

  /** 서버 중지 */
  async stop() {
    this.serverCtx.status = 'stopping';
    this.stdioTransport?.stop();
    this.serverCtx.status = 'stopped';
    console.log(`[air] "${this.config.name}" stopped`);
  }

  /** 서버 상태 반환 */
  status() {
    return {
      name: this.serverCtx.name,
      version: this.serverCtx.version,
      state: this.serverCtx.status,
      uptime: this.serverCtx.uptime,
      toolCount: this.tools.length,
      resourceCount: this.resources.length,
      transport: detectTransport(this.config.transport),
    };
  }

  /** 등록된 도구 목록 */
  getTools() {
    return [...this.tools];
  }

  /** 서버 컨텍스트 */
  getContext() {
    return this.serverCtx;
  }

  /** 프로토콜 엔진 접근 (테스트용) */
  getEngine(): McpProtocolEngine {
    return this.engine;
  }
}
