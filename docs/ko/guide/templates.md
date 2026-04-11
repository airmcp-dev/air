# 템플릿

`air create` 명령어는 템플릿에서 프로젝트를 생성합니다. 각 템플릿은 바로 실행 가능한 MCP 서버입니다.

## 사용 가능한 템플릿

| 템플릿 | 설명 |
|--------|------|
| `basic` | 도구 하나의 최소 서버. 학습용. |
| `api` | 외부 API 래핑. 인증과 재시도 플러그인 포함. |
| `crud` | 파일 기반 스토리지 CRUD 도구 (create, read, update, delete). |
| `agent` | think-execute-remember 패턴의 에이전트 서버. L6/L7 계층 힌트. |

## 사용법

```bash
air create my-server                       # basic (기본)
air create my-server --template api        # 특정 템플릿
air create my-server --template basic --lang ko  # 한국어 주석
```

## 프로젝트 구조

모든 템플릿은 동일한 레이아웃을 생성합니다:

```
my-server/
├── src/
│   └── index.ts          # 서버 정의
├── package.json          # @airmcp-dev/core 의존성
└── tsconfig.json         # TypeScript 설정
```

## basic

도구 하나, 플러그인 없음. 가장 간단한 출발점.

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '0.1.0',
  tools: [
    defineTool('hello', {
      description: 'Say hello',
      params: { name: { type: 'string', description: 'Your name' } },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

## api

외부 API를 래핑하는 도구 서버. `fetch` 헬퍼로 외부 API를 호출하고 결과를 MCP 도구로 노출합니다.

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const BASE_URL = process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com';
const API_KEY = process.env.API_KEY || '';

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

const server = defineServer({
  name: 'my-api-server',
  version: '0.1.0',
  tools: [
    defineTool('fetch', {
      description: 'Fetch data from the API',
      params: { path: { type: 'string', description: 'API endpoint (e.g. /users)' } },
      handler: async ({ path }) => apiFetch(path),
    }),
    defineTool('post', {
      description: 'Create data via API',
      params: {
        path: { type: 'string', description: 'API endpoint' },
        body: { type: 'string', description: 'JSON string of request body' },
      },
      handler: async ({ path, body }) => apiFetch(path, { method: 'POST', body }),
    }),
    defineTool('search', {
      description: 'Search with query parameters',
      params: {
        path: { type: 'string', description: 'API endpoint' },
        query: { type: 'string', description: 'Query string (e.g. "q=hello&limit=10")' },
      },
      handler: async ({ path, query }) => {
        const sep = path.includes('?') ? '&' : '?';
        return apiFetch(`${path}${sep}${query}`);
      },
    }),
  ],
});

server.start();
```

환경변수 설정:
- `API_BASE_URL` — 외부 API의 기본 URL
- `API_KEY` — Bearer 토큰 (선택)

## crud

4개 CRUD 도구와 인메모리 스토리지. 실제로는 DB로 교체하여 사용합니다.

```typescript
import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

const store = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-crud-server',
  version: '0.1.0',
  tools: [
    defineTool('create', {
      description: 'Create a new record',
      params: {
        collection: { type: 'string', description: 'Collection name' },
        data: { type: 'string', description: 'JSON string of record data' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(id, { ...record, _id: id, _collection: collection });
        return { id, message: `Created in ${collection}` };
      },
    }),
    defineTool('read', { /* ... */ }),
    defineTool('update', { /* ... */ }),
    defineTool('delete', { /* ... */ }),
  ],
});

server.start();
```

## agent

think-execute-remember 패턴의 AI 에이전트 서버. LLM 연동 없이 구조만 제공 — 사용자가 LLM 호출을 추가합니다.

```typescript
import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

const memory = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-agent-server',
  version: '0.1.0',
  tools: [
    defineTool('think', {
      description: 'Analyze a problem and produce a plan',
      params: {
        problem: { type: 'string', description: 'Problem statement' },
        context: { type: 'string', description: 'Additional context', optional: true },
      },
      handler: async ({ problem, context }) => {
        // TODO: LLM 호출 연결
        const plan = {
          problem,
          steps: ['Understand', 'Gather data', 'Execute', 'Verify'],
          reasoning: 'Replace with LLM-generated reasoning',
        };
        await memory.set(`thought_${Date.now()}`, { ...plan, timestamp: new Date().toISOString() });
        return plan;
      },
    }),
    defineTool('execute', {
      description: 'Execute a step from the plan',
      params: {
        step: { type: 'string', description: 'Step to execute' },
        input: { type: 'string', description: 'Input data', optional: true },
      },
      handler: async ({ step, input }) => {
        // TODO: 실제 실행 로직 (파일, API, DB 등)
        const result = { step, status: 'completed', output: `Executed: ${step}` };
        await memory.set(`exec_${Date.now()}`, result);
        return result;
      },
    }),
    defineTool('remember', {
      description: 'Store or recall from agent memory',
      params: {
        action: { type: 'string', description: '"store" or "recall"' },
        key: { type: 'string', description: 'Memory key' },
        value: { type: 'string', description: 'Value to store', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set(key, { value, timestamp: new Date().toISOString() });
          return { action: 'stored', key };
        }
        if (action === 'recall') {
          const data = await memory.get(key);
          return data ? { action: 'recall', key, found: true, data } : { action: 'recall', key, found: false };
        }
        return { error: 'Invalid action. Use "store" or "recall".' };
      },
    }),
  ],
});

server.start();
```

## 언어 변형

모든 템플릿에 한국어 변형이 있습니다 (예: `basic-ko`). `--lang ko`로 선택하면 주석과 설명이 한국어로 제공됩니다.
