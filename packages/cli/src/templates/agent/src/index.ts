// my-agent-server — src/index.ts
//
// AI 에이전트 도구 서버 템플릿.
// think + execute + remember 패턴.
// LLM 호출 없이 구조만 제공 — 사용자가 LLM 연동을 추가.

import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

// 에이전트 메모리 (인메모리, 실제로는 벡터DB 등으로 교체)
const memory = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-agent-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: 'AI agent with think-execute-remember pattern',

  tools: [
    defineTool('think', {
      description: 'Analyze a problem and produce a plan',
      params: {
        problem: { type: 'string', description: 'Problem statement or question' },
        context: { type: 'string', description: 'Additional context (optional)', optional: true },
      },
      handler: async ({ problem, context }) => {
        // TODO: 여기에 LLM 호출을 연결
        // const plan = await llm.generate(`Analyze: ${problem}\nContext: ${context}`);
        const plan = {
          problem,
          steps: [
            'Step 1: Understand the problem',
            'Step 2: Gather relevant data',
            'Step 3: Execute solution',
            'Step 4: Verify result',
          ],
          reasoning: 'Replace this with LLM-generated reasoning',
        };

        // 사고 과정을 메모리에 저장
        const id = `thought_${Date.now()}`;
        await memory.set(id, { ...plan, timestamp: new Date().toISOString() });

        return plan;
      },
    }),

    defineTool('execute', {
      description: 'Execute a step from the plan',
      params: {
        step: { type: 'string', description: 'Step description to execute' },
        input: { type: 'string', description: 'Input data for the step (optional)', optional: true },
      },
      handler: async ({ step, input }) => {
        // TODO: 여기에 실제 실행 로직을 연결
        // 파일 조작, API 호출, DB 쿼리 등
        const result = {
          step,
          status: 'completed',
          output: `Executed: ${step}`,
          timestamp: new Date().toISOString(),
        };

        // 실행 결과를 메모리에 저장
        const id = `exec_${Date.now()}`;
        await memory.set(id, result);

        return result;
      },
    }),

    defineTool('remember', {
      description: 'Store or recall information from agent memory',
      params: {
        action: { type: 'string', description: '"store" or "recall"' },
        key: { type: 'string', description: 'Memory key' },
        value: { type: 'string', description: 'Value to store (for store action)', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set(key, { value, timestamp: new Date().toISOString() });
          return { action: 'stored', key };
        }

        if (action === 'recall') {
          const data = await memory.get(key);
          if (!data) return { action: 'recall', key, found: false };
          return { action: 'recall', key, found: true, data };
        }

        return { error: 'Invalid action. Use "store" or "recall".' };
      },
    }),
  ],
});

server.start();
