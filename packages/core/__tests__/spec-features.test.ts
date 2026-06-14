// @airmcp-dev/core — __tests__/spec-features.test.ts
// MCP 2025-03-26 ~ 2025-06-18 스펙 기능 테스트
// - Tool Annotations
// - Structured Output (outputSchema)
// - Resource Links
// - Elicitation context
// - Request context options (signal)

import { describe, it, expect } from 'vitest';
import { defineTool } from '../src/tool/define-tool.js';
import { normalizeResult } from '../src/tool/tool-result.js';
import { paramsToZodSchema } from '../src/tool/tool-schema.js';
import { createRequestContext } from '../src/context/request-context.js';

// ═══════════════════════════════════════════════════
// 1. Tool Annotations
// ═══════════════════════════════════════════════════

describe('Tool Annotations', () => {
  it('should include annotations in tool definition', () => {
    const tool = defineTool('delete_user', {
      description: '사용자 삭제',
      params: { userId: 'string' },
      annotations: {
        title: 'Delete User',
        destructiveHint: true,
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      handler: async () => 'deleted',
    });

    expect(tool.annotations).toBeDefined();
    expect(tool.annotations!.destructiveHint).toBe(true);
    expect(tool.annotations!.readOnlyHint).toBe(false);
    expect(tool.annotations!.title).toBe('Delete User');
    expect(tool.annotations!.openWorldHint).toBe(true);
  });

  it('should allow omitting annotations', () => {
    const tool = defineTool('simple', {
      handler: async () => 'ok',
    });

    expect(tool.annotations).toBeUndefined();
  });

  it('should allow partial annotations', () => {
    const tool = defineTool('read_data', {
      annotations: { readOnlyHint: true },
      handler: async () => 'data',
    });

    expect(tool.annotations!.readOnlyHint).toBe(true);
    expect(tool.annotations!.destructiveHint).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════
// 2. Structured Output (outputSchema)
// ═══════════════════════════════════════════════════

describe('Structured Output', () => {
  it('should include outputSchema in tool definition', () => {
    const tool = defineTool('get_user', {
      params: { userId: 'string' },
      outputSchema: { name: 'string', email: 'string', age: 'number?' },
      handler: async () => ({ name: 'Alice', email: 'a@test.com' }),
    });

    expect(tool.outputSchema).toBeDefined();
    expect(tool.outputSchema!.name).toBe('string');
    expect(tool.outputSchema!.email).toBe('string');
    expect(tool.outputSchema!.age).toBe('number?');
  });

  it('should convert outputSchema to zod schema', () => {
    const schema = paramsToZodSchema({
      name: 'string',
      count: 'number',
      active: 'boolean?',
    });

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
    expect(schema!.shape.name).toBeDefined();
    expect(schema!.shape.count).toBeDefined();
    expect(schema!.shape.active).toBeDefined();
  });

  it('should allow omitting outputSchema', () => {
    const tool = defineTool('no_output', {
      handler: async () => 'ok',
    });

    expect(tool.outputSchema).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════
// 3. Resource Links
// ═══════════════════════════════════════════════════

describe('Resource Links', () => {
  it('should normalize resource response to resource_link content', () => {
    const result = normalizeResult({
      resource: {
        uri: 'file:///reports/q4.pdf',
        name: 'Q4 Report',
        mimeType: 'application/pdf',
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('resource_link');
    expect(result[0].uri).toBe('file:///reports/q4.pdf');
    expect(result[0].name).toBe('Q4 Report');
    expect(result[0].mimeType).toBe('application/pdf');
  });

  it('should handle resource with only uri', () => {
    const result = normalizeResult({
      resource: { uri: 'db://users/123' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('resource_link');
    expect(result[0].uri).toBe('db://users/123');
    expect(result[0].name).toBeUndefined();
  });

  it('should include description in resource_link', () => {
    const result = normalizeResult({
      resource: {
        uri: 'api://docs/readme',
        description: 'API documentation',
      },
    });

    expect(result[0].description).toBe('API documentation');
  });

  it('should still normalize text response correctly', () => {
    const result = normalizeResult('hello');
    expect(result).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('should still normalize image response correctly', () => {
    const result = normalizeResult({ image: 'base64data', mimeType: 'image/jpeg' });
    expect(result).toEqual([{ type: 'image', data: 'base64data', mimeType: 'image/jpeg' }]);
  });
});

// ═══════════════════════════════════════════════════
// 4. Request Context — Elicitation & Signal
// ═══════════════════════════════════════════════════

describe('Request Context', () => {
  it('should create context with default values', () => {
    const ctx = createRequestContext('my-server', { count: 0 });

    expect(ctx.requestId).toBeDefined();
    expect(ctx.requestId.length).toBeGreaterThan(0);
    expect(ctx.serverName).toBe('my-server');
    expect(ctx.startedAt).toBeGreaterThan(0);
    expect(ctx.state).toEqual({ count: 0 });
    expect(ctx.signal).toBeUndefined();
    expect(ctx.elicit).toBeUndefined();
  });

  it('should pass signal through options', () => {
    const controller = new AbortController();
    const ctx = createRequestContext('srv', {}, { signal: controller.signal });

    expect(ctx.signal).toBe(controller.signal);
    expect(ctx.signal!.aborted).toBe(false);
  });

  it('should pass elicit function through options', async () => {
    const mockElicit = async (message: string, schema: any) => ({
      action: 'accept' as const,
      content: { confirmed: true },
    });

    const ctx = createRequestContext('srv', {}, { elicit: mockElicit });

    expect(ctx.elicit).toBeDefined();
    const result = await ctx.elicit!('Confirm?', { confirmed: { type: 'boolean' } });
    expect(result.action).toBe('accept');
    expect(result.content).toEqual({ confirmed: true });
  });

  it('should handle elicit decline', async () => {
    const mockElicit = async () => ({
      action: 'decline' as const,
      content: undefined,
    });

    const ctx = createRequestContext('srv', {}, { elicit: mockElicit });
    const result = await ctx.elicit!('Proceed?', {});
    expect(result.action).toBe('decline');
    expect(result.content).toBeUndefined();
  });

  it('should handle aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = createRequestContext('srv', {}, { signal: controller.signal });

    expect(ctx.signal!.aborted).toBe(true);
  });
});
