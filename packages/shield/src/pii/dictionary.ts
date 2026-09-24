// @airmcp-dev/shield — pii/dictionary.ts
//
// 사전 기반 PII 탐지.
// 고객사명, 담당자명, 서버 호스트명 등 정규식으로 잡을 수 없는
// 비정형 데이터를 사전 등록 → 정확 매칭으로 탐지.

import type { PIIEntity, DictionaryEntry, DictionaryConfig } from './types.js';

/** 내부 검색용 엔트리 (정규화됨) */
interface NormalizedEntry {
  original: DictionaryEntry;
  /** 검색용 정규식 (원본 + 별칭 모두 OR 결합) */
  regex: RegExp;
}

export class PIIDictionary {
  private entries: NormalizedEntry[] = [];

  constructor(config?: DictionaryConfig) {
    if (config?.entries) {
      for (const entry of config.entries) {
        this.add(entry);
      }
    }
  }

  /**
   * 사전에 항목 추가.
   */
  add(entry: DictionaryEntry): void {
    const values = [entry.value, ...(entry.aliases || [])];

    // 긴 값부터 매칭하도록 정렬 (삼성전자 vs 삼성 → 삼성전자 우선)
    values.sort((a, b) => b.length - a.length);

    // 정규식 특수문자 이스케이프
    const escaped = values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const flags = entry.ignoreCase !== false ? 'gi' : 'g';
    const regex = new RegExp(`(?:${escaped.join('|')})`, flags);

    this.entries.push({ original: entry, regex });
  }

  /**
   * 사전에서 항목 제거.
   */
  remove(value: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.original.value !== value);
    return this.entries.length < before;
  }

  /**
   * 등록된 항목 목록 반환.
   */
  list(): DictionaryEntry[] {
    return this.entries.map((e) => e.original);
  }

  /**
   * 사전 전체 초기화.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 텍스트에서 사전 기반 PII 탐지.
   *
   * @returns 탐지된 엔티티 목록 (위치 정보 포함)
   */
  detect(text: string): PIIEntity[] {
    const entities: PIIEntity[] = [];

    for (const entry of this.entries) {
      // 정규식 lastIndex 초기화
      entry.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = entry.regex.exec(text)) !== null) {
        entities.push({
          type: entry.original.type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 1.0, // 사전 매칭은 확실
          source: 'dictionary',
        });
      }
    }

    return entities;
  }

  /**
   * 현재 등록된 항목 수.
   */
  get size(): number {
    return this.entries.length;
  }
}
