# Storage

air provides built-in storage adapters for persisting data. No external database required — use key-value storage and append-only logs out of the box.

## Quick start

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// In-memory (default, lost on restart)
const memory = new MemoryStore();
await memory.init();

// File-based (persists to disk)
const file = new FileStore('.air/data');
await file.init();

// Factory — pick by config
const store = await createStorage({ type: 'file', path: '.air/data' });
```

## Using with defineServer

```typescript
defineServer({
  storage: { type: 'file', path: '.air/data' },
});
```

## createStorage factory

Creates the appropriate adapter based on `StoreOptions` and calls `init()`:

```typescript
import { createStorage } from '@airmcp-dev/core';

const store = await createStorage({ type: 'memory' });
const store = await createStorage({ type: 'file', path: './data' });
const store = await createStorage({ type: 'sqlite', path: './data' });
// ⚠️ sqlite is not yet implemented — falls back to FileStore + warning
```

### StoreOptions

```typescript
interface StoreOptions {
  type: 'memory' | 'file';     // Currently implemented types
  path?: string;                // Path for file type (default: '.air/data/')
  defaultTtl?: number;          // Default TTL in seconds (0 = no expiry)
}
```

## StorageAdapter API

All adapters implement this interface:

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

## Key-value operations

### set — store a value

```typescript
// Basic storage (no expiry)
await store.set('users', 'user-1', { name: 'Alice', role: 'admin' });

// With TTL (in seconds — NOT milliseconds)
await store.set('cache', 'token', 'abc123', 3600);  // Expires in 1 hour
await store.set('sessions', 'sess-1', { userId: 1 }, 1800);  // 30 minutes
```

::: warning
TTL is in **seconds**. `3600` = 1 hour. Not milliseconds.
:::

### get — retrieve a value

```typescript
const user = await store.get('users', 'user-1');
// { name: 'Alice', role: 'admin' }

const missing = await store.get('users', 'nonexistent');
// null

// Expired keys also return null (auto-cleaned)
```

### delete — remove a value

```typescript
const existed = await store.delete('users', 'user-1');
// true (deleted) or false (key not found)
```

### list — get keys

```typescript
await store.set('users', 'alice', { name: 'Alice' });
await store.set('users', 'bob', { name: 'Bob' });
await store.set('users', 'admin-charlie', { name: 'Charlie' });

// All keys
const allKeys = await store.list('users');
// ['alice', 'bob', 'admin-charlie']

// Filter by prefix
const adminKeys = await store.list('users', 'admin-');
// ['admin-charlie']
```

### entries — get key-value pairs

```typescript
const allUsers = await store.entries('users');
// [
//   { key: 'alice', value: { name: 'Alice' } },
//   { key: 'bob', value: { name: 'Bob' } },
// ]

// Expired entries are automatically excluded
const activeUsers = await store.entries('users', 'active-');
```

## Append-only log

For audit logs, metrics recording, event streams. Use `append` to add, `query` to read.

### append — add log entry

```typescript
await store.append('audit', {
  tool: 'search',
  params: { query: 'hello' },
  userId: 'user-1',
});
```

Each entry gets an automatic `_ts` field (timestamp, `Date.now()`).

### query — read log entries

```typescript
// Latest 50 entries (sorted newest first)
const recent = await store.query('audit', { limit: 50 });

// Date range filter
const today = await store.query('audit', {
  since: new Date('2025-01-01'),
  until: new Date('2025-01-02'),
});

// Field filter
const searchLogs = await store.query('audit', {
  filter: { tool: 'search' },
  limit: 100,
});

// Pagination
const page2 = await store.query('audit', { offset: 50, limit: 50 });
```

### QueryOptions

```typescript
interface QueryOptions {
  limit?: number;              // Default: 100
  offset?: number;             // Default: 0
  since?: Date;                // After this time
  until?: Date;                // Before this time
  filter?: Record<string, any>;  // Field value match
}
```

Results are always sorted **newest first** (`_ts` descending).

## MemoryStore

In-memory storage. Fast but lost on restart. Good for development and testing.

```typescript
const store = new MemoryStore();
await store.init();  // no-op
```

`close()` immediately deletes all data and logs.

## FileStore

Persists to disk as JSON files. No external database needed.

```typescript
const store = new FileStore('.air/data');
await store.init();  // Creates directory + starts 5-second flush timer
```

### File structure

```
.air/data/
├── users.json          # Key-value data per namespace (JSON)
├── cache.json
├── audit.log.jsonl     # Append-only log per namespace (JSONL)
└── events.log.jsonl
```

### Internal behavior

- **Memory cache**: Data is cached in memory per namespace. Disk reads happen only on first access
- **Dirty tracking**: Only changed namespaces are tracked, preventing unnecessary writes
- **5-second periodic flush**: Only dirty namespaces are written to disk every 5 seconds
- **Immediate flush on close()**: Unsaved data is written to disk when the server shuts down

```typescript
// FileStore close() behavior
await store.close();
// 1. Stop flush timer
// 2. Flush all dirty namespaces to disk immediately
// 3. Clear memory cache
```

### Append file format

`.log.jsonl` files contain one JSON object per line:

```jsonl
{"tool":"search","params":{"query":"hello"},"_ts":1710000000000}
{"tool":"delete","params":{"id":"42"},"_ts":1710000001000}
```

## Using storage in tool handlers

Store the adapter in `server.state` and access from handlers:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });

const server = defineServer({
  name: 'my-server',
  tools: [
    defineTool('save-note', {
      params: { title: 'string', content: 'string' },
      handler: async ({ title, content }, context) => {
        const store = context.state.store;
        const id = `note-${Date.now()}`;
        await store.set('notes', id, { title, content, createdAt: new Date().toISOString() });
        return { id, message: 'Saved' };
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
