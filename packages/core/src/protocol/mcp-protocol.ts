// @airmcp-dev/core — protocol/mcp-protocol.ts
//
// air 자체 MCP 프로토콜 엔진.
// SDK 의존 없이 MCP 2026-07-28 + 레거시(2025-11-25) 듀얼 프로토콜을 처리한다.
//
// Workers adapter에서 이미 하고 있던 JSON-RPC 직접 처리를 정규화한 것.
// 모든 transport(stdio, SSE, HTTP, Workers)가 이 엔진을 공유한다.

import type { AirToolDef } from '../types/tool.js';
import type { AirResourceDef } from '../types/resource.js';
import type { AirPromptDef } from '../types/prompt.js';
import { paramsToJsonSchema } from '../tool/tool-schema.js';
import { matchTemplate } from '../resource/resource-template.js';

// ── 프로토콜 상수 ──

export const PROTOCOL_VERSIONS = {
  MODERN: '2026-07-28',
  LEGACY: '2025-11-25',
  LEGACY_OLD: '2024-11-05',
} as const;

export const SUPPORTED_VERSIONS = [
  PROTOCOL_VERSIONS.MODERN,
  PROTOCOL_VERSIONS.LEGACY,
  PROTOCOL_VERSIONS.LEGACY_OLD,
];

// ── 에러 코드 (MCP 2026-07-28 spec) ──

export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP spec-reserved (-32020 ~ -32099)
  HEADER_MISMATCH: -32020,
  MISSING_CLIENT_CAPABILITY: -32021,
  UNSUPPORTED_PROTOCOL_VERSION: -32022,
} as const;

// ── 타입 ──

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  id?: string | number;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

/** _meta에서 추출한 클라이언트 정보 */
export interface ClientMeta {
  protocolVersion?: string;
  clientInfo?: { name: string; version: string };
  clientCapabilities?: Record<string, any>;
}

/** server/discover 응답 */
export interface DiscoverResult {
  resultType: 'complete';
  supportedVersions: string[];
  capabilities: {
    tools?: { listChanged: boolean };
    resources?: { listChanged: boolean };
    prompts?: { listChanged: boolean };
    extensions?: Record<string, any>;
  };
  _meta: {
    'io.modelcontextprotocol/serverInfo': { name: string; version: string };
  };
}

/** 프로토콜 엔진 설정 */
export interface ProtocolEngineConfig {
  name: string;
  version: string;
  tools: AirToolDef[];
  resources: AirResourceDef[];
  prompts: AirPromptDef[];
  /** 도구 실행 함수 — 미들웨어 체인을 거쳐 실행 */
  callTool: (toolName: string, params: Record<string, any>, meta?: ClientMeta, inputResponses?: any[]) => Promise<any>;
  /** 캐시 힌트 (기본: 300000ms) */
  defaultTtlMs?: number;
  /** 캐시 스코프 (기본: 'public') */
  defaultCacheScope?: 'public' | 'private';
}

// ── 프로토콜 엔진 ──

/** 구독 타입 */
type SubscriptionType = 'toolsListChanged' | 'promptsListChanged' | 'resourcesListChanged' | 'resourceSubscriptions';

/** 구독 정보 */
interface Subscription {
  id: string;
  types: SubscriptionType[];
  createdAt: number;
}

export class McpProtocolEngine {
  private config: ProtocolEngineConfig;
  private serverInfo: { name: string; version: string };
  private subscriptions = new Map<string, Subscription>();
  private subscriptionCounter = 0;

  constructor(config: ProtocolEngineConfig) {
    this.config = config;
    this.serverInfo = { name: config.name, version: config.version };
  }

  /**
   * JSON-RPC 메시지를 처리하고 응답을 반환한다.
   * 2026-07-28 (stateless, _meta) + 레거시(initialize 핸드셰이크) 둘 다 지원.
   */
  async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, id, params } = message;

    // _meta에서 클라이언트 정보 추출
    const meta = this.extractMeta(params);
    const isModern = meta.protocolVersion === PROTOCOL_VERSIONS.MODERN;

    try {
      let result: any;

      switch (method) {
        // ── 2026-07-28: server/discover ──
        case 'server/discover':
          result = this.handleDiscover();
          break;

        // ── 레거시: initialize ──
        case 'initialize':
          result = this.handleInitialize(params);
          break;

        // ── 레거시: notifications/initialized ──
        case 'notifications/initialized':
          return this.noContent(id);

        // ── tools ──
        case 'tools/list':
          result = this.handleToolsList(isModern);
          break;
        case 'tools/call':
          result = await this.handleToolsCall(params, meta);
          break;

        // ── resources ──
        case 'resources/list':
          result = this.handleResourcesList(isModern);
          break;
        case 'resources/read':
          result = await this.handleResourcesRead(params);
          break;
        case 'resources/templates/list':
          result = this.handleResourceTemplatesList(isModern);
          break;

        // ── prompts ──
        case 'prompts/list':
          result = this.handlePromptsList(isModern);
          break;
        case 'prompts/get':
          result = await this.handlePromptsGet(params);
          break;

        // ── ping (레거시, 2026-07-28에서 제거됨) ──
        case 'ping':
          result = { resultType: 'complete' };
          break;

        // ── subscriptions (2026-07-28) ──
        case 'subscriptions/listen':
          result = this.handleSubscriptionsListen(params, isModern);
          break;

        // ── 레거시: resources/subscribe, resources/unsubscribe ──
        case 'resources/subscribe':
          result = this.handleResourcesSubscribe(params);
          break;
        case 'resources/unsubscribe':
          result = this.handleResourcesUnsubscribe(params);
          break;

        // ── unknown ──
        default:
          return this.error(id, ErrorCodes.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }

      // modern 응답에 serverInfo _meta 추가
      if (isModern && result && typeof result === 'object') {
        if (!result._meta) result._meta = {};
        result._meta['io.modelcontextprotocol/serverInfo'] = this.serverInfo;
      }

      return this.success(id, result);
    } catch (err: any) {
      const code = typeof err.code === 'number' ? err.code : ErrorCodes.INTERNAL_ERROR;
      return this.error(id, code, err.message || 'Internal error');
    }
  }

  // ── server/discover (2026-07-28) ──

  private handleDiscover(): DiscoverResult {
    return {
      resultType: 'complete',
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
      _meta: {
        'io.modelcontextprotocol/serverInfo': this.serverInfo,
      },
    };
  }

  // ── initialize (레거시 2025-11-25 폴백) ──

  private handleInitialize(params?: Record<string, any>): any {
    const clientVersion = params?.protocolVersion;

    // 클라이언트가 2026-07-28을 요청하면 UnsupportedProtocolVersion 에러 반환
    // → 클라이언트는 server/discover를 사용해야 함
    if (clientVersion === PROTOCOL_VERSIONS.MODERN) {
      return {
        protocolVersion: PROTOCOL_VERSIONS.LEGACY,
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true },
          prompts: { listChanged: true },
        },
        serverInfo: this.serverInfo,
        // 지원 버전을 알려줘서 클라이언트가 discover로 전환 가능
        _supportedVersions: SUPPORTED_VERSIONS,
      };
    }

    // 레거시 핸드셰이크 — 가장 높은 공통 버전으로 협상
    const negotiated = clientVersion && SUPPORTED_VERSIONS.includes(clientVersion)
      ? clientVersion
      : PROTOCOL_VERSIONS.LEGACY;

    return {
      protocolVersion: negotiated,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
      serverInfo: this.serverInfo,
    };
  }

  // ── tools ──

  private handleToolsList(isModern: boolean): any {
    const tools = this.config.tools.map(t => {
      const schema: Record<string, any> = {
        name: t.name,
      };
      if (t.description) schema.description = t.description;

      // inputSchema
      const jsonSchema = paramsToJsonSchema(t.params);
      schema.inputSchema = jsonSchema || { type: 'object', properties: {} };

      // outputSchema
      if (t.outputSchema) {
        const outputJsonSchema = paramsToJsonSchema(t.outputSchema);
        if (outputJsonSchema) schema.outputSchema = outputJsonSchema;
      }

      // annotations
      if (t.annotations) {
        const { title, ...hints } = t.annotations;
        if (title) schema.title = title;
        if (Object.keys(hints).length > 0) schema.annotations = hints;
      }

      return schema;
    });

    const result: any = { tools };

    if (isModern) {
      result.resultType = 'complete';
      result.ttlMs = this.config.defaultTtlMs ?? 300_000;
      result.cacheScope = this.config.defaultCacheScope ?? 'public';
    }

    return result;
  }

  private async handleToolsCall(params?: Record<string, any>, meta?: ClientMeta): Promise<any> {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const inputResponses = params?.inputResponses;
    const requestState = params?.requestState;

    if (!toolName) {
      throw Object.assign(new Error('Missing required param: name'), { code: ErrorCodes.INVALID_PARAMS });
    }

    const tool = this.config.tools.find(t => t.name === toolName);
    if (!tool) {
      throw Object.assign(new Error(`Tool not found: ${toolName}`), { code: ErrorCodes.METHOD_NOT_FOUND });
    }

    const content = await this.config.callTool(toolName, args, meta, inputResponses);

    // MRTR: handler가 _inputRequired를 반환하면 input_required 응답
    if (content && typeof content === 'object' && '_inputRequired' in content && content._inputRequired) {
      return {
        resultType: 'input_required',
        inputRequests: content.inputRequests,
        ...(content.requestState ? { requestState: content.requestState } : {}),
        content: [{ type: 'text', text: content.inputRequests[0]?.message || 'Additional input required' }],
      };
    }

    const result: any = { content };

    // outputSchema가 있으면 structuredContent 추가
    if (tool.outputSchema && Array.isArray(content) && content.length > 0) {
      const firstText = content[0];
      if (firstText?.type === 'text' && typeof firstText.text === 'string') {
        try {
          result.structuredContent = JSON.parse(firstText.text);
        } catch { /* not JSON, skip */ }
      }
    }

    if (meta?.protocolVersion === PROTOCOL_VERSIONS.MODERN) {
      result.resultType = 'complete';
    }

    return result;
  }

  // ── resources ──

  private handleResourcesList(isModern: boolean): any {
    const resources = this.config.resources
      .filter(r => !r.uri.includes('{'))
      .map(r => ({
        uri: r.uri,
        name: r.name,
        ...(r.description ? { description: r.description } : {}),
        ...(r.mimeType ? { mimeType: r.mimeType } : {}),
      }));

    const result: any = { resources };

    if (isModern) {
      result.resultType = 'complete';
      result.ttlMs = this.config.defaultTtlMs ?? 300_000;
      result.cacheScope = this.config.defaultCacheScope ?? 'public';
    }

    return result;
  }

  private handleResourceTemplatesList(isModern: boolean): any {
    const resourceTemplates = this.config.resources
      .filter(r => r.uri.includes('{'))
      .map(r => ({
        uriTemplate: r.uri,
        name: r.name,
        ...(r.description ? { description: r.description } : {}),
        ...(r.mimeType ? { mimeType: r.mimeType } : {}),
      }));

    const result: any = { resourceTemplates };

    if (isModern) {
      result.resultType = 'complete';
      result.ttlMs = this.config.defaultTtlMs ?? 300_000;
      result.cacheScope = this.config.defaultCacheScope ?? 'public';
    }

    return result;
  }

  private async handleResourcesRead(params?: Record<string, any>): Promise<any> {
    const uri = params?.uri;
    if (!uri) throw Object.assign(new Error('Missing required param: uri'), { code: ErrorCodes.INVALID_PARAMS });

    // 정적 URI → 템플릿 매칭 순서
    const resource = this.config.resources.find(r => r.uri === uri)
      ?? this.config.resources.find(r => matchTemplate(r.uri, uri) !== null);

    if (!resource) {
      throw Object.assign(new Error(`Resource not found: ${uri}`), { code: ErrorCodes.INVALID_PARAMS });
    }

    const ctx = { requestId: crypto.randomUUID(), serverName: this.config.name };
    const raw = await resource.handler(uri, ctx);

    let contents: any[];
    if (typeof raw === 'string') {
      contents = [{ uri, mimeType: resource.mimeType || 'text/plain', text: raw }];
    } else if ('blob' in raw) {
      contents = [{ uri, mimeType: raw.mimeType, blob: raw.blob }];
    } else {
      contents = [{ uri, mimeType: raw.mimeType || resource.mimeType || 'text/plain', text: raw.text }];
    }

    return { contents, resultType: 'complete' };
  }

  // ── prompts ──

  private handlePromptsList(isModern: boolean): any {
    const prompts = this.config.prompts.map(p => ({
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      ...(p.arguments ? { arguments: p.arguments } : {}),
    }));

    const result: any = { prompts };

    if (isModern) {
      result.resultType = 'complete';
      result.ttlMs = this.config.defaultTtlMs ?? 300_000;
      result.cacheScope = this.config.defaultCacheScope ?? 'public';
    }

    return result;
  }

  private async handlePromptsGet(params?: Record<string, any>): Promise<any> {
    const name = params?.name;
    const args = params?.arguments || {};

    if (!name) throw Object.assign(new Error('Missing required param: name'), { code: ErrorCodes.INVALID_PARAMS });

    const prompt = this.config.prompts.find(p => p.name === name);
    if (!prompt) throw Object.assign(new Error(`Prompt not found: ${name}`), { code: ErrorCodes.INVALID_PARAMS });

    const messages = await prompt.handler(args);

    return {
      resultType: 'complete',
      description: prompt.description || '',
      messages: messages.map(m => ({
        role: m.role,
        content: { type: 'text', text: m.content },
      })),
    };
  }

  // ── subscriptions/listen (2026-07-28) ──

  private handleSubscriptionsListen(params?: Record<string, any>, isModern?: boolean): any {
    const types = params?.types as SubscriptionType[] | undefined;

    if (!types || !Array.isArray(types) || types.length === 0) {
      throw Object.assign(
        new Error('Missing or empty "types" array'),
        { code: ErrorCodes.INVALID_PARAMS },
      );
    }

    // 유효한 구독 타입 체크
    const validTypes: SubscriptionType[] = [
      'toolsListChanged', 'promptsListChanged',
      'resourcesListChanged', 'resourceSubscriptions',
    ];
    for (const t of types) {
      if (!validTypes.includes(t)) {
        throw Object.assign(
          new Error(`Invalid subscription type: "${t}". Valid: ${validTypes.join(', ')}`),
          { code: ErrorCodes.INVALID_PARAMS },
        );
      }
    }

    // 구독 등록
    const subId = `sub_${++this.subscriptionCounter}_${Date.now()}`;
    this.subscriptions.set(subId, {
      id: subId,
      types,
      createdAt: Date.now(),
    });

    return {
      resultType: 'complete',
      'io.modelcontextprotocol/subscriptionId': subId,
    };
  }

  // ── 레거시: resources/subscribe, resources/unsubscribe ──

  private handleResourcesSubscribe(params?: Record<string, any>): any {
    const uri = params?.uri;
    if (!uri) {
      throw Object.assign(new Error('Missing required param: uri'), { code: ErrorCodes.INVALID_PARAMS });
    }
    // 레거시 호환 — 구독만 기록하고 응답
    const subId = `legacy_res_${++this.subscriptionCounter}`;
    this.subscriptions.set(subId, {
      id: subId,
      types: ['resourceSubscriptions'],
      createdAt: Date.now(),
    });
    return {};
  }

  private handleResourcesUnsubscribe(params?: Record<string, any>): any {
    const uri = params?.uri;
    if (!uri) {
      throw Object.assign(new Error('Missing required param: uri'), { code: ErrorCodes.INVALID_PARAMS });
    }
    // 해당 URI의 구독 제거 (간단 구현: 전체 legacy 구독 중 하나 제거)
    for (const [id, sub] of this.subscriptions) {
      if (id.startsWith('legacy_res_')) {
        this.subscriptions.delete(id);
        break;
      }
    }
    return {};
  }

  /**
   * 변경 알림을 생성한다 (외부에서 호출).
   * 도구/리소스/프롬프트가 런타임에 추가/제거될 때 호출.
   */
  createNotification(type: SubscriptionType): any[] {
    const notifications: any[] = [];
    const methodMap: Record<SubscriptionType, string> = {
      toolsListChanged: 'notifications/tools/list_changed',
      promptsListChanged: 'notifications/prompts/list_changed',
      resourcesListChanged: 'notifications/resources/list_changed',
      resourceSubscriptions: 'notifications/resources/updated',
    };

    for (const sub of this.subscriptions.values()) {
      if (sub.types.includes(type)) {
        notifications.push({
          jsonrpc: '2.0',
          method: methodMap[type],
          params: {
            'io.modelcontextprotocol/subscriptionId': sub.id,
          },
        });
      }
    }

    return notifications;
  }

  /** 활성 구독 수 */
  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  // ── _meta 추출 ──

  private extractMeta(params?: Record<string, any>): ClientMeta {
    if (!params?._meta) return {};

    const meta = params._meta;
    return {
      protocolVersion: meta['io.modelcontextprotocol/protocolVersion'],
      clientInfo: meta['io.modelcontextprotocol/clientInfo'],
      clientCapabilities: meta['io.modelcontextprotocol/clientCapabilities'],
    };
  }

  // ── JSON-RPC 응답 헬퍼 ──

  private success(id: string | number | null | undefined, result: any): JsonRpcResponse {
    return { jsonrpc: '2.0', id: id ?? null, result };
  }

  private error(id: string | number | null | undefined, code: number, message: string, data?: any): JsonRpcResponse {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
  }

  private noContent(id: string | number | null | undefined): JsonRpcResponse {
    return { jsonrpc: '2.0', id: id ?? null, result: {} };
  }

  // ── 동적 도구/리소스/프롬프트 관리 ──

  addTool(tool: AirToolDef): void {
    this.config.tools.push(tool);
  }

  addResource(resource: AirResourceDef): void {
    this.config.resources.push(resource);
  }

  addPrompt(prompt: AirPromptDef): void {
    this.config.prompts.push(prompt);
  }

  getTools(): AirToolDef[] {
    return [...this.config.tools];
  }

  getResources(): AirResourceDef[] {
    return [...this.config.resources];
  }

  getPrompts(): AirPromptDef[] {
    return [...this.config.prompts];
  }
}
