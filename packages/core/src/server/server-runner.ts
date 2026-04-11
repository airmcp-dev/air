// @airmcp-dev/core — server/server-runner.ts
// MCP SDK 서버에 도구/리소스/프롬프트를 등록하고 transport를 연결하는 런타임

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AirToolDef } from '../types/tool.js';
import type { AirResourceDef } from '../types/resource.js';
import type { AirPromptDef } from '../types/prompt.js';
import type { AirConfig } from '../types/config.js';
import type { PluginContext } from '../types/plugin.js';
import { paramsToZodSchema } from '../tool/tool-schema.js';
import { MiddlewareChain } from '../middleware/chain.js';
import { createRequestContext } from '../context/request-context.js';
import { ServerContext } from '../context/server-context.js';
import { detectTransport } from '../transport/auto-detect.js';
import { createStdioTransport } from '../transport/stdio-adapter.js';
import { createHttpTransport } from '../transport/http-adapter.js';
import { onShutdown } from './lifecycle.js';

export class ServerRunner {
  private mcp: McpServer;
  private config: AirConfig;
  private serverCtx: ServerContext;
  private middlewareChain: MiddlewareChain;
  private tools: AirToolDef[] = [];
  private resources: AirResourceDef[] = [];
  private prompts: AirPromptDef[] = [];

  constructor(config: AirConfig, middlewareChain: MiddlewareChain) {
    this.config = config;
    this.middlewareChain = middlewareChain;
    this.serverCtx = new ServerContext(config.name, config.version || '0.1.0');
    this.mcp = new McpServer({
      name: config.name,
      version: config.version || '0.1.0',
    });
  }

  /** 도구 등록 — MCP SDK에 zod 스키마 + 핸들러 래퍼를 연결 */
  registerTool(tool: AirToolDef) {
    this.tools.push(tool);
    this.registerToolToServer(this.mcp, tool);
  }

  /** 리소스 등록 */
  registerResource(resource: AirResourceDef) {
    this.resources.push(resource);
    this.registerResourceToServer(this.mcp, resource);
  }

  /** 프롬프트 등록 */
  registerPrompt(prompt: AirPromptDef) {
    this.prompts.push(prompt);
    this.registerPromptToServer(this.mcp, prompt);
  }

  // ── 팩토리 메서드: 임의의 McpServer 인스턴스에 도구/리소스/프롬프트를 등록 ──

  /** 도구를 지정 McpServer에 등록 */
  private registerToolToServer(server: McpServer, tool: AirToolDef) {
    const zodSchema = paramsToZodSchema(tool.params);
    if (zodSchema) {
      server.tool(tool.name, tool.description || '', zodSchema.shape, async (params: any) => {
        const reqCtx = createRequestContext(this.config.name, this.serverCtx.state);
        const content = await this.middlewareChain.execute(tool, params || {}, reqCtx);
        return { content } as any;
      });
    } else {
      server.tool(tool.name, tool.description || '', async (params: any) => {
        const reqCtx = createRequestContext(this.config.name, this.serverCtx.state);
        const content = await this.middlewareChain.execute(tool, params || {}, reqCtx);
        return { content } as any;
      });
    }
  }

  /** 리소스를 지정 McpServer에 등록 */
  private registerResourceToServer(server: McpServer, resource: AirResourceDef) {
    const metadata: Record<string, any> = {};
    if (resource.description) metadata.description = resource.description;
    if (resource.mimeType) metadata.mimeType = resource.mimeType;

    const uri = String(resource.uri);

    try {
      server.resource(
        resource.name,
        uri,
        metadata,
        async (reqUri: URL) => {
          const ctx = { requestId: crypto.randomUUID(), serverName: this.config.name };
          const result = await resource.handler(reqUri.href, ctx);
          const content =
            typeof result === 'string'
              ? { uri: reqUri.href, text: result }
              : 'text' in result
                ? { uri: reqUri.href, text: result.text, mimeType: result.mimeType }
                : { uri: reqUri.href, blob: result.blob, mimeType: result.mimeType };
          return { contents: [content] };
        },
      );
    } catch (err: any) {
      console.error(`[air] Failed to register resource "${resource.name}" (uri: "${uri}"): ${err.message}\n${err.stack}`);
    }
  }

  /** 프롬프트를 지정 McpServer에 등록 */
  private registerPromptToServer(server: McpServer, prompt: AirPromptDef) {
    server.prompt(prompt.name, prompt.description || '', async (args: any) => {
      const messages = await prompt.handler(args || {});
      return {
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: { type: 'text' as const, text: m.content },
        })),
      };
    });
  }

  /** 모든 도구/리소스/프롬프트를 지정 McpServer에 일괄 등록 (SSE 세션용) */
  private registerAllToServer(server: McpServer) {
    for (const tool of this.tools) {
      this.registerToolToServer(server, tool);
    }
    for (const resource of this.resources) {
      this.registerResourceToServer(server, resource);
    }
    for (const prompt of this.prompts) {
      this.registerPromptToServer(server, prompt);
    }
  }

  /** 서버 시작 — transport 감지 + 연결 */
  async start() {
    this.serverCtx.status = 'starting';
    const transportType = detectTransport(this.config.transport);

    console.log(
      `[air] Starting "${this.config.name}" (${transportType} transport, ${this.tools.length} tools)`,
    );

    if (transportType === 'stdio') {
      const transport = createStdioTransport();
      onShutdown(async () => {
        this.serverCtx.status = 'stopping';
        await this.mcp.close();
        this.serverCtx.status = 'stopped';
      });
      await this.mcp.connect(transport);

    } else if (transportType === 'sse') {
      // ── SSE Transport ──
      // mcp-proxy 호환: GET /sse → SSE 스트림, POST /message → 메시지 수신
      await this.startSSE();

    } else if (transportType === 'http') {
      // ── Streamable HTTP Transport ──
      const { createServer } = await import('http');
      const httpTransport = createHttpTransport(this.config.transport);
      const port = this.config.transport?.port || this.config.dev?.port || 3100;

      const server = createServer(async (req, res) => {
        if (req.method === 'POST') {
          await httpTransport.handleRequest(req, res);
        } else if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.status()));
        } else if (req.method === 'DELETE') {
          await httpTransport.handleRequest(req, res);
        } else {
          res.writeHead(405).end();
        }
      });

      await this.mcp.connect(httpTransport);

      server.listen(port, () => {
        console.log(`[air] HTTP server listening on port ${port}`);
      });

      onShutdown(async () => {
        this.serverCtx.status = 'stopping';
        server.close();
        await this.mcp.close();
        this.serverCtx.status = 'stopped';
      });
    }

    this.serverCtx.status = 'running';
  }

  /** SSE transport 시작 — GET /sse + POST /message, 세션별 독립 McpServer */
  private async startSSE() {
    const { createServer } = await import('http');
    const port = this.config.transport?.port || this.config.dev?.port || 3100;
    const maxSessions = this.config.maxSseSessions ?? 200;

    // 세션별 SSE transport + McpServer를 관리
    const sessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      // CORS 헤더
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      // GET /sse — 새 세션 생성 + SSE 연결
      if (req.method === 'GET' && url.pathname === '/sse') {
        // 세션 수 상한 체크
        if (sessions.size >= maxSessions) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Max sessions reached (${maxSessions})` }));
          return;
        }

        const transport = new SSEServerTransport('/message', res);
        
        // 세션별 새 McpServer 인스턴스 생성
        const sessionServer = new McpServer({
          name: this.config.name,
          version: this.config.version || '0.1.0',
        });

        // 모든 도구/리소스/프롬프트를 세션 서버에 등록
        this.registerAllToServer(sessionServer);

        sessions.set(transport.sessionId, { transport, server: sessionServer });
        console.log(`[air] SSE client connected (session: ${transport.sessionId})`);

        transport.onclose = () => {
          sessions.delete(transport.sessionId);
          console.log(`[air] SSE client disconnected (session: ${transport.sessionId})`);
        };

        await sessionServer.connect(transport);
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

        const session = sessions.get(sessionId);
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        await session.transport.handlePostMessage(req, res);
        return;
      }

      // GET / — 상태 확인
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
      for (const session of sessions.values()) {
        await session.transport.close();
      }
      sessions.clear();
      httpServer.close();
      await this.mcp.close();
      this.serverCtx.status = 'stopped';
    });
  }

  /** 서버 중지 */
  async stop() {
    this.serverCtx.status = 'stopping';
    await this.mcp.close();
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
}
