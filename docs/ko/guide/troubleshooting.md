# 알려진 문제 & FAQ

## 연결 문제

### Claude Desktop에서 서버가 안 보여요

1. **서버를 등록했는지 확인:**
   ```bash
   npx @airmcp-dev/cli connect claude-desktop
   ```

2. **Claude Desktop을 재시작했는지 확인.** 설정 파일은 시작 시에만 읽힙니다.

3. **설정 파일 직접 확인:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

   설정이 올바른지 확인:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "npx",
         "args": ["tsx", "/절대/경로/my-server/src/index.ts"]
       }
     }
   }
   ```

4. **SSE/HTTP인 경우 서버가 실행 중인지 확인:**
   ```bash
   curl http://localhost:3510/
   ```
   응답이 없으면 서버가 실행되지 않은 것입니다.

5. **경로가 상대 경로인지 확인.** Claude Desktop은 셸 환경이 아니므로 **절대 경로**를 사용해야 합니다.

### Cursor/VS Code에서 연결이 안 돼요

1. **경로 확인:**
   ```bash
   npx @airmcp-dev/cli connect cursor
   npx @airmcp-dev/cli connect vscode
   ```

2. **IDE를 재시작합니다.** 설정 변경 후 재시작이 필요합니다.

3. **VS Code의 경우** MCP 확장이 설치되어 있는지 확인하세요.

4. **Cursor의 경우** 설정 파일 경로가 OS별로 다릅니다:
   - macOS: `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/config.json`
   - Windows: `%APPDATA%/Cursor/User/globalStorage/cursor.mcp/config.json`

### stdio에서 로그가 안 나와요

정상입니다. stdio 트랜스포트에서 stdout은 MCP 프로토콜 전용이므로, 모든 로그는 **stderr**로 출력됩니다. air가 이를 자동으로 처리합니다.

터미널에서 stderr를 보려면:
```bash
node dist/index.js 2>server.log
# 또는
node dist/index.js 2>&1 | tee server.log
```

::: warning
stdio 모드에서 `console.log()`를 사용하면 MCP 프로토콜이 깨집니다. air의 내장 로거나 `console.error()`를 사용하세요.
:::

### SSE 연결이 자꾸 끊겨요

리버스 프록시(Nginx, Cloudflare)가 장기 연결을 끊을 수 있습니다:

```nginx
# Nginx — SSE용 설정
proxy_read_timeout 86400;
proxy_send_timeout 86400;
proxy_buffering off;
proxy_cache off;
proxy_set_header Connection "";
```

Cloudflare를 사용하는 경우 SSE 연결이 100초 후 끊길 수 있습니다. 이 경우 `http` 트랜스포트로 전환하세요.

::: tip
리버스 프록시 뒤에서는 SSE 대신 `http` 트랜스포트를 권장합니다. HTTP는 요청-응답 방식이라 프록시 호환성이 좋습니다.
:::

### "서버가 응답하지 않습니다" 에러

1. **서버가 시작되었는지 확인:**
   ```bash
   npx @airmcp-dev/cli status
   ```

2. **포트 충돌 확인:**
   ```bash
   lsof -i :3510   # macOS/Linux
   netstat -ano | findstr :3510   # Windows
   ```

3. **방화벽 확인.** 로컬 개발 시에도 방화벽이 포트를 막을 수 있습니다.

## 개발 문제

### `dev` 명령어로 시작 시 엔트리 파일을 못 찾아요

엔트리 파일 탐색 순서: `src/index.ts` → `src/index.js` → `index.ts` → `index.js`

파일이 이 경로에 없으면 에러가 발생합니다. 프로젝트 루트에서 실행하고 있는지 확인하세요:

```bash
ls src/index.ts   # 이 파일이 있어야 합니다
npx @airmcp-dev/cli dev
```

### 핫 리로드가 안 돼요

`dev` 명령어는 `src/` 디렉토리의 `.ts`, `.js`, `.json` 파일만 감시합니다.

체크리스트:
- 수정한 파일이 `src/` 디렉토리 안에 있는지 확인
- `.env` 파일 변경은 감지하지 않습니다 (서버 재시작 필요)
- 300ms 디바운스가 있으므로 저장 직후에는 잠깐 기다리세요
- Windows에서 WSL을 사용하는 경우 `fs.watch`가 크로스 파일시스템에서 동작하지 않을 수 있습니다

### TypeScript 컴파일 에러

air는 ESM 프로젝트입니다. `tsconfig.json`에 다음이 필요합니다:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist"
  }
}
```

`package.json`에도:

```json
{
  "type": "module"
}
```

### `Cannot find module` 에러

ESM에서는 import 경로에 `.js` 확장자가 필요합니다:

```typescript
// ❌ 에러
import { myHelper } from './utils/helper';

// ✅ 정상
import { myHelper } from './utils/helper.js';
```

TypeScript 파일이라도 `.js`로 작성합니다. Node.js ESM 규칙입니다.

### `top-level await` 에러

`createStorage`는 `await`가 필요합니다. top-level await를 사용하려면 `tsconfig.json`에 `"module": "NodeNext"`가 필요합니다. 또는 async IIFE로 감싸세요:

```typescript
(async () => {
  const store = await createStorage({ type: 'file' });
  const server = defineServer({ ... });
  server.start();
})();
```

## 플러그인 문제

### 플러그인 순서가 왜 중요한가요?

`use` 배열의 순서가 미들웨어 실행 순서입니다. 일반적인 권장 순서:

```typescript
use: [
  authPlugin(),          // 1. 인증 (미인증 요청 조기 차단)
  sanitizerPlugin(),     // 2. 입력 정제
  timeoutPlugin(),       // 3. 타임아웃
  retryPlugin(),         // 4. 재시도 (타임아웃 안에서)
  cachePlugin(),         // 5. 캐시 (재시도 전에 캐시 확인)
  queuePlugin(),         // 6. 동시성 제한
]
```

`authPlugin`을 마지막에 넣으면 인증 전에 다른 플러그인이 실행되어 리소스가 낭비됩니다.

### cachePlugin이 동작하지 않아요

1. **캐시 키 확인:** 같은 도구 + 같은 파라미터여야 캐시 히트됩니다. 파라미터가 조금이라도 다르면 미스입니다. 파라미터 키의 **정렬 순서**도 동일해야 합니다.

2. **`exclude` 확인:** 해당 도구가 제외 목록에 있는지 확인하세요.

3. **TTL 확인:** 기본 60초. 60초가 지나면 캐시가 만료됩니다.

4. **`maxEntries` 확인:** 기본 1000개. 초과 시 가장 오래된 항목이 FIFO로 삭제됩니다.

### authPlugin에서 `_auth` 파라미터가 전달되지 않아요

MCP 프로토콜은 스키마에 정의되지 않은 파라미터를 제거합니다. `_auth` 파라미터를 쓰려면 도구의 `params`에 정의해야 합니다:

```typescript
defineTool('search', {
  params: {
    query: 'string',
    _auth: { type: 'string', description: '인증 토큰', optional: true },
  },
  handler: async ({ query }) => doSearch(query),
  // _auth는 authPlugin이 before에서 제거하므로 핸들러에 도달하지 않음
});
```

::: info
이는 MCP SDK의 동작입니다. air의 제한이 아닙니다. `dryrunPlugin`의 `perCall` 모드도 같은 이유로 MCP 클라이언트 경유 시 동작하지 않습니다.
:::

### retryPlugin이 재시도를 안 해요

1. **`retryOn` 필터 확인:** 기본은 모든 에러를 재시도하지만, 커스텀 필터를 설정한 경우 해당 에러가 필터를 통과하는지 확인하세요.

2. **`maxRetries` 확인:** 기본 3회. 이미 3회 시도 후 실패한 것일 수 있습니다.

3. **에러가 핸들러에서 throw된 것인지 확인:** `retryPlugin`은 `onError` 훅에서 동작합니다. `return { error: '...' }` 같은 정상 응답은 재시도하지 않습니다. 재시도를 원하면 `throw`를 사용하세요.

### circuitBreakerPlugin이 모든 도구를 차단해요

`perTool` 옵션을 확인하세요:

```typescript
// 기본: true → 도구별 독립 서킷
circuitBreakerPlugin({ perTool: true })

// false → 전역 서킷 (하나의 도구 실패가 모든 도구에 영향)
circuitBreakerPlugin({ perTool: false })
```

기본값 `true`가 권장됩니다.

## 스토리지 문제

### FileStore 데이터가 저장 안 돼요

FileStore는 5초마다 dirty 데이터를 디스크에 flush합니다. 서버를 강제 종료(kill -9)하면 마지막 5초 이내의 데이터가 유실될 수 있습니다.

항상 `onShutdown`을 등록하세요:

```typescript
onShutdown(async () => { await store.close(); });
```

`store.close()`는 즉시 flush → 타이머 중지 → 캐시 클리어를 수행합니다.

### TTL 단위가 헷갈려요

- `cachePlugin({ ttlMs: 60000 })` — **밀리초** (60초)
- `store.set('ns', 'key', value, 3600)` — **초** (1시간)

규칙: 옵션 이름에 `Ms` 접미사가 있으면 밀리초, 없으면 초입니다.

### MemoryStore에서 데이터가 사라져요

정상입니다. `MemoryStore`는 서버 재시작 시 모든 데이터가 소멸됩니다. 영속 저장이 필요하면 `FileStore`를 사용하세요:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });
```

### FileStore에서 동시 접근 문제

FileStore는 단일 프로세스용입니다. 여러 프로세스가 같은 디렉토리를 사용하면 데이터가 충돌합니다. 멀티 프로세스 환경에서는 외부 DB(PostgreSQL, Redis 등)를 직접 사용하세요.

## 배포 문제

### Cloudflare Workers에서 FileStore가 안 돼요

Workers에는 영속 파일시스템이 없습니다. `MemoryStore`를 사용하거나 Cloudflare KV/D1에 직접 연결하세요. [Cloudflare Workers 배포](/ko/guide/deploy-cloudflare) 참고.

### Lambda에서 `FileStore`가 초기화 시 에러

Lambda의 `/tmp`는 쓰기 가능하지만 인스턴스 종료 시 소멸합니다:

```typescript
const store = await createStorage({ type: 'file', path: '/tmp/air-data' });
```

영속 데이터가 필요하면 DynamoDB나 S3를 직접 사용하세요.

### Docker에서 `.air/data` 권한 에러

컨테이너 내부에서 `FileStore`가 디렉토리를 생성할 수 없는 경우:

```dockerfile
RUN mkdir -p /app/.air/data && chown -R node:node /app/.air
USER node
```

### PM2에서 서버가 계속 재시작돼요

1. **Node.js 버전 확인:** air는 Node.js 18 이상이 필요합니다.
2. **ESM 설정 확인:** `package.json`에 `"type": "module"`이 필요합니다.
3. **PM2 ecosystem 파일 사용:**
   ```javascript
   // ecosystem.config.cjs
   module.exports = {
     apps: [{
       name: 'my-mcp-server',
       script: 'dist/index.js',
       node_args: '--experimental-specifier-resolution=node',
       env: { NODE_ENV: 'production', MCP_TRANSPORT: 'http', PORT: '3510' },
     }],
   };
   ```

## 성능

### Meter의 Ring Buffer가 가득 차면?

최대 10,000건입니다. 초과 시 가장 오래된 기록이 자동 삭제됩니다. 메모리 사용량이 일정합니다. 10,000건 이상의 이력이 필요하면 `webhookPlugin`이나 `jsonLoggerPlugin`으로 외부 시스템에 전송하세요.

### 도구가 많으면 느려지나요?

도구 100개까지는 성능 영향 없습니다. 도구 검색은 `Map<string, ToolDef>` O(1) 조회입니다. 미들웨어 체인 실행 시간은 도구 수가 아니라 미들웨어 수에 비례합니다.

### 메모리가 계속 증가해요

1. **cachePlugin의 `maxEntries` 확인:** 기본 1000개. 크기가 큰 응답을 캐시하면 메모리가 빠르게 증가합니다.
2. **dedupPlugin의 inflight 누적:** `windowMs`가 너무 크면 inflight 맵이 커집니다. 기본 1000ms가 적절합니다.
3. **FileStore의 메모리 캐시:** 네임스페이스가 매우 많으면 각각의 캐시가 메모리를 차지합니다.

## Gateway 문제

### Gateway에서 도구가 중복으로 보여요

같은 이름의 도구를 제공하는 서버가 여러 개 등록되면 정상입니다. Gateway의 Tool Index가 자동으로 라우팅합니다. 중복을 원하지 않으면 서버별로 도구 이름을 고유하게 지정하세요.

### 서버가 "error" 상태에서 복구되지 않아요

Health Checker가 `healthCheckInterval` (기본 15초)마다 확인합니다. 서버가 복구되면 다음 헬스 체크에서 자동으로 `connected`로 전환됩니다. 15초 이내에 복구되지 않으면 서버 로그를 확인하세요.

---

## 그 외 문제

여기에 없는 문제를 겪고 있다면 GitHub Issues에 알려주세요:

**[github.com/airmcp-dev/air/issues](https://github.com/airmcp-dev/air/issues)**

이슈 등록 시 다음 정보를 포함해 주시면 빠른 해결에 도움이 됩니다:

- air 버전 (`npx @airmcp-dev/cli license`)
- Node.js 버전 (`node -v`)
- OS 및 환경 (macOS/Windows/Linux, Docker 여부)
- 트랜스포트 타입 (stdio/SSE/HTTP)
- 사용 중인 MCP 클라이언트 (Claude Desktop, Cursor, VS Code 등)
- 에러 메시지 전문
- 재현 가능한 최소 코드
