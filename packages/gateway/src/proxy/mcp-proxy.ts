// @airmcp-dev/gateway — proxy/mcp-proxy.ts
//
// MCP 리버스 프록시.
// 클라이언트의 도구 호출을 받아서 적절한 하위 서버로 전달하고 결과를 반환.
// ServerRegistry + ToolIndex + RequestRouter + SessionPool을 조합.

import type { GatewayConfig, ServerConnection, HttpConnection, ToolEntry } from '../types.js';
import { ServerRegistry } from '../registry/server-registry.js';
import { ToolIndex } from '../registry/tool-index.js';
import { HealthChecker } from '../registry/health-checker.js';
import { RequestRouter } from '../router/request-router.js';
import { LoadBalancer } from '../router/load-balancer.js';
import { SessionPool } from './session-pool.js';
import { buildToolCallRequest, extractResult } from './protocol-adapter.js';

export class McpProxy {
  readonly registry: ServerRegistry;
  readonly toolIndex: ToolIndex;
  readonly router: RequestRouter;
  readonly healthChecker: HealthChecker;
  private sessionPool: SessionPool;
  private config: Required<GatewayConfig>;

  constructor(config: GatewayConfig = {}) {
    this.config = {
      name: config.name || 'air-gateway',
      port: config.port || 4000,
      healthCheckInterval: config.healthCheckInterval || 30_000,
      balancer: config.balancer || 'round-robin',
      requestTimeout: config.requestTimeout || 30_000,
    };

    this.registry = new ServerRegistry();
    this.toolIndex = new ToolIndex();
    const balancer = new LoadBalancer(this.config.balancer);
    this.router = new RequestRouter(this.registry, this.toolIndex, balancer);
    this.healthChecker = new HealthChecker(this.registry, this.config.healthCheckInterval);
    this.sessionPool = new SessionPool();
  }

  /**
   * 하위 MCP 서버를 등록한다.
   */
  addServer(id: string, name: string, connection: ServerConnection): void {
    const entry = this.registry.register(id, name, connection);
    entry.status = 'connected'; // 초기 상태
  }

  /**
   * 서버를 제거한다.
   */
  removeServer(id: string): void {
    this.toolIndex.removeServer(id);
    this.sessionPool.destroyByServer(id);
    this.registry.unregister(id);
  }

  /**
   * 서버의 도구를 발견하고 인덱싱한다.
   */
  registerTools(
    serverId: string,
    tools: Array<{ name: string; description?: string; inputSchema?: any }>,
  ): void {
    const toolEntries: ToolEntry[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      serverId,
      inputSchema: t.inputSchema,
    }));

    this.registry.updateTools(serverId, toolEntries);
    const server = this.registry.get(serverId);
    if (server) {
      this.toolIndex.reindex(server);
    }
  }

  /**
   * 도구를 호출한다 (프록시 핵심).
   */
  async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    // 라우팅
    const { server, tool } = this.router.route({ toolName, params });

    // 세션 획득
    const session = this.sessionPool.acquire(server);

    try {
      // JSON-RPC 요청 구성
      const request = buildToolCallRequest(toolName, params);

      // transport에 따라 실행 (여기서는 HTTP 예시)
      if (server.connection.type === 'http' || server.connection.type === 'sse') {
        const conn = server.connection as HttpConnection;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);

        try {
          const res = await fetch(conn.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.jsonrpc),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const response = await res.json();
          return extractResult(response);
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      }

      // stdio 서버는 Gateway 프록시 미지원 — SSE/HTTP 사용 권장
      throw new Error(
        `[Gateway] stdio proxy is not supported. Server "${server.id}" uses stdio transport. ` +
        `Please configure the server with SSE or HTTP transport instead. ` +
        `Example: transport: { type: 'sse', port: 3510 }`
      );
    } finally {
      this.sessionPool.release(session.id);
    }
  }

  /**
   * Gateway를 시작한다.
   */
  async start(): Promise<void> {
    this.healthChecker.start();
  }

  /**
   * Gateway를 중지한다.
   */
  async stop(): Promise<void> {
    this.healthChecker.stop();
  }

  /**
   * 현재 상태를 반환한다.
   */
  status() {
    return {
      name: this.config.name,
      servers: this.registry.size,
      tools: this.toolIndex.size,
      sessions: this.sessionPool.size,
      health: this.healthChecker.getAllResults(),
    };
  }
}
