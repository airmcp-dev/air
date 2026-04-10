// @airmcp-dev/logger — types.ts

/** 로그 레벨 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** 로그 엔트리 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  /** 도구/서버 이름 */
  source?: string;
  /** 요청 ID (추적용) */
  requestId?: string;
  /** 추가 데이터 */
  data?: Record<string, any>;
  /** 에러 객체 */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/** 포매터 인터페이스 */
export interface LogFormatter {
  format(entry: LogEntry): string;
}

/** 트랜스포트 인터페이스 */
export interface LogTransport {
  name: string;
  write(formatted: string, entry: LogEntry): void | Promise<void>;
  close?(): void | Promise<void>;
}

/** 로거 설정 */
export interface LoggerConfig {
  /** 최소 출력 레벨 */
  level?: LogLevel;
  /** 포매터 ('json' | 'pretty' | 커스텀) */
  formatter?: 'json' | 'pretty' | LogFormatter;
  /** 트랜스포트 목록 */
  transports?: LogTransport[];
  /** 소스 이름 (도구/서버 식별) */
  source?: string;
}

/** 레벨 우선순위 (숫자가 높을수록 심각) */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};
