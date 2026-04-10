// @airmcp-dev/core — plugin/builtin/dryrun.ts
//
// 드라이런 플러그인.
// 실제 핸들러를 실행하지 않고 파라미터 검증 + 예상 결과만 반환.
// 테스트, CI, 스키마 검증에 사용.
//
// 사용 방법:
//   1. 전역 모드: dryrunPlugin({ enabled: true }) — 모든 호출을 드라이런
//   2. 환경변수: dryrunPlugin({ enabled: process.env.DRY_RUN === 'true' })
//   3. callTool API: server.callTool('name', { _dryrun: true }) — MCP 프로토콜 우회 시
//
// NOTE: MCP SDK가 스키마에 없는 파라미터를 제거하기 때문에
// perCall 모드는 MCP 프로토콜 경유(클라이언트→서버) 시 동작하지 않음.
// server.callTool() 직접 호출 시에만 perCall이 동작.
//
// @example
//   defineServer({
//     use: [dryrunPlugin({ enabled: process.env.DRY_RUN === 'true' })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface DryrunOptions {
  /** 드라이런 활성화 (기본: false) */
  enabled?: boolean;
  /** 파라미터에 _dryrun=true 가 있으면 해당 호출만 드라이런 */
  perCall?: boolean;
  /** 커스텀 드라이런 응답 생성기 */
  mockResponse?: (toolName: string, params: Record<string, any>) => any;
}

export function dryrunPlugin(options?: DryrunOptions): AirPlugin {
  const globalEnabled = options?.enabled ?? false;
  const perCall = options?.perCall ?? true;
  const mockFn = options?.mockResponse;

  const middleware: AirMiddleware = {
    name: 'air:dryrun',
    before: async (ctx) => {
      const isDryrun = globalEnabled || (perCall && (ctx.params._dryrun === true || ctx.params._dryrun === 'true'));
      if (!isDryrun) return;

      // _dryrun 파라미터 제거
      const { _dryrun, ...cleanParams } = ctx.params;

      const response = mockFn
        ? mockFn(ctx.tool.name, cleanParams)
        : {
            dryrun: true,
            tool: ctx.tool.name,
            params: cleanParams,
            description: ctx.tool.description,
            schema: ctx.tool.params
              ? Object.entries(ctx.tool.params).map(([k, v]) => ({
                  name: k,
                  type: typeof v === 'string' ? v : (v as any).type || 'any',
                  provided: k in cleanParams,
                  value: cleanParams[k] ?? null,
                }))
              : [],
            message: `[Dryrun] "${ctx.tool.name}" would be called with: ${JSON.stringify(cleanParams)}`,
          };

      return {
        abort: true,
        abortResponse: typeof response === 'string' ? response : JSON.stringify(response, null, 2),
      };
    },
  };

  return {
    meta: { name: 'air:dryrun', version: '1.0.0' },
    middleware: [middleware],
  };
}
