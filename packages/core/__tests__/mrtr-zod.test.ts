// MRTR + Zod JSON Schema 테스트

import { describe, it, expect } from 'vitest';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';
import { createRequestContext } from '../src/context/request-context.js';
import { z } from 'zod';

// ── MRTR ──

describe('MRTR (Multi Round-Trip Requests)', () => {
  function createMRTREngine() {
    return new McpProtocolEngine({
      name: 'mrtr-test',
      version: '1.0.0',
      tools: [{ name: 'transfer', params: { amount: 'number' }, handler: async () => 'ok' }],
      resources: [],
      prompts: [],
      callTool: async (_toolName, params, _meta, inputResponses) => {
        const ctx = createRequestContext('mrtr-test', {}, { inputResponses });
        if (!ctx.inputResponses?.length) {
          return ctx.requestInput(`Transfer $${params.amount}. Confirm?`, {
            confirmed: { type: 'boolean', description: 'Confirm' },
          });
        }
        const resp = ctx.inputResponses[0];
        if (resp.action === 'accept' && resp.content?.confirmed) {
          return [{ type: 'text', text: `Transferred $${params.amount}` }];
        }
        return [{ type: 'text', text: 'Cancelled' }];
      },
    });
  }

  it('should return input_required on first call', async () => {
    const engine = createMRTREngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 1,
      params: {
        name: 'transfer', arguments: { amount: 500 },
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
      },
    });
    expect(res.result.resultType).toBe('input_required');
    expect(res.result.inputRequests).toHaveLength(1);
    expect(res.result.inputRequests[0].type).toBe('elicitation');
    expect(res.result.inputRequests[0].message).toContain('500');
    expect(res.result.inputRequests[0].requestedSchema.properties.confirmed.type).toBe('boolean');
  });

  it('should return complete on accepted retry', async () => {
    const engine = createMRTREngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 2,
      params: {
        name: 'transfer', arguments: { amount: 500 },
        inputResponses: [{ type: 'elicitation', action: 'accept', content: { confirmed: true } }],
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
      },
    });
    expect(res.result.resultType).toBe('complete');
    expect(res.result.content[0].text).toBe('Transferred $500');
  });

  it('should handle declined input', async () => {
    const engine = createMRTREngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 3,
      params: {
        name: 'transfer', arguments: { amount: 500 },
        inputResponses: [{ type: 'elicitation', action: 'decline' }],
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
      },
    });
    expect(res.result.resultType).toBe('complete');
    expect(res.result.content[0].text).toBe('Cancelled');
  });

  it('should include requestState when provided', async () => {
    const engine = new McpProtocolEngine({
      name: 'state-test', version: '1.0.0',
      tools: [{ name: 'action', params: {}, handler: async () => 'ok' }],
      resources: [], prompts: [],
      callTool: async (_tn, _p, _m, ir) => {
        const ctx = createRequestContext('state-test', {}, { inputResponses: ir });
        return ctx.requestInput('Confirm?', { ok: { type: 'boolean' } }, 'txn-abc-123');
      },
    });
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'tools/call', id: 1,
      params: { name: 'action', arguments: {} },
    });
    expect(res.result.resultType).toBe('input_required');
    expect(res.result.requestState).toBe('txn-abc-123');
  });
});

// ── Zod → JSON Schema 변환 ──

describe('Zod v3 → JSON Schema in tools/list', () => {
  it('should convert basic Zod types', async () => {
    const engine = new McpProtocolEngine({
      name: 'zod-test', version: '1.0.0',
      tools: [{
        name: 'search',
        params: {
          query: z.string().describe('Search query'),
          limit: z.number().optional(),
          enabled: z.boolean(),
        },
        handler: async () => 'ok',
      }],
      resources: [], prompts: [],
      callTool: async () => [{ type: 'text', text: 'ok' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    const schema = res.result.tools[0].inputSchema;

    expect(schema.properties.query.type).toBe('string');
    expect(schema.properties.query.description).toBe('Search query');
    expect(schema.properties.limit.type).toBe('number');
    expect(schema.properties.enabled.type).toBe('boolean');
    expect(schema.required).toContain('query');
    expect(schema.required).toContain('enabled');
    expect(schema.required).not.toContain('limit');
  });

  it('should convert Zod enum', async () => {
    const engine = new McpProtocolEngine({
      name: 'enum-test', version: '1.0.0',
      tools: [{
        name: 'sort',
        params: { order: z.enum(['asc', 'desc']) },
        handler: async () => 'ok',
      }],
      resources: [], prompts: [],
      callTool: async () => [{ type: 'text', text: 'ok' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    expect(res.result.tools[0].inputSchema.properties.order.enum).toEqual(['asc', 'desc']);
  });

  it('should convert Zod array', async () => {
    const engine = new McpProtocolEngine({
      name: 'arr-test', version: '1.0.0',
      tools: [{
        name: 'tag',
        params: { tags: z.array(z.string()) },
        handler: async () => 'ok',
      }],
      resources: [], prompts: [],
      callTool: async () => [{ type: 'text', text: 'ok' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    expect(res.result.tools[0].inputSchema.properties.tags.type).toBe('array');
  });

  it('should handle mixed params (shorthand + Zod + objectDef)', async () => {
    const engine = new McpProtocolEngine({
      name: 'mixed-test', version: '1.0.0',
      tools: [{
        name: 'mixed',
        params: {
          name: 'string',
          age: z.number(),
          email: { type: 'string', description: 'Email', optional: true },
        },
        handler: async () => 'ok',
      }],
      resources: [], prompts: [],
      callTool: async () => [{ type: 'text', text: 'ok' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    const schema = res.result.tools[0].inputSchema;

    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.age.type).toBe('number');
    expect(schema.properties.email.type).toBe('string');
    expect(schema.properties.email.description).toBe('Email');
    expect(schema.required).toContain('name');
    expect(schema.required).toContain('age');
    expect(schema.required).not.toContain('email');
  });

  it('should convert Zod default with value', async () => {
    const engine = new McpProtocolEngine({
      name: 'default-test', version: '1.0.0',
      tools: [{
        name: 'page',
        params: { limit: z.number().default(10) },
        handler: async () => 'ok',
      }],
      resources: [], prompts: [],
      callTool: async () => [{ type: 'text', text: 'ok' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    const prop = res.result.tools[0].inputSchema.properties.limit;
    expect(prop.type).toBe('number');
    expect(prop.default).toBe(10);
  });
});
