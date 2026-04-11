# 시작하기

5분 안에 첫 MCP 서버를 만들고 실행하세요.

## 사전 요구사항

- **Node.js** 18 이상 (`node -v`로 확인)
- **npm**, **pnpm**, 또는 **yarn**

## 1단계: 프로젝트 생성 (~1분)

```bash
npx @airmcp-dev/cli create my-server
```

언어 선택 프롬프트가 나타납니다:

```
  Select language / 언어를 선택하세요:

    1) English
    2) 한국어

  > 2
```

`--template`과 `--lang` 옵션으로 인터랙티브 프롬프트를 건너뛸 수 있습니다:

```bash
npx @airmcp-dev/cli create my-server --template basic --lang ko
```

사용 가능한 템플릿: `basic`(기본), `api`, `crud`, `agent`. 자세한 내용은 [템플릿](/ko/guide/templates)을 참고하세요.

생성 후 의존성을 설치합니다:

```bash
cd my-server
npm install
```

생성되는 구조:

```
my-server/
├── src/
│   └── index.ts          # 서버 정의
├── package.json          # @airmcp-dev/core 의존성 포함
└── tsconfig.json         # TypeScript ESM 설정
```

`package.json` 내용:

```json
{
  "name": "my-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "npx @airmcp-dev/cli dev"
  },
  "dependencies": {
    "@airmcp-dev/core": "^0.1.3"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

## 2단계: 서버 코드 작성 (~1분)

`src/index.ts`를 열어주세요 (basic 템플릿 기준):

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('greet', {
      description: '인사하기',
      params: {
        name: { type: 'string', description: '이름' },
      },
      handler: async ({ name }) => `안녕하세요, ${name}!`,
    }),
  ],
});

server.start();
```

핵심 구조:
- `defineServer` — 서버를 정의합니다. 이름, 버전, 트랜스포트, 도구 목록을 받습니다
- `defineTool` — 도구 하나를 정의합니다. 이름, 설명, 파라미터, 핸들러를 받습니다
- `server.start()` — 서버를 시작합니다

## 3단계: 개발 모드 실행 (~30초)

```bash
npx @airmcp-dev/cli dev --console -p 3510
```

터미널 출력:

```
[air] Starting dev mode...
[air] Transport: sse (port 3510)
[air] Tools: greet
[air] Test console: http://localhost:3510
[air] Watching for file changes...
```

기능:
- **핫 리로드** — `src/` 파일 변경 시 자동 재시작
- **테스트 콘솔** — `http://localhost:3510`에서 브라우저로 도구 테스트

::: tip
`-p` 옵션을 생략하면 기본 포트 3100이 사용됩니다 (air.config.ts의 `dev.port` 기본값).
:::

## 4단계: 도구 테스트 (~1분)

### 브라우저 테스트 콘솔

`http://localhost:3510`을 열면 테스트 콘솔이 나옵니다:
1. `greet` 도구를 선택
2. `name` 파라미터에 값 입력 (예: `세계`)
3. Run 클릭
4. 결과: `안녕하세요, 세계!`

### 프로그래밍 방식 테스트

```typescript
const result = await server.callTool('greet', { name: '세계' });
console.log(result); // "안녕하세요, 세계!"
```

`callTool`은 미들웨어 체인(검증, 에러 처리, 플러그인)을 전부 거칩니다. 테스트 코드에서도 프로덕션과 동일한 경로로 실행됩니다.

## 5단계: Claude Desktop 연결 (~30초)

```bash
npx @airmcp-dev/cli connect claude-desktop
```

이 명령은 Claude Desktop의 MCP 설정 파일에 서버를 등록합니다:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

등록 후 Claude Desktop을 재시작하면 도구 목록에 `greet`이 나타납니다.

::: info
`stdio` 트랜스포트를 사용하면 Claude Desktop이 서버를 자식 프로세스로 직접 실행합니다. `sse`나 `http`를 사용하면 서버를 별도로 실행해야 합니다.
:::

## 도구를 더 추가해보세요

같은 서버에 도구를 여러 개 등록할 수 있습니다:

```typescript
const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  tools: [
    defineTool('greet', {
      description: '인사하기',
      params: { name: 'string' },
      handler: async ({ name }) => `안녕하세요, ${name}!`,
    }),

    defineTool('add', {
      description: '두 수를 더합니다',
      params: { a: 'number', b: 'number' },
      handler: async ({ a, b }) => a + b,
    }),

    defineTool('now', {
      description: '현재 시각을 반환합니다',
      handler: async () => new Date().toISOString(),
    }),
  ],
});
```

`params`가 없는 도구도 만들 수 있습니다 (`now` 예시).

## 플러그인 추가

`use` 배열에 플러그인을 추가합니다. 배열 순서대로 실행됩니다.

```typescript
import {
  defineServer, defineTool,
  cachePlugin, retryPlugin, timeoutPlugin,
} from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  use: [
    timeoutPlugin(10_000),             // 10초 초과 시 중단
    retryPlugin({ maxRetries: 2 }),    // 실패 시 2회 재시도 (200ms → 400ms 백오프)
    cachePlugin({ ttlMs: 30_000 }),    // 동일 호출 30초 캐시
  ],
  tools: [
    defineTool('search', {
      description: '문서를 검색합니다',
      params: {
        query: { type: 'string', description: '검색어' },
        limit: { type: 'number', description: '최대 결과 수', optional: true },
      },
      handler: async ({ query, limit }) => {
        // 외부 API 호출 등
        return { results: [], total: 0 };
      },
    }),
  ],
});

server.start();
```

실행 순서: timeout → retry → cache → handler. 19개 내장 플러그인 전체 목록은 [플러그인 가이드](/ko/guide/plugins)를 참고하세요.

## 프로덕션 빌드

```bash
# TypeScript 컴파일
npx tsc

# 프로덕션 실행
node dist/index.js
```

## 다음 단계

- [설정 파일](/ko/guide/configuration) — air.config.ts로 설정 분리하기
- [서버 정의](/ko/guide/server) — defineServer 전체 옵션과 AirServer 인터페이스
- [도구](/ko/guide/tools) — 3가지 파라미터 형식 (단축, 객체, Zod), 핸들러 컨텍스트, 응답 타입
- [플러그인](/ko/guide/plugins) — 19개 내장 플러그인과 실행 순서
- [트랜스포트](/ko/guide/transport) — stdio vs SSE vs HTTP, 언제 어떤 걸 쓰는지
- [CLI 명령어](/ko/guide/cli) — create, dev, connect 등 12개 명령어
- [테스트 작성](/ko/guide/testing) — vitest로 도구 테스트 작성하기
