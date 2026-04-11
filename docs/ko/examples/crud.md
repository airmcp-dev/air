# 예제: CRUD 서버

데이터 관리 도구 서버. AI가 레코드를 생성, 조회, 수정, 삭제할 수 있습니다.

## 프로젝트 생성

```bash
npx @airmcp-dev/cli create my-crud-server --template crud --lang ko
cd my-crud-server
npm install
```

## 전체 코드

```typescript
// src/index.ts
import {
  defineServer, defineTool, createStorage, onShutdown,
  sanitizerPlugin, validatorPlugin,
} from '@airmcp-dev/core';

// 파일 기반 스토리지 (서버 재시작해도 데이터 유지)
const store = await createStorage({ type: 'file', path: '.air/data' });

const server = defineServer({
  name: 'my-crud-server',
  version: '1.0.0',
  description: 'CRUD 데이터 관리 서버',

  transport: { type: 'sse', port: 3510 },
  logging: { level: 'info' },

  use: [
    sanitizerPlugin(),                     // XSS 방지
    validatorPlugin({
      rules: [
        { tool: 'create', validate: (p) => {
          try { JSON.parse(p.data); } catch { return 'data는 유효한 JSON이어야 합니다'; }
        }},
        { tool: 'update', validate: (p) => {
          try { JSON.parse(p.data); } catch { return 'data는 유효한 JSON이어야 합니다'; }
        }},
      ],
    }),
  ],

  tools: [
    defineTool('create', {
      description: '새 레코드를 생성합니다',
      params: {
        collection: { type: 'string', description: '컬렉션 이름 (예: users, posts)' },
        data: { type: 'string', description: '레코드 데이터 (JSON 문자열)' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(collection, id, { ...record, _id: id, _createdAt: new Date().toISOString() });
        return { id, message: `${collection}에 생성됨` };
      },
    }),

    defineTool('read', {
      description: '레코드를 조회합니다. ID를 생략하면 전체 목록을 반환합니다',
      params: {
        collection: { type: 'string', description: '컬렉션 이름' },
        id: { type: 'string', description: '레코드 ID (선택)', optional: true },
      },
      handler: async ({ collection, id }) => {
        if (id) {
          const record = await store.get(collection, id);
          return record || { error: '찾을 수 없습니다', id };
        }
        const records = await store.entries(collection);
        return { collection, count: records.length, records };
      },
    }),

    defineTool('update', {
      description: '기존 레코드를 수정합니다',
      params: {
        collection: { type: 'string', description: '컬렉션 이름' },
        id: { type: 'string', description: '레코드 ID' },
        data: { type: 'string', description: '수정할 필드 (JSON 문자열)' },
      },
      handler: async ({ collection, id, data }) => {
        const existing = await store.get(collection, id);
        if (!existing) return { error: '찾을 수 없습니다', id };
        const updated = { ...existing, ...JSON.parse(data), _updatedAt: new Date().toISOString() };
        await store.set(collection, id, updated);
        return { id, message: '수정됨', record: updated };
      },
    }),

    defineTool('delete', {
      description: '레코드를 삭제합니다',
      params: {
        collection: { type: 'string', description: '컬렉션 이름' },
        id: { type: 'string', description: '레코드 ID' },
      },
      handler: async ({ collection, id }) => {
        const existed = await store.delete(collection, id);
        return existed
          ? { id, message: '삭제됨' }
          : { error: '찾을 수 없습니다', id };
      },
    }),

    defineTool('list_collections', {
      description: '사용 가능한 컬렉션 목록을 반환합니다',
      handler: async () => {
        // .air/data/ 디렉토리의 .json 파일 목록
        const { readdir } = await import('node:fs/promises');
        const files = await readdir('.air/data').catch(() => []);
        const collections = files
          .filter((f: string) => f.endsWith('.json'))
          .map((f: string) => f.replace('.json', ''));
        return { collections };
      },
    }),
  ],
});

server.state.store = store;

onShutdown(async () => {
  await store.close();
});

server.start();
```

## 사용 예시

Claude에서:
- "users 컬렉션에 이름이 Alice, 나이 30인 레코드를 만들어줘"
- "users 컬렉션의 전체 목록을 보여줘"
- "users_1234567890 레코드의 나이를 31로 수정해줘"
- "users_1234567890 레코드를 삭제해줘"

## 저장 구조

```
.air/data/
├── users.json        # users 컬렉션 데이터
├── posts.json        # posts 컬렉션 데이터
└── ...
```

각 파일은 네임스페이스별 key-value JSON. FileStore가 5초마다 dirty 데이터를 디스크에 flush합니다.

## 프로덕션 팁

- `sanitizerPlugin`으로 XSS 입력 방지
- `validatorPlugin`으로 JSON 형식 검증
- `onShutdown`으로 스토리지 정상 종료
- 실제 프로덕션에서는 `FileStore` 대신 PostgreSQL이나 MongoDB에 직접 연결
