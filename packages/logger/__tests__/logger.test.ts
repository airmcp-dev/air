// @airmcp-dev/logger — __tests__/logger.test.ts

import { describe, it, expect, vi } from 'vitest';
import { AirLogger } from '../src/logger.js';
import { JsonFormatter } from '../src/formatter/json.js';
import type { LogTransport, LogEntry } from '../src/types.js';

/** 테스트용 트랜스포트 — 출력을 캡처 */
function createCapture(): { transport: LogTransport; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    transport: {
      name: 'capture',
      write(formatted: string) {
        lines.push(formatted);
      },
    },
  };
}

describe('AirLogger', () => {
  it('should log info messages', () => {
    const capture = createCapture();
    const logger = new AirLogger({
      level: 'info',
      formatter: 'json',
      transports: [capture.transport],
    });

    logger.info('Hello world');
    expect(capture.lines.length).toBe(1);

    const parsed = JSON.parse(capture.lines[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('Hello world');
  });

  it('should filter by level', () => {
    const capture = createCapture();
    const logger = new AirLogger({
      level: 'warn',
      formatter: 'json',
      transports: [capture.transport],
    });

    logger.debug('should not appear');
    logger.info('should not appear');
    logger.warn('should appear');

    expect(capture.lines.length).toBe(1);
  });

  it('should include data in log entry', () => {
    const capture = createCapture();
    const logger = new AirLogger({
      level: 'info',
      formatter: 'json',
      transports: [capture.transport],
    });

    logger.info('User logged in', { userId: 42 });

    const parsed = JSON.parse(capture.lines[0]);
    expect(parsed.data.userId).toBe(42);
  });

  it('should include error info', () => {
    const capture = createCapture();
    const logger = new AirLogger({
      level: 'error',
      formatter: 'json',
      transports: [capture.transport],
    });

    logger.error('Failed', {}, new Error('connection refused'));

    const parsed = JSON.parse(capture.lines[0]);
    expect(parsed.err.name).toBe('Error');
    expect(parsed.err.message).toBe('connection refused');
  });

  it('should create child logger with source', () => {
    const capture = createCapture();
    const parent = new AirLogger({
      level: 'info',
      formatter: 'json',
      transports: [capture.transport],
    });

    const child = parent.child('my-tool');
    child.info('Tool started');

    const parsed = JSON.parse(capture.lines[0]);
    expect(parsed.source).toBe('my-tool');
  });
});

describe('JsonFormatter', () => {
  it('should produce valid JSON', () => {
    const formatter = new JsonFormatter();
    const entry: LogEntry = {
      level: 'info',
      message: 'test',
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test');
    expect(parsed.ts).toBe('2026-01-01T00:00:00.000Z');
  });
});
