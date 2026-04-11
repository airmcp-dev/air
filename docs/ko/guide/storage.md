# 스토리지

air는 데이터 영속화를 위한 내장 스토리지 어댑터를 제공합니다. 외부 데이터베이스 없이 key-value 저장과 append-only 로그를 사용할 수 있습니다.

## 빠른 시작

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// 인메모리 (기본, 재시작 시 소멸)
const memory = new MemoryStore();
await memory.init();

// 파일 기반 (디스크에 영속)
const file = new FileStore('.air/data');
await file.init();

// 팩토리 — 설정으로 선택
const store = await createStorage({ type: 'file', path: '.air/data' });
```

## defineServer와 함께 사용

```typescript
defineServer({
  storage: { type: 'file', path: '.air/data' },
});
```

## createStorage 팩토리

`StoreOptions`에 따라 적절한 어댑터를 생성하고 `init()`까지 호출합니다:

```typescript
import { createStorage } from '@airmcp-dev/core';

const store = await createStorage({ type: 'memory' });
const store = await createStorage({ type: 'file', path: './data' });
const store = await createStorage({ type: 'sqlite', path: './data' });
// ⚠️ sqlite는 아직 미구현 — FileStore로 fallback + 경고 출력
```

### StoreOptions

```typescript
interface StoreOptions {
  type: 'memory' | 'file';     // 현재 구현된 타입
  path?: string;                // file 타입 시 경로 (기본: '.air/data/')
  defaultTtl?: number;          // 기본 TTL, 초 단위 (0 = 무제한)
}
```

## StorageAdapter API

모든 어댑터가 구현하는 인터페이스:

```typescript
interface StorageAdapter {
  init(): Promise<void>;
  set(namespace: string, key: string, value: any, ttl?: number): Promise<void>;
  get<T>(namespace: string, key: string): Promise<T | null>;
  delete(namespace: string, key: string): Promise<boolean>;
  list(namespace: string, prefix?: string): Promise<string[]>;
  entries<T>(namespace: string, prefix?: string): Promise<Array<{ key: string; value: T }>>;
  append(namespace: string, entry: any): Promise<void>;
  query(namespace: string, opts?: QueryOptions): Promise<any[]>;
  close(): Promise<void>;
}
```

## Key-Value 연산

### set — 값 저장

```typescript
// 기본 저장 (만료 없음)
await store.set('users', 'user-1', { name: 'Alice', role: 'admin' });

// TTL 지정 (초 단위 — 밀리초가 아닙니다)
await store.set('cache', 'token', 'abc123', 3600);  // 1시간 후 만료
await store.set('sessions', 'sess-1', { userId: 1 }, 1800);  // 30분
```

::: warning
TTL은 **초 단위**입니다. `3600` = 1시간. 밀리초가 아닙니다.
:::

### get — 값 조회

```typescript
const user = await store.get('users', 'user-1');
// { name: 'Alice', role: 'admin' }

const missing = await store.get('users', 'nonexistent');
// null

// TTL 만료된 키도 null 반환 (자동 정리)
```

### delete — 값 삭제

```typescript
const existed = await store.delete('users', 'user-1');
// true (삭제됨) 또는 false (키 없음)
```

### list — 키 목록

```typescript
await store.set('users', 'alice', { name: 'Alice' });
await store.set('users', 'bob', { name: 'Bob' });
await store.set('users', 'admin-charlie', { name: 'Charlie' });

// 전체 키
const allKeys = await store.list('users');
// ['alice', 'bob', 'admin-charlie']

// 프리픽스 필터
const adminKeys = await store.list('users', 'admin-');
// ['admin-charlie']
```

### entries — 키-값 쌍 목록

```typescript
const allUsers = await store.entries('users');
// [
//   { key: 'alice', value: { name: 'Alice' } },
//   { key: 'bob', value: { name: 'Bob' } },
// ]

// TTL 만료된 항목은 자동 제외
const activeUsers = await store.entries('users', 'active-');
```

## Append-Only 로그

감사 로그, 메트릭 기록, 이벤트 스트림용. `append`로 추가하고 `query`로 조회합니다.

### append — 로그 추가

```typescript
await store.append('audit', {
  tool: 'search',
  params: { query: 'hello' },
  userId: 'user-1',
});

await store.append('audit', {
  tool: 'delete',
  params: { id: '42' },
  userId: 'user-2',
});
```

각 항목에 `_ts` (타임스탬프, `Date.now()`) 필드가 자동으로 추가됩니다.

### query — 로그 조회

```typescript
// 최근 50건 (최신순 정렬)
const recent = await store.query('audit', { limit: 50 });

// 기간 필터
const today = await store.query('audit', {
  since: new Date('2025-01-01'),
  until: new Date('2025-01-02'),
});

// 필드 필터
const searchLogs = await store.query('audit', {
  filter: { tool: 'search' },
  limit: 100,
});

// 페이지네이션
const page2 = await store.query('audit', {
  offset: 50,
  limit: 50,
});
```

### QueryOptions

```typescript
interface QueryOptions {
  limit?: number;              // 기본: 100
  offset?: number;             // 기본: 0
  since?: Date;                // 이 시각 이후
  until?: Date;                // 이 시각 이전
  filter?: Record<string, any>;  // 필드 값 일치 필터
}
```

결과는 항상 **최신순**(`_ts` 내림차순)으로 정렬됩니다.

## MemoryStore

인메모리 저장. 빠르지만 서버 재시작 시 소멸. 개발과 테스트에 적합합니다.

```typescript
const store = new MemoryStore();
await store.init();  // no-op (초기화 작업 없음)
```

`close()` 호출 시 모든 데이터와 로그가 즉시 삭제됩니다.

## FileStore

디스크에 JSON 파일로 저장합니다. 외부 DB 없이 데이터를 영속화합니다.

```typescript
const store = new FileStore('.air/data');
await store.init();  // 디렉토리 생성 + 5초 주기 flush 타이머 시작
```

### 저장 구조

```
.air/data/
├── users.json          # namespace별 key-value (JSON)
├── cache.json
├── audit.log.jsonl     # namespace별 append-only 로그 (JSONL)
└── events.log.jsonl
```

### 내부 동작

- **메모리 캐시**: 네임스페이스별로 데이터를 메모리에 캐시. 디스크 읽기는 첫 접근 시 1회만
- **Dirty 트래킹**: 변경된 네임스페이스만 추적하여 불필요한 쓰기 방지
- **5초 주기 flush**: dirty 네임스페이스만 5초마다 디스크에 저장. 쓰기 빈도를 줄여 성능 확보
- **close() 시 즉시 flush**: 서버 종료 시 미저장 데이터를 즉시 디스크에 기록

```typescript
// FileStore의 close() 동작
await store.close();
// 1. flush 타이머 중지
// 2. 모든 dirty 네임스페이스 즉시 디스크에 저장
// 3. 메모리 캐시 클리어
```

### append 파일 형식

`.log.jsonl` 파일은 한 줄에 하나의 JSON 객체:

```jsonl
{"tool":"search","params":{"query":"hello"},"_ts":1710000000000}
{"tool":"delete","params":{"id":"42"},"_ts":1710000001000}
```

## 도구 핸들러에서 스토리지 사용

`server.state`에 스토리지를 저장하고 핸들러에서 접근합니다:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });

const server = defineServer({
  name: 'my-server',
  tools: [
    defineTool('save-note', {
      params: {
        title: 'string',
        content: 'string',
      },
      handler: async ({ title, content }, context) => {
        const store = context.state.store;
        const id = `note-${Date.now()}`;
        await store.set('notes', id, { title, content, createdAt: new Date().toISOString() });
        return { id, message: '저장됨' };
      },
    }),

    defineTool('list-notes', {
      handler: async (_, context) => {
        const store = context.state.store;
        return store.entries('notes');
      },
    }),
  ],
});

server.state.store = store;
server.start();
```
