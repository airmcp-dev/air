// @airmcp-dev/core — types/storage.ts

/** 스토리지 어댑터 인터페이스 (PG 종속 없음) */
export interface StorageAdapter {
  /** 초기화 */
  init(): Promise<void>;
  /** 값 저장 */
  set(namespace: string, key: string, value: any, ttl?: number): Promise<void>;
  /** 값 조회 */
  get<T = any>(namespace: string, key: string): Promise<T | null>;
  /** 값 삭제 */
  delete(namespace: string, key: string): Promise<boolean>;
  /** namespace 내 모든 키 조회 */
  list(namespace: string, prefix?: string): Promise<string[]>;
  /** namespace 내 모든 항목 조회 */
  entries<T = any>(namespace: string, prefix?: string): Promise<Array<{ key: string; value: T }>>;
  /** append-only 로그 추가 (감사/메트릭용) */
  append(namespace: string, entry: any): Promise<void>;
  /** append 로그 조회 (최신순) */
  query(namespace: string, opts?: QueryOptions): Promise<any[]>;
  /** 종료 */
  close(): Promise<void>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
  filter?: Record<string, any>;
}

export interface StoreOptions {
  /** 스토리지 타입 */
  type: 'memory' | 'file' | 'sqlite';
  /** file/sqlite 경로 (기본: .air/data/) */
  path?: string;
  /** TTL 기본값 (초, 0=무제한) */
  defaultTtl?: number;
}
