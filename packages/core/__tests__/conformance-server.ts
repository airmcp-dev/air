// air 적합성 테스트용 서버
// MCP conformance suite가 기대하는 도구/리소스/프롬프트를 전부 등록

import { defineServer, defineTool, defineResource, definePrompt } from '../src/index.js';

// Base64 인코딩된 1x1 투명 PNG
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// Base64 인코딩된 짧은 오디오 (silence)
const TINY_AUDIO_B64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
          {
            type: 'resource',
            resource: { uri: 'test://mixed', mimeType: 'text/plain', text: 'Mixed resource content' },
          },
        ],
      }),
    }),
    defineTool('test_tool_with_logging', {
      description: 'A tool that logs during execution',
      params: {},
      handler: async (_params, ctx) => {
        ctx.log('info', 'Tool execution started', 'test');
        await sleep(50);
        ctx.log('info', 'Tool processing data', 'test');
        await sleep(50);
        ctx.log('info', 'Tool execution completed', 'test');
        return 'Logged and done';
      },
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
      handler: async ({ steps }, ctx) => {
        const s = steps ?? 3;
        ctx.progress(0, 100);
        await sleep(50);
        ctx.progress(50, 100);
        await sleep(50);
        ctx.progress(100, 100);
        return `Completed ${s} steps`;
      },
    }),
    defineTool('test_sampling', {
      description: 'A tool that uses sampling',
      params: { prompt: 'string?' },
      // sampling/createMessage는 아직 미지원 — 베이스라인에 기록됨
      handler: async () => 'Sampling result',
    }),
    defineTool('test_elicitation', {
      description: 'A tool that uses elicitation',
      params: { message: 'string?' },
      handler: async ({ message }, ctx) => {
        if (!ctx.elicit) return { content: [{ type: 'text', text: 'Client does not support elicitation' }], isError: true };
        const result = await ctx.elicit(message ?? 'Please provide input', {
          username: { type: 'string', description: "User's response", required: true },
          email: { type: 'string', description: "User's email address", required: true },
        });
        return `User response: action=${result.action}, content=${JSON.stringify(result.content ?? {})}`;
      },
    }),
    defineTool('test_elicitation_sep1034_defaults', {
      description: 'Tests elicitation with defaults',
      params: {},
      handler: async (_params, ctx) => {
        if (!ctx.elicit) return { content: [{ type: 'text', text: 'Client does not support elicitation' }], isError: true };
        const result = await ctx.elicit('Provide defaults', {
          name: { type: 'string', description: 'User name', default: 'John Doe' },
          age: { type: 'integer', description: 'User age', default: 30 },
          score: { type: 'number', description: 'User score', default: 95.5 },
          status: { type: 'string', description: 'User status', enum: ['active', 'inactive', 'pending'], default: 'active' },
          verified: { type: 'boolean', description: 'Verified', default: true },
        });
        return `Elicitation completed: action=${result.action}, content=${JSON.stringify(result.content ?? {})}`;
      },
    }),
    defineTool('test_elicitation_sep1330_enums', {
      description: 'Tests elicitation with enums',
      params: {},
      handler: async (_params, ctx) => {
        if (!ctx.elicit) return { content: [{ type: 'text', text: 'Client does not support elicitation' }], isError: true };
        // 세부 스키마(oneOf/array)가 필요하면 JSON Schema 객체를 그대로 넘긴다
        const result = await ctx.elicit('Choose options', {
          type: 'object',
          properties: {
            untitledSingle: { type: 'string', enum: ['option1', 'option2', 'option3'] },
            titledSingle: {
              type: 'string',
              oneOf: [
                { const: 'value1', title: 'First Option' },
                { const: 'value2', title: 'Second Option' },
                { const: 'value3', title: 'Third Option' },
              ],
            },
            legacyEnum: { type: 'string', enum: ['opt1', 'opt2', 'opt3'], enumNames: ['Option One', 'Option Two', 'Option Three'] },
            untitledMulti: { type: 'array', items: { type: 'string', enum: ['option1', 'option2', 'option3'] } },
            titledMulti: {
              type: 'array',
              items: {
                anyOf: [
                  { const: 'value1', title: 'First Choice' },
                  { const: 'value2', title: 'Second Choice' },
                  { const: 'value3', title: 'Third Choice' },
                ],
              },
            },
          },
        });
        return `Elicitation completed: action=${result.action}, content=${JSON.stringify(result.content ?? {})}`;
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
        { name: 'arg1', description: 'First argument', required: true },
        { name: 'arg2', description: 'Second argument', required: true },
      ],
      handler: ({ arg1, arg2 }) => [
        { role: 'user', content: `Prompt with arguments: arg1='${arg1}', arg2='${arg2}'` },
      ],
    }),
    definePrompt('test_prompt_with_embedded_resource', {
      description: 'A prompt with embedded resource',
      arguments: [{ name: 'resourceUri', description: 'URI of the resource to embed', required: true }],
      handler: ({ resourceUri }) => [
        { role: 'user', content: 'Here is a resource reference' },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: { uri: resourceUri, mimeType: 'text/plain', text: 'Embedded resource content for testing.' },
          },
        },
      ],
    }),
    definePrompt('test_prompt_with_image', {
      description: 'A prompt with image',
      arguments: [],
      handler: () => [
        { role: 'user', content: 'Here is an image prompt' },
        { role: 'user', content: { type: 'image', data: TINY_PNG_B64, mimeType: 'image/png' } },
      ],
    }),
  ],
});

await server.start();
console.log('[conformance] Server ready at http://localhost:19789/mcp');
