# air

MCP 서버를 위한 TypeScript 프레임워크.

도구 하나에 함수 하나. 플러그인 하나에 한 줄. 보안, 캐시, 재시도 — 전부 내장.

```bash
npm install @airmcp-dev/core
```

## 왜 air?

MCP SDK를 직접 사용하면 도구 하나에 ~70줄의 보일러플레이트가 필요합니다: Zod 스키마, 수동 content 래핑, 모든 핸들러에 try/catch, 트랜스포트 설정. air는 핵심만 남깁니다.

**MCP SDK (직접 사용):**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool('search', 'Search docs', { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

// 재시도? 캐시? 인증? 레이트 리밋? 로깅? 전부 직접 구현해야 합니다
```

**air:**

```typescript
import { defineServer, defineTool, retryPlugin, cachePlugin, authPlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
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

## 빠른 시작

```bash
npx @airmcp-dev/cli create my-server --lang ko
cd my-server && npm install
npx @airmcp-dev/cli dev --console -p 3510
```

## 실 사용 예제

### REST API 래퍼

REST API를 MCP 도구로 래핑 — 30줄:

```typescript
import { defineServer, defineTool, cachePlugin, timeoutPlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'weather-api',
  transport: { type: 'sse', port: 3510 },
  use: [timeoutPlugin(5000), cachePlugin({ ttlMs: 300_000 })],
  tools: [
    defineTool('get_weather', {
      description: '도시의 현재 날씨를 조회합니다',
      params: { city: 'string' },
      handler: async ({ city }) => {
        const res = await fetch(`https://wttr.in/${city}?format=j1`);
        const data = await res.json();
        return {
          city,
          temp: data.current_condition[0].temp_C + '°C',
          desc: data.current_condition[0].weatherDesc[0].value,
        };
      },
    }),
  ],
});
server.start();
```

### 영속 노트 관리

```typescript
import { defineServer, defineTool, createStorage, onShutdown } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/notes' });

const server = defineServer({
  name: 'notes',
  tools: [
    defineTool('create_note', {
      params: { title: 'string', content: 'string', tags: 'string?' },
      handler: async ({ title, content, tags }) => {
        const id = `n_${Date.now()}`;
        await store.set('notes', id, { id, title, content, tags: tags?.split(',') ?? [], createdAt: new Date().toISOString() });
        return { id, message: `"${title}" 생성됨` };
      },
    }),
    defineTool('search_notes', {
      params: { query: 'string' },
      handler: async ({ query }) => {
        const entries = await store.entries('notes');
        return entries.filter(e => e.value.title.includes(query) || e.value.content.includes(query))
                      .map(e => ({ id: e.key, title: e.value.title }));
      },
    }),
  ],
});

onShutdown(async () => { await store.close(); });
server.start();
```

### Claude Desktop 연결

```bash
npx @airmcp-dev/cli connect claude-desktop
```

### 로컬 LLM 연동 (Ollama)

air 서버는 모든 MCP 호환 클라이언트와 동작합니다. Ollama에서는 도구 정의를 function calling으로 전달합니다:

```typescript
// 1. air에서 도구 정의
const server = defineServer({ name: 'my-tools', tools: [...] });

// 2. Ollama API에 도구 정의 전달
const response = await fetch('http://localhost:11434/api/chat', {
  body: JSON.stringify({ model: 'llama3.1', messages: [...], tools: [...] }),
});

// 3. air로 도구 실행
const result = await server.callTool(toolCall.function.name, toolCall.function.arguments);
```

## 19개 내장 플러그인

`use` 배열에 추가. 순서가 곧 실행 순서입니다.

| 카테고리 | 플러그인 |
|---------|---------|
| **안정성** | timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin |
| **성능** | cachePlugin, dedupPlugin, queuePlugin |
| **보안** | authPlugin, sanitizerPlugin, validatorPlugin |
| **네트워크** | corsPlugin, webhookPlugin |
| **데이터** | transformPlugin, i18nPlugin |
| **모니터링** | jsonLoggerPlugin, perUserRateLimitPlugin |
| **개발** | dryrunPlugin |

## 트랜스포트

```typescript
transport: { type: 'stdio' }             // Claude Desktop (기본)
transport: { type: 'sse', port: 3510 }   // 원격 SSE
transport: { type: 'http', port: 3510 }  // Streamable HTTP
```

## 스토리지

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });

await store.set('users', 'u1', { name: 'Alice' }, 3600);  // TTL: 초 단위
await store.get('users', 'u1');
await store.append('logs', { action: 'login' });
await store.query('logs', { limit: 50, filter: { action: 'login' } });
```

## CLI

```
npx @airmcp-dev/cli create <n>        프로젝트 생성 (템플릿: basic, api, crud, agent)
npx @airmcp-dev/cli dev --console        개발 모드 + 핫 리로드
npx @airmcp-dev/cli connect <client>     Claude Desktop, Cursor, VS Code 등에 등록
```

지원 클라이언트: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## 패키지

| 패키지 | 설명 | 라이선스 |
|--------|------|---------|
| [@airmcp-dev/core](https://www.npmjs.com/package/@airmcp-dev/core) | 서버, 도구, 19개 플러그인, 스토리지, 트랜스포트 | Apache-2.0 |
| [@airmcp-dev/cli](https://www.npmjs.com/package/@airmcp-dev/cli) | CLI (create, dev, connect, inspect) | Apache-2.0 |
| [@airmcp-dev/gateway](https://www.npmjs.com/package/@airmcp-dev/gateway) | 멀티서버 프록시, 로드밸런싱, 헬스체크 | Apache-2.0 |
| [@airmcp-dev/logger](https://www.npmjs.com/package/@airmcp-dev/logger) | 구조화 로깅, 파일 로테이션 | Apache-2.0 |
| [@airmcp-dev/meter](https://www.npmjs.com/package/@airmcp-dev/meter) | 7계층 호출 분류, 비용 추적 | Apache-2.0 |
| @airmcp-dev/shield | 위협 탐지, 정책 엔진, 감사 로그 | Commercial |
| @airmcp-dev/hive | 프로세스 풀, 자동 재시작, 멀티테넌트 | Commercial |

## 문서

전체 문서: **[docs.airmcp.dev](https://docs.airmcp.dev)**

110페이지, 영한 이중 언어 · 소스 검증 API 레퍼런스 · 9개 실전 예제

## 라이선스

오픈소스 패키지: [Apache-2.0](LICENSE)
엔터프라이즈 패키지 (shield, hive): Commercial License

---

Built by [CodePedia Labs](https://labs.codepedia.kr) · [문서](https://docs.airmcp.dev) · [npm](https://www.npmjs.com/org/airmcp-dev)
