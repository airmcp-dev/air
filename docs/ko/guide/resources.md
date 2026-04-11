# 리소스

리소스는 MCP 클라이언트에 데이터를 노출합니다. 클라이언트는 URI로 읽을 수 있습니다.

## 도구 vs 리소스

MCP에는 도구(Tool)와 리소스(Resource) 두 가지 프리미티브가 있습니다:

| | 도구 (Tool) | 리소스 (Resource) |
|---|---|---|
| **용도** | 작업 수행 (부수 효과 가능) | 데이터 읽기 (읽기 전용) |
| **호출 방식** | 이름 + 파라미터 | URI |
| **예시** | DB 쓰기, 이메일 전송, API 호출 | 설정 조회, 상태 확인, 파일 읽기 |
| **AI 관점** | "이걸 실행해줘" | "이 정보를 보여줘" |

간단한 규칙: **데이터를 바꾸면 도구**, **데이터를 읽으면 리소스**.

## 기본 리소스

```typescript
import { defineResource } from '@airmcp-dev/core';

const config = defineResource('config://app', {
  name: 'app-config',
  description: '애플리케이션 설정',
  handler: async () => ({
    version: '1.0.0',
    env: process.env.NODE_ENV,
  }),
});
```

## defineResource API

두 가지 호출 방식:

```typescript
// 방식 1: URI + 옵션
defineResource('config://app', {
  name: 'app-config',
  description: '앱 설정',
  handler: async (uri, context) => { /* ... */ },
});

// 방식 2: 단일 객체
defineResource({
  uri: 'config://app',
  name: 'app-config',
  description: '앱 설정',
  handler: async (uri, context) => { /* ... */ },
});
```

### AirResourceDef

```typescript
interface AirResourceDef {
  uri: string;                  // 리소스 URI (예: "config://app")
  name: string;                 // 표시 이름
  description?: string;         // 설명
  mimeType?: string;            // MIME 타입 (기본: text/plain)
  handler: (uri: string, context: AirResourceContext) => Promise<AirResourceContent>;
}
```

## 핸들러

핸들러는 요청된 URI와 컨텍스트 객체를 받습니다:

```typescript
interface AirResourceContext {
  requestId: string;    // crypto.randomUUID()
  serverName: string;   // defineServer의 name
}
```

핸들러 예제:

```typescript
defineResource('status://server', {
  name: 'server-status',
  handler: async (uri, context) => {
    return {
      text: JSON.stringify({
        server: context.serverName,
        requestId: context.requestId,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }),
      mimeType: 'application/json',
    };
  },
});
```

## 응답 타입

```typescript
// 문자열 → text/plain
handler: async () => '일반 텍스트 내용'

// MIME 타입 지정 텍스트
handler: async () => ({
  text: '{"key": "value"}',
  mimeType: 'application/json',
})

// 바이너리 (base64 인코딩)
handler: async () => ({
  blob: 'base64-encoded-data',
  mimeType: 'image/png',
})
```

타입 정의:

```typescript
type AirResourceContent =
  | string                                          // → text/plain
  | { text: string; mimeType?: string }            // → 지정 MIME
  | { blob: string; mimeType: string };            // → 바이너리
```

## URI 템플릿

`{variable}` 문법으로 동적 URI를 사용합니다. 클라이언트가 실제 URI(예: `file:///readme.md`)를 요청하면 핸들러에서 변수를 추출합니다.

```typescript
import { matchTemplate } from '@airmcp-dev/core';

defineResource('file:///{path}', {
  name: 'file-reader',
  description: '경로로 파일 읽기',
  handler: async (uri) => {
    const vars = matchTemplate('file:///{path}', uri);
    if (!vars) return 'File not found';
    // vars = { path: 'readme.md' }
    return readFile(vars.path, 'utf-8');
  },
});
```

다중 변수:

```typescript
defineResource('db:///{database}/{table}', {
  name: 'db-table',
  handler: async (uri) => {
    const vars = matchTemplate('db:///{database}/{table}', uri);
    if (!vars) return 'Not found';
    // vars = { database: 'mydb', table: 'users' }
    return JSON.stringify(await db.query(vars.database, vars.table));
  },
});
```

### 템플릿 헬퍼

```typescript
import { extractTemplateVars, matchTemplate } from '@airmcp-dev/core';

// 템플릿에서 변수 이름 추출
extractTemplateVars('file:///{path}');
// → ['path']

extractTemplateVars('db:///{database}/{table}');
// → ['database', 'table']

// URI가 템플릿 패턴과 매칭되는지 확인
matchTemplate('user:///{id}/profile', 'user:///42/profile');
// → { id: '42' }

matchTemplate('user:///{id}/profile', 'user:///42/settings');
// → null (매칭 안 됨)
```

내부 구현: `{variable}`을 정규식 `(?<variable>[^/]+)`으로 변환하여 매칭합니다.

## 서버에 등록

```typescript
import { defineServer, defineResource, matchTemplate } from '@airmcp-dev/core';

defineServer({
  resources: [
    // 정적 리소스
    defineResource('config://app', {
      name: 'app-config',
      handler: async () => ({ version: '1.0.0', env: 'production' }),
    }),

    // 동적 URI 리소스
    defineResource('db:///{table}', {
      name: 'db-table',
      description: '테이블 데이터 조회',
      mimeType: 'application/json',
      handler: async (uri) => {
        const { table } = matchTemplate('db:///{table}', uri)!;
        const rows = await db.query(`SELECT * FROM ${table} LIMIT 10`);
        return JSON.stringify(rows);
      },
    }),

    // 바이너리 리소스
    defineResource('logo://app', {
      name: 'app-logo',
      description: '앱 로고 이미지',
      mimeType: 'image/png',
      handler: async () => ({
        blob: await readFile('assets/logo.png', 'base64'),
        mimeType: 'image/png',
      }),
    }),
  ],
});
```

## 등록된 리소스 조회

```typescript
const resources = server.resources();
// [
//   { uri: 'config://app', name: 'app-config', ... },
//   { uri: 'db:///{table}', name: 'db-table', ... },
// ]
```
