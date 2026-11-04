// @airmcp-dev/core — __tests__/prompt-content.test.ts
//
// prompts/get 메시지 콘텐츠 (MCP 스펙 server/prompts, PromptMessage.content):
// 문자열은 text 콘텐츠로 감싸고, 콘텐츠 객체(image/audio/resource/resource_link)는 그대로 전달한다.

import { describe, it, expect } from 'vitest';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';
import { definePrompt } from '../src/prompt/define-prompt.js';

const PNG = 'iVBORw0KGgo=';

const engine = new McpProtocolEngine({
  name: 'prompt-content-test',
  version: '1.0.0',
  tools: [],
  resources: [],
  prompts: [
    definePrompt('plain', {
      handler: () => [{ role: 'user', content: 'just text' }],
    }),
    definePrompt('mixed', {
      arguments: [{ name: 'uri', required: true }],
      handler: ({ uri }) => [
        { role: 'user', content: 'look at this' },
        { role: 'user', content: { type: 'image', data: PNG, mimeType: 'image/png' } },
        { role: 'assistant', content: { type: 'audio', data: 'AAAA', mimeType: 'audio/wav' } },
        { role: 'user', content: { type: 'resource', resource: { uri, mimeType: 'text/plain', text: 'body' } } },
        { role: 'user', content: { type: 'resource_link', uri: 'file:///a.txt', name: 'a.txt' } },
      ],
    }),
  ],
  callTool: async () => [],
});

const get = (name: string, args?: Record<string, string>) =>
  engine.handleMessage({ jsonrpc: '2.0', id: 1, method: 'prompts/get', params: { name, arguments: args } });

describe('prompts/get message content', () => {
  it('should wrap a string as text content', async () => {
    const res = await get('plain');
    expect(res.result.messages).toEqual([{ role: 'user', content: { type: 'text', text: 'just text' } }]);
  });

  it('should pass content objects through unchanged', async () => {
    const res = await get('mixed', { uri: 'test://doc' });
    const contents = res.result.messages.map((m: any) => m.content);
    expect(contents).toEqual([
      { type: 'text', text: 'look at this' },
      { type: 'image', data: PNG, mimeType: 'image/png' },
      { type: 'audio', data: 'AAAA', mimeType: 'audio/wav' },
      { type: 'resource', resource: { uri: 'test://doc', mimeType: 'text/plain', text: 'body' } },
      { type: 'resource_link', uri: 'file:///a.txt', name: 'a.txt' },
    ]);
    expect(res.result.messages.map((m: any) => m.role)).toEqual(['user', 'user', 'assistant', 'user', 'user']);
  });
});
