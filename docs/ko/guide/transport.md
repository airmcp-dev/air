# 트랜스포트

air는 세 가지 MCP 트랜스포트를 지원합니다. `transport` 설정으로 선택합니다.

## stdio

표준 입출력. Claude Desktop이 서버를 자식 프로세스로 실행하고 stdin/stdout으로 통신합니다.

```typescript
defineServer({
  transport: { type: 'stdio' },
});
```

포트 불필요. 로그는 **stderr**로 출력됩니다 (stdout은 MCP 프로토콜 전용).

## SSE (Server-Sent Events)

HTTP 기반 원격 연결. 세션별 독립 MCP 서버 인스턴스가 생성됩니다.

```typescript
defineServer({
  transport: { type: 'sse', port: 3510 },
});
```

### SSE 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/sse` | SSE 스트림 연결 (새 세션 생성) |
| `POST` | `/message?sessionId=xxx` | 메시지 전송 |
| `GET` | `/` | 서버 상태 JSON 반환 |
| `OPTIONS` | `*` | CORS preflight (자동 처리) |

클라이언트 연결 흐름:
1. `GET /sse` → SSE 연결 수립, 세션 ID 발급
2. `POST /message?sessionId=xxx` → MCP 메시지 전송
3. 연결 종료 시 세션 자동 정리

터미널 출력:

```
[air] SSE server listening on port 3510
[air] SSE client connected (session: a1b2c3d4-...)
[air] SSE client disconnected (session: a1b2c3d4-...)
```

### CORS

SSE 트랜스포트는 CORS 헤더를 자동으로 설정합니다:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

커스터마이즈하려면 `corsPlugin`을 사용하세요.

## Streamable HTTP

최신 MCP 트랜스포트 스펙. 단일 엔드포인트로 모든 통신을 처리합니다.

```typescript
defineServer({
  transport: { type: 'http', port: 3510 },
});
```

| 메서드 | 설명 |
|--------|------|
| `POST` | MCP 메시지 처리 |
| `GET` | 서버 상태 JSON 반환 |
| `DELETE` | 세션 종료 |

각 세션에 고유 ID(`crypto.randomUUID()`)가 자동 할당됩니다.

## auto (기본)

`type`을 생략하거나 `'auto'`로 설정하면 환경을 감지하여 자동 선택합니다:

```typescript
defineServer({
  transport: { type: 'auto', port: 3510 },
});
```

감지 순서:

1. `MCP_TRANSPORT` 환경변수가 있으면 해당 값 사용 (`stdio`, `http`, `sse`)
2. stdin이 TTY가 아니면 → `stdio` (MCP 클라이언트가 spawn한 경우)
3. stdin이 TTY이면 → `http` (개발자가 직접 실행한 경우)

```bash
# 환경변수로 강제 지정
MCP_TRANSPORT=sse node dist/index.js

# 파이프 → stdio 자동 감지
echo '{}' | node dist/index.js

# 터미널 직접 실행 → http 자동 감지
node dist/index.js
```

## TransportConfig

```typescript
interface TransportConfig {
  type?: 'stdio' | 'sse' | 'http' | 'auto';  // 기본: 'auto'
  port?: number;                               // HTTP/SSE 포트
  host?: string;                               // 기본: 'localhost'
  basePath?: string;                           // 기본: '/'
}
```

### 포트 결정 순서

포트는 다음 순서로 결정됩니다:

1. `transport.port` (명시적 지정)
2. `dev.port` (개발 모드 설정)
3. `3100` (하드코딩 기본값)

```typescript
// transport.port 우선
defineServer({ transport: { type: 'sse', port: 3510 } });  // → 3510

// transport.port 없으면 dev.port
defineServer({ transport: { type: 'sse' }, dev: { port: 4000 } });  // → 4000

// 둘 다 없으면 3100
defineServer({ transport: { type: 'sse' } });  // → 3100
```

## 선택 가이드

| 트랜스포트 | 용도 | 클라이언트 |
|-----------|------|-----------|
| `stdio` | 로컬 도구, Claude Desktop 직접 연결 | Claude Desktop, `mcp-cli` |
| `sse` | 원격 서버, 기존 MCP 인프라, `mcp-proxy` 호환 | Cursor, VS Code, `mcp-proxy` |
| `http` | 새 배포, Streamable HTTP 스펙, 리버스 프록시 뒤 | 최신 MCP 클라이언트 |

::: tip
리버스 프록시(Nginx, Cloudflare) 뒤에 배포할 때는 `http` 트랜스포트를 사용하세요. SSE는 장기 연결(`proxy_read_timeout 86400`)을 위한 별도 프록시 설정이 필요합니다.
:::

::: info
`stdio` 트랜스포트에서는 모든 `console.log` 출력이 MCP 프로토콜 스트림에 섞일 수 있습니다. air의 내장 로거는 이를 자동으로 `stderr`로 리다이렉트합니다.
:::
