# air

MCP 서버를 만들고, 실행하고, 관리하는 프레임워크.

air는 Model Context Protocol (MCP) 서버를 빌드하는 TypeScript 프레임워크입니다. 간단한 함수로 도구, 리소스, 프롬프트를 정의하고, 내장 플러그인으로 보안, 캐시, 재시도, 모니터링을 추가합니다. stdio, SSE, HTTP 트랜스포트로 배포합니다.

## 빠른 시작

```bash
npx air create my-server --lang ko
cd my-server
npm install
npx air dev --console -p 3510
```

## 서버 정의

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
      handler: async ({ name }) => `안녕하세요, ${name}님!`,
    }),
  ],
});

server.start();
```

## 플러그인

19개 내장 플러그인. `use` 배열에 추가:

```typescript
import {
  defineServer,
  timeoutPlugin,
  retryPlugin,
  cachePlugin,
  authPlugin,
} from '@airmcp-dev/core';

defineServer({
  name: 'my-server',
  use: [
    timeoutPlugin(10_000),
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: ['sk-xxx'] }),
  ],
  tools: [ ... ],
});
```

### 플러그인 목록

**안정성:** timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin
**성능:** cachePlugin, dedupPlugin, queuePlugin
**보안:** authPlugin, sanitizerPlugin, validatorPlugin
**네트워크:** corsPlugin, webhookPlugin
**데이터:** transformPlugin, i18nPlugin
**모니터링:** jsonLoggerPlugin, perUserRateLimitPlugin
**개발/테스트:** dryrunPlugin

## 내장 보안

```typescript
defineServer({
  shield: {
    enabled: true,
    policies: [
      { name: 'block-admin', target: 'admin_*', action: 'deny', priority: 10 },
    ],
    threatDetection: true,
    rateLimit: { perTool: { search: { maxCalls: 100, windowMs: 60_000 } } },
    audit: true,
  },
  meter: { classify: true, trackCalls: true },
});
```

위협 패턴 8개 (프롬프트 인젝션, 경로 탐색, 명령어 주입, 도구 오염).
MCP 에러 코드 (-32000~-32003, -32601~-32603).

## CLI

```
air create <이름>              새 MCP 서버 프로젝트 생성
air add tool <이름>            도구/리소스/프롬프트 scaffold 추가
air dev [--console]            개발 모드 (핫 리로드 + 테스트 콘솔)
air start                      프로덕션 모드 (백그라운드)
air stop                       서버 중지
air status                     상태 확인
air list                       도구/리소스/프롬프트 목록
air inspect <도구>             도구 스키마 확인
air connect <클라이언트>       Claude Desktop, Cursor 등에 등록
air disconnect <클라이언트>    등록 해제
air check                      프로젝트 진단
```

## 트랜스포트

```typescript
// stdio (기본값) -- Claude Desktop 직접 실행
transport: { type: 'stdio' }

// SSE -- mcp-proxy 경유 리모트 연결
transport: { type: 'sse', port: 3510 }

// Streamable HTTP
transport: { type: 'http', port: 3510 }
```

## 스토리지

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// 메모리 (기본값)
const store = new MemoryStore();

// 파일 기반 (JSON + append-only 로그)
const store = new FileStore('.air/data');

// 팩토리
const store = await createStorage({ type: 'file', path: '.air/data' });
```

## 패키지

| 패키지 | 라이선스 | 설명 |
|--------|---------|------|
| @airmcp-dev/core | Apache-2.0 | 서버, 도구, 플러그인, 스토리지, 트랜스포트 |
| air (CLI) | Apache-2.0 | CLI 명령 (create, dev, connect 등) |
| @airmcp-dev/gateway | Apache-2.0 | 멀티 서버 프록시, 로드 밸런싱 |
| @airmcp-dev/logger | Apache-2.0 | 구조화된 로깅 |
| @airmcp-dev/meter | Apache-2.0 | 7-Layer 분류, 비용 추적 |
| @airmcp-dev/shield | Commercial | OWASP MCP Top 10, 고급 위협 탐지 |
| @airmcp-dev/hive | Commercial | 프로세스 풀, 자동 재시작, 멀티테넌트 |

## 테스트

```bash
pnpm install
npx vitest run    # 17파일, 165개 테스트
```

## 라이선스

오픈소스 패키지: Apache-2.0
엔터프라이즈 패키지 (@airmcp-dev/shield, @airmcp-dev/hive): Commercial License

---

Built by [CodePedia Labs](https://labs.codepedia.kr)
