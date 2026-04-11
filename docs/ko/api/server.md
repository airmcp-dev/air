# 서버 레퍼런스

## defineServer(options)

MCP 서버 인스턴스를 생성합니다.

```typescript
import { defineServer } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '1.0.0',
  tools: [ /* ... */ ],
});
```

### AirServerOptions

```typescript
interface AirServerOptions {
  name: string;                           // 필수 — MCP 등록명
  version?: string;                       // 기본: '0.1.0'
  description?: string;

  tools?: AirToolDef[];
  resources?: AirResourceDef[];
  prompts?: AirPromptDef[];

  use?: Array<AirPlugin | AirPluginFactory>;  // 배열 순서 = 실행 순서
  middleware?: AirMiddleware[];            // 플러그인 미들웨어 이후 실행

  transport?: TransportConfig;
  storage?: StoreOptions;
  meter?: MeterConfig;

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // 기본: 'info'
    format?: 'json' | 'pretty';                                // 기본: 'pretty'
  };

  dev?: {
    hotReload?: boolean;                  // 기본: true
    port?: number;                        // 기본: 3100
  };
}
```

### AirServer

```typescript
interface AirServer {
  readonly name: string;

  start(): Promise<void>;
  stop(): Promise<void>;
  status(): AirServerStatus;

  tools(): AirToolDef[];
  resources(): AirResourceDef[];

  callTool(name: string, params?: Record<string, any>): Promise<any>;

  addTool(tool: AirToolDef): void;
  addMiddleware(mw: AirMiddleware): void;
  addPlugin(plugin: AirPlugin): void;

  state: Record<string, any>;
}
```

### 메서드 상세

#### server.start()

플러그인 `onInit` → `onStart` 훅 실행 후 트랜스포트 연결.

```typescript
await server.start();
// [air] Starting "my-server" (sse transport, 3 tools)
// [air] SSE server listening on port 3510
```

#### server.stop()

플러그인 `onStop` 훅 실행 후 MCP 연결 종료.

```typescript
await server.stop();
// [air] "my-server" stopped
```

#### server.status()

```typescript
const s = server.status();
```

반환값:

```typescript
interface AirServerStatus {
  name: string;
  version: string;
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;           // ms
  toolCount: number;
  resourceCount: number;
  transport: string;        // 'stdio' | 'sse' | 'http'
}
```

#### server.callTool(name, params?)

미들웨어 체인(검증, 에러 처리, 플러그인)을 전부 거쳐 도구 호출. 프로덕션과 동일한 경로.

```typescript
const result = await server.callTool('search', { query: 'hello' });
// 없는 도구 → throws AirError (code: -32601)
```

내부: 도구 검색 → requestContext 생성 → chain.execute → McpContent[]에서 첫 텍스트 추출.

#### server.addTool(tool)

런타임 도구 추가. `onToolRegister` 훅을 거침.

```typescript
server.addTool(defineTool('dynamic', { handler: async () => 'ok' }));
```

#### server.addPlugin(plugin)

런타임 플러그인 등록. 미들웨어가 체인에 동적 추가됨.

```typescript
server.addPlugin(webhookPlugin({ url: 'https://hooks.example.com' }));
```

#### server.state

모든 도구 핸들러에서 `context.state`로 접근 가능한 공유 객체.

```typescript
server.state.db = myConnection;

// 핸들러에서
handler: async (params, context) => context.state.db.query(params.sql)
```

## onShutdown(handler)

SIGTERM/SIGINT 수신 시 실행할 정리 함수. 여러 개 등록 가능, 등록 순서대로 실행. 하나가 실패해도 나머지 계속 실행.

```typescript
import { onShutdown } from '@airmcp-dev/core';

onShutdown(async () => {
  await db.close();
  console.log('DB closed');
});

onShutdown(async () => {
  await cache.flush();
});
```

시그널 수신 시:

```
[air] SIGTERM received — shutting down...
DB closed
[air] "my-server" stopped
```
