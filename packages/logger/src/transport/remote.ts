// @airmcp-dev/logger — transport/remote.ts
//
// HTTP로 로그를 외부 서비스에 전송하는 트랜스포트.
// 배치 모드: 일정 개수 또는 시간 간격마다 묶어서 전송.

import type { LogEntry, LogTransport } from '../types.js';

export interface RemoteTransportOptions {
  /** 전송 대상 URL */
  url: string;
  /** HTTP 헤더 (인증 등) */
  headers?: Record<string, string>;
  /** 배치 크기 (기본 50) */
  batchSize?: number;
  /** 플러시 간격 (ms, 기본 5000) */
  flushInterval?: number;
}

export class RemoteTransport implements LogTransport {
  name = 'remote';
  private buffer: string[] = [];
  private url: string;
  private headers: Record<string, string>;
  private batchSize: number;
  private timer: ReturnType<typeof setInterval> | null;

  constructor(opts: RemoteTransportOptions) {
    this.url = opts.url;
    this.headers = {
      'Content-Type': 'application/json',
      ...opts.headers,
    };
    this.batchSize = opts.batchSize ?? 50;

    const interval = opts.flushInterval ?? 5000;
    this.timer = setInterval(() => this.flush(), interval);
  }

  write(formatted: string, _entry: LogEntry): void {
    this.buffer.push(formatted);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const body = JSON.stringify({ logs: batch });

    try {
      await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body,
      });
    } catch {
      // 전송 실패 시 버퍼에 되돌리지 않음 (유실 허용)
      // 프로덕션에서는 재시도 큐 추가 가능
    }
  }
}
