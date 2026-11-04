// @airmcp-dev/gateway — gateway/gateway.ts
//
// MCP 게이트웨이 프론트. 클라이언트에게는 하나의 Streamable HTTP MCP 서버로 보이고,
// 뒤에서는 등록된 하위 서버들로 요청을 라우팅한다.
//
//   - initialize / ping / logging/setLevel: 게이트웨이가 직접 응답
//   - tools/list · resources/list · prompts/list: 등록 시 발견(discover)한 목록을 집계해 응답
//   - tools/call: 도구 이름으로 라우팅(로드밸런싱) → 하위 서버로 전달.
//       클라이언트가 Accept: text/event-stream이면 하위 서버의 SSE 이벤트(progress/log/elicitation)를
//       클라이언트 스트림으로 그대로 흘린다. 서버발 요청의 id는 게이트웨이 id로 바꿔 매핑해 두고,
//       클라이언트가 POST로 보낸 JSON-RPC 응답을 원래 하위 서버로 되돌린다.
//   - resources/read · prompts/get · resources/templates/list 등: 해당 항목을 가진 서버로 전달
//
// 하위 서버는 Streamable HTTP(air `http` transport)만 지원한다.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { checkOrigin, isJsonRpcResponse, PROTOCOL_VERSIONS, ErrorCodes } from '@airmcp-dev/core';
import type { GatewayConfig, HttpConnection, ServerConnection, ServerEntry, ToolEntry, BalancerStrategy } from '../types.js';
import { ServerRegistry } from '../registry/server-registry.js';
import { ToolIndex } from '../registry/tool-index.js';
import { HealthChecker } from '../registry/health-checker.js';
import { RequestRouter } from '../router/request-router.js';
import { LoadBalancer } from '../router/load-balancer.js';
import { UpstreamClient, type JsonRpcResponse } from './upstream.js';
import { GatewayRequestIds } from './request-id.js';

export interface GatewayServerRegistration {
  id: string;
  name: string;
  transport?: 'http' | 'sse' | 'stdio';
  connection: ServerConnection;
  /** weighted 전략용 가중치 */
  weight?: number;
}

export interface GatewayOptions extends GatewayConfig {
  /** 바인딩 호스트 (기본: 127.0.0.1) */
  host?: string;
  /** MCP 엔드포인트 경로 (기본: '/mcp') */
  endpoint?: string;
  /** 루프백 외에 허용할 브라우저 Origin. '*'는 전부 */
  allowedOrigins?: string[];
  /** start() 시 하위 서버 목록을 발견할지 (기본: true) */
  discoverOnStart?: boolean;
  /**
   * 서버발 요청 id 서명 키. 게이트웨이를 여러 대 띄우면 같은 값을 주어야
   * 한 인스턴스가 만든 elicitation id에 대한 클라이언트 응답을 다른 인스턴스가 처리할 수 있다.
   * 없으면 프로세스마다 임의 키 (단일 인스턴스용).
   */
  secret?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class Gateway {
  readonly registry = new ServerRegistry();
  readonly toolIndex = new ToolIndex();
  readonly router: RequestRouter;
  readonly balancer: LoadBalancer;
  readonly healthChecker: HealthChecker;

  private readonly config: Required<Pick<GatewayConfig, 'name' | 'port' | 'healthCheckInterval' | 'balancer' | 'requestTimeout'>> &
    Required<Pick<GatewayOptions, 'host' | 'endpoint' | 'discoverOnStart'>> &
    Pick<GatewayOptions, 'allowedOrigins'>;
  private upstreams = new Map<string, UpstreamClient>();
  /** 발견한 리소스·프롬프트 → 제공 서버 id */
  private resourceOwners = new Map<string, string[]>();
  private promptOwners = new Map<string, string[]>();
  private resourceTemplateOwners = new Map<string, string[]>();
  private discovered = new Map<string, { resources: any[]; prompts: any[]; resourceTemplates: any[] }>();
  /** 서버발 요청 id ↔ 게이트웨이 id (stateless, HMAC) */
  private readonly ids: GatewayRequestIds;
  private server: Server | null = null;
  /** initialize에서 받은 클라이언트 능력 — 하위 서버에 _meta로 전달 */
  private clientCapabilities: Record<string, any> = {};
  private logLevel: string | undefined;

  constructor(options: GatewayOptions = {}) {
    this.config = {
      name: options.name ?? 'air-gateway',
      port: options.port ?? 4000,
      host: options.host ?? '127.0.0.1',
      endpoint: options.endpoint ?? '/mcp',
      healthCheckInterval: options.healthCheckInterval ?? 15_000,
      balancer: options.balancer ?? 'round-robin',
      requestTimeout: options.requestTimeout ?? 30_000,
      allowedOrigins: options.allowedOrigins,
      discoverOnStart: options.discoverOnStart ?? true,
    };
    this.ids = new GatewayRequestIds(options.secret);
    this.balancer = new LoadBalancer(this.config.balancer as BalancerStrategy);
    this.router = new RequestRouter(this.registry, this.toolIndex, this.balancer);
    this.healthChecker = new HealthChecker(this.registry, this.config.healthCheckInterval);
  }

  // ── 등록 ──

  /** 하위 서버를 등록한다. Streamable HTTP(http) 연결만 지원. */
  register(entry: GatewayServerRegistration): ServerEntry {
    if (entry.connection.type !== 'http') {
      throw new Error(
        `[Gateway] server "${entry.id}": only Streamable HTTP upstreams are supported ` +
        `(got "${entry.connection.type}"). Run the server with transport: { type: 'http' }.`,
      );
    }
    const server = this.registry.register(entry.id, entry.name, entry.connection);
    server.status = 'connected';
    this.upstreams.set(entry.id, new UpstreamClient(entry.connection as HttpConnection));
    if (entry.weight !== undefined) this.balancer.setWeight(entry.id, entry.weight);
    return server;
  }

  /** 하위 서버를 제거한다. */
  unregister(id: string): void {
    this.toolIndex.removeServer(id);
    this.registry.unregister(id);
    this.upstreams.delete(id);
    this.discovered.delete(id);
    this.rebuildOwners();
  }

  /** 하위 서버의 tools/resources/prompts를 (다시) 발견한다. id를 주면 그 서버만. */
  async discover(id?: string): Promise<void> {
    const ids = id ? [id] : [...this.upstreams.keys()];
    await Promise.all(ids.map(async (serverId) => {
      const upstream = this.upstreams.get(serverId);
      const server = this.registry.get(serverId);
      if (!upstream || !server) return;
      const found = await upstream.discover();
      const tools: ToolEntry[] = found.tools.map((t) => ({
        name: t.name,
        description: t.description,
        serverId,
        inputSchema: t.inputSchema,
        // outputSchema/annotations/title 등은 그대로 보존해 tools/list에 실어 보낸다
        ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
        ...(t.annotations ? { annotations: t.annotations } : {}),
        ...(t.title ? { title: t.title } : {}),
      } as ToolEntry));
      this.registry.updateTools(serverId, tools);
      this.toolIndex.reindex(server);
      let resourceTemplates: any[] = [];
      try {
        const res = await upstream.call('resources/templates/list', {}, { timeoutMs: 10_000 });
        resourceTemplates = Array.isArray(res.result?.resourceTemplates) ? res.result.resourceTemplates : [];
      } catch { /* 미지원 */ }
      this.discovered.set(serverId, { resources: found.resources, prompts: found.prompts, resourceTemplates });
    }));
    this.rebuildOwners();
  }

  private rebuildOwners(): void {
    this.resourceOwners.clear();
    this.promptOwners.clear();
    this.resourceTemplateOwners.clear();
    for (const [serverId, d] of this.discovered) {
      for (const r of d.resources) this.addOwner(this.resourceOwners, r.uri, serverId);
      for (const p of d.prompts) this.addOwner(this.promptOwners, p.name, serverId);
      for (const t of d.resourceTemplates) this.addOwner(this.resourceTemplateOwners, t.uriTemplate, serverId);
    }
  }

  private addOwner(map: Map<string, string[]>, key: string, serverId: string): void {
    const list = map.get(key) ?? [];
    if (!list.includes(serverId)) list.push(serverId);
    map.set(key, list);
  }

  // ── 수명주기 ──

  async start(): Promise<void> {
    if (this.config.discoverOnStart) await this.discover();
    this.healthChecker.start();
    await new Promise<void>((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          if (!res.headersSent) {
            res.writeHead(500, JSON_HEADERS);
            res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(err?.message ?? err) } }));
          } else {
            res.end();
          }
        });
      });
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server!.off('error', reject);
        console.log(`[air:gateway] ${this.config.name} listening on http://${this.config.host}:${this.port}${this.config.endpoint}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.healthChecker.stop();
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
  }

  /** 실제 리슨 포트 (port: 0으로 띄웠을 때 유용) */
  get port(): number {
    const addr = this.server?.address();
    return typeof addr === 'object' && addr ? addr.port : this.config.port;
  }

  status() {
    return {
      name: this.config.name,
      servers: this.registry.size,
      tools: this.toolIndex.size,
      health: this.healthChecker.getAllResults(),
    };
  }

  // ── HTTP 처리 ──

  /** 외부 http 서버에 끼워 쓸 수 있도록 공개 */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!checkOrigin(req, res, this.config.allowedOrigins)) return;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Accept');

    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok', ...this.status() }));
      return;
    }

    if (req.method === 'POST' && url.pathname === this.config.endpoint) {
      await this.handlePost(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === this.config.endpoint) {
      res.writeHead(405, { ...JSON_HEADERS, Allow: 'POST, OPTIONS' });
      res.end(JSON.stringify({ error: 'GET not supported on the gateway endpoint' }));
      return;
    }

    res.writeHead(404).end();
  }

  private async handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: any;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } }));
      return;
    }

    const protocolVersion = (req.headers['mcp-protocol-version'] as string | undefined) ?? PROTOCOL_VERSIONS.LEGACY;

    // 클라이언트 → 하위 서버로 되돌릴 JSON-RPC 응답 (elicitation 등의 답)
    if (isJsonRpcResponse(body)) {
      await this.forwardClientResponse(body);
      res.writeHead(202).end();
      return;
    }

    if (Array.isArray(body)) {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported by the gateway' } }));
      return;
    }

    const { id, method, params } = body;

    // notification
    if (id === undefined) {
      if (method === 'notifications/initialized') { /* no-op */ }
      res.writeHead(202).end();
      return;
    }

    // tools/call은 스트리밍 가능
    if (method === 'tools/call') {
      await this.handleToolsCall(req, res, body, protocolVersion);
      return;
    }

    let response: JsonRpcResponse;
    try {
      const result = await this.handleSimple(method, params ?? {}, protocolVersion);
      response = { jsonrpc: '2.0', id, result };
    } catch (err: any) {
      response = { jsonrpc: '2.0', id, error: { code: err?.code ?? -32603, message: err?.message ?? String(err), ...(err?.data ? { data: err.data } : {}) } };
    }
    res.writeHead(200, { ...JSON_HEADERS, 'MCP-Protocol-Version': protocolVersion });
    res.end(JSON.stringify(response));
  }

  /** tools/call 외의 메서드 */
  private async handleSimple(method: string, params: Record<string, any>, protocolVersion: string): Promise<any> {
    switch (method) {
      case 'initialize': {
        this.clientCapabilities = params.capabilities ?? {};
        return {
          protocolVersion: PROTOCOL_VERSIONS.LEGACY,
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: true },
            prompts: { listChanged: true },
            logging: {},
          },
          serverInfo: { name: this.config.name, version: '0.1.0' },
        };
      }
      case 'ping':
        return {};
      case 'logging/setLevel': {
        this.logLevel = params.level;
        await Promise.all([...this.upstreams.values()].map((u) => u.call('logging/setLevel', params, { timeoutMs: 5_000 }).catch(() => {})));
        return {};
      }
      case 'tools/list':
        return { tools: this.aggregateTools() };
      case 'resources/list':
        return { resources: this.aggregate('resources', (d) => d.resources) };
      case 'resources/templates/list':
        return { resourceTemplates: this.aggregate('resourceTemplates', (d) => d.resourceTemplates) };
      case 'prompts/list':
        return { prompts: this.aggregate('prompts', (d) => d.prompts) };
      case 'resources/read':
        return this.forwardToOwner(this.resourceOwners, params.uri, method, params, protocolVersion, (uri) => this.matchTemplateOwner(uri));
      case 'resources/subscribe':
      case 'resources/unsubscribe':
        return this.forwardToOwner(this.resourceOwners, params.uri, method, params, protocolVersion, (uri) => this.matchTemplateOwner(uri));
      case 'prompts/get':
        return this.forwardToOwner(this.promptOwners, params.name, method, params, protocolVersion);
      case 'completion/complete': {
        // ref에 따라 소유 서버로; 없으면 빈 결과
        const ref = params.ref ?? {};
        const owners = ref.type === 'ref/prompt' ? this.promptOwners.get(ref.name) : ref.type === 'ref/resource' ? this.resourceOwners.get(ref.uri) : undefined;
        if (!owners?.length) return { completion: { values: [], hasMore: false, total: 0 } };
        return this.callUpstream(owners[0], method, params, protocolVersion);
      }
      default:
        throw Object.assign(new Error(`Method not found: ${method}`), { code: ErrorCodes.METHOD_NOT_FOUND });
    }
  }

  private aggregateTools(): any[] {
    const seen = new Map<string, any>();
    for (const server of this.registry.listByStatus('connected')) {
      for (const t of server.tools) {
        if (seen.has(t.name)) continue; // 같은 이름 = 복제본(로드밸런싱 대상)
        const { serverId: _serverId, ...tool } = t as any;
        seen.set(t.name, { ...tool, inputSchema: tool.inputSchema ?? { type: 'object', properties: {} } });
      }
    }
    return [...seen.values()];
  }

  private aggregate(kind: 'resources' | 'prompts' | 'resourceTemplates', pick: (d: { resources: any[]; prompts: any[]; resourceTemplates: any[] }) => any[]): any[] {
    const key = kind === 'resources' ? 'uri' : kind === 'prompts' ? 'name' : 'uriTemplate';
    const seen = new Map<string, any>();
    for (const server of this.registry.listByStatus('connected')) {
      const d = this.discovered.get(server.id);
      if (!d) continue;
      for (const item of pick(d)) if (!seen.has(item[key])) seen.set(item[key], item);
    }
    return [...seen.values()];
  }

  private matchTemplateOwner(uri: string): string[] {
    for (const [template, owners] of this.resourceTemplateOwners) {
      const pattern = '^' + template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '$';
      if (new RegExp(pattern).test(uri)) return owners;
    }
    return [];
  }

  private async forwardToOwner(
    owners: Map<string, string[]>,
    key: string,
    method: string,
    params: Record<string, any>,
    protocolVersion: string,
    fallback?: (key: string) => string[],
  ): Promise<any> {
    let candidates = (owners.get(key) ?? []).filter((id) => this.registry.get(id)?.status === 'connected');
    if (candidates.length === 0 && fallback) candidates = fallback(key).filter((id) => this.registry.get(id)?.status === 'connected');
    if (candidates.length === 0) {
      throw Object.assign(new Error(`No server provides "${key}"`), { code: ErrorCodes.INVALID_PARAMS });
    }
    return this.callUpstream(candidates[0], method, params, protocolVersion);
  }

  private async callUpstream(serverId: string, method: string, params: Record<string, any>, protocolVersion: string): Promise<any> {
    const upstream = this.upstreams.get(serverId);
    if (!upstream) throw Object.assign(new Error(`Unknown server ${serverId}`), { code: -32603 });
    const res = await upstream.call(method, params, { timeoutMs: this.config.requestTimeout, protocolVersion });
    if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code, data: res.error.data });
    return res.result;
  }

  // ── tools/call ──

  private async handleToolsCall(req: IncomingMessage, res: ServerResponse, body: any, protocolVersion: string): Promise<void> {
    const { id, params = {} } = body;
    const toolName = params.name;
    const fail = (status: number, code: number, message: string) => {
      res.writeHead(status, { ...JSON_HEADERS, 'MCP-Protocol-Version': protocolVersion });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
    };
    if (!toolName) return fail(200, ErrorCodes.INVALID_PARAMS, 'Missing required param: name');

    let server: ServerEntry;
    try {
      ({ server } = this.router.route({ toolName, params: params.arguments ?? {} }));
    } catch (err: any) {
      return fail(200, ErrorCodes.METHOD_NOT_FOUND, err?.message ?? String(err));
    }
    const upstream = this.upstreams.get(server.id)!;

    // 클라이언트 능력을 _meta로 전달해 하위 서버가 elicitation 가능 여부를 알게 한다
    const forwardedParams = {
      ...params,
      _meta: {
        ...(params._meta ?? {}),
        'io.modelcontextprotocol/clientCapabilities': this.clientCapabilities,
      },
    };

    const clientAcceptsSse = String(req.headers.accept ?? '').includes('text/event-stream');

    // 요청 취소(클라이언트 연결 끊김) → 하위 호출도 중단
    const abort = new AbortController();
    req.on('close', () => { if (!res.writableEnded) abort.abort(new Error('client disconnected')); });

    if (!clientAcceptsSse) {
      // JSON 모드: 하위 서버도 JSON으로 → 알림/서버발 요청 없음
      let response: JsonRpcResponse;
      try {
        const up = await upstream.call('tools/call', forwardedParams, { timeoutMs: this.config.requestTimeout, protocolVersion, signal: abort.signal });
        response = { jsonrpc: '2.0', id, ...(up.error ? { error: up.error } : { result: up.result }) };
      } catch (err: any) {
        response = { jsonrpc: '2.0', id, error: { code: err?.code ?? -32603, message: err?.message ?? String(err) } };
      }
      if (res.writableEnded) return;
      res.writeHead(200, { ...JSON_HEADERS, 'MCP-Protocol-Version': protocolVersion });
      res.end(JSON.stringify(response));
      return;
    }

    // SSE 모드: 하위 스트림을 클라이언트 스트림으로
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'MCP-Protocol-Version': protocolVersion,
    });
    res.flushHeaders?.();
    const write = (message: any) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
    };

    let response: JsonRpcResponse;
    try {
      const up = await upstream.call('tools/call', forwardedParams, {
        stream: true,
        timeoutMs: this.config.requestTimeout,
        protocolVersion,
        signal: abort.signal,
        onEvent: (message) => {
          if (message && typeof message === 'object' && 'method' in message && message.id !== undefined) {
            // 하위 서버발 요청 → 백엔드와 원래 id를 담은 서명된 게이트웨이 id로 (저장소 없음)
            write({ ...message, id: this.ids.encode(server.id, message.id) });
            return;
          }
          // 알림은 그대로
          write(message);
        },
      });
      response = { jsonrpc: '2.0', id, ...(up.error ? { error: up.error } : { result: up.result }) };
    } catch (err: any) {
      response = { jsonrpc: '2.0', id, error: { code: err?.code ?? -32603, message: err?.message ?? String(err) } };
    }
    write(response);
    res.end();
  }

  /**
   * 클라이언트가 보낸 JSON-RPC 응답을 원래 하위 서버로 되돌린다.
   * id에 백엔드와 원래 id가 서명돼 들어 있으므로 어느 게이트웨이 인스턴스든 처리할 수 있다.
   * 서명이 맞지 않거나 모르는 백엔드면 무시한다 (202로 받되 전달하지 않음).
   */
  private async forwardClientResponse(message: { id: string | number; result?: any; error?: any }): Promise<void> {
    const decoded = this.ids.decode(message.id);
    if (!decoded) return;
    const upstream = this.upstreams.get(decoded.backendId);
    if (!upstream) return;
    await upstream.reply({
      id: decoded.upstreamId,
      ...(message.error ? { error: message.error } : { result: message.result }),
    });
  }
}
