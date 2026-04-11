# MCP SDK로 70줄 짜던 걸 15줄로 줄인 프레임워크를 만들었습니다

> 태그: MCP, TypeScript, 오픈소스, AI, Claude

지난달에 세 번째 MCP 서버를 만들다가 멈췄습니다. 또 같은 보일러플레이트 — Zod 스키마, content 래핑, try/catch, 트랜스포트 설정. 도구 하나마다 반복.

세어보니 **도구 하나에 ~70줄**. 대부분 로직이 아니라 의식(ceremony)이었습니다.

그래서 [air](https://github.com/airmcp-dev/air)를 만들었습니다.

## 문제

MCP SDK로 검색 도구를 만들면 이렇습니다:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool(
  'search',
  'Search documents',
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(results) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

도구 하나입니다. 여기에 재시도? 캐시? 인증? 레이트 리밋? 로깅? 각각 20-50줄씩 직접 구현해야 합니다. 모든 핸들러에.

## 해결

같은 도구를 air로 만들면:

```typescript
import { defineServer, defineTool, retryPlugin, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [
    defineTool('search', {
      description: '문서 검색',
      params: { query: 'string', limit: 'number?' },
      handler: async ({ query, limit }) => doSearch(query, limit),
    }),
  ],
});

server.start();
```

15줄. 재시도와 캐시 포함. Zod import 없음, content 래핑 없음, try/catch 보일러플레이트 없음.

## 뭐가 바뀌었나

**파라미터 단축** — `z.string()` 대신 `'string'`만 쓰면 됩니다. 선택 파라미터? `'number?'`. air가 내부에서 Zod 스키마와 JSON 스키마를 생성합니다.

**자동 content 변환** — 문자열, 숫자, 객체, 배열, null을 반환하면 air가 MCP content 형식으로 래핑합니다. `{ content: [{ type: 'text', text: JSON.stringify(result) }] }` 안 써도 됩니다.

**플러그인 시스템** — 19개 내장 플러그인. `use` 배열에 추가하면 됩니다:

```typescript
use: [
  authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
  sanitizerPlugin(),
  timeoutPlugin(10_000),
  retryPlugin({ maxRetries: 3 }),
  cachePlugin({ ttlMs: 60_000 }),
]
```

순서가 곧 실행 순서. 인증 → 새니타이저 → 타임아웃 → 재시도 → 캐시.

**내장 스토리지** — MemoryStore와 FileStore를 바로 쓸 수 있습니다:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });
await store.set('users', 'u1', { name: 'Alice' }, 3600); // TTL 초 단위
await store.append('logs', { action: 'login' });          // append-only 로그
```

## 로컬 LLM으로 테스트

Ollama에서 llama3.1을 돌리고 air 서버에 연결했습니다. 도구 4개 — 시스템 정보, 노트 관리, 계산기, 메트릭. 자연어로 질문했습니다.

LLM이 올바르게:
- "CPU랑 메모리 알려줘" → `system_info` 호출 ✅
- "Meeting Notes 만들어줘" → `note_create`에 제목/내용/태그 전달 ✅
- "1234 곱하기 5678" → `calc`에 `{ a: 1234, op: '*', b: 5678 }` 전달 → 7,006,652 ✅
- "저장된 노트 보여줘" → `note_list` 호출 ✅
- "MCP가 뭐야?" → **도구 안 씀**, 자체 지식으로 답변 ✅

모든 도구 호출이 air의 플러그인 파이프라인 — 새니타이저, 타임아웃, 재시도, 캐시 — 를 자동으로 통과했습니다.

## 포함된 것

- **19개 플러그인**: timeout, retry, circuit breaker, fallback, cache, dedup, queue, auth, sanitizer, validator, cors, webhook, transform, i18n, json logger, per-user rate limit, dryrun
- **3개 트랜스포트**: stdio, SSE, Streamable HTTP (자동 감지)
- **스토리지**: MemoryStore, FileStore (TTL + append-only 로그)
- **7-Layer Meter**: L1(캐시 히트)~L7(에이전트 체이닝) 호출 분류, 비용 추적
- **CLI**: `npx @airmcp-dev/cli create my-server` — 스캐폴딩, 개발 모드, 클라이언트 등록
- **Gateway**: 멀티서버 프록시, 로드밸런싱, 헬스체크

## 숫자

- npm 5개 패키지, Apache-2.0
- 165개 테스트 통과
- 보안 취약점 0건 (93개 의존성 전부 MIT/ISC/BSD/Apache-2.0)
- [110페이지 문서](https://docs.airmcp.dev) 영한 이중 언어
- 모든 API 시그니처를 소스 코드와 대조 검증

## 써보기

```bash
npm install @airmcp-dev/core
```

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'hello',
  tools: [
    defineTool('greet', {
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

- [GitHub](https://github.com/airmcp-dev/air)
- [문서](https://docs.airmcp.dev)
- [npm](https://www.npmjs.com/package/@airmcp-dev/core)

---

MCP 서버를 만들어보시고 보일러플레이트에 지치셨다면, 한번 써보시고 피드백 주세요. Star 환영합니다. 이슈와 PR도 환영합니다.
