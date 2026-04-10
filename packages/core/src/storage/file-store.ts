// @airmcp-dev/core — storage/file-store.ts
//
// 파일 기반 StorageAdapter 구현.
// 네임스페이스별로 JSON 파일에 저장한다.
// 외부 의존성 없이 Node.js fs만 사용.
//
// 저장 구조:
//   {basePath}/
//     {namespace}.json      — key-value 데이터
//     {namespace}.log.jsonl — append-only 로그

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageAdapter, QueryOptions } from '../types/storage.js';

interface FileEntry {
  value: any;
  expireAt?: number;
}

export class FileStore implements StorageAdapter {
  private basePath: string;
  private cache = new Map<string, Map<string, FileEntry>>();
  private dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(basePath?: string) {
    this.basePath = basePath || join(process.cwd(), '.air', 'data');
  }

  async init(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });

    // 주기적 flush (5초마다 dirty 네임스페이스만 저장)
    this.flushTimer = setInterval(() => this.flushAll(), 5000);
  }

  async set(namespace: string, key: string, value: any, ttl?: number): Promise<void> {
    const ns = await this.loadNamespace(namespace);
    const expireAt = ttl ? Date.now() + ttl * 1000 : undefined;
    ns.set(key, { value, expireAt });
    this.dirty.add(namespace);
  }

  async get<T = any>(namespace: string, key: string): Promise<T | null> {
    const ns = await this.loadNamespace(namespace);
    const entry = ns.get(key);
    if (!entry) return null;

    if (entry.expireAt && Date.now() > entry.expireAt) {
      ns.delete(key);
      this.dirty.add(namespace);
      return null;
    }

    return entry.value as T;
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    const ns = await this.loadNamespace(namespace);
    const existed = ns.delete(key);
    if (existed) this.dirty.add(namespace);
    return existed;
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    const ns = await this.loadNamespace(namespace);
    this.cleanExpired(ns, namespace);

    const keys: string[] = [];
    for (const k of ns.keys()) {
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }

  async entries<T = any>(namespace: string, prefix?: string): Promise<Array<{ key: string; value: T }>> {
    const ns = await this.loadNamespace(namespace);
    this.cleanExpired(ns, namespace);

    const result: Array<{ key: string; value: T }> = [];
    for (const [k, entry] of ns.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        result.push({ key: k, value: entry.value as T });
      }
    }
    return result;
  }

  async append(namespace: string, entry: any): Promise<void> {
    const logPath = join(this.basePath, `${namespace}.log.jsonl`);
    const line = JSON.stringify({ ...entry, _ts: Date.now() }) + '\n';

    try {
      const existing = await readFile(logPath, 'utf-8').catch(() => '');
      await writeFile(logPath, existing + line, 'utf-8');
    } catch {
      await writeFile(logPath, line, 'utf-8');
    }
  }

  async query(namespace: string, opts?: QueryOptions): Promise<any[]> {
    const logPath = join(this.basePath, `${namespace}.log.jsonl`);
    let content: string;

    try {
      content = await readFile(logPath, 'utf-8');
    } catch {
      return [];
    }

    let entries = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);

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

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushAll();
    this.cache.clear();
  }

  // ── 내부 메서드 ──

  private async loadNamespace(namespace: string): Promise<Map<string, FileEntry>> {
    if (this.cache.has(namespace)) return this.cache.get(namespace)!;

    const filePath = join(this.basePath, `${namespace}.json`);
    const ns = new Map<string, FileEntry>();

    try {
      const raw = await readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, FileEntry>;
      for (const [k, v] of Object.entries(data)) {
        ns.set(k, v);
      }
    } catch {
      // 파일 없으면 빈 맵
    }

    this.cache.set(namespace, ns);
    return ns;
  }

  private async flushNamespace(namespace: string): Promise<void> {
    const ns = this.cache.get(namespace);
    if (!ns) return;

    const filePath = join(this.basePath, `${namespace}.json`);
    const data: Record<string, FileEntry> = {};
    for (const [k, v] of ns.entries()) {
      data[k] = v;
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async flushAll(): Promise<void> {
    for (const ns of this.dirty) {
      await this.flushNamespace(ns);
    }
    this.dirty.clear();
  }

  private cleanExpired(ns: Map<string, FileEntry>, namespace: string): void {
    const now = Date.now();
    for (const [k, entry] of ns.entries()) {
      if (entry.expireAt && now > entry.expireAt) {
        ns.delete(k);
        this.dirty.add(namespace);
      }
    }
  }
}
