// @airmcp-dev/core — __tests__/workers-adapter.test.ts
//
// Workers transport의 resources/read, prompts/get 핸들러 테스트

import { describe, it, expect } from 'vitest';
import { createWorkersFetchHandler } from '../src/transport/workers-adapter.js';
import type { WorkersTransportConfig } from '../src/transport/workers-adapter.js';

function createConfig(overrides?: Partial<WorkersTransportConfig>): WorkersTransportConfig {
  return {
    name: 'test-server',
    version: '1.0.0',
    tools: [],
    resources: [
      {
        uri: 'note://docs/readme',
        name: 'readme',
        description: 'README file',
        mimeType: 'text/plain',
        handler: async (uri) => `Content of ${uri}`,
      },
      {
        uri: 'file:///{path}',
        name: 'file',
        mimeType: 'text/plain',
        handler: async (uri) => `File: ${uri}`,
      },
    ],
    prompts: [
      {
        name: 'summarize',
        description: 'Summarize text',
        arguments: [{ name: 'text', required: true }],
        handler: ({ text }) => [
          { role: 'user' as const, content: `Summarize: ${text}` },
        ],
      },
      {
        name: 'translate',
        description: 'Translate text',
        arguments: [{ name: 'text', required: true }, { name: 'lang', required: true }],
        handler: ({ text, lang }) => [
          { role: 'user' as const, content: `Translate to ${lang}: ${text}` },
        ],
      },
    ],
    callTool: async () => 'ok',
    ...overrides,
  };
}

function makeRequest(method: string, params?: any): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
}

describe('Workers adapter — resources/read', () => {
  it('should read a static resource by exact URI', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('resources/read', { uri: 'note://docs/readme' }));
    const body = await res.json() as any;

    expect(body.result.contents).toHaveLength(1);
    expect(body.result.contents[0].uri).toBe('note://docs/readme');
    expect(body.result.contents[0].text).toBe('Content of note://docs/readme');
    expect(body.result.contents[0].mimeType).toBe('text/plain');
  });

  it('should read a template resource by pattern match', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('resources/read', { uri: 'file:///hello.txt' }));
    const body = await res.json() as any;

    expect(body.result.contents).toHaveLength(1);
    expect(body.result.contents[0].uri).toBe('file:///hello.txt');
    expect(body.result.contents[0].text).toBe('File: file:///hello.txt');
  });

  it('should return error for missing uri param', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('resources/read', {}));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain('Missing required param');
  });

  it('should return error for unknown resource URI', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('resources/read', { uri: 'unknown://foo' }));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain('Resource not found');
  });

  it('should handle blob resource content', async () => {
    const config = createConfig({
      resources: [
        {
          uri: 'image://logo',
          name: 'logo',
          mimeType: 'image/png',
          handler: async () => ({ blob: 'iVBORw0KGgo=', mimeType: 'image/png' }),
        },
      ],
    });
    const handler = createWorkersFetchHandler(config);
    const res = await handler(makeRequest('resources/read', { uri: 'image://logo' }));
    const body = await res.json() as any;

    expect(body.result.contents[0].blob).toBe('iVBORw0KGgo=');
    expect(body.result.contents[0].mimeType).toBe('image/png');
  });

  it('should handle handler errors gracefully', async () => {
    const config = createConfig({
      resources: [
        {
          uri: 'error://fail',
          name: 'fail',
          handler: async () => { throw new Error('disk read error'); },
        },
      ],
    });
    const handler = createWorkersFetchHandler(config);
    const res = await handler(makeRequest('resources/read', { uri: 'error://fail' }));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32603);
    expect(body.error.message).toBe('disk read error');
  });
});

describe('Workers adapter — prompts/get', () => {
  it('should get a prompt by name', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('prompts/get', {
      name: 'summarize',
      arguments: { text: 'Hello world' },
    }));
    const body = await res.json() as any;

    expect(body.result.description).toBe('Summarize text');
    expect(body.result.messages).toHaveLength(1);
    expect(body.result.messages[0].role).toBe('user');
    expect(body.result.messages[0].content.type).toBe('text');
    expect(body.result.messages[0].content.text).toBe('Summarize: Hello world');
  });

  it('should pass multiple arguments to prompt handler', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('prompts/get', {
      name: 'translate',
      arguments: { text: 'Hello', lang: 'ko' },
    }));
    const body = await res.json() as any;

    expect(body.result.messages[0].content.text).toBe('Translate to ko: Hello');
  });

  it('should return error for missing name param', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('prompts/get', {}));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain('Missing required param');
  });

  it('should return error for unknown prompt name', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('prompts/get', { name: 'nonexistent' }));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain('Prompt not found');
  });

  it('should handle handler errors gracefully', async () => {
    const config = createConfig({
      prompts: [
        {
          name: 'broken',
          description: 'Broken prompt',
          handler: () => { throw new Error('template error'); },
        },
      ],
    });
    const handler = createWorkersFetchHandler(config);
    const res = await handler(makeRequest('prompts/get', { name: 'broken' }));
    const body = await res.json() as any;

    expect(body.error.code).toBe(-32603);
    expect(body.error.message).toBe('template error');
  });
});

describe('Workers adapter — initialize capabilities', () => {
  it('should declare resources and prompts capabilities', async () => {
    const handler = createWorkersFetchHandler(createConfig());
    const res = await handler(makeRequest('initialize'));
    const body = await res.json() as any;

    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.capabilities.resources).toBeDefined();
    expect(body.result.capabilities.prompts).toBeDefined();
  });
});
