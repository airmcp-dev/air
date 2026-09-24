// @airmcp-dev/core — transport/auto-detect.ts
// 환경에 따라 적절한 transport를 자동 감지

import type { TransportType, TransportConfig } from '../types/transport.js';

/** transport 타입 자동 감지 */
export function detectTransport(config?: TransportConfig): TransportType {
  if (config?.type && config.type !== 'auto') return config.type;

  // 환경변수로 명시적 지정
  if (process.env.MCP_TRANSPORT === 'stdio') return 'stdio';
  if (process.env.MCP_TRANSPORT === 'http') return 'http';
  if (process.env.MCP_TRANSPORT === 'sse') return 'sse';
  if (process.env.MCP_TRANSPORT === 'workers') return 'workers';

  // Workers 환경 감지 (globalThis에 caches가 있고 process.stdin이 없음)
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis && typeof (globalThis as any).process?.stdin?.isTTY === 'undefined') {
    return 'workers';
  }

  // TTY(터미널)가 아니면 stdio (MCP 클라이언트가 spawn한 경우)
  if (!process.stdin.isTTY) return 'stdio';

  // TTY이면 HTTP (개발자가 직접 실행한 경우)
  return 'http';
}
