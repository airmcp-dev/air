// @airmcp-dev/logger — formatter/json.ts
//
// 구조화 JSON 포맷. 파일 저장, 원격 전송, 파이프라인 처리용.
// 한 줄 한 엔트리 (NDJSON).

import type { LogEntry, LogFormatter } from '../types.js';

export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const obj: Record<string, any> = {
      level: entry.level,
      msg: entry.message,
      ts: entry.timestamp.toISOString(),
    };

    if (entry.source) obj.source = entry.source;
    if (entry.requestId) obj.reqId = entry.requestId;
    if (entry.data) obj.data = entry.data;
    if (entry.error) {
      obj.err = {
        name: entry.error.name,
        message: entry.error.message,
        ...(entry.error.stack ? { stack: entry.error.stack } : {}),
      };
    }

    return JSON.stringify(obj);
  }
}
