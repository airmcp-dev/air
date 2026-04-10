// @airmcp-dev/logger — logger.ts
//
// AirLogger — 구조화 로깅 메인 클래스.
// formatter + transport 조합으로 출력.
//
// @example
//   const logger = new AirLogger({ level: 'info', formatter: 'pretty' });
//   logger.info('Server started', { port: 3000 });
//   logger.error('Connection failed', { host: 'db' }, err);

import type { LogLevel, LogEntry, LogFormatter, LogTransport, LoggerConfig } from './types.js';
import { LOG_LEVEL_PRIORITY } from './types.js';
import { JsonFormatter } from './formatter/json.js';
import { PrettyFormatter } from './formatter/pretty.js';
import { ConsoleTransport } from './transport/console.js';

export class AirLogger {
  private level: LogLevel;
  private formatter: LogFormatter;
  private transports: LogTransport[];
  private source?: string;

  constructor(config?: LoggerConfig) {
    this.level = config?.level ?? 'info';
    this.source = config?.source;

    // 포매터 결정
    if (!config?.formatter || config.formatter === 'json') {
      this.formatter = new JsonFormatter();
    } else if (config.formatter === 'pretty') {
      this.formatter = new PrettyFormatter();
    } else {
      this.formatter = config.formatter;
    }

    // 트랜스포트 (기본: console)
    this.transports = config?.transports ?? [new ConsoleTransport()];
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, any>, err?: Error): void {
    this.log('error', message, data, err);
  }

  fatal(message: string, data?: Record<string, any>, err?: Error): void {
    this.log('fatal', message, data, err);
  }

  /**
   * 자식 로거를 생성한다. source를 오버라이드.
   */
  child(source: string): AirLogger {
    const child = new AirLogger({
      level: this.level,
      source,
      transports: this.transports,
    });
    // 포매터 공유
    (child as any).formatter = this.formatter;
    return child;
  }

  /**
   * 트랜스포트를 추가한다.
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * 모든 트랜스포트를 정리한다.
   */
  async close(): Promise<void> {
    for (const t of this.transports) {
      if (t.close) await t.close();
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, err?: Error): void {
    // 레벨 필터링
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      source: this.source,
      data,
    };

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    const formatted = this.formatter.format(entry);

    for (const transport of this.transports) {
      transport.write(formatted, entry);
    }
  }
}
