# 예제: AI 에이전트

think → execute → remember 패턴의 에이전트 서버. AI가 문제를 분석하고, 계획을 실행하고, 결과를 기억합니다.

## 프로젝트 생성

```bash
npx @airmcp-dev/cli create my-agent --template agent --lang ko
cd my-agent
npm install
```

## 전체 코드

```typescript
// src/index.ts
import {
  defineServer, defineTool, createStorage, onShutdown,
  retryPlugin, timeoutPlugin,
} from '@airmcp-dev/core';

// 에이전트 메모리
const memory = await createStorage({ type: 'file', path: '.air/memory' });

const server = defineServer({
  name: 'my-agent',
  version: '1.0.0',
  description: 'AI 에이전트 — think, execute, remember',

  transport: { type: 'sse', port: 3510 },

  use: [
    timeoutPlugin(60_000),             // 에이전트는 오래 걸릴 수 있으므로 60초
    retryPlugin({ maxRetries: 1 }),    // 실패 시 1회 재시도
  ],

  tools: [
    defineTool('think', {
      description: '문제를 분석하고 실행 계획을 생성합니다',
      layer: 7,                        // L7: 에이전트 체인
      params: {
        problem: { type: 'string', description: '해결할 문제 또는 질문' },
        context: { type: 'string', description: '추가 맥락 (선택)', optional: true },
      },
      handler: async ({ problem, context }, ctx) => {
        // TODO: LLM 연동
        // const plan = await llm.generate(`분석: ${problem}\n맥락: ${context}`);

        const plan = {
          problem,
          steps: [
            '1단계: 문제 이해 및 분해',
            '2단계: 관련 데이터 수집',
            '3단계: 해결 방안 실행',
            '4단계: 결과 검증',
          ],
          reasoning: 'LLM 추론 결과로 교체하세요',
        };

        // 사고 과정을 메모리에 저장
        const id = `thought_${Date.now()}`;
        await memory.set('thoughts', id, {
          ...plan,
          timestamp: new Date().toISOString(),
        });

        return plan;
      },
    }),

    defineTool('execute', {
      description: '계획의 단계를 실행합니다',
      layer: 6,
      params: {
        step: { type: 'string', description: '실행할 단계 설명' },
        input: { type: 'string', description: '단계의 입력 데이터 (선택)', optional: true },
      },
      handler: async ({ step, input }) => {
        // TODO: 실제 실행 로직 (파일 조작, API 호출, DB 쿼리 등)
        const result = {
          step,
          status: 'completed',
          output: `실행 완료: ${step}`,
          timestamp: new Date().toISOString(),
        };

        // 실행 결과를 메모리에 저장
        await memory.set('executions', `exec_${Date.now()}`, result);

        return result;
      },
    }),

    defineTool('remember', {
      description: '에이전트 메모리에 정보를 저장하거나 조회합니다',
      layer: 1,
      params: {
        action: { type: 'string', description: '"store" 또는 "recall"' },
        key: { type: 'string', description: '메모리 키' },
        value: { type: 'string', description: '저장할 값 (store 시)', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set('facts', key, {
            value,
            storedAt: new Date().toISOString(),
          });
          return { action: 'stored', key };
        }

        if (action === 'recall') {
          const data = await memory.get('facts', key);
          return data
            ? { action: 'recall', key, found: true, data }
            : { action: 'recall', key, found: false };
        }

        return { error: '"store" 또는 "recall"을 사용하세요' };
      },
    }),

    defineTool('memory_search', {
      description: '메모리에서 최근 사고/실행 기록을 검색합니다',
      layer: 2,
      params: {
        type: { type: 'string', description: '"thoughts", "executions", 또는 "facts"' },
        limit: { type: 'number', description: '최대 결과 수', optional: true },
      },
      handler: async ({ type, limit }) => {
        const entries = await memory.entries(type);
        const sorted = entries.sort((a: any, b: any) =>
          (b.value.timestamp || b.value.storedAt || '').localeCompare(
            a.value.timestamp || a.value.storedAt || ''
          )
        );
        return sorted.slice(0, limit || 10);
      },
    }),
  ],
});

onShutdown(async () => {
  await memory.close();
});

server.start();
```

## 사용 시나리오

Claude에서:

1. **문제 분석**: "우리 앱의 로그인 실패율이 높은 원인을 분석해줘" → `think` 호출
2. **단계 실행**: "1단계를 실행해줘: 로그 데이터 수집" → `execute` 호출
3. **결과 기억**: "분석 결과를 'login-issue-2025'로 저장해줘" → `remember(store)` 호출
4. **과거 조회**: "이전에 분석한 'login-issue-2025'를 가져와줘" → `remember(recall)` 호출
5. **기록 검색**: "최근 사고 과정 5개를 보여줘" → `memory_search(thoughts, 5)` 호출

## Meter 분류

| 도구 | 계층 | 이유 |
|------|------|------|
| `think` | L7 | 에이전트 추론 (LLM 연동 시 높은 비용) |
| `execute` | L6 | 외부 액션 실행 |
| `remember` | L1 | 단순 key-value 조회/저장 |
| `memory_search` | L2 | 메모리 검색 |

## LLM 연동

`think` 도구에 실제 LLM을 연결하려면:

```typescript
// OpenAI 예시
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

handler: async ({ problem, context }) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: '문제를 분석하고 단계별 계획을 JSON으로 반환하세요.' },
      { role: 'user', content: `문제: ${problem}\n맥락: ${context || '없음'}` },
    ],
    response_format: { type: 'json_object' },
  });

  const plan = JSON.parse(response.choices[0].message.content!);
  await memory.set('thoughts', `thought_${Date.now()}`, plan);
  return plan;
},
```
