// @airmcp-dev/logger — formatter/pretty.ts
//
// 사람이 읽기 좋은 컬러 포맷. 개발 모드용.
// 예: 14:32:05 INFO  [my-tool] Server started on port 3000

import type { LogEntry, LogFormatter } from '../types.js';

const LEVEL_COLORS: Record<string, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m', // magenta
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

export class PrettyFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const time = entry.timestamp.toTimeString().slice(0, 8);
    const level = entry.level.toUpperCase().padEnd(5);
    const color = LEVEL_COLORS[entry.level] || '';
    const source = entry.source ? `${DIM}[${entry.source}]${RESET} ` : '';

    let line = `${DIM}${time}${RESET} ${color}${level}${RESET} ${source}${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      line += ` ${DIM}${JSON.stringify(entry.data)}${RESET}`;
    }

    if (entry.error) {
      line += `\n  ${color}${entry.error.name}: ${entry.error.message}${RESET}`;
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(1, 4);
        line += `\n${DIM}${stackLines.join('\n')}${RESET}`;
      }
    }

    return line;
  }
}
