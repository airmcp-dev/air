# 스토리지 레퍼런스

## createStorage(options?)

설정에 따라 스토리지 어댑터 생성 + `init()` 호출.

```typescript
import { createStorage } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/data' });
const store = await createStorage({ type: 'memory' });
const store = await createStorage();  // 기본: memory
```

`type: 'sqlite'`은 현재 미구현 — FileStore로 fallback + 경고 출력.

### StoreOptions

```typescript
interface StoreOptions {
  type: 'memory' | 'file';
  path?: string;              // file 타입 경로 (기본: '.air/data/')
  defaultTtl?: number;        // 초 단위 (0 = 무제한)
}
```

## StorageAdapter

모든 어댑터가 구현하는 인터페이스:

```typescript
interface StorageAdapter {
  init(): Promise<void>;

  // Key-Value
  set(namespace: string, key: string, value: any, ttl?: number): Promise<void>;
  get<T>(namespace: string, key: string): Promise<T | null>;
  delete(namespace: string, key: string): Promise<boolean>;
  list(namespace: string, prefix?: string): Promise<string[]>;
  entries<T>(namespace: string, prefix?: string): Promise<Array<{ key: string; value: T }>>;

  // Append-Only Log
  append(namespace: string, entry: any): Promise<void>;
  query(namespace: string, opts?: QueryOptions): Promise<any[]>;

  close(): Promise<void>;
}
```

### 메서드 상세

#### set(namespace, key, value, ttl?)

```typescript
await store.set('users', 'u1', { name: 'Alice' });
await store.set('cache', 'token', 'abc', 3600);  // 1시간 TTL (초 단위!)
```

::: warning
TTL은 **초 단위**입니다. `3600` = 1시간. 밀리초가 아닙니다.
:::

#### get(namespace, key)

```typescript
const user = await store.get('users', 'u1');       // { name: 'Alice' }
const missing = await store.get('users', 'xxx');   // null
// TTL 만료된 키도 null (자동 삭제)
```

#### delete(namespace, key)

```typescript
const existed = await store.delete('users', 'u1');  // true or false
```

#### list(namespace, prefix?)

```typescript
const allKeys = await store.list('users');           // ['u1', 'u2', 'admin-1']
const admins = await store.list('users', 'admin-');  // ['admin-1']
```

#### entries(namespace, prefix?)

```typescript
const all = await store.entries('users');
// [{ key: 'u1', value: { name: 'Alice' } }, { key: 'u2', value: { name: 'Bob' } }]
```

TTL 만료 항목 자동 제외.

#### append(namespace, entry)

```typescript
await store.append('audit', { tool: 'search', userId: 'u1' });
// 자동 추가: { ..., _ts: Date.now() }
```

#### query(namespace, opts?)

```typescript
const logs = await store.query('audit', {
  limit: 50,                    // 기본: 100
  offset: 0,                    // 기본: 0
  since: new Date('2025-01-01'),
  until: new Date('2025-02-01'),
  filter: { tool: 'search' },   // 필드 값 일치
});
```

결과는 항상 `_ts` **내림차순** (최신순).

### QueryOptions

```typescript
interface QueryOptions {
  limit?: number;               // 기본: 100
  offset?: number;              // 기본: 0
  since?: Date;
  until?: Date;
  filter?: Record<string, any>;
}
```

## MemoryStore

인메모리. 재시작 시 소멸. `init()`은 no-op. `close()`는 즉시 전체 삭제.

```typescript
import { MemoryStore } from '@airmcp-dev/core';

const store = new MemoryStore();
await store.init();
```

## FileStore

JSON 파일 기반 영속 스토리지.

```typescript
import { FileStore } from '@airmcp-dev/core';

const store = new FileStore('.air/data');  // 기본: process.cwd() + '.air/data'
await store.init();  // 디렉토리 생성 + 5초 주기 flush 타이머 시작
```

### 파일 구조

```
.air/data/
├── users.json          # namespace별 key-value (JSON)
├── audit.log.jsonl     # namespace별 append-only 로그 (JSONL)
```

### 내부 동작

- **메모리 캐시**: 네임스페이스별. 디스크 읽기는 첫 접근 시 1회
- **Dirty 트래킹**: 변경된 네임스페이스만 추적
- **5초 주기 flush**: dirty만 디스크 저장
- **close()**: 즉시 flush → 타이머 중지 → 캐시 클리어

### JSONL 포맷

```jsonl
{"tool":"search","userId":"u1","_ts":1710000000000}
{"tool":"delete","userId":"u2","_ts":1710000001000}
```
