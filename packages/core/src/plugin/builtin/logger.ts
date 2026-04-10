// @airmcp-dev/core — plugin/builtin/logger.ts
// 내장 로깅 플러그인 — core만 설치해도 기본 로깅 동작

import type { AirPlugin } from '../../types/plugin.js';
import { loggingMiddleware } from '../../middleware/after-hook.js';

export function builtinLoggerPlugin(level: string = 'info'): AirPlugin {
  const shouldLog = (msgLevel: string) => {
    const levels = ['debug', 'info', 'warn', 'error', 'silent'];
    return levels.indexOf(msgLevel) >= levels.indexOf(level);
  };

  return {
    meta: { name: 'air:builtin-logger', version: '0.1.0', description: 'Built-in logging' },
    middleware: [
      loggingMiddleware((msg) => {
        if (shouldLog('info')) {
          const ts = new Date().toISOString().slice(11, 23);
          console.log(`${ts} ${msg}`);
        }
      }),
    ],
  };
}
