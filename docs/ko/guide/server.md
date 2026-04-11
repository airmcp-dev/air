# 서버 정의

`defineServer()`는 air의 진입점입니다. 옵션 객체 하나를 받아 `AirServer` 인스턴스를 반환합니다.

## 기본 사용법

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  tools: [
    defineTool('ping', {
      description: '헬스 체크',
      handler: async () => 'pong',
    }),
  ],
});

server.start();
```

## 옵션

`defineServer`는 `AirServerOptions`를 받습니다:

```typescript
interface AirServerOptions {
  name: string;                           // 서버 이름 (MCP 등록명)
  version?: string;                       // 버전 (기본: '0.1.0')
  description?: string;                   // 설명

  tools?: AirToolDef[];                   // 도구 정의
  resources?: AirResourceDef[];           // 리소스 정의
  prompts?: AirPromptDef[];               // 프롬프트 정의

  use?: Array<AirPlugin | AirPluginFactory>;  // 플러그인 (배열 순서 = 실행 순서)
  middleware?: AirMiddleware[];            // 커스텀 미들웨어 (플러그인 이후 실행)

  transport?: TransportConfig;            // 트랜스포트 설정
  storage?: StoreOptions;                 // 스토리지 설정
  meter?: MeterConfig;                    // 측정 설정

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format?: 'json' | 'pretty';
  };

  dev?: {
    hotReload?: boolean;                  // 기본: true
    port?: number;                        // 기본: 3100
  };
}
```

## AirServer 인스턴스

`defineServer()`가 반환하는 객체:

```typescript
interface AirServer {
  readonly name: string;

  start(): Promise<void>;               // 서버 시작
  stop(): Promise<void>;                // 우아한 종료
  status(): AirServerStatus;            // 현재 상태

  tools(): AirToolDef[];                // 등록된 도구 목록
  resources(): AirResourceDef[];        // 등록된 리소스 목록

  callTool(name: string, params?: Record<string, any>): Promise<any>;

  addTool(tool: AirToolDef): void;      // 런타임 도구 추가
  addMiddleware(mw: AirMiddleware): void;  // 런타임 미들웨어 추가
  addPlugin(plugin: AirPlugin): void;   // 런타임 플러그인 추가

  state: Record<string, any>;           // 글로벌 상태
}
```

## server.start()

서버를 시작합니다. 내부적으로 플러그인의 `onInit` → `onStart` 훅을 실행한 뒤 트랜스포트를 연결합니다.

```typescript
await server.start();
```

터미널 출력:

```
[air] Starting "my-server" (sse transport, 3 tools)
[air] SSE server listening on port 3510
```

## server.stop()

서버를 정지합니다. 플러그인의 `onStop` 훅을 실행한 뒤 MCP 연결을 종료합니다.

```typescript
await server.stop();
// [air] "my-server" stopped
```

## server.status()

```typescript
const s = server.status();
// {
//   name: 'my-server',
//   version: '0.1.0',
//   state: 'running',        // idle | starting | running | stopping | stopped | error
//   uptime: 12345,           // ms
//   toolCount: 3,
//   resourceCount: 0,
//   transport: 'sse'
// }
```

## server.callTool()

미들웨어 체인(검증, 에러 처리, 플러그인 전부)을 거쳐 도구를 호출합니다. 프로덕션과 동일한 경로로 실행되므로 테스트에도 적합합니다.

```typescript
const result = await server.callTool('search', { query: 'hello' });
```

내부 동작:
1. 도구 이름으로 등록된 도구를 찾음 (없으면 `McpErrors.toolNotFound` throw)
2. 요청 컨텍스트 생성 (requestId, serverName, startedAt, state)
3. 미들웨어 체인 실행 (before → handler → after)
4. MCP content 배열에서 첫 번째 텍스트 결과를 추출하여 반환

```typescript
// 없는 도구 호출 시
await server.callTool('nonexistent', {});
// → throws AirError: Tool "nonexistent" not found (code: -32601)
```

## server.addTool()

런타임에 도구를 추가합니다. 추가된 도구는 플러그인의 `onToolRegister` 훅을 거칩니다.

```typescript
server.addTool(defineTool('dynamic', {
  description: '런타임에 추가된 도구',
  handler: async () => 'works!',
}));

// 플러그인에 onToolRegister 훅이 있으면 적용됨
// 예: 태그 추가, 설명 수정 등
```

## server.addMiddleware()

런타임에 미들웨어를 체인 끝에 추가합니다.

```typescript
server.addMiddleware({
  name: 'late-logger',
  after: async (ctx) => {
    console.log(`${ctx.tool.name} completed in ${ctx.duration}ms`);
  },
});
```

## server.addPlugin()

런타임에 플러그인을 등록합니다. 플러그인의 미들웨어가 체인에 동적으로 추가됩니다.

```typescript
server.addPlugin(webhookPlugin({
  url: 'https://hooks.example.com/events',
}));
// → 플러그인 등록 + 미들웨어 수집 + 체인에 추가
```

## 글로벌 상태

`state`는 서버 전체에서 공유되는 객체입니다. 모든 도구 핸들러에서 `context.state`로 접근합니다.

```typescript
// 서버 레벨에서 설정
server.state.db = myDatabaseConnection;
server.state.config = { maxResults: 100 };

// 도구 핸들러에서 접근
defineTool('query', {
  params: { sql: 'string' },
  handler: async ({ sql }, context) => {
    const db = context.state.db;
    const limit = context.state.config.maxResults;
    return db.query(sql).limit(limit);
  },
});
```

## onShutdown

SIGTERM/SIGINT 시그널을 받았을 때 실행할 정리 함수를 등록합니다. DB 연결 종료, 임시 파일 정리 등에 사용합니다.

```typescript
import { onShutdown } from '@airmcp-dev/core';

// DB 연결 정리
onShutdown(async () => {
  await db.close();
  console.log('Database connection closed');
});

// 임시 파일 정리
onShutdown(async () => {
  await fs.rm('.air/tmp', { recursive: true, force: true });
});
```

여러 개 등록하면 등록 순서대로 실행됩니다. 하나가 실패해도 나머지는 계속 실행됩니다.

시그널 수신 시 터미널 출력:

```
[air] SIGTERM received — shutting down...
Database connection closed
[air] "my-server" stopped
```

## defineServer 내부 동작 순서

`defineServer()`를 호출하면 프레임워크가 다음을 순서대로 수행합니다:

1. **미들웨어 체인 생성** — `errorBoundaryMiddleware` + `validationMiddleware` 등록
2. **Meter 미들웨어** — `meter` 설정이 있으면 (기본 활성) 측정 미들웨어 추가
3. **내장 플러그인** 등록 — `builtinLoggerPlugin`(로그 레벨에 따라) + `builtinMetricsPlugin`
4. **사용자 플러그인** — `use` 배열의 플러그인을 등록하고 미들웨어를 수집하여 체인에 추가
5. **사용자 미들웨어** — `middleware` 배열을 체인 끝에 추가
6. **도구 등록** — `tools` 배열 + 플러그인이 제공하는 도구를 MCP SDK에 등록. 각 도구는 `onToolRegister` 훅을 거침
7. **리소스 등록** — `resources` 배열을 MCP SDK에 등록
8. **프롬프트 등록** — `prompts` 배열을 MCP SDK에 등록
9. **AirServer 인스턴스 반환** — start, stop, callTool 등의 메서드를 가진 객체

## 전체 예제

```typescript
import {
  defineServer, defineTool, defineResource, definePrompt,
  cachePlugin, retryPlugin, authPlugin, onShutdown,
} from '@airmcp-dev/core';

// DB 연결 (예시)
const db = await connectDatabase();

const server = defineServer({
  name: 'production-server',
  version: '1.0.0',
  description: '프로덕션 MCP 서버',

  transport: { type: 'sse', port: 3510 },
  storage: { type: 'file', path: '.air/data' },
  logging: { level: 'info', format: 'json' },
  meter: { classify: true, trackCalls: true },

  use: [
    authPlugin({ type: 'api-key', keys: [process.env.API_KEY!] }),
    cachePlugin({ ttlMs: 60_000 }),
    retryPlugin({ maxRetries: 3 }),
  ],

  tools: [
    defineTool('search', {
      description: '문서 검색',
      params: {
        query: { type: 'string', description: '검색어' },
        limit: { type: 'number', description: '최대 결과 수', optional: true },
      },
      handler: async ({ query, limit }, context) => {
        const db = context.state.db;
        return db.search(query, limit || 10);
      },
    }),
  ],

  resources: [
    defineResource('config://app', {
      name: 'app-config',
      description: '서버 설정 정보',
      handler: async () => ({
        version: '1.0.0',
        tools: server.tools().map(t => t.name),
      }),
    }),
  ],

  prompts: [
    definePrompt('summarize', {
      description: '텍스트 요약',
      arguments: [{ name: 'text', required: true }],
      handler: ({ text }) => [
        { role: 'user', content: `다음을 요약해주세요:\n\n${text}` },
      ],
    }),
  ],
});

// 글로벌 상태에 DB 연결 저장
server.state.db = db;

// 종료 시 DB 정리
onShutdown(async () => {
  await db.close();
});

server.start();
```
