// @airmcp-dev/logger — transport/file.ts
//
// 파일 로테이션 트랜스포트.
// 지정 크기 초과 시 자동 로테이션 (.1, .2, ...).

import { createWriteStream, statSync, renameSync, type WriteStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogEntry, LogTransport } from '../types.js';

export interface FileTransportOptions {
  /** 로그 파일 경로 */
  path: string;
  /** 최대 파일 크기 (bytes, 기본 10MB) */
  maxSize?: number;
  /** 보관할 로테이션 파일 수 (기본 5) */
  maxFiles?: number;
}

export class FileTransport implements LogTransport {
  name = 'file';
  private stream: WriteStream;
  private currentSize = 0;
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;

  constructor(opts: FileTransportOptions) {
    this.filePath = opts.path;
    this.maxSize = opts.maxSize ?? 10 * 1024 * 1024;
    this.maxFiles = opts.maxFiles ?? 5;

    // 디렉토리 생성
    mkdirSync(dirname(this.filePath), { recursive: true });

    // 기존 파일 크기 확인
    try {
      this.currentSize = statSync(this.filePath).size;
    } catch {
      this.currentSize = 0;
    }

    this.stream = createWriteStream(this.filePath, { flags: 'a' });
  }

  write(formatted: string, _entry: LogEntry): void {
    const line = formatted + '\n';
    this.stream.write(line);
    this.currentSize += Buffer.byteLength(line);

    if (this.currentSize >= this.maxSize) {
      this.rotate();
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(resolve);
    });
  }

  private rotate(): void {
    this.stream.end();

    // .5 → 삭제, .4 → .5, ... .1 → .2, 현재 → .1
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = i === 1 ? this.filePath : `${this.filePath}.${i}`;
      const to = `${this.filePath}.${i + 1}`;
      try {
        renameSync(from, to);
      } catch {
        /* 없으면 무시 */
      }
    }

    try {
      renameSync(this.filePath, `${this.filePath}.1`);
    } catch {
      /* ignore */
    }

    this.stream = createWriteStream(this.filePath, { flags: 'a' });
    this.currentSize = 0;
  }
}
