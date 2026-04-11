# air MCP Framework — AI Context Document

> 이 문서는 AI 코딩 어시스턴트(Claude, Cursor, GitHub Copilot 등)에게 제공하기 위한 air 프레임워크 요약입니다.
> 프로젝트에 이 파일을 포함하면 AI가 air API를 정확하게 사용할 수 있습니다.

## air란?

air는 MCP(Model Context Protocol) 서버를 만들기 위한 TypeScript 프레임워크입니다. `@airmcp-dev/core` 하나로 도구, 리소스, 프롬프트를 정의하고, 19개 내장 플러그인으로 재시도/캐시/인증 등을 한 줄로 추가합니다.

- **패키지**: `@airmcp-dev/core`, `@airmcp-dev/cli`, `@airmcp-dev/gateway`, `@airmcp-dev/logger`, `@airmcp-dev/meter`
- **런타임**: Node.js 18+, TypeScript ESM
- **MCP SDK**: 내부적으로 `@modelcontextprotocol/sdk ^1.12.0` 사용
- **라이선스**: Apache-2.0

## 핵심 API

### defineServer

```typescript
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',              // 필수
  version: '1.0.0',               // 기본: '0.1.0'
  description: '서버 설명',
  transport: { type: 'sse', port: 3510 },  // 'stdio' | 'sse' | 'http' | 'auto'
  storage: { type: 'file', path: '.air/data' },  // 'memory' | 'file'
  logging: { level: 'info', format: 'json' },
  meter: { classify: true, trackCalls: true },
  use: [ /* 플러그인 배열 — 순서 = 실행 순서 */ ],
  middleware: [ /* 커스텀 미들웨어 */ ],
  tools: [ /* defineTool 배열 */ ],
  resources: [ /* defineResource 배열 */ ],
  prompts: [ /* definePrompt 배열 */ ],
});

server.start();
```

### defineTool

```typescript
defineTool('search', {
  description: '문서 검색',
  params: {
    query: 'string',                    // 단축 표기
    limit: 'number?',                   // ? = optional
    email: { type: 'string', description: '이메일', optional: true },  // 객체 표기
    tags: z.array(z.string()),          // Zod도 가능
  },
  layer: 4,                             // L1-L7 Meter 힌트 (선택)
  handler: async ({ query, limit }, context) => {
    // context: { requestId, serverName, startedAt, state }
    // 반환값은 자동으로 MCP content로 변환:
    //   string → text, number/boolean → String, object/array → JSON.stringify
    //   { text } → text, { image, mimeType } → image, { content: [...] } → 그대로
    return await doSearch(query, limit);
  },
});
```

**ParamShorthand**: `'string'`, `'string?'`, `'number'`, `'number?'`, `'boolean'`, `'boolean?'`, `'object'`, `'object?'`

### defineResource

```typescript
defineResource('file:///{path}', {
  name: 'file',
  mimeType: 'text/plain',
  handler: async (uri, ctx) => {
    const vars = matchTemplate('file:///{path}', uri);  // { path: '...' } | null
    return readFile(vars!.path, 'utf-8');  // string → text/plain
  },
});
```

### definePrompt

```typescript
definePrompt('summarize', {
  description: '텍스트 요약',
  arguments: [{ name: 'text', required: true }],  // 모두 string 타입
  handler: ({ text }) => [
    { role: 'user', content: `요약해주세요: ${text}` },
  ],
});
```

## 19개 내장 플러그인

```typescript
import {
  // 안정성
  timeoutPlugin,         // timeoutPlugin(30_000) — ms
  retryPlugin,           // retryPlugin({ maxRetries: 3, delayMs: 200, retryOn?: (err) => bool })
  circuitBreakerPlugin,  // circuitBreakerPlugin({ failureThreshold: 5, resetTimeoutMs: 30_000, perTool: true })
  fallbackPlugin,        // fallbackPlugin({ 'primary_tool': 'backup_tool' }) — 도구명→대체도구 맵

  // 성능
  cachePlugin,           // cachePlugin({ ttlMs: 60_000, maxEntries: 1000, exclude: ['write'] })
  dedupPlugin,           // dedupPlugin({ windowMs: 1000 })
  queuePlugin,           // queuePlugin({ concurrency: { 'db': 3, '*': 10 }, maxQueueSize: 100, queueTimeoutMs: 30_000 })

  // 보안
  authPlugin,            // authPlugin({ type: 'api-key', keys: [process.env.KEY!], publicTools: ['ping'], paramName: '_auth' })
  sanitizerPlugin,       // sanitizerPlugin({ stripHtml: true, stripControl: true, maxStringLength: 10_000, exclude: [] })
  validatorPlugin,       // validatorPlugin({ rules: [{ tool: '*', validate: (p) => errorMsg | undefined }] })

  // 네트워크
  corsPlugin,            // corsPlugin({ origins: ['*'], methods: ['GET','POST','OPTIONS'], credentials: false })
  webhookPlugin,         // webhookPlugin({ url, events: ['tool.call','tool.error','tool.slow'], slowThresholdMs: 5000, batchSize: 1 })

  // 데이터
  transformPlugin,       // transformPlugin({ before: { '*': (p) => p }, after: { 'tool': (r) => r } })
  i18nPlugin,            // i18nPlugin({ defaultLang: 'en', translations: { key: { en: '', ko: '' } }, langParam: '_lang' })

  // 모니터링
  jsonLoggerPlugin,      // jsonLoggerPlugin({ output: 'stderr', logParams: false, extraFields: {} })
  perUserRateLimitPlugin,// perUserRateLimitPlugin({ maxCalls: 10, windowMs: 60_000, identifyBy: '_userId' })

  // 개발
  dryrunPlugin,          // dryrunPlugin({ enabled: false, perCall: true, mockResponse?: (tool, params) => any })
} from '@airmcp-dev/core';
```

**권장 순서**: `authPlugin → sanitizerPlugin → timeoutPlugin → retryPlugin → cachePlugin → queuePlugin`

## 스토리지

```typescript
import { createStorage, MemoryStore, FileStore } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/data' });

// Key-Value
await store.set('namespace', 'key', value, ttlSeconds?);  // TTL은 초 단위!
await store.get('namespace', 'key');          // T | null
await store.delete('namespace', 'key');       // boolean
await store.list('namespace', 'prefix?');     // string[]
await store.entries('namespace', 'prefix?');  // { key, value }[]

// Append-Only Log
await store.append('logs', { action: 'login' });  // 자동 _ts 추가
await store.query('logs', { limit: 100, since?: Date, filter?: { action: 'login' } });

await store.close();  // FileStore: 즉시 flush + 타이머 중지
```

## 미들웨어

```typescript
const myMiddleware: AirMiddleware = {
  name: 'my-mw',
  before: async (ctx) => {
    // ctx: { tool, params, requestId, serverName, startedAt, meta }
    // return undefined → 다음으로
    // return { params: {...} } → 파라미터 교체
    // return { abort: true, abortResponse: '...' } → 체인 중단
  },
  after: async (ctx) => {
    // ctx에 추가: result, duration
  },
  onError: async (ctx, error) => {
    // return 값 → 정상 응답으로 전환
    // return undefined → 다음 에러 핸들러로
  },
};
```

## 에러

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

throw McpErrors.toolNotFound('name');        // -32601
throw McpErrors.invalidParams('bad email');  // -32602
throw McpErrors.internal('db failed');       // -32603
throw McpErrors.forbidden('denied');         // -32000
throw McpErrors.rateLimited('tool', 5000);   // -32001
throw McpErrors.timeout('tool', 30000);      // -32003
throw new AirError('custom', -32010, { detail: 'value' });
```

## onShutdown

```typescript
import { onShutdown } from '@airmcp-dev/core';

onShutdown(async () => {
  await store.close();
  await db.disconnect();
});
```

## CLI

```bash
npx @airmcp-dev/cli create my-server --template basic --lang ko
npx @airmcp-dev/cli dev --console -p 3510
npx @airmcp-dev/cli connect claude-desktop
npx @airmcp-dev/cli connect cursor --transport sse --port 3510
npx @airmcp-dev/cli start / stop / status / list / inspect <tool>
```

**지원 클라이언트**: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## Gateway

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  port: 4000,
  healthCheckInterval: 15_000,
  balancer: 'round-robin',  // 'round-robin' | 'least-connections' | 'weighted' | 'random'
});

gateway.register({
  id: 'search-1', name: 'search', transport: 'sse',
  connection: { type: 'sse', url: 'http://localhost:3510' },
});
// stdio: connection: { type: 'stdio', command: 'node', args: ['dist/index.js'] }

await gateway.start();
```

## 메트릭

```typescript
import { getMetrics, resetMetrics, getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

getMetrics();          // { toolName: { calls, errors, totalDuration, avgDuration, lastCalledAt } }
getMetricsSnapshot();  // { totalCalls, successRate, avgLatencyMs, layerDistribution, toolCounts }
```

## 커스텀 플러그인

```typescript
function myPlugin(options?: MyOptions): AirPlugin {
  return {
    meta: { name: 'my-plugin', version: '1.0.0' },
    middleware: [{ name: 'my:mw', before, after, onError }],
    hooks: {
      onInit: async (ctx) => { ctx.state.db = createPool(); },
      onStop: async (ctx) => { await ctx.state.db.close(); },
      onToolRegister: (tool, ctx) => ({ ...tool, description: `[Enhanced] ${tool.description}` }),
    },
    tools: [{ name: '_status', handler: async () => 'ok' }],
  };
}
```

## 주의사항

- ESM 프로젝트: `"type": "module"`, import에 `.js` 확장자 필수
- stdio에서 `console.log()` 사용 금지 → MCP 프로토콜 깨짐. `console.error()` 사용
- `cachePlugin({ ttlMs })` = 밀리초, `store.set(ns, key, val, ttl)` = 초
- `authPlugin`의 `_auth` 파라미터는 도구 params에 정의해야 MCP 클라이언트 경유 시 전달됨
- `fallbackPlugin`은 값이 아니라 도구명→대체도구명 매핑: `{ 'primary': 'backup' }`
- `queuePlugin`의 `concurrency`는 맵: `{ 'db': 3, '*': 10 }`
