// air 적합성 테스트용 서버
// MCP conformance suite가 기대하는 도구/리소스/프롬프트를 전부 등록

import { defineServer, defineTool, defineResource, definePrompt } from '../src/index.js';

// Base64 인코딩된 1x1 투명 PNG
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// Base64 인코딩된 짧은 오디오 (silence)
const TINY_AUDIO_B64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const server = defineServer({
  name: 'air-conformance',
  version: '1.0.0',
  transport: { type: 'http', port: 19789 },
  tools: [
    // ── conformance 필수 도구 ──
    defineTool('test_simple_text', {
      description: 'Returns simple text content',
      params: { input: 'string?' },
      handler: async ({ input }) => input || 'Hello, World!',
    }),
    defineTool('test_image_content', {
      description: 'Returns image content',
      params: {},
      handler: async () => ({
        content: [{ type: 'image', data: TINY_PNG_B64, mimeType: 'image/png' }],
      }),
    }),
    defineTool('test_audio_content', {
      description: 'Returns audio content',
      params: {},
      handler: async () => ({
        content: [{ type: 'audio', data: TINY_AUDIO_B64, mimeType: 'audio/wav' }],
      }),
    }),
    defineTool('test_embedded_resource', {
      description: 'Returns embedded resource content',
      params: {},
      handler: async () => ({
        content: [{
          type: 'resource',
          resource: { uri: 'test://embedded', mimeType: 'text/plain', text: 'Embedded content' },
        }],
      }),
    }),
    defineTool('test_multiple_content_types', {
      description: 'Returns multiple content types',
      params: {},
      handler: async () => ({
        content: [
          { type: 'text', text: 'Here is some text' },
          { type: 'image', data: TINY_PNG_B64, mimeType: 'image/png' },
        ],
      }),
    }),
    defineTool('test_tool_with_logging', {
      description: 'A tool that logs during execution',
      params: {},
      handler: async () => 'Logged and done',
    }),
    defineTool('test_error_handling', {
      description: 'A tool that throws an error',
      params: {},
      handler: async () => {
        throw new Error('Intentional test error');
      },
    }),
    defineTool('test_tool_with_progress', {
      description: 'A tool that reports progress',
      params: { steps: 'number?' },
      handler: async ({ steps }) => {
        const s = steps ?? 3;
        return `Completed ${s} steps`;
      },
    }),
    defineTool('test_sampling', {
      description: 'A tool that uses sampling',
      params: {},
      handler: async () => 'Sampling result',
    }),
    defineTool('test_elicitation', {
      description: 'A tool that uses elicitation',
      params: {},
      handler: async (_params, ctx) => {
        if (ctx.elicit) {
          const result = await ctx.elicit('Please provide input', {
            value: { type: 'string', description: 'A value' },
          });
          if (result.action === 'accept') return `Got: ${result.content?.value}`;
          return 'Elicitation declined';
        }
        return 'No elicitation support';
      },
    }),
    defineTool('test_elicitation_sep1034_defaults', {
      description: 'Tests elicitation with defaults',
      params: {},
      handler: async (_params, ctx) => {
        if (ctx.elicit) {
          const result = await ctx.elicit('Provide defaults', {
            name: { type: 'string', description: 'Name' },
          });
          if (result.action === 'accept') return `Name: ${result.content?.name}`;
          return 'Declined';
        }
        return 'No elicitation';
      },
    }),
    defineTool('test_elicitation_sep1330_enums', {
      description: 'Tests elicitation with enums',
      params: {},
      handler: async (_params, ctx) => {
        if (ctx.elicit) {
          const result = await ctx.elicit('Choose color', {
            color: { type: 'string', description: 'Color choice' },
          });
          if (result.action === 'accept') return `Color: ${result.content?.color}`;
          return 'Declined';
        }
        return 'No elicitation';
      },
    }),
  ],
  resources: [
    defineResource('test://static-text', {
      name: 'Static Text Resource',
      description: 'A static text resource',
      mimeType: 'text/plain',
      handler: async () => 'This is static text content',
    }),
    defineResource('test://static-binary', {
      name: 'Static Binary Resource',
      description: 'A static binary resource',
      mimeType: 'application/octet-stream',
      handler: async () => ({ blob: TINY_PNG_B64, mimeType: 'application/octet-stream' }),
    }),
    defineResource('test://template/{id}/data', {
      name: 'Template Resource',
      description: 'A templated resource',
      mimeType: 'text/plain',
      handler: async (uri: string) => `Data for ${uri}`,
    }),
  ],
  prompts: [
    definePrompt('test_simple_prompt', {
      description: 'A simple prompt',
      arguments: [],
      handler: () => [
        { role: 'user', content: 'Hello from simple prompt' },
      ],
    }),
    definePrompt('test_prompt_with_arguments', {
      description: 'A prompt with arguments',
      arguments: [
        { name: 'name', description: 'Name to greet', required: true },
        { name: 'style', description: 'Greeting style', required: false },
      ],
      handler: ({ name, style }) => [
        { role: 'user', content: `Hello, ${name}!${style ? ` Style: ${style}` : ''}` },
      ],
    }),
    definePrompt('test_prompt_with_embedded_resource', {
      description: 'A prompt with embedded resource',
      arguments: [],
      handler: () => [
        { role: 'user', content: 'Here is a resource reference' },
      ],
    }),
    definePrompt('test_prompt_with_image', {
      description: 'A prompt with image',
      arguments: [],
      handler: () => [
        { role: 'user', content: 'Here is an image prompt' },
      ],
    }),
  ],
});

await server.start();
console.log('[conformance] Server ready at http://localhost:19789/mcp');
