// @airmcp-dev/core — storage/memory-store.ts
// 인메모리 StorageAdapter 구현 (개발용 기본값)

import type { StorageAdapter, QueryOptions } from '../types/storage.js';

interface Entry {
  value: any;
  expireAt?: number;
}

export class MemoryStore implements StorageAdapter {
  private data = new Map<string, Entry>();
  private logs = new Map<string, any[]>();

  async init() {
    /* no-op */
  }

  async set(namespace: string, key: string, value: any, ttl?: number) {
    const fullKey = `${namespace}:${key}`;
    const expireAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.data.set(fullKey, { value, expireAt });
  }

  async get<T = any>(namespace: string, key: string): Promise<T | null> {
    const fullKey = `${namespace}:${key}`;
    const entry = this.data.get(fullKey);
    if (!entry) return null;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.data.delete(fullKey);
      return null;
    }
    return entry.value as T;
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    return this.data.delete(`${namespace}:${key}`);
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    const nsPrefix = prefix ? `${namespace}:${prefix}` : `${namespace}:`;
    const keys: string[] = [];
    for (const k of this.data.keys()) {
      if (k.startsWith(nsPrefix)) keys.push(k.slice(namespace.length + 1));
    }
    return keys;
  }

  async entries<T = any>(
    namespace: string,
    prefix?: string,
  ): Promise<Array<{ key: string; value: T }>> {
    const nsPrefix = prefix ? `${namespace}:${prefix}` : `${namespace}:`;
    const result: Array<{ key: string; value: T }> = [];
    for (const [k, entry] of this.data.entries()) {
      if (!k.startsWith(nsPrefix)) continue;
      if (entry.expireAt && Date.now() > entry.expireAt) continue;
      result.push({ key: k.slice(namespace.length + 1), value: entry.value as T });
    }
    return result;
  }

  async append(namespace: string, entry: any) {
    if (!this.logs.has(namespace)) this.logs.set(namespace, []);
    this.logs.get(namespace)!.push({ ...entry, _ts: Date.now() });
  }

  async query(namespace: string, opts?: QueryOptions): Promise<any[]> {
    let entries = this.logs.get(namespace) || [];

    if (opts?.since) entries = entries.filter((e) => e._ts >= opts.since!.getTime());
    if (opts?.until) entries = entries.filter((e) => e._ts <= opts.until!.getTime());
    if (opts?.filter) {
      entries = entries.filter((e) => {
        for (const [k, v] of Object.entries(opts.filter!)) {
          if (e[k] !== v) return false;
        }
        return true;
      });
    }

    entries.sort((a, b) => b._ts - a._ts);

    const offset = opts?.offset || 0;
    const limit = opts?.limit || 100;
    return entries.slice(offset, offset + limit);
  }

  async close() {
    this.data.clear();
    this.logs.clear();
  }
}
