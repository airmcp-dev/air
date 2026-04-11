# 개발/테스트 플러그인

## dryrunPlugin

실제 핸들러를 실행하지 않고 파라미터 검증 + 예상 결과를 반환합니다. 테스트, CI, 스키마 확인에 사용합니다.

```typescript
import { dryrunPlugin } from '@airmcp-dev/core';

// 전역 모드 — 모든 호출을 드라이런
use: [dryrunPlugin({ enabled: true })]

// 환경변수로 제어
use: [dryrunPlugin({ enabled: process.env.DRY_RUN === 'true' })]

// perCall 모드 — _dryrun 파라미터가 있는 호출만
use: [dryrunPlugin({ perCall: true })]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `enabled` | `boolean` | `false` | 전역 드라이런 활성화 |
| `perCall` | `boolean` | `true` | `_dryrun: true` 파라미터가 있는 호출만 드라이런 |
| `mockResponse` | `(toolName, params) => any` | — | 커스텀 드라이런 응답 생성기 |

### 기본 드라이런 응답

```json
{
  "dryrun": true,
  "tool": "search",
  "params": { "query": "hello" },
  "description": "Search documents",
  "schema": [
    { "name": "query", "type": "string", "provided": true, "value": "hello" },
    { "name": "limit", "type": "number", "provided": false, "value": null }
  ],
  "message": "[Dryrun] \"search\" would be called with: {\"query\":\"hello\"}"
}
```

### 커스텀 응답

```typescript
use: [dryrunPlugin({
  enabled: true,
  mockResponse: (toolName, params) => {
    if (toolName === 'search') return { results: [], total: 0 };
    return `[Mock] ${toolName} would run`;
  },
})]
```

### perCall 모드 주의사항

`perCall` 모드는 `server.callTool()` 직접 호출 시에만 동작합니다:

```typescript
// ✅ 동작 — callTool은 미들웨어 체인을 그대로 거침
server.callTool('search', { query: 'hello', _dryrun: true });

// ❌ 미동작 — MCP 클라이언트 경유 시 SDK가 스키마에 없는 파라미터(_dryrun)를 제거
// Claude Desktop → 서버로 호출 시 _dryrun 파라미터가 도달하지 않음
```

MCP 클라이언트 경유 시에는 `enabled: true` 전역 모드나 환경변수를 사용하세요.
