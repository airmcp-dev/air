# Cloudflare Workers 배포

air MCP 서버를 Cloudflare Workers에 배포합니다. 인프라 관리 없이 엣지에서 실행됩니다.

## 사전 요구사항

- Cloudflare 계정 (무료 또는 유료)
- `wrangler` CLI: `npm install -g wrangler`
- `wrangler login` 완료

## 빠른 시작

### 1. 프로젝트 생성

```bash
mkdir my-mcp-worker && cd my-mcp-worker
npm init -y
npm install @airmcp-dev/core
npm install -D wrangler typescript @cloudflare/workers-types
```

### 2. wrangler.toml 설정

```toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]
```

### 3. 서버 작성

```typescript
// src/index.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  transport: { type: 'workers' },
  tools: [
    defineTool('greet', {
      description: '이름으로 인사하기',
      params: { name: 'string' },
      handler: async ({ name }) => `안녕하세요, ${name}!`,
    }),
  ],
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // MCP Streamable HTTP
    if (request.method === 'POST' && url.pathname === '/') {
      return server.fetch!(request);
    }

    // 서버 상태
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json(server.status());
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

### 4. 배포

```bash
wrangler deploy
```

MCP 서버가 `https://my-mcp-server.<your-subdomain>.workers.dev`에서 실행됩니다.

## 트랜스포트

`transport: { type: 'workers' }`를 사용합니다. air는 다음을 처리합니다:

- Node.js http 서버 생성 건너뛰기
- `server.fetch()`를 통한 MCP 요청 처리
- JSON-RPC 2.0 직접 처리 (런타임에 MCP SDK 의존성 없음)
- `initialize`, `tools/list`, `tools/call`을 air의 미들웨어 체인을 통해 실행

::: warning
Workers 환경에서는 `stdio`와 `sse` 트랜스포트를 **사용할 수 없습니다**. `workers` 트랜스포트만 지원됩니다.
:::

::: tip
Workers에서는 `server.start()`를 호출할 필요가 없습니다. 서버는 즉시 사용 가능합니다.
:::

## D1 (SQLite) 사용

영속적 데이터 저장에는 Cloudflare D1을 사용합니다:

### wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "your-database-id"
```

### 마이그레이션

```sql
-- migrations/001_init.sql
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

```bash
wrangler d1 create my-db
wrangler d1 execute my-db --file=./migrations/001_init.sql --remote
```

### 서버에서 사용

```typescript
export interface Env {
  DB: D1Database;
}

let _db: D1Database;

const server = defineServer({
  name: 'my-server',
  transport: { type: 'workers' },
  tools: [
    defineTool('save', {
      params: { key: 'string', value: 'string' },
      handler: async ({ key, value }) => {
        await _db.prepare('INSERT INTO items (id, data) VALUES (?, ?)')
          .bind(key, value).run();
        return '저장 완료';
      },
    }),
  ],
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    _db = env.DB;
    // ... 라우팅
  },
};
```

## KV 사용

단순 키-값 저장에는 Cloudflare KV를 사용합니다:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

```typescript
export interface Env {
  KV: KVNamespace;
}
```

## 커스텀 도메인

1. Cloudflare 대시보드 → Workers → 워커 선택 → Settings → Domains
2. 커스텀 도메인 추가 (Cloudflare DNS에 등록된 도메인이어야 함)
3. MCP 서버가 `https://your-domain.com`에서 접근 가능

## 클라이언트 연결

```bash
# 원격 URL로 MCP 클라이언트 연결
npx mcp-remote https://your-domain.com
```

Claude Desktop의 `claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-domain.com"]
    }
  }
}
```

## 제한사항

- **파일시스템 없음**: D1, KV, R2 사용
- **장기 실행 프로세스 없음**: 각 요청이 독립 실행
- **stdio/SSE 불가**: `workers` 트랜스포트만
- **실행 시간**: 무료 30초, 유료 15분
- **번들 크기**: 10MB 제한 (air core는 ~83KB)

## 실전 예제: SQ-MCP

[SQ-MCP](https://sq.infoshell.cloud)는 air + Workers + D1로 구축한 사회적 지능 진단 도구입니다:

- 9개 MCP 도구 (진단, 훈련, 진행 추적)
- D1로 사용자 진행 데이터 영속 저장
- Workers에서 HTML 테스트 페이지 서빙
- 카카오 PlayMCP에 배포
