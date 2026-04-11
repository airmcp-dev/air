# 예제: REST API 래퍼

외부 REST API를 MCP 도구로 래핑하여 AI가 API를 호출할 수 있게 합니다.

## 프로젝트 생성

```bash
npx @airmcp-dev/cli create my-api-server --template api --lang ko
cd my-api-server
npm install
```

## 프로젝트 구조

```
my-api-server/
├── src/
│   └── index.ts
├── air.config.ts          # 선택
├── package.json
└── tsconfig.json
```

## 전체 코드

```typescript
// src/index.ts
import { defineServer, defineTool, retryPlugin, cachePlugin, timeoutPlugin } from '@airmcp-dev/core';

const BASE_URL = process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com';
const API_KEY = process.env.API_KEY || '';

// 공통 fetch 헬퍼
async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

const server = defineServer({
  name: 'my-api-server',
  version: '1.0.0',
  description: '외부 API를 MCP 도구로 래핑',

  transport: { type: 'sse', port: 3510 },
  logging: { level: 'info', format: 'json' },

  use: [
    timeoutPlugin(15_000),           // 15초 타임아웃
    retryPlugin({                    // 네트워크 에러만 재시도
      maxRetries: 2,
      retryOn: (err) => err.message.includes('fetch failed'),
    }),
    cachePlugin({                    // GET 결과 30초 캐시
      ttlMs: 30_000,
      exclude: ['api_post'],         // POST는 캐시 안 함
    }),
  ],

  tools: [
    defineTool('api_get', {
      description: 'API에서 데이터를 조회합니다 (GET)',
      params: {
        path: { type: 'string', description: 'API 경로 (예: /users, /posts/1)' },
      },
      handler: async ({ path }) => apiFetch(path),
    }),

    defineTool('api_post', {
      description: 'API에 데이터를 생성합니다 (POST)',
      params: {
        path: { type: 'string', description: 'API 경로' },
        body: { type: 'string', description: '요청 본문 (JSON 문자열)' },
      },
      handler: async ({ path, body }) => apiFetch(path, { method: 'POST', body }),
    }),

    defineTool('api_search', {
      description: '쿼리 파라미터로 API를 검색합니다',
      params: {
        path: { type: 'string', description: 'API 경로' },
        query: { type: 'string', description: '쿼리 문자열 (예: "q=hello&limit=10")' },
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

## 실행

```bash
# 개발 모드
npx @airmcp-dev/cli dev --console -p 3510

# 환경변수로 API 설정
API_BASE_URL=https://api.example.com API_KEY=your-key npx @airmcp-dev/cli dev -p 3510
```

## Claude Desktop 연결

```bash
npx @airmcp-dev/cli connect claude-desktop --transport sse --port 3510
```

Claude에서 사용 예시:
- "jsonplaceholder에서 사용자 목록을 가져와줘" → `api_get` 호출
- "새 게시글을 만들어줘. 제목은 'Hello', 내용은 'World'" → `api_post` 호출

## 플러그인 활용 포인트

- `timeoutPlugin` — 외부 API 응답이 느릴 때 15초 후 에러 반환
- `retryPlugin` — 네트워크 에러 시 2회 재시도 (200ms → 400ms)
- `cachePlugin` — 같은 GET 요청은 30초간 캐시. POST는 `exclude`로 제외

## 환경변수

| 변수 | 기본값 | 설명 |
|------|-------|------|
| `API_BASE_URL` | `https://jsonplaceholder.typicode.com` | 외부 API 기본 URL |
| `API_KEY` | (없음) | Bearer 토큰 (선택) |
