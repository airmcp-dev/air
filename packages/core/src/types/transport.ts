// @airmcp-dev/core — types/transport.ts

export type TransportType = 'stdio' | 'http' | 'sse' | 'auto';

export interface TransportConfig {
  /** transport 타입 (기본: auto → 환경에 따라 stdio 또는 http) */
  type?: TransportType;
  /** HTTP/SSE 포트 */
  port?: number;
  /** HTTP/SSE 호스트 (기본: localhost) */
  host?: string;
  /** HTTP 기본 경로 (기본: /) */
  basePath?: string;
}
