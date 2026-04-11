# Storage Reference

## createStorage(options?)

Create a storage adapter and call `init()`.

```typescript
import { createStorage } from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/data' });
const store = await createStorage({ type: 'memory' });
const store = await createStorage();  // Default: memory
```

`type: 'sqlite'` is not yet implemented — falls back to FileStore with a warning.

### StoreOptions

```typescript
interface StoreOptions {
  type: 'memory' | 'file';
  path?: string;              // For file type (default: '.air/data/')
  defaultTtl?: number;        // Seconds (0 = no expiry)
}
```

## StorageAdapter

Interface implemented by all adapters:

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

### Method details

#### set(namespace, key, value, ttl?)

```typescript
await store.set('users', 'u1', { name: 'Alice' });
await store.set('cache', 'token', 'abc', 3600);  // 1 hour TTL (seconds!)
```

::: warning
TTL is in **seconds**. `3600` = 1 hour. Not milliseconds.
:::

#### get(namespace, key)

```typescript
const user = await store.get('users', 'u1');       // { name: 'Alice' }
const missing = await store.get('users', 'xxx');   // null
// Expired keys also return null (auto-deleted)
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
// [{ key: 'u1', value: { name: 'Alice' } }, ...]
```

Expired entries auto-excluded.

#### append(namespace, entry)

```typescript
await store.append('audit', { tool: 'search', userId: 'u1' });
// Auto-adds: { ..., _ts: Date.now() }
```

#### query(namespace, opts?)

```typescript
const logs = await store.query('audit', {
  limit: 50,       // Default: 100
  offset: 0,       // Default: 0
  since: new Date('2025-01-01'),
  until: new Date('2025-02-01'),
  filter: { tool: 'search' },
});
```

Results always sorted by `_ts` **descending** (newest first).

### QueryOptions

```typescript
interface QueryOptions {
  limit?: number;       // Default: 100
  offset?: number;      // Default: 0
  since?: Date;
  until?: Date;
  filter?: Record<string, any>;
}
```

## MemoryStore

In-memory. Lost on restart. `init()` is no-op. `close()` deletes everything immediately.

```typescript
import { MemoryStore } from '@airmcp-dev/core';
const store = new MemoryStore();
await store.init();
```

## FileStore

JSON file-based persistent storage.

```typescript
import { FileStore } from '@airmcp-dev/core';
const store = new FileStore('.air/data');  // Default: cwd + '.air/data'
await store.init();  // Creates directory + starts 5s flush timer
```

### File structure

```
.air/data/
├── users.json          # Key-value per namespace (JSON)
├── audit.log.jsonl     # Append-only log per namespace (JSONL)
```

### Internal behavior

- **Memory cache**: per namespace. Disk reads only on first access
- **Dirty tracking**: only changed namespaces tracked
- **5-second periodic flush**: only dirty namespaces written to disk
- **close()**: immediate flush → stop timer → clear cache
