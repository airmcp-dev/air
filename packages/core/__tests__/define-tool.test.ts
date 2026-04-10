// @airmcp-dev/core — __tests__/define-tool.test.ts

import { describe, it, expect } from 'vitest';
import { defineTool } from '../src/tool/define-tool.js';

describe('defineTool', () => {
  it('should create a tool definition with name and handler', () => {
    const tool = defineTool('greet', {
      handler: async ({ name }: any) => `Hello, ${name}!`,
    });

    expect(tool.name).toBe('greet');
    expect(tool.handler).toBeTypeOf('function');
  });

  it('should include description when provided', () => {
    const tool = defineTool('search', {
      description: 'Search for items',
      handler: async () => 'results',
    });

    expect(tool.description).toBe('Search for items');
  });

  it('should include params when provided', () => {
    const tool = defineTool('query', {
      params: {
        q: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
      },
      handler: async () => 'ok',
    });

    expect(tool.params).toBeDefined();
    expect(tool.params!.q).toEqual({ type: 'string', description: 'Search query' });
  });

  it('should execute handler correctly', async () => {
    const tool = defineTool('add', {
      handler: async ({ a, b }: any) => a + b,
    });

    const result = await tool.handler({ a: 2, b: 3 }, {} as any);
    expect(result).toBe(5);
  });
});
