// @airmcp-dev/core — plugin/builtin/auth.ts
//
// 간단한 인증 플러그인.
// API 키 또는 Bearer 토큰으로 도구 접근을 제한.
// 프로덕션에서는 OAuth 2.1을 사용하되, 개발/내부용으로 이 플러그인 사용.
//
// @example
//   defineServer({
//     use: [authPlugin({
//       type: 'api-key',
//       keys: ['sk-abc123', 'sk-def456'],
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface AuthOptions {
  /** 인증 방식 */
  type: 'api-key' | 'bearer';
  /** 허용할 키/토큰 목록 */
  keys?: string[];
  /** 커스텀 검증 함수 */
  verify?: (token: string) => Promise<boolean> | boolean;
  /** 인증 없이 허용할 도구 (기본: []) */
  publicTools?: string[];
  /** 인증 헤더/파라미터 이름 (기본: _auth) */
  paramName?: string;
}

export function authPlugin(options: AuthOptions): AirPlugin {
  const publicTools = new Set(options.publicTools || []);
  const validKeys = new Set(options.keys || []);
  const paramName = options.paramName || '_auth';

  async function isValid(token: string): Promise<boolean> {
    if (options.verify) return options.verify(token);
    return validKeys.has(token);
  }

  const middleware: AirMiddleware = {
    name: 'air:auth',
    before: async (ctx) => {
      // 공개 도구는 인증 스킵
      if (publicTools.has(ctx.tool.name)) return;

      const token = ctx.params[paramName] as string;
      if (!token) {
        return {
          abort: true,
          abortResponse: {
            content: [{ type: 'text', text: `[Auth] Authentication required for "${ctx.tool.name}". Pass "${paramName}" parameter.` }],
            isError: true,
          },
        };
      }

      const valid = await isValid(token);
      if (!valid) {
        return {
          abort: true,
          abortResponse: {
            content: [{ type: 'text', text: `[Auth] Invalid credentials for "${ctx.tool.name}".` }],
            isError: true,
          },
        };
      }

      // 인증 성공 — _auth 파라미터를 제거하여 핸들러에 전달하지 않음
      const { [paramName]: _, ...cleanParams } = ctx.params;
      return { params: cleanParams, meta: { authenticated: true } };
    },
  };

  return {
    meta: { name: 'air:auth', version: '1.0.0' },
    middleware: [middleware],
  };
}
