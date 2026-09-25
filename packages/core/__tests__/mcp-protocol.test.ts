// @airmcp-dev/core — __tests__/mcp-protocol.test.ts
//
// McpProtocolEngine 유닛 테스트
// SDK 없이 MCP 2026-07-28 + 레거시(2025-11-25) 듀얼 프로토콜 검증

import { describe, it, expect } from 'vitest';
import { McpProtocolEngine, PROTOCOL_VERSIONS } from '../src/protocol/mcp-protocol.js';

function createEngine(overrides?: any) {
  return new McpProtocolEngine({
    name: 'test-server',
    version: '1.0.0',
    tools: [
      {
        name: 'echo',
        description: 'Echo input',
        params: { message: 'string' },
        handler: async ({ message }: any) => `echo: ${message}`,
      },
      {
        name: 'add',
        description: 'Add numbers',
        params: { a: 'number', b: 'number' },
        handler: async ({ a, b }: any) => ({ sum: a + b }),
      },
      {
        name: 'no_params',
        handler: async () => 'ok',
      },
    ],
    resources: [
      {
        uri: 'config://version',
        name: 'version',
        mimeType: 'text/plain',
        handler: async () => '1.0.0',
      },
      {
        uri: 'file:///{path}',
        name: 'file',
        mimeType: 'text/plain',
        handler: async (uri: string) => `Content of ${uri}`,
      },
    ],
    prompts: [
      {
        name: 'summarize',
        description: 'Summarize text',
        arguments: [{ name: 'text', required: true }],
        handler: ({ text }: any) => [
          { role: 'user' as const, content: `Summarize: ${text}` },
        ],
      },
    ],
    callTool: async (toolName: string, params: Record<string, any>) => {
      const tool = [
        { name: 'echo', handler: async (p: any) => `echo: ${p.message}` },
        { name: 'add', handler: async (p: any) => ({ sum: p.a + p.b }) },
        { name: 'no_params', handler: async () => 'ok' },
      ].find(t => t.name === toolName);
      if (!tool) throw new Error(`Tool not found: ${toolName}`);
      const result = await tool.handler(params);
      if (typeof result === 'string') return [{ type: 'text', text: result }];
      return [{ type: 'text', text: JSON.stringify(result) }];
    },
    ...overrides,
  });
}

// ── 2026-07-28 (Modern) ──

describe('McpProtocolEngine — server/discover', () => {
  it('should return supported versions and capabilities', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'server/discover', id: 1,
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result.supportedVersions).toContain('2026-07-28');
    expect(res.result.supportedVersions).toContain('2025-11-25');
    expect(res.result.capabilities.tools).toBeDefined();
    expect(res.result.capabilities.resources).toBeDefined();
    expect(res.result.capabilities.prompts).toBeDefined();
    expect(res.result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('test-server');
  });
});

describe('McpProtocolEngine — modern tools', () => {
  const modernMeta = {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0' },
    },
  };

  it('should list tools with resultType and ttlMs', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/list', id: 1,
      params: modernMeta,
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result.ttlMs).toBeGreaterThan(0);
    expect(res.result.cacheScope).toBe('public');
    expect(res.result.tools).toHaveLength(3);
    expect(res.result.tools[0].name).toBe('echo');
    expect(res.result._meta['io.modelcontextprotocol/serverInfo']).toBeDefined();
  });

  it('should call tool and return resultType complete', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 2,
      params: {
        name: 'echo',
        arguments: { message: 'hello' },
        ...modernMeta,
      },
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result.content[0].text).toBe('echo: hello');
  });

  it('should return error for unknown tool', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 3,
      params: { name: 'nonexistent', arguments: {}, ...modernMeta },
    });

    expect(res.error).toBeDefined();
    expect(res.error!.message).toContain('Tool not found');
  });
});

describe('McpProtocolEngine — modern resources', () => {
  const modernMeta = {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  };

  it('should list resources with cache hints', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/list', id: 1,
      params: modernMeta,
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result.ttlMs).toBeGreaterThan(0);
    expect(res.result.resources.length).toBeGreaterThanOrEqual(1);
  });

  it('should read resource by static URI', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/read', id: 2,
      params: { uri: 'config://version' },
    });

    expect(res.result.contents[0].text).toBe('1.0.0');
  });

  it('should read resource by template URI', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/read', id: 3,
      params: { uri: 'file:///hello.txt' },
    });

    expect(res.result.contents[0].text).toBe('Content of file:///hello.txt');
  });

  it('should list resource templates', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/templates/list', id: 4,
      params: modernMeta,
    });

    expect(res.result.resourceTemplates.length).toBeGreaterThanOrEqual(1);
    expect(res.result.resourceTemplates[0].uriTemplate).toContain('{');
  });
});

describe('McpProtocolEngine — modern prompts', () => {
  it('should list prompts', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'prompts/list', id: 1,
      params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result.prompts).toHaveLength(1);
    expect(res.result.prompts[0].name).toBe('summarize');
  });

  it('should get prompt', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'prompts/get', id: 2,
      params: { name: 'summarize', arguments: { text: 'Hello world' } },
    });

    expect(res.result.messages[0].content.text).toBe('Summarize: Hello world');
  });
});

// ── 레거시 (2025-11-25) ──

describe('McpProtocolEngine — legacy initialize', () => {
  it('should handle initialize with version negotiation', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'initialize', id: 1,
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'legacy-client', version: '1.0' },
      },
    });

    expect(res.result.protocolVersion).toBe('2025-11-25');
    expect(res.result.serverInfo.name).toBe('test-server');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it('should handle notifications/initialized', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'notifications/initialized',
    });

    expect(res.result).toEqual({});
  });

  it('should list tools without resultType/ttlMs for legacy', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/list', id: 1,
    });

    expect(res.result.tools).toHaveLength(3);
    expect(res.result.resultType).toBeUndefined();
    expect(res.result.ttlMs).toBeUndefined();
  });
});

// ── 에러 케이스 ──

describe('McpProtocolEngine — errors', () => {
  it('should return method not found for unknown method', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'unknown/method', id: 1,
    });

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
  });

  it('should return error for missing tool name', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 1,
      params: { arguments: {} },
    });

    expect(res.error).toBeDefined();
  });

  it('should return error for missing resource URI', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/read', id: 1,
      params: {},
    });

    expect(res.error).toBeDefined();
  });

  it('should return error for unknown resource', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/read', id: 1,
      params: { uri: 'unknown://foo' },
    });

    expect(res.error).toBeDefined();
  });

  it('should handle ping (legacy)', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'ping', id: 1,
    });

    expect(res.result).toBeDefined();
  });
});
