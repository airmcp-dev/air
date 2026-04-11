# air란?

air는 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버를 만들기 위한 TypeScript 프레임워크입니다.

## MCP란?

MCP는 Anthropic이 만든 오픈 프로토콜로, AI 에이전트(Claude, Cursor, VS Code Copilot 등)가 외부 도구, 데이터, 서비스에 접근할 수 있게 해줍니다. MCP 서버를 만들면 AI가 당신의 API, 데이터베이스, 파일 시스템 등을 도구로 사용할 수 있습니다.

예를 들어:
- Claude가 회사 내부 DB를 검색하는 도구
- Cursor가 CI/CD 파이프라인을 실행하는 도구
- AI 에이전트가 외부 API를 호출하는 도구

이 모든 것이 MCP 서버입니다.

## 문제

MCP 서버를 처음부터 만들려면 `@modelcontextprotocol/sdk`를 직접 사용해야 합니다:

```typescript
// MCP SDK 직접 사용 — 70줄 이상
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '0.1.0' });

server.tool(
  'search',
  'Search documents',
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    // 에러 처리를 직접 해야 함
    try {
      const results = await doSearch(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(results) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// 트랜스포트 설정 직접
const transport = new StdioServerTransport();
await server.connect(transport);

// 재시도? 캐시? 인증? 로깅? 전부 직접 구현해야 함
```

해야 할 일:
- Zod 스키마를 직접 정의하고 결과를 MCP content 형식으로 수동 변환
- 에러 처리를 모든 도구에 try/catch로 반복 작성
- 재시도, 캐시, 인증, 레이트 리밋을 직접 구현
- 트랜스포트 전환 시 코드 수정 필요
- 로깅, 메트릭, 우아한 종료 전부 수동

## 해결

air는 같은 서버를 이렇게 만듭니다:

```typescript
// air 사용 — 20줄
import { defineServer, defineTool, retryPlugin, cachePlugin } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
  ],
  tools: [
    defineTool('search', {
      description: '문서 검색',
      params: { query: 'string', limit: 'number?' },
      handler: async ({ query, limit }) => {
        return await doSearch(query, limit);
      },
    }),
  ],
});

server.start();
```

차이점:
- 파라미터는 `'string'`, `'number?'` 단축 표기 → 내부에서 Zod로 자동 변환
- 핸들러 반환값은 문자열, 객체, 배열 아무거나 → MCP content로 자동 변환
- 에러 처리는 내장 미들웨어가 자동으로 MCP 에러 코드 변환
- 재시도, 캐시는 `use` 배열에 한 줄
- 트랜스포트는 설정 한 줄로 교체

## 어떤 서버를 만들 수 있나요?

| 사용 사례 | 설명 | 적합한 템플릿 |
|-----------|------|--------------|
| 내부 API 래핑 | REST API를 MCP 도구로 노출 | `api` |
| DB 관리 도구 | CRUD 작업을 AI가 수행 | `crud` |
| 파일/문서 검색 | 로컬 파일을 검색·요약 | `basic` |
| AI 에이전트 | 멀티스텝 작업 (think-execute-remember) | `agent` |
| DevOps 도구 | CI/CD, 모니터링, 로그 분석 | `api` |
| 데이터 분석 | 통계 계산, 차트 생성 | `basic` |

## 패키지 구성

air는 5개 패키지로 구성된 모노레포입니다. `@airmcp-dev/core` 하나만 설치하면 시작할 수 있고, 필요에 따라 추가합니다.

| 패키지 | 설명 | 라이선스 |
|--------|------|---------|
| `@airmcp-dev/core` | 서버, 도구, 19개 플러그인, 스토리지, 트랜스포트. 이것만 있으면 MCP 서버를 만들 수 있음 | Apache-2.0 |
| `@airmcp-dev/cli` | CLI 도구 — 프로젝트 생성(`create`), 개발 모드(`dev`), 클라이언트 연결(`connect`), 상태 확인(`status`) 등 12개 명령 | Apache-2.0 |
| `@airmcp-dev/gateway` | 여러 MCP 서버를 하나의 엔드포인트로 묶는 리버스 프록시. 헬스 체크, 로드밸런싱, 자동 장애복구 | Apache-2.0 |
| `@airmcp-dev/logger` | JSON/pretty 포맷, 파일 로테이션, 원격 전송을 지원하는 구조화 로거 | Apache-2.0 |
| `@airmcp-dev/meter` | 모든 MCP 호출을 L1(캐시)~L7(에이전트 체인) 7계층으로 자동 분류. 토큰 비용 추적, 예산 설정 | Apache-2.0 |

## defineServer가 자동으로 처리하는 것

`defineServer()`를 호출하면 프레임워크가 다음을 순서대로 설정합니다:

1. **에러 경계 미들웨어** — 핸들러에서 throw된 모든 에러를 잡아 MCP 프로토콜 에러 코드(`-32601`, `-32602`, `-32603` 등)로 변환. 로그는 stderr로 출력 (stdout은 MCP 프로토콜 전용)
2. **입력 검증 미들웨어** — `params`에 정의된 타입을 Zod 스키마로 변환하고, 호출마다 파라미터를 자동 검증. 실패 시 `-32602 Invalid params` 에러 반환
3. **Meter 미들웨어** — `meter` 설정 시 모든 호출을 L1~L7로 분류하고 호출량·지연시간 추적. `layer` 힌트가 없으면 실행 시간 기반으로 자동 분류
4. **내장 로거 플러그인** — 모든 도구 호출을 자동 로깅. `logging.level`로 레벨 제어 (debug/info/warn/error/silent). 개발 시 pretty, 프로덕션 시 JSON
5. **내장 메트릭 플러그인** — 도구별 호출 수, 에러율, 지연시간(p50/p95/p99) 자동 수집. `getMetrics()`로 접근
6. **사용자 플러그인** — `use` 배열에 등록된 플러그인에서 미들웨어를 수집하여 체인에 추가. 배열 순서 = 실행 순서
7. **사용자 미들웨어** — `middleware` 배열에 등록된 커스텀 미들웨어 (플러그인 이후 실행)
8. **Graceful shutdown** — SIGTERM/SIGINT 시그널을 받으면 등록된 정리 함수를 순서대로 실행한 뒤 프로세스 종료

## 기술 스택

- **런타임**: Node.js 18+
- **언어**: TypeScript (ESM)
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.12.0
- **검증**: Zod ^3.23
- **빌드**: turbo (모노레포)
- **테스트**: vitest
- **패키지 관리**: pnpm

## 다음 단계

- [시작하기](/ko/guide/getting-started) — 5분 만에 첫 서버 만들기
- [서버 정의](/ko/guide/server) — defineServer 전체 옵션과 AirServer 인터페이스
- [도구](/ko/guide/tools) — defineTool API, 3가지 파라미터 형식, 핸들러 컨텍스트
- [플러그인](/ko/guide/plugins) — 19개 내장 플러그인과 실행 순서
- [설정 파일](/ko/guide/configuration) — air.config.ts와 기본값
