// @airmcp-dev/core — plugin/builtin/cors.ts
//
// CORS 헤더 플러그인.
// HTTP/SSE transport 사용 시 브라우저에서 접근 가능하게 CORS를 설정.
// 서버 상태에 CORS 설정을 저장하여 HTTP 핸들러에서 참조.
//
// @example
//   defineServer({
//     use: [corsPlugin({ origins: ['http://localhost:3000'] })],
//   });

import type { AirPlugin } from '../../types/plugin.js';

interface CorsOptions {
  /** 허용 origin (기본: '*') */
  origins?: string[];
  /** 허용 메서드 */
  methods?: string[];
  /** 허용 헤더 */
  headers?: string[];
}

export function corsPlugin(options?: CorsOptions): AirPlugin {
  const origins = options?.origins || ['*'];
  const methods = options?.methods || ['GET', 'POST', 'OPTIONS', 'DELETE'];
  const headers = options?.headers || ['Content-Type', 'Accept', 'Mcp-Session-Id'];

  return {
    meta: { name: 'air:cors', version: '1.0.0' },
    hooks: {
      onInit: async (ctx) => {
        ctx.state._cors = {
          origins,
          methods: methods.join(', '),
          headers: headers.join(', '),
        };
      },
    },
  };
}
