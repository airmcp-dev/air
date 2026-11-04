// @airmcp-dev/core — types/transport.ts

export type TransportType = 'stdio' | 'http' | 'sse' | 'workers' | 'auto';

export interface TransportConfig {
  /** transport 타입 (기본: auto → 환경에 따라 stdio 또는 http) */
  type?: TransportType;
  /** HTTP/SSE 포트 */
  port?: number;
  /** HTTP/SSE 바인딩 호스트 (기본: 127.0.0.1, 외부 접속을 받으려면 '0.0.0.0') */
  host?: string;
  /**
   * HTTP/SSE transport에서 루프백 출처(localhost, 127.0.0.1, [::1]) 외에 더 허용할 브라우저 Origin.
   * 목록에 없는 Origin 헤더는 403. '*'는 모든 Origin 허용.
   */
  allowedOrigins?: string[];
  /** HTTP 기본 경로 (기본: /) */
  basePath?: string;
}
