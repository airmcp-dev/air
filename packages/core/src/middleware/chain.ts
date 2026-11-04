// @airmcp-dev/core — middleware/chain.ts
// 미들웨어 체인 실행기 — before → handler → after, 에러 시 onError

import type { AirMiddleware, MiddlewareContext } from '../types/middleware.js';
import type { AirToolDef, AirToolContext } from '../types/tool.js';
import { normalizeResult, normalizeToolResult, type McpToolResult } from '../tool/tool-result.js';

export class MiddlewareChain {
  private middlewares: AirMiddleware[] = [];

  add(mw: AirMiddleware) {
    this.middlewares.push(mw);
  }

  addAll(mws: AirMiddleware[]) {
    this.middlewares.push(...mws);
  }

  /** 미들웨어 체인을 실행하고 도구 핸들러를 호출 (content 배열 반환) */
  async execute(tool: AirToolDef, params: Record<string, any>, toolCtx: AirToolContext) {
    return (await this.executeTool(tool, params, toolCtx)).content;
  }

  /**
   * 미들웨어 체인을 실행하고 tools/call 결과({ content, isError })를 반환.
   * 검증 실패, 핸들러 예외, { isError: true } 응답은 isError: true로 남는다.
   */
  async executeTool(
    tool: AirToolDef,
    params: Record<string, any>,
    toolCtx: AirToolContext,
  ): Promise<McpToolResult> {
    const ctx: MiddlewareContext = {
      tool,
      params: { ...params },
      requestId: toolCtx.requestId,
      serverName: toolCtx.serverName,
      startedAt: toolCtx.startedAt,
      meta: {
        _serverState: toolCtx.state,
        // 핸들러를 다시 부르는 플러그인(retry 등)이 같은 컨텍스트(elicit/progress/log/signal)를 쓰도록
        _toolCtx: toolCtx,
      },
    };

    // ── before 미들웨어 ──
    for (const mw of this.middlewares) {
      if (!mw.before) continue;
      try {
        const result = await mw.before(ctx);
        if (result?.abort) {
          const abortResult: McpToolResult = result.abortResponse
            ? normalizeToolResult(result.abortResponse)
            : { content: normalizeResult('Request aborted by middleware'), isError: true };

          // abort 시에도 after 미들웨어를 실행 (로깅/메트릭 수집 보장)
          const duration = Date.now() - ctx.startedAt;
          const afterCtx = { ...ctx, result: abortResult.content, duration };
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

    return normalizeToolResult(afterCtx.result);
  }

  private async handleError(ctx: MiddlewareContext, error: Error): Promise<McpToolResult> {
    // onError 미들웨어가 있으면 위임
    for (const mw of this.middlewares) {
      if (!mw.onError) continue;
      try {
        const recovery = await mw.onError(ctx, error);
        if (recovery !== undefined) return normalizeToolResult(recovery);
      } catch {
        // onError도 실패하면 다음으로
      }
    }
    // 아무도 처리 못하면 에러 메시지 반환
    return { content: normalizeResult({ text: `Error: ${error.message}` }), isError: true };
  }
}
