# air 프레임워크 -- AI 레퍼런스

이 문서는 AI 어시스턴트가 air 프레임워크를 이해하고 코드를 생성하기 위한 참조 문서입니다.

## 아키텍처

air는 MCP (Model Context Protocol) 서버를 빌드하는 TypeScript 모노레포 (pnpm + turborepo)입니다.

패키지:
- @airmcp-dev/core -- 서버 정의, 도구, 리소스, 프롬프트, 플러그인, 스토리지, 트랜스포트, 미들웨어
- air (CLI) -- 스캐폴딩, 개발 서버, 클라이언트 등록
- @airmcp-dev/gateway -- 멀티 서버 프록시, 라우팅, 로드밸런싱
- @airmcp-dev/logger -- 구조화된 로깅 (JSON, pretty, file, remote)
- @airmcp-dev/meter -- 7-Layer 분류, 호출 추적, 예산 관리
- @airmcp-dev/shield (상용) -- OWASP MCP Top 10, 고급 위협 탐지, 샌드박스
- @airmcp-dev/hive (상용) -- 프로세스 풀, 자동 재시작, 멀티테넌트, 클러스터

## 핵심 API

### defineServer

```typescript
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';

const server = defineServer({
  name: string,
  version?: string,
  description?: string,
  transport?: { type: 'stdio' | 'sse' | 'http', port?: number },
  shield?: ShieldConfig,
  meter?: MeterConfig,
  use?: AirPlugin[],
  tools?: AirToolDef[],
  resources?: AirResourceDef[],
  prompts?: AirPromptDef[],
  middleware?: AirMiddleware[],
  storage?: StoreOptions,
});
```

반환: `{ start(), stop(), status(), tools(), resources(), callTool(name, params) }`

### defineTool

```typescript
defineTool('도구_이름', {
  description: string,
  params: { key: ParamDef, ... },
  handler: async (params, ctx) => result,
})

// ParamDef: 'string' | 'number' | 'boolean' | { type, description?, optional? }
```

핸들러 반환 타입:
- string -- `[{ type: 'text', text }]`로 변환
- object -- JSON 문자열로 변환
- `{ text, isError? }` -- MCP 컨텐츠 직접 반환

### defineResource

```typescript
// 형태 1
defineResource('file:///path', { name, description?, handler })

// 형태 2
defineResource({ uri, name, description?, handler })
```

### definePrompt

```typescript
// 형태 1
definePrompt('이름', { description?, args?, handler })

// 형태 2
definePrompt({ name, description?, args?, handler })
```

핸들러: `(args) => [{ role: 'user' | 'assistant', content: string }]`

## 플러그인 (19개 내장)

모든 플러그인은 `AirPlugin` 인터페이스를 따릅니다:
```typescript
interface AirPlugin {
  meta: { name: string, version?: string },
  middleware?: AirMiddleware[],
  tools?: AirToolDef[],
  hooks?: PluginHooks,
}
```

사용 가능한 플러그인 ('@airmcp-dev/core'에서 import):

| 플러그인 | 팩토리 | 주요 옵션 |
|---------|--------|----------|
| timeoutPlugin | timeoutPlugin(ms) | 타임아웃 밀리초 |
| retryPlugin | retryPlugin({ maxRetries, delayMs }) | 지수 백오프 |
| circuitBreakerPlugin | circuitBreakerPlugin({ failureThreshold, resetTimeoutMs }) | 도구별 서킷 |
| fallbackPlugin | fallbackPlugin({ primary: 'backup' }) | 도구명 매핑 |
| cachePlugin | cachePlugin({ ttlMs, maxEntries, exclude }) | 결과 캐시 |
| dedupPlugin | dedupPlugin({ windowMs }) | 중복 요청 제거 |
| queuePlugin | queuePlugin({ concurrency: { tool: N } }) | 동시성 제어 |
| authPlugin | authPlugin({ type, keys, publicTools }) | API 키 / Bearer 인증 |
| sanitizerPlugin | sanitizerPlugin({ stripHtml, maxStringLength }) | 입력 정제 |
| validatorPlugin | validatorPlugin({ rules: { tool: fn } }) | 비즈니스 검증 |
| corsPlugin | corsPlugin({ origins }) | CORS 헤더 |
| webhookPlugin | webhookPlugin({ url, events }) | 외부 알림 |
| transformPlugin | transformPlugin({ before, after }) | 입출력 변환 |
| i18nPlugin | i18nPlugin({ defaultLang, translations }) | 다국어 응답 |
| jsonLoggerPlugin | jsonLoggerPlugin({ output }) | JSON 구조화 로깅 |
| perUserRateLimitPlugin | perUserRateLimitPlugin({ maxCalls, windowMs }) | 사용자별 레이트 리밋 |
| dryrunPlugin | dryrunPlugin({ enabled }) | 드라이런 모드 |

## Shield 설정

```typescript
shield: {
  enabled: true,
  policies: [{ name, target (glob), action: 'allow' | 'deny', priority }],
  threatDetection: boolean,
  rateLimit: {
    perTool: { [toolName]: { maxCalls, windowMs } },
    default: { maxCalls, windowMs },
  },
  audit: boolean,
}
```

## Meter 설정

```typescript
meter: {
  enabled: boolean,
  classify: boolean,    // 7-Layer 분류
  trackCalls: boolean,  // 호출 이력 (ring buffer)
}
```

## 스토리지

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// MemoryStore -- 인메모리, TTL 지원
// FileStore -- JSON 파일 + .jsonl append 로그, 주기적 flush
// createStorage({ type: 'memory' | 'file' | 'sqlite', path? })
```

## 트랜스포트

- stdio: 기본값, Claude Desktop 서브프로세스
- sse: GET /sse + POST /message?sessionId=xxx, 멀티 세션
- http: Streamable HTTP (POST /, Accept 헤더, Mcp-Session-Id)

## 미들웨어 체인 순서

1. errorBoundary (내장)
2. validation (내장, zod passthrough)
3. shield (활성화 시)
4. meter (활성화 시)
5. 내장 logger/metrics 플러그인
6. 사용자 플러그인 (use 배열 순서)
7. 사용자 미들웨어 (middleware 배열 순서)

## 에러 처리

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

McpErrors.toolNotFound(name)       // -32601
McpErrors.invalidParams(msg)       // -32602
McpErrors.internal(msg)            // -32603
McpErrors.forbidden(msg)           // -32000
McpErrors.rateLimited(tool, ms)    // -32001
McpErrors.threatDetected(type, sev) // -32002
McpErrors.timeout(tool, ms)        // -32003
```

## CLI 명령

```
air create <이름> [--template basic|crud|api|agent] [--lang ko|en]
air add <타입> <이름> [--params "key:type,..."]
air dev [--console] [-p port] [-t stdio|sse|http]
air start [-p port] [-t transport] [--foreground]
air stop [이름]
air status
air list [--json]
air inspect <도구>
air connect <클라이언트> [-t transport] [-p port] [-H host] [--proxy path]
air disconnect <클라이언트>
air check
```

지원 클라이언트: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio
