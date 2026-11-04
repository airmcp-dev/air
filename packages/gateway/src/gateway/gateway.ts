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
  /**
   * 백엔드 자기 등록(push registration). 백엔드가 `POST /registry`로 자신을 알리고 주기적으로 하트비트를 보낸다.
   * air 서버는 `gateway: { url, token }` 설정으로 자동 등록한다.
   */
  registration?: {
    /** 요청의 Authorization: Bearer <token>과 비교. 없으면 인증 없음 (루프백/내부망 전제) */
    token?: string;
    /** 이 시간(ms) 동안 하트비트가 없으면 제거 (기본: 30초) */
    staleAfterMs?: number;
    /** false면 /registry를 열지 않는다 (기본: true) */
    enabled?: boolean;
  };
  /**
   * 다른 게이트웨이 인스턴스 목록. 주기적으로 서로의 백엔드 목록을 교환해(gossip) 어느 한 곳에 등록된 백엔드를
   * 전부가 알게 된다. 인증은 registration.token을 그대로 쓴다. 피어가 꺼져 있어도 동작엔 영향 없다.
   */
  peers?: string[];
  /** 피어 동기화 주기 ms (기본: 5000) */
  peerSyncMs?: number;
}

/** GET /peers/state 응답의 백엔드 항목 */
export interface PeerBackendState {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  weight?: number;
  status: string;
  tools: ToolEntry[];
  resources: any[];
  prompts: any[];
  resourceTemplates: any[];
}

/** POST /registry 본문 */
export interface RegistrationPayload {
  id: string;
  name: string;
  /** 백엔드의 Streamable HTTP 엔드포인트 (예: http://10.0.0.5:3510/mcp) */
  url: string;
  weight?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
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
  /** 자기 등록한 백엔드의 마지막 하트비트 시각 */
  private lastSeen = new Map<string, number>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private readonly registration: { enabled: boolean; token?: string; staleAfterMs: number };
  private readonly peers: string[];
  private readonly peerSyncMs: number;
  private peerTimer: ReturnType<typeof setInterval> | null = null;
  private peerState = new Map<string, 'up' | 'down'>();
  /** 피어에게서 배운 백엔드의 마지막 확인 시각 */
  private peerSeen = new Map<string, number>();
  private weights = new Map<string, number>();
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
    this.registration = {
      enabled: options.registration?.enabled ?? true,
      token: options.registration?.token,
      staleAfterMs: options.registration?.staleAfterMs ?? 30_000,
    };
    this.peers = (options.peers ?? []).map((u) => u.replace(/\/+$/, ''));
    this.peerSyncMs = options.peerSyncMs ?? 5_000;
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
    if (entry.weight !== undefined) { this.balancer.setWeight(entry.id, entry.weight); this.weights.set(entry.id, entry.weight); }
    return server;
  }

  /** 하위 서버를 제거한다. */
  unregister(id: string): void {
    this.toolIndex.removeServer(id);
    this.registry.unregister(id);
    this.upstreams.delete(id);
    this.discovered.delete(id);
    this.lastSeen.delete(id);
    this.peerSeen.delete(id);
    this.weights.delete(id);
    this.rebuildOwners();
  }

  // ── 피어링 (gossip) ──

  /** 이 인스턴스가 직접 아는 백엔드(정적·자기 등록)만 내보낸다. 피어에게 배운 것은 재전파하지 않는다 (루프 방지) */
  peerStateSnapshot(): PeerBackendState[] {
    return this.registry.listAll()
      .filter((s) => s.metadata?.origin !== 'peer')
      .map((s) => {
        const conn = s.connection as HttpConnection;
        const d = this.discovered.get(s.id) ?? { resources: [], prompts: [], resourceTemplates: [] };
        return {
          id: s.id, name: s.name, url: conn.url, ...(conn.headers ? { headers: conn.headers } : {}),
          ...(this.weights.has(s.id) ? { weight: this.weights.get(s.id) } : {}),
          status: s.status, tools: s.tools, resources: d.resources, prompts: d.prompts, resourceTemplates: d.resourceTemplates,
        };
      });
  }

  /** 피어 하나의 상태를 받아 모르는 백엔드를 흡수한다. */
  mergePeerState(backends: PeerBackendState[]): void {
    const now = Date.now();
    for (const b of backends) {
      const existing = this.registry.get(b.id);
      if (existing && existing.metadata?.origin !== 'peer') continue; // 직접 아는 것이 우선
      const conn = existing?.connection as HttpConnection | undefined;
      if (!existing || conn?.url !== b.url) {
        if (existing) this.unregister(b.id);
        const entry = this.register({
          id: b.id, name: b.name,
          connection: { type: 'http', url: b.url, ...(b.headers ? { headers: b.headers } : {}) },
          ...(b.weight !== undefined ? { weight: b.weight } : {}),
        });
        entry.metadata = { origin: 'peer' };
        console.log(`[air:gateway] learned backend from peer: ${b.id} → ${b.url}`);
      }
      // 발견 목록은 피어 것을 그대로 (다시 discover 하지 않음)
      const server = this.registry.get(b.id)!;
      this.registry.updateTools(b.id, b.tools.map((t) => ({ ...t, serverId: b.id })));
      this.toolIndex.reindex(server);
      this.discovered.set(b.id, { resources: b.resources, prompts: b.prompts, resourceTemplates: b.resourceTemplates });
      this.peerSeen.set(b.id, now);
    }
    this.rebuildOwners();
  }

  private async syncPeers(): Promise<void> {
    await Promise.all(this.peers.map(async (base) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), Math.min(this.peerSyncMs, 5_000));
      try {
        const res = await fetch(`${base}/peers/state`, {
          headers: this.registration.token ? { Authorization: `Bearer ${this.registration.token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { backends: PeerBackendState[] };
        this.mergePeerState(body.backends ?? []);
        if (this.peerState.get(base) !== 'up') { this.peerState.set(base, 'up'); console.log(`[air:gateway] peer ${base} up`); }
      } catch (err: any) {
        if (this.peerState.get(base) !== 'down') { this.peerState.set(base, 'down'); console.warn(`[air:gateway] peer ${base} unreachable (${err?.message ?? err})`); }
      } finally {
        clearTimeout(t);
      }
    }));
    // 피어에게서 배웠는데 한동안 어느 피어에도 안 보이는 백엔드 제거
    const now = Date.now();
    const peerStaleMs = this.peerSyncMs * 3;
    for (const [id, seen] of this.peerSeen) {
      if (now - seen > peerStaleMs && this.registry.get(id)?.metadata?.origin === 'peer') {
        console.log(`[air:gateway] peer-learned backend ${id} gone — removed`);
        this.unregister(id);
      }
    }
  }

  // ── 자기 등록 (push registration) ──

  /**
   * 백엔드의 등록/하트비트를 처리한다. 처음 보는 id면 등록하고 목록을 발견한다.
   * 같은 id가 다른 url로 오면 교체한다 (재시작으로 포트가 바뀐 경우).
   */
  async acceptRegistration(payload: RegistrationPayload): Promise<{ registered: boolean }> {
    const existing = this.registry.get(payload.id);
    const conn = (existing?.connection as HttpConnection | undefined);
    const changed = !existing || conn?.url !== payload.url;
    this.lastSeen.set(payload.id, Date.now());
    if (!changed) {
      // 하트비트: 상태만 회복
      if (existing!.status !== 'connected') this.registry.updateStatus(payload.id, 'connected');
      return { registered: false };
    }
    if (existing) this.unregister(payload.id);
    const entry = this.register({
      id: payload.id,
      name: payload.name,
      connection: { type: 'http', url: payload.url, ...(payload.headers ? { headers: payload.headers } : {}) },
      ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
    });
    entry.metadata = { ...(payload.metadata ?? {}), selfRegistered: true, origin: 'self' };
    this.lastSeen.set(payload.id, Date.now());
    await this.discover(payload.id);
    console.log(`[air:gateway] backend registered: ${payload.id} → ${payload.url}`);
    return { registered: true };
  }

  /** 하트비트가 끊긴 자기 등록 백엔드를 제거한다. */
  private sweepStale(): void {
    const now = Date.now();
    for (const [id, seen] of this.lastSeen) {
      if (now - seen > this.registration.staleAfterMs) {
        console.log(`[air:gateway] backend ${id} stale (no heartbeat for ${now - seen}ms) — removed`);
        this.unregister(id);
      }
    }
  }

  private authorizedForRegistry(req: IncomingMessage): boolean {
    if (!this.registration.token) return true;
    const auth = String(req.headers.authorization ?? '');
    return auth === `Bearer ${this.registration.token}`;
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
    // 자기 등록 백엔드 중 하트비트가 끊긴 것 제거
    this.sweeper = setInterval(() => this.sweepStale(), Math.max(1_000, Math.floor(this.registration.staleAfterMs / 3)));
    this.sweeper.unref();
    if (this.peers.length > 0) {
      void this.syncPeers();
      this.peerTimer = setInterval(() => void this.syncPeers(), this.peerSyncMs);
      this.peerTimer.unref();
    }
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
    if (this.sweeper) { clearInterval(this.sweeper); this.sweeper = null; }
    if (this.peerTimer) { clearInterval(this.peerTimer); this.peerTimer = null; }
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
      peers: Object.fromEntries(this.peers.map((p) => [p, this.peerState.get(p) ?? 'unknown'])),
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

    // 피어 동기화: GET /peers/state
    if (req.method === 'GET' && url.pathname === '/peers/state') {
      if (!this.authorizedForRegistry(req)) { res.writeHead(401, JSON_HEADERS); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ name: this.config.name, backends: this.peerStateSnapshot() }));
      return;
    }

    // 백엔드 자기 등록: POST /registry (등록·하트비트), DELETE /registry/:id, GET /registry
    if (this.registration.enabled && (url.pathname === '/registry' || url.pathname.startsWith('/registry/'))) {
      if (!this.authorizedForRegistry(req)) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/registry') {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({
          servers: this.registry.listAll().map((s) => ({
            id: s.id, name: s.name, status: s.status,
            url: (s.connection as HttpConnection).url,
            tools: s.tools.map((t) => t.name),
            selfRegistered: s.metadata?.selfRegistered === true,
            lastSeen: this.lastSeen.get(s.id) ?? null,
          })),
        }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/registry') {
        let payload: RegistrationPayload;
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (!payload?.id || !payload?.url || !payload?.name) throw new Error('id, name, url are required');
          new URL(payload.url);
        } catch (err: any) {
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ error: `Invalid registration: ${err?.message ?? err}` }));
          return;
        }
        const result = await this.acceptRegistration(payload);
        res.writeHead(result.registered ? 201 : 200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, ...result, staleAfterMs: this.registration.staleAfterMs }));
        return;
      }
      if (req.method === 'DELETE' && url.pathname.startsWith('/registry/')) {
        const id = decodeURIComponent(url.pathname.slice('/registry/'.length));
        const existed = !!this.registry.get(id);
        if (existed) this.unregister(id);
        res.writeHead(existed ? 200 : 404, JSON_HEADERS);
        res.end(JSON.stringify({ ok: existed }));
        return;
      }
      res.writeHead(405, { ...JSON_HEADERS, Allow: 'GET, POST, DELETE' }).end();
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
