# Gateway

Gateway는 여러 MCP 서버 앞에 Streamable HTTP 엔드포인트 하나를 세웁니다. 클라이언트에게는 MCP 서버 하나로 보이고, 뒤에서는 도구·리소스·프롬프트 목록을 집계하고, 호출을 백엔드로 라우팅하고, 복제된 도구를 로드밸런싱하고, 비정상 백엔드를 제외하고, 스트리밍 알림과 elicitation을 그대로 통과시킵니다.

## 개요

```
Client → Gateway (:4000/mcp) → search-1   (:3510, http)
                             → search-2   (:3511, http)   ← search-1의 복제본, round-robin
                             → files      (:3512, http)
```

백엔드는 Streamable HTTP(air `transport: { type: 'http' }`)여야 합니다. 레거시 SSE와 stdio 백엔드는 아직 upstream으로 지원하지 않습니다.

## 설치

```bash
npm install @airmcp-dev/gateway
```

## 기본 사용법

```typescript
import { Gateway } from '@airmcp-dev/gateway';

const gateway = new Gateway({
  name: 'my-gateway',
  port: 4000,
  host: '127.0.0.1',            // 컨테이너에서는 '0.0.0.0'
  healthCheckInterval: 15_000,
  balancer: 'round-robin',
  requestTimeout: 30_000,
});

gateway.register({ id: 'search-1', name: 'search', connection: { type: 'http', url: 'http://localhost:3510/mcp' } });
gateway.register({ id: 'search-2', name: 'search', connection: { type: 'http', url: 'http://localhost:3511/mcp' } });
gateway.register({ id: 'files',    name: 'files',  connection: { type: 'http', url: 'http://localhost:3512/mcp' } });

await gateway.start();   // 도구/리소스/프롬프트 발견 → 헬스체크 시작 → 리슨
```

MCP 클라이언트를 `http://localhost:4000/mcp`로 연결하면 됩니다.

## GatewayOptions

```typescript
interface GatewayOptions {
  name?: string;                  // 클라이언트에 보이는 serverInfo.name (기본: 'air-gateway')
  port?: number;                  // 기본: 4000 (0이면 임의 포트; start() 후 gateway.port로 확인)
  host?: string;                  // 기본: '127.0.0.1'
  endpoint?: string;              // 기본: '/mcp'
  allowedOrigins?: string[];      // 루프백 외에 허용할 브라우저 Origin. '*'는 전부
  healthCheckInterval?: number;   // ms, 기본: 15000
  balancer?: BalancerStrategy;    // 'round-robin' | 'random' | 'weighted'
  requestTimeout?: number;        // upstream 호출당 ms, 기본: 30000
  discoverOnStart?: boolean;      // 기본: true
  pendingTtlMs?: number;          // 클라이언트의 elicitation 응답 대기 시간, 기본: 5분
}
```

## 백엔드 등록

```typescript
gateway.register({
  id: 'search-2',                 // 고유
  name: 'search',                 // 표시 이름
  connection: { type: 'http', url: 'http://localhost:3511/mcp', headers: { Authorization: 'Bearer …' } },
  weight: 2,                      // 'weighted' 밸런서용
});

gateway.unregister('search-2');
await gateway.discover();         // 모든 백엔드의 도구/리소스/프롬프트를 다시 읽기
await gateway.discover('files');  // 하나만
```

`stdio`·`sse` 연결은 `register()`에서 예외를 던집니다.

## Gateway가 직접 답하는 것 / 전달하는 것

| 메서드 | 처리 |
|--------|------|
| `initialize`, `ping` | Gateway가 직접 응답. 클라이언트 능력을 기억해 매 `tools/call`에 `_meta`로 백엔드에 전달하므로, 백엔드가 elicitation 가능 여부를 알 수 있습니다. |
| `tools/list`, `resources/list`, `resources/templates/list`, `prompts/list` | `start()`/`discover()`에서 발견한 목록을 집계. 여러 백엔드에 같은 이름의 도구가 있으면 한 번만 나열되고 복제본으로 취급됩니다. |
| `tools/call` | 도구 이름 → 로드밸런서 → 백엔드로 라우팅. 클라이언트가 SSE를 받으면 스트리밍(아래). |
| `resources/read`, `resources/subscribe`, `prompts/get`, `completion/complete` | 그 URI/프롬프트를 나열한 백엔드로 전달 (리소스 템플릿도 매칭). |
| `logging/setLevel` | 모든 백엔드에 전달. |
| 클라이언트 알림 | `202`로 받고 전달하지 않음. |
| JSON-RPC 배치 | 거부 (`-32600`). |

## 스트리밍 패스스루

클라이언트가 `Accept: text/event-stream`으로 `tools/call`을 보내면 Gateway도 같은 방식으로 백엔드를 호출하고, 백엔드 SSE 스트림의 이벤트를 전부 클라이언트 스트림으로 중계합니다: `notifications/progress`, `notifications/message`, 그리고 `elicitation/create` 같은 서버발 요청. 최종 JSON-RPC 응답이 스트림을 닫습니다.

서버발 요청은 백엔드 id가 충돌할 수 있어서 Gateway 범위의 id(`gw-N`)로 바뀝니다. 클라이언트는 단일 서버에 하듯 Gateway 엔드포인트로 JSON-RPC 응답을 `POST`하면 되고, Gateway가 id를 되돌려 요청한 백엔드로 전달합니다. 답이 없는 요청은 `pendingTtlMs` 뒤 버려집니다.

`application/json`만 받는 클라이언트는 최종 결과만 받습니다. 백엔드도 JSON 모드로 호출되므로 알림을 보내지 않고 `ctx.elicit`은 `undefined`입니다.

호출 중 클라이언트 연결이 끊기면 upstream 요청도 중단됩니다.

## 로드밸런싱

복제된 도구(여러 백엔드에 같은 이름)는 호출마다 분배됩니다:

| 전략 | 설명 |
|------|------|
| `round-robin` | 순서대로 번갈아 (기본) |
| `random` | 무작위 |
| `weighted` | `register()`의 `weight`에 비례 |
| `least-connections` | 받긴 하지만 현재는 round-robin으로 폴백 |

상태가 `connected`가 아닌 백엔드는 건너뜁니다. 도구를 가진 백엔드가 하나도 정상이 아니면 `-32601`로 실패합니다.

## 헬스체크

`healthCheckInterval` ms마다 각 백엔드 origin의 `/health`를 조회합니다(air 서버가 응답). 실패하거나 5초 넘게 걸리면 `error`로, 통과하면 `connected`로 돌아옵니다. 첫 체크는 10초 뒤에 시작해 콜드 스타트 중인 백엔드가 down으로 찍히지 않게 합니다.

```typescript
gateway.healthChecker.getAllResults();  // [{ serverId, healthy, latencyMs, error?, checkedAt }]
await gateway.healthChecker.checkAll(); // 지금 한 번 실행
```

Gateway 자신의 `GET /`, `GET /health`는 상태(서버 수, 도구 수, 대기 중 요청, 헬스 결과)를 돌려줍니다.

## 페일오버

1. 백엔드 다운 → 그쪽으로 가던 호출은 실패하거나 타임아웃.
2. 다음 헬스체크가 `error`로 표시 → 라우팅에서 제외.
3. 복제된 도구는 나머지 백엔드로 계속 흐르고, 그 백엔드만 제공하던 도구는 "no healthy server"로 실패.
4. 백엔드 복구 → 헬스체크 통과 → `connected` → 다시 순환에 포함.

## 임베딩

`gateway.handleRequest(req, res)`가 공개되어 있어, `start()`로 따로 리슨하는 대신 기존 `node:http` 서버 안에 엔드포인트를 끼울 수 있습니다.

## 하위 구성요소

`ServerRegistry`, `ToolIndex`, `RequestRouter`, `LoadBalancer`, `HealthChecker`, `UpstreamClient`가 export되어 커스텀 프론트를 만들 수 있습니다. `McpProxy`(HTTP 프론트 없이 프로세스 내 `callTool()` 라우팅)는 호환용으로 남아 있습니다.
