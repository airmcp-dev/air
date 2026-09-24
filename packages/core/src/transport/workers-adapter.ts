// @airmcp-dev/core — transport/workers-adapter.ts
// Cloudflare Workers용 MCP transport
// JSON-RPC 2.0 직접 처리 (MCP SDK의 Node 전용 transport 대신)

import type { AirToolDef } from '../types/tool.js';
import type { AirResourceDef } from '../types/resource.js';
import type { AirPromptDef } from '../types/prompt.js';
import { paramsToJsonSchema } from '../tool/tool-schema.js';
import { matchTemplate } from '../resource/resource-template.js';

export interface WorkersTransportConfig {
  name: string;
  version: string;
  tools: AirToolDef[];
  resources: AirResourceDef[];
  prompts: AirPromptDef[];
  /** 도구 호출 시 실행되는 핸들러 (미들웨어 체인 포함) */
  callTool: (toolName: string, params: Record<string, any>) => Promise<any>;
}

/**
 * Workers fetch 핸들러를 생성한다.
 * MCP Streamable HTTP 프로토콜을 JSON-RPC 2.0으로 직접 처리.
 */
export function createWorkersFetchHandler(config: WorkersTransportConfig) {
  return async (request: Request): Promise<Response> => {
    const body = await request.json() as {
      jsonrpc: string;
      method: string;
      params?: any;
      id?: number | string;
    };

    const headers = {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-03-26',
    };

    // ── initialize ──
    if (body.method === 'initialize') {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: { name: config.name, version: config.version },
        },
      }, { headers });
    }

    // ── notifications/initialized ──
    if (body.method === 'notifications/initialized') {
      return new Response(null, { status: 204 });
    }

    // ── tools/list ──
    if (body.method === 'tools/list') {
      const tools = config.tools.map(tool => {
        const inputSchema = paramsToJsonSchema(tool.params);
        const entry: Record<string, any> = {
          name: tool.name,
          description: tool.description || '',
          inputSchema: inputSchema || { type: 'object', properties: {} },
        };
        if (tool.annotations) {
          entry.annotations = tool.annotations;
        }
        return entry;
      });

      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { tools },
      }, { headers });
    }

    // ── tools/call ──
    if (body.method === 'tools/call') {
      const { name, arguments: args } = body.params || {};

      try {
        const result = await config.callTool(name, args || {});

        // 결과 정규화 — 문자열이면 text 블록으로 래핑
        let content: any[];
        if (typeof result === 'string') {
          content = [{ type: 'text', text: result }];
        } else if (Array.isArray(result)) {
          content = result;
        } else if (result && typeof result === 'object' && 'content' in result) {
          content = result.content;
        } else {
          content = [{ type: 'text', text: JSON.stringify(result) }];
        }

        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: { content },
        }, { headers });
      } catch (err: any) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: err.message || 'Tool execution failed' },
        }, { headers, status: 500 });
      }
    }

    // ── resources/list ──
    if (body.method === 'resources/list') {
      const resources = config.resources.map(r => ({
        uri: String(r.uri),
        name: r.name,
        description: r.description || '',
        mimeType: r.mimeType,
      }));
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { resources },
      }, { headers });
    }

    // ── prompts/list ──
    if (body.method === 'prompts/list') {
      const prompts = config.prompts.map(p => ({
        name: p.name,
        description: p.description || '',
      }));
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { prompts },
      }, { headers });
    }

    // ── resources/read ──
    if (body.method === 'resources/read') {
      const { uri } = body.params || {};
      if (!uri) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32602, message: 'Missing required param: uri' },
        }, { headers, status: 400 });
      }

      // 정적 URI 매칭 → 템플릿 매칭 순서로 탐색
      const resource = config.resources.find(r => r.uri === uri)
        ?? config.resources.find(r => matchTemplate(r.uri, uri) !== null);

      if (!resource) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32602, message: `Resource not found: ${uri}` },
        }, { headers, status: 404 });
      }

      try {
        const ctx = { requestId: crypto.randomUUID(), serverName: config.name };
        const raw = await resource.handler(uri, ctx);

        let contents: any[];
        if (typeof raw === 'string') {
          contents = [{ uri, mimeType: resource.mimeType || 'text/plain', text: raw }];
        } else if ('blob' in raw) {
          contents = [{ uri, mimeType: raw.mimeType, blob: raw.blob }];
        } else {
          contents = [{ uri, mimeType: raw.mimeType || resource.mimeType || 'text/plain', text: raw.text }];
        }

        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: { contents },
        }, { headers });
      } catch (err: any) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: err.message || 'Resource read failed' },
        }, { headers, status: 500 });
      }
    }

    // ── prompts/get ──
    if (body.method === 'prompts/get') {
      const { name, arguments: args } = body.params || {};
      if (!name) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32602, message: 'Missing required param: name' },
        }, { headers, status: 400 });
      }

      const prompt = config.prompts.find(p => p.name === name);
      if (!prompt) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32602, message: `Prompt not found: ${name}` },
        }, { headers, status: 404 });
      }

      try {
        const messages = await prompt.handler(args || {});
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            description: prompt.description || '',
            messages: messages.map(m => ({
              role: m.role,
              content: { type: 'text', text: m.content },
            })),
          },
        }, { headers });
      } catch (err: any) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: err.message || 'Prompt get failed' },
        }, { headers, status: 500 });
      }
    }

    // ── unknown method ──
    return Response.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    }, { headers, status: 400 });
  };
}
