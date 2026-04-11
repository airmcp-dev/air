// @airmcp-dev/core — middleware/chain.ts
// 미들웨어 체인 실행기 — before → handler → after, 에러 시 onError

import type { AirMiddleware, MiddlewareContext } from '../types/middleware.js';
import type { AirToolDef, AirToolContext } from '../types/tool.js';
import { normalizeResult } from '../tool/tool-result.js';

export class MiddlewareChain {
  private middlewares: AirMiddleware[] = [];

  add(mw: AirMiddleware) {
    this.middlewares.push(mw);
  }

  addAll(mws: AirMiddleware[]) {
    this.middlewares.push(...mws);
  }

  /** 미들웨어 체인을 실행하고 도구 핸들러를 호출 */
  async execute(tool: AirToolDef, params: Record<string, any>, toolCtx: AirToolContext) {
    const ctx: MiddlewareContext = {
      tool,
      params: { ...params },
      requestId: toolCtx.requestId,
      serverName: toolCtx.serverName,
      startedAt: toolCtx.startedAt,
      meta: {
        _serverState: toolCtx.state,
      },
    };

    // ── before 미들웨어 ──
    for (const mw of this.middlewares) {
      if (!mw.before) continue;
      try {
        const result = await mw.before(ctx);
        if (result?.abort) {
          const abortResult = result.abortResponse
            ? normalizeResult(result.abortResponse)
            : normalizeResult('Request aborted by middleware');

          // abort 시에도 after 미들웨어를 실행 (로깅/메트릭 수집 보장)
          const duration = Date.now() - ctx.startedAt;
          const afterCtx = { ...ctx, result: abortResult, duration };
          for (const afterMw of this.middlewares) {
            if (!afterMw.after) continue;
            try { await afterMw.after(afterCtx); } catch { /* after 에러 무시 */ }
          }

          return abortResult;
        }
        if (result?.params) ctx.params = result.params;
        if (result?.meta) Object.assign(ctx.meta, result.meta);
      } catch (err) {
        return this.handleError(ctx, err as Error);
      }
    }

    // ── 핸들러 실행 ──
    let handlerResult: any;
    try {
      handlerResult = await tool.handler(ctx.params, toolCtx);
    } catch (err) {
      return this.handleError(ctx, err as Error);
    }

    // ── after 미들웨어 ──
    const duration = Date.now() - ctx.startedAt;
    const afterCtx = { ...ctx, result: handlerResult, duration };
    for (const mw of this.middlewares) {
      if (!mw.after) continue;
      try {
        await mw.after(afterCtx);
      } catch {
        // after 미들웨어 에러는 무시 (결과는 이미 나왔으므로)
      }
    }

    return normalizeResult(afterCtx.result);
  }

  private async handleError(ctx: MiddlewareContext, error: Error) {
    // onError 미들웨어가 있으면 위임
    for (const mw of this.middlewares) {
      if (!mw.onError) continue;
      try {
        const recovery = await mw.onError(ctx, error);
        if (recovery !== undefined) return normalizeResult(recovery);
      } catch {
        // onError도 실패하면 다음으로
      }
    }
    // 아무도 처리 못하면 에러 메시지 반환
    return normalizeResult({ text: `Error: ${error.message}` });
  }
}
