// @airmcp-dev/core — storage/storage-adapter.ts
// StorageAdapter 팩토리

import type { StorageAdapter, StoreOptions } from '../types/storage.js';
import { MemoryStore } from './memory-store.js';
import { FileStore } from './file-store.js';

/** StoreOptions에 따라 적절한 StorageAdapter를 생성 */
export async function createStorage(options?: StoreOptions): Promise<StorageAdapter> {
  const type = options?.type || 'memory';

  switch (type) {
    case 'memory': {
      const store = new MemoryStore();
      await store.init();
      return store;
    }

    case 'file': {
      const store = new FileStore(options?.path);
      await store.init();
      return store;
    }

    case 'sqlite': {
      // SQLite는 별도 패키지(@airmcp-dev/storage-sqlite)로 제공 예정
      // 지금은 FileStore로 fallback
      console.warn('[air] SQLite storage not yet available — using FileStore');
      const store = new FileStore(options?.path);
      await store.init();
      return store;
    }

    default:
      throw new Error(`Unknown storage type: ${type}. Available: memory, file, sqlite`);
  }
}
