# 리소스 & 프롬프트 레퍼런스

## defineResource

```typescript
import { defineResource } from '@airmcp-dev/core';

// 방식 1: URI + 옵션
const r = defineResource('config://app', {
  name: 'app-config',
  description: '앱 설정',
  handler: async (uri, ctx) => ({ version: '1.0.0' }),
});

// 방식 2: 단일 객체
const r = defineResource({
  uri: 'config://app',
  name: 'app-config',
  handler: async (uri, ctx) => ({ version: '1.0.0' }),
});
```

### AirResourceDef

```typescript
interface AirResourceDef {
  uri: string;                  // 리소스 URI (예: "config://app", "file:///{path}")
  name: string;                 // 표시 이름
  description?: string;
  mimeType?: string;            // 기본: 'text/plain'
  handler: (uri: string, context: AirResourceContext) => Promise<AirResourceContent>;
}
```

### AirResourceContext

```typescript
interface AirResourceContext {
  requestId: string;    // crypto.randomUUID()
  serverName: string;
}
```

### AirResourceContent

```typescript
type AirResourceContent =
  | string                                  // → text/plain
  | { text: string; mimeType?: string }    // → 지정 MIME
  | { blob: string; mimeType: string };    // → 바이너리 (base64)
```

## 템플릿 헬퍼

### extractTemplateVars(uri)

```typescript
import { extractTemplateVars } from '@airmcp-dev/core';

extractTemplateVars('file:///{path}');           // → ['path']
extractTemplateVars('db:///{database}/{table}'); // → ['database', 'table']
extractTemplateVars('config://app');             // → []
```

### matchTemplate(template, uri)

내부 구현: `{var}` → `(?<var>[^/]+)` 정규식 변환.

```typescript
import { matchTemplate } from '@airmcp-dev/core';

matchTemplate('user:///{id}/profile', 'user:///42/profile');
// → { id: '42' }

matchTemplate('db:///{db}/{table}', 'db:///mydb/users');
// → { db: 'mydb', table: 'users' }

matchTemplate('user:///{id}/profile', 'user:///42/settings');
// → null (매칭 안 됨)
```

## definePrompt

```typescript
import { definePrompt } from '@airmcp-dev/core';

// 방식 1: 이름 + 옵션
const p = definePrompt('summarize', {
  description: '텍스트 요약',
  arguments: [{ name: 'text', required: true }],
  handler: ({ text }) => [
    { role: 'user', content: `요약해주세요: ${text}` },
  ],
});

// 방식 2: 단일 객체
const p = definePrompt({
  name: 'summarize',
  arguments: [{ name: 'text', required: true }],
  handler: ({ text }) => [{ role: 'user', content: `요약: ${text}` }],
});
```

### AirPromptDef

```typescript
interface AirPromptDef {
  name: string;
  description?: string;
  arguments?: AirPromptArg[];
  handler: (args: Record<string, string>) => Promise<AirPromptMessage[]> | AirPromptMessage[];
}
```

::: info
프롬프트 인자는 모두 `string` 타입입니다 (MCP 프로토콜 스펙 제약).
:::

### AirPromptArg

```typescript
interface AirPromptArg {
  name: string;
  description?: string;
  required?: boolean;         // 기본: false
}
```

### AirPromptMessage

```typescript
interface AirPromptMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

MCP SDK 등록 시 `{ role, content: { type: 'text', text: content } }` 형식으로 자동 변환.
