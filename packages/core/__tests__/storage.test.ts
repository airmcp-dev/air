// @airmcp-dev/core — __tests__/storage.test.ts

import { describe, it, expect } from 'vitest';
import { MemoryStore } from '../src/storage/memory-store.js';

const NS = 'test';

describe('MemoryStore', () => {
  it('should set and get a value', async () => {
    const store = new MemoryStore();
    await store.set(NS, 'key1', { name: 'test' });
    const result = await store.get(NS, 'key1');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return null for missing key', async () => {
    const store = new MemoryStore();
    const result = await store.get(NS, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should delete a key', async () => {
    const store = new MemoryStore();
    await store.set(NS, 'key1', 'value');
    await store.delete(NS, 'key1');
    const result = await store.get(NS, 'key1');
    expect(result).toBeNull();
  });

  it('should list keys with prefix', async () => {
    const store = new MemoryStore();
    await store.set(NS, 'user_1', { id: 1 });
    await store.set(NS, 'user_2', { id: 2 });
    await store.set(NS, 'post_1', { id: 1 });

    const keys = await store.list(NS, 'user_');
    expect(keys.length).toBe(2);
  });

  it('should overwrite existing key', async () => {
    const store = new MemoryStore();
    await store.set(NS, 'key1', 'old');
    await store.set(NS, 'key1', 'new');
    const result = await store.get(NS, 'key1');
    expect(result).toBe('new');
  });

  it('should expire entries with TTL', async () => {
    const store = new MemoryStore();
    await store.set(NS, 'temp', 'value', 0.001); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    const result = await store.get(NS, 'temp');
    expect(result).toBeNull();
  });

  it('should isolate namespaces', async () => {
    const store = new MemoryStore();
    await store.set('ns1', 'key', 'value1');
    await store.set('ns2', 'key', 'value2');
    expect(await store.get('ns1', 'key')).toBe('value1');
    expect(await store.get('ns2', 'key')).toBe('value2');
  });
});
