# 보안 플러그인

## authPlugin

API 키 또는 Bearer 토큰으로 도구 호출을 인증합니다.

```typescript
import { authPlugin } from '@airmcp-dev/core';

// API 키 인증
use: [authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] })]

// Bearer 토큰 인증
use: [authPlugin({ type: 'bearer', tokens: [process.env.MCP_TOKEN!] })]
```

| 옵션 | 타입 | 설명 |
|------|------|------|
| `type` | `'api-key' \| 'bearer'` | 인증 타입 |
| `keys` | `string[]` | 유효한 API 키 |
| `verify` | `(token: string) => boolean \| Promise<boolean>` | 커스텀 검증 함수 (keys 대신 사용) |
| `publicTools` | `string[]` | 인증 없이 허용할 도구 목록 (기본: `[]`) |
| `paramName` | `string` | 인증 파라미터 이름 (기본: `'_auth'`) |

내부 동작:
- `before`: `paramName`에서 토큰 추출 → `keys` 또는 `verify`로 검증 → 성공 시 인증 파라미터 제거 후 통과
- `publicTools`에 포함된 도구는 인증 없이 통과

```typescript
// 커스텀 검증 함수 사용
use: [authPlugin({
  type: 'bearer',
  verify: async (token) => {
    const user = await db.verifyToken(token);
    return !!user;
  },
  publicTools: ['ping', 'health'],
})]
```

::: warning
키와 토큰은 반드시 환경변수로 관리하세요. 코드에 하드코딩하지 마세요.
:::

## sanitizerPlugin

입력 파라미터에서 위험한 문자와 패턴을 자동 제거합니다.

```typescript
import { sanitizerPlugin } from '@airmcp-dev/core';

use: [sanitizerPlugin()]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `stripHtml` | `boolean` | `true` | HTML 태그 제거 (`<[^>]*>` 패턴) |
| `stripControl` | `boolean` | `true` | 제어 문자 제거 (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F) |
| `maxStringLength` | `number` | `10000` | 초과 문자열 잘라내기 |
| `exclude` | `string[]` | `[]` | 적용 제외 도구 이름 목록 |

내부 동작: 모든 string 값에 대해 재귀적으로 정제. 객체 안의 중첩 문자열도 처리됨.

```typescript
// HTML을 허용하고 길이만 제한
sanitizerPlugin({
  stripHtml: false,
  maxStringLength: 50_000,
  exclude: ['html_render'],   // 특정 도구 제외
})
```

## validatorPlugin

Zod 스키마 이상의 커스텀 검증 규칙을 추가합니다.

```typescript
import { validatorPlugin } from '@airmcp-dev/core';

use: [validatorPlugin({
  rules: [
    {
      tool: 'search',
      validate: (params) => {
        if (params.query.length < 2) {
          return '검색어는 2자 이상이어야 합니다';
        }
      },
    },
    {
      tool: '*',               // 모든 도구에 적용
      validate: (params) => {
        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string' && value.length > 5000) {
            return `${key} 파라미터가 너무 깁니다 (최대 5000자)`;
          }
        }
      },
    },
  ],
})]
```

각 규칙:
- `tool` — 도구 이름 또는 `'*'` (모든 도구)
- `validate` — 에러 문자열 반환 시 호출 거부, `undefined` 반환 시 통과
