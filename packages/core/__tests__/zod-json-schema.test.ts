// @airmcp-dev/core — __tests__/zod-json-schema.test.ts
//
// Zod 파라미터/출력 스키마 → JSON Schema 변환 (tools/list의 inputSchema, outputSchema).
// optional, default, refine, nullable 같은 래퍼를 거쳐도 타입과 설명이 빠지지 않아야 한다.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { paramsToJsonSchema } from '../src/tool/tool-schema.js';
import { validationMiddleware } from '../src/middleware/before-hook.js';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';

describe('paramsToJsonSchema — Zod v3 wrappers', () => {
  it('should keep descriptions on wrapped schemas', () => {
    const schema = paramsToJsonSchema({
      query: z
        .string()
        .refine((s) => s.trim().length > 0, 'blank')
        .describe('search text'),
      format: z.enum(['json', 'text']).optional().describe('output format'),
      k: z.number().default(5).describe('top k'),
      tags: z.array(z.string()).describe('labels'),
      inner: z.string().describe('inner text').optional(),
    })!;

    expect(schema.properties.query).toEqual({ type: 'string', description: 'search text' });
    expect(schema.properties.format).toEqual({
      type: 'string',
      enum: ['json', 'text'],
      description: 'output format',
    });
    expect(schema.properties.k).toEqual({ type: 'number', default: 5, description: 'top k' });
    expect(schema.properties.tags).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: 'labels',
    });
    expect(schema.properties.inner).toEqual({ type: 'string', description: 'inner text' });
    expect(schema.required).toEqual(['query', 'tags']);
  });

  it('should type a refined number as number', () => {
    const schema = paramsToJsonSchema({
      budget: z
        .number()
        .int()
        .refine((n) => n >= 1, 'must be >= 1')
        .describe('token budget'),
    })!;

    expect(schema.properties.budget).toEqual({ type: 'number', description: 'token budget' });
  });

  it('should allow null for nullable fields with an anyOf null branch', () => {
    const schema = paramsToJsonSchema({
      count: z.number().nullable(),
      note: z.string().nullable().describe('free text'),
      label: z.string().describe('inner label').nullable(),
      mode: z.enum(['a', 'b']).nullable(),
      meta: z.object({ id: z.number() }).nullable(),
      free: z.any().nullable(),
    })!;

    expect(schema.properties.count).toEqual({ anyOf: [{ type: 'number' }, { type: 'null' }] });
    // 설명은 .nullable() 앞뒤 어디에 붙여도 감싼 쪽에 둔다
    expect(schema.properties.note).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'free text',
    });
    expect(schema.properties.label).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'inner label',
    });
    expect(schema.properties.mode).toEqual({
      anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }],
    });
    expect(schema.properties.meta).toEqual({
      anyOf: [
        { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        { type: 'null' },
      ],
    });
    // {}는 이미 null을 받는다
    expect(schema.properties.free).toEqual({});
    // 타입 배열을 쓰지 않는다 (단일 type만 받는 클라이언트용)
    expect(JSON.stringify(schema)).not.toContain('"type":[');
    // nullable은 optional이 아니다
    expect(schema.required).toEqual(['count', 'note', 'label', 'mode', 'meta', 'free']);
  });
});

describe('tools/list outputSchema', () => {
  it('should emit nullable output fields that accept null', async () => {
    const engine = new McpProtocolEngine({
      name: 'output-test',
      version: '1.0.0',
      tools: [
        {
          name: 'stats',
          outputSchema: { count: z.number().nullable(), note: z.string().nullable() },
          handler: async () => ({ count: 3, note: null }),
        },
      ],
      resources: [],
      prompts: [],
      callTool: async () => [{ type: 'text', text: '{"count":3,"note":null}' }],
    });

    const res = await engine.handleMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    expect(res.result.tools[0].outputSchema).toEqual({
      type: 'object',
      properties: {
        count: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['count', 'note'],
    });
  });
});

describe('validation error text — Expected schema', () => {
  it('should list Zod params with their type and optionality', async () => {
    const tool = {
      name: 'search',
      params: {
        name: z.string(),
        limit: z.number().optional(),
        note: z.string().nullable(),
        mode: 'string?' as const,
        email: { type: 'string' as const, optional: true },
      },
      handler: async () => 'ok',
    };
    const res: any = await validationMiddleware().before!({
      tool,
      params: {},
      requestId: 'r1',
      serverName: 's1',
      startedAt: Date.now(),
      meta: {},
    });

    const text: string = res.abortResponse.content[0].text;
    expect(text).toContain('Expected schema:\n  - name: string\n');
    expect(text).toContain('  - limit: number (optional)\n');
    expect(text).toContain('  - note: string | null\n');
    expect(text).toContain('  - mode: string?\n');
    expect(text).toContain('  - email: string (optional)');
    expect(text).not.toContain('any (optional)');
  });
});
