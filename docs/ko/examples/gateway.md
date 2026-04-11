# 예제: 멀티서버 Gateway

여러 MCP 서버를 Gateway로 묶어 하나의 엔드포인트로 제공합니다. 각 서버를 독립적으로 개발·배포하고, 클라이언트는 Gateway 하나에 연결합니다.

## 아키텍처

```
Claude Desktop → Gateway (:4000) → search-server  (:3510, SSE)
                                 → files-server   (:3511, SSE)
                                 → analytics       (stdio)
```

## 프로젝트 구조

```
my-mcp-platform/
├── servers/
│   ├── search/
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── files/
│   │   ├── src/index.ts
│   │   └── package.json
│   └── analytics/
│       ├── src/index.ts
│       └── package.json
├── gateway/
│   ├── src/index.ts
│   └── package.json
└── package.json              # 워크스페이스 루트
```

## 1. 검색 서버

```typescript
// servers/search/src/index.ts
import { defineServer, defineTool, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'search-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },

  use: [cachePlugin({ ttlMs: 30_000, exclude: ['search_reindex'] })],

  tools: [
    defineTool('search', {
      description: '전문 검색. 제목과 본문에서 키워드를 찾습니다',
      params: {
        query: { type: 'string', description: '검색어' },
        limit: { type: 'number', description: '최대 결과 수', optional: true },
      },
      handler: async ({ query, limit }) => {
        // 실제 검색 엔진 연동
        return { results: [], total: 0, query };
      },
    }),

    defineTool('search_reindex', {
      description: '검색 인덱스를 재구축합니다',
      handler: async () => {
        // 재인덱싱 로직
        return { status: 'reindexing', startedAt: new Date().toISOString() };
      },
    }),
  ],
});

server.start();
```

## 2. 파일 서버

```typescript
// servers/files/src/index.ts
import { defineServer, defineTool, defineResource } from '@airmcp-dev/core';
import { readFile, readdir } from 'node:fs/promises';

const server = defineServer({
  name: 'files-server',
  version: '1.0.0',
  transport: { type: 'sse', port: 3511 },

  tools: [
    defineTool('read_file', {
      description: '파일을 읽어 내용을 반환합니다',
      params: {
        path: { type: 'string', description: '파일 경로' },
      },
      handler: async ({ path }) => readFile(path, 'utf-8'),
    }),

    defineTool('list_files', {
      description: '디렉토리의 파일 목록을 반환합니다',
      params: {
        dir: { type: 'string', description: '디렉토리 경로' },
      },
      handler: async ({ dir }) => {
        const files = await readdir(dir, { withFileTypes: true });
        return files.map(f => ({
          name: f.name,
          type: f.isDirectory() ? 'directory' : 'file',
        }));
      },
    }),
  ],

  resources: [
    defineResource('file:///{path}', {
      name: 'file-content',
      description: '파일 내용을 리소스로 제공',
      handler: async (uri) => {
        const { matchTemplate } = await import('@airmcp-dev/core');
        const vars = matchTemplate('file:///{path}', uri);
        if (!vars) return 'Not found';
        return readFile(vars.path, 'utf-8');
      },
    }),
  ],
});

server.start();
```

## 3. 분석 서버 (stdio)

```typescript
// servers/analytics/src/index.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'analytics-server',
  version: '1.0.0',
  transport: { type: 'stdio' },  // Gateway가 자식 프로세스로 실행

  tools: [
    defineTool('aggregate', {
      description: '데이터를 집계합니다',
      layer: 4,
      params: {
        metric: { type: 'string', description: '메트릭 이름' },
        period: { type: 'string', description: '기간 (예: 7d, 30d, 1y)' },
      },
      handler: async ({ metric, period }) => {
        return { metric, period, value: Math.random() * 1000, unit: 'count' };
      },
    }),
  ],
});

server.start();
```

## 4. Gateway

```typescript
// gateway/src/index.ts
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  name: 'my-platform-gateway',
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

// SSE 서버 등록
gateway.register({
  id: 'search-1',
  name: 'search',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});

gateway.register({
  id: 'files-1',
  name: 'files',
  transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3511' },
});

// stdio 서버 등록
gateway.register({
  id: 'analytics-1',
  name: 'analytics',
  transport: 'stdio',
  connection: {
    type: 'stdio',
    command: 'node',
    args: ['../servers/analytics/dist/index.js'],
  },
});

await gateway.start();
console.log('Gateway listening on port 4000');
console.log('Registered servers:', gateway.list().map(s => `${s.name} (${s.status})`));
```

## 실행

```bash
# 1. 각 서버 빌드
cd servers/search && npx tsc && cd ../..
cd servers/files && npx tsc && cd ../..
cd servers/analytics && npx tsc && cd ../..

# 2. SSE 서버 시작
cd servers/search && node dist/index.js &
cd servers/files && node dist/index.js &

# 3. Gateway 시작 (analytics는 Gateway가 자동 시작)
cd gateway && node dist/index.js
```

## Claude Desktop 연결

```bash
# Gateway에 연결 (모든 서버의 도구가 한 번에 사용 가능)
npx @airmcp-dev/cli connect claude-desktop --transport http --port 4000
```

Claude에서 사용:
- "hello를 검색해줘" → Gateway → search-server → `search` 도구
- "README.md 파일을 읽어줘" → Gateway → files-server → `read_file` 도구
- "최근 30일 매출을 집계해줘" → Gateway → analytics-server → `aggregate` 도구

## 로드밸런싱

같은 이름의 서버를 여러 개 등록하면 자동 로드밸런싱:

```typescript
gateway.register({ id: 'search-1', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://server1:3510' } });
gateway.register({ id: 'search-2', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://server2:3510' } });
// → search 도구 호출이 server1, server2에 번갈아 라우팅
```

## 장애 대응

- 서버 다운 → 헬스 체크가 15초 내 감지 → `error` 상태 전환 → 라우팅 풀에서 제외
- 서버 복구 → 다음 헬스 체크 통과 → `connected` 복귀 → 라우팅 풀 복귀
- `search-1`이 다운되어도 `search-2`가 정상이면 도구 호출 중단 없음
