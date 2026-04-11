# MCP SDK에서 마이그레이션

`@modelcontextprotocol/sdk`로 만든 기존 MCP 서버를 air로 전환하는 가이드입니다.

## 핵심 차이점

| | MCP SDK 직접 사용 | air |
|---|---|---|
| **도구 정의** | `server.tool(name, desc, zodSchema, handler)` | `defineTool(name, { params, handler })` |
| **파라미터** | Zod 스키마 직접 작성 | `'string'`, `'number?'` 단축 표기 (Zod도 가능) |
| **반환값** | `{ content: [{ type: 'text', text: '...' }] }` 수동 구성 | 아무 값이나 반환 → 자동 변환 |
| **에러 처리** | 모든 핸들러에 try/catch | 내장 에러 경계 미들웨어가 자동 처리 |
| **트랜스포트** | `StdioServerTransport`/`SSEServerTransport` 직접 연결 | `transport: { type: 'sse' }` 설정 한 줄 |
| **재시도/캐시** | 직접 구현 | `use: [retryPlugin(), cachePlugin()]` |
| **인증** | 직접 구현 | `use: [authPlugin({ type: 'api-key', keys: [...] })]` |

## Before / After

### 도구 정의

**MCP SDK:**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool(
  'search',
  'Search documents',
  {
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Max results'),
  },
  async ({ query, limit }) => {
    try {
      const results = await doSearch(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);
```

**air:**

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      handler: async ({ query, limit }) => {
        return await doSearch(query, limit);
        // 반환값이 자동으로 MCP content로 변환됨
        // 에러는 자동으로 MCP 에러 코드로 변환됨
      },
    }),
  ],
});

server.start();
```

### 트랜스포트

**MCP SDK:**

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// 또는
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// stdio
const transport = new StdioServerTransport();
await server.connect(transport);

// SSE — Express 서버를 직접 설정해야 함
import express from 'express';
const app = express();
const transports = new Map();
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);
  await server.connect(transport);
});
app.post('/messages', async (req, res) => { /* ... */ });
app.listen(3510);
```

**air:**

```typescript
// stdio (기본)
defineServer({ name: 'my-server', tools: [...] });

// SSE
defineServer({
  name: 'my-server',
  transport: { type: 'sse', port: 3510 },
  tools: [...],
});

// HTTP (Streamable HTTP)
defineServer({
  name: 'my-server',
  transport: { type: 'http', port: 3510 },
  tools: [...],
});
```

### 리소스

**MCP SDK:**

```typescript
server.resource(
  new ResourceTemplate('file:///{path}', { list: undefined }),
  async (uri, { path }) => ({
    contents: [{
      uri: uri.href,
      text: await readFile(path, 'utf-8'),
      mimeType: 'text/plain',
    }],
  })
);
```

**air:**

```typescript
defineResource('file:///{path}', {
  name: 'file',
  mimeType: 'text/plain',
  handler: async (uri) => {
    const vars = matchTemplate('file:///{path}', uri);
    return readFile(vars!.path, 'utf-8');
    // string 반환 → 자동으로 { text, mimeType } 변환
  },
});
```

### 프롬프트

**MCP SDK:**

```typescript
server.prompt(
  'summarize',
  { text: z.string() },
  async ({ text }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Summarize: ${text}` },
    }],
  })
);
```

**air:**

```typescript
definePrompt('summarize', {
  arguments: [{ name: 'text', required: true }],
  handler: ({ text }) => [
    { role: 'user', content: `Summarize: ${text}` },
  ],
});
```

## 단계별 전환

### 1단계: 의존성 교체

```bash
npm uninstall @modelcontextprotocol/sdk
npm install @airmcp-dev/core
```

::: info
air는 내부적으로 `@modelcontextprotocol/sdk`를 사용합니다. 직접 의존할 필요 없습니다.
:::

### 2단계: import 변경

```typescript
// Before
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// After
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';
```

### 3단계: 서버 정의 변환

```typescript
// Before
const server = new McpServer({ name: 'my-server', version: '0.1.0' });
server.tool('search', '...', { query: z.string() }, handler);
const transport = new StdioServerTransport();
await server.connect(transport);

// After
const server = defineServer({
  name: 'my-server',
  tools: [defineTool('search', { params: { query: 'string' }, handler })],
});
server.start();
```

### 4단계: 에러 처리 제거

각 핸들러의 try/catch를 제거합니다. air가 자동으로 처리합니다.

```typescript
// Before
async ({ query }) => {
  try {
    const result = await doSearch(query);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
}

// After
async ({ query }) => doSearch(query)
```

### 5단계: 플러그인 추가 (선택)

기존에 직접 구현했던 기능을 플러그인으로 교체합니다:

```typescript
defineServer({
  use: [
    retryPlugin({ maxRetries: 3 }),              // 직접 구현한 재시도 코드 → 삭제
    cachePlugin({ ttlMs: 60_000 }),              // 직접 구현한 캐시 코드 → 삭제
    authPlugin({ type: 'api-key', keys: [...] }),  // 직접 구현한 인증 코드 → 삭제
    sanitizerPlugin(),                           // 직접 구현한 입력 검증 → 삭제
  ],
});
```

## 호환성

air는 `@modelcontextprotocol/sdk ^1.12.0`을 내부적으로 사용합니다. MCP 프로토콜 호환성은 동일합니다. 기존 MCP 클라이언트(Claude Desktop, Cursor, VS Code 등)는 수정 없이 그대로 동작합니다.
