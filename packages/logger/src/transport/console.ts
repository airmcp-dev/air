// @airmcp-dev/logger — transport/console.ts
//
// stdout/stderr 출력 트랜스포트. 기본값.

import type { LogEntry, LogTransport } from '../types.js';

export class ConsoleTransport implements LogTransport {
  name = 'console';

  write(formatted: string, entry: LogEntry): void {
    if (entry.level === 'error' || entry.level === 'fatal') {
      process.stderr.write(formatted + '\n');
    } else {
      process.stdout.write(formatted + '\n');
    }
  }
}
