// @airmcp-dev/core — __tests__/prompt-args.test.ts
//
// prompts/get 필수 인자 확인 (MCP 스펙 server/prompts, Error Handling):
// 필수 인자가 빠지면 템플릿을 그리지 않고 -32602 (Invalid params)를 돌려준다.

import { describe, it, expect } from 'vitest';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';
import { definePrompt } from '../src/prompt/define-prompt.js';

function getPrompt(params: Record<string, any>) {
  const engine = new McpProtocolEngine({
    name: 'prompt-args-test',
    version: '1.0.0',
    tools: [],
    resources: [],
    prompts: [
      definePrompt('review', {
        description: 'Code review',
        arguments: [
          { name: 'code', required: true },
          { name: 'language', required: false },
        ],
        handler: ({ code, language }) => [
          { role: 'user', content: `Review (${language ?? 'any'}):\n${code}` },
        ],
      }),
    ],
    callTool: async () => [],
  });
  return engine.handleMessage({ jsonrpc: '2.0', id: 1, method: 'prompts/get', params });
}

describe('prompts/get required arguments', () => {
  it('should render when the required argument is given and optional ones are omitted', async () => {
    const res = await getPrompt({ name: 'review', arguments: { code: 'let x = 1;' } });
    expect(res.error).toBeUndefined();
    expect(res.result.messages[0].content.text).toBe('Review (any):\nlet x = 1;');
  });

  it('should return -32602 when arguments are omitted', async () => {
    const res = await getPrompt({ name: 'review' });
    expect(res.result).toBeUndefined();
    expect(res.error).toEqual({
      code: -32602,
      message: 'Missing required arguments for prompt review: code',
    });
  });

  it('should return -32602 when only optional arguments are given', async () => {
    const res = await getPrompt({ name: 'review', arguments: { language: 'ts' } });
    expect(res.error?.code).toBe(-32602);
  });

  it('should return -32602 when a required argument is null', async () => {
    const res = await getPrompt({ name: 'review', arguments: { code: null } });
    expect(res.error?.code).toBe(-32602);
  });
});
