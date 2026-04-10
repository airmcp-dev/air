// my-agent-server — src/index.ts
//
// AI 에이전트 도구 서버 템플릿.
// 생각(think) + 실행(execute) + 기억(remember) 패턴.
// LLM 연동은 직접 추가하세요.

import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

// 에이전트 메모리 (인메모리, 실제로는 벡터DB 등으로 교체하세요)
const memory = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-agent-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: '생각-실행-기억 패턴의 AI 에이전트 서버',

  tools: [
    defineTool('think', {
      description: '문제를 분석하고 실행 계획을 세웁니다',
      params: {
        problem: { type: 'string', description: '문제 또는 질문' },
        context: { type: 'string', description: '추가 맥락 (선택)', optional: true },
      },
      handler: async ({ problem, context }) => {
        // TODO: 여기에 LLM 호출을 연결하세요
        const plan = {
          problem,
          steps: [
            '1단계: 문제 이해',
            '2단계: 관련 데이터 수집',
            '3단계: 해결책 실행',
            '4단계: 결과 검증',
          ],
          reasoning: 'LLM 추론 결과로 교체하세요',
        };

        const id = `thought_${Date.now()}`;
        await memory.set(id, { ...plan, timestamp: new Date().toISOString() });
        return plan;
      },
    }),

    defineTool('execute', {
      description: '계획의 단계를 실행합니다',
      params: {
        step: { type: 'string', description: '실행할 단계 설명' },
        input: { type: 'string', description: '입력 데이터 (선택)', optional: true },
      },
      handler: async ({ step, input }) => {
        // TODO: 여기에 실제 실행 로직을 연결하세요
        const result = {
          step,
          status: '완료',
          output: `실행됨: ${step}`,
          timestamp: new Date().toISOString(),
        };

        const id = `exec_${Date.now()}`;
        await memory.set(id, result);
        return result;
      },
    }),

    defineTool('remember', {
      description: '에이전트 메모리에 정보를 저장하거나 불러옵니다',
      params: {
        action: { type: 'string', description: '"store" 또는 "recall"' },
        key: { type: 'string', description: '메모리 키' },
        value: { type: 'string', description: '저장할 값 (store 시)', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set(key, { value, timestamp: new Date().toISOString() });
          return { action: '저장됨', key };
        }

        if (action === 'recall') {
          const data = await memory.get(key);
          if (!data) return { action: '조회', key, found: false };
          return { action: '조회', key, found: true, data };
        }

        return { error: '올바르지 않은 action입니다. "store" 또는 "recall"을 사용하세요.' };
      },
    }),
  ],
});

server.start();
