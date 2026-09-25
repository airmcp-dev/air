// air 적합성 테스트용 서버
// tools, resources, prompts를 전부 등록하고 HTTP /mcp 엔드포인트로 서빙

import { defineServer, defineTool, defineResource, definePrompt } from '../src/index.js';

const server = defineServer({
  name: 'air-conformance',
  version: '1.0.0',
  transport: { type: 'http', port: 19789 },
  tools: [
    defineTool('echo', {
      description: 'Echo the input message',
      params: { message: { type: 'string', description: 'Message to echo' } },
      handler: async ({ message }) => message,
    }),
    defineTool('add', {
      description: 'Add two numbers',
      params: { a: { type: 'number', description: 'First number' }, b: { type: 'number', description: 'Second number' } },
      handler: async ({ a, b }) => ({ sum: a + b }),
    }),
    defineTool('longRunningOperation', {
      description: 'Simulates a long running operation',
      params: {
        duration: { type: 'number', description: 'Duration in ms', optional: true },
        steps: { type: 'number', description: 'Number of steps', optional: true },
      },
      handler: async ({ duration, steps }) => {
        const d = duration ?? 1000;
        const s = steps ?? 5;
        await new Promise(r => setTimeout(r, Math.min(d, 100)));
        return `Operation completed in ${s} steps`;
      },
    }),
  ],
  resources: [
    defineResource('test://static/resource', {
      name: 'Static Test Resource',
      description: 'A static test resource',
      mimeType: 'text/plain',
      handler: async () => 'This is a static test resource',
    }),
    defineResource('test://static/resource/{id}', {
      name: 'Dynamic Test Resource',
      description: 'A dynamic test resource',
      mimeType: 'text/plain',
      handler: async (uri: string) => `Resource content for ${uri}`,
    }),
  ],
  prompts: [
    definePrompt('simple_prompt', {
      description: 'A simple test prompt',
      arguments: [
        { name: 'name', description: 'Name to use', required: true },
      ],
      handler: ({ name }) => [
        { role: 'user', content: `Hello, ${name}!` },
      ],
    }),
    definePrompt('complex_prompt', {
      description: 'A complex test prompt with multiple messages',
      arguments: [
        { name: 'topic', description: 'Topic to discuss', required: true },
        { name: 'style', description: 'Writing style', required: false },
      ],
      handler: ({ topic, style }) => [
        { role: 'user', content: `Please discuss: ${topic}` },
        { role: 'assistant', content: `I'll discuss ${topic}${style ? ` in a ${style} style` : ''}.` },
      ],
    }),
  ],
});

await server.start();
console.log('[conformance] Server ready at http://localhost:19789/mcp');
