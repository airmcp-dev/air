// @airmcp-dev/gateway — router/request-router.ts
//
// 도구 호출 요청을 적절한 서버로 라우팅한다.
// ToolIndex에서 후보를 찾고, LoadBalancer로 하나를 선택.

import type { RouteRequest, RouteResult, ServerEntry, ToolEntry } from '../types.js';
import { ServerRegistry } from '../registry/server-registry.js';
import { ToolIndex } from '../registry/tool-index.js';
import { LoadBalancer } from './load-balancer.js';

export class RequestRouter {
  constructor(
    private registry: ServerRegistry,
    private toolIndex: ToolIndex,
    private balancer: LoadBalancer,
  ) {}

  /**
   * 도구 호출 요청을 라우팅한다.
   *
   * @throws 도구를 찾을 수 없거나 사용 가능한 서버가 없으면 에러
   */
  route(request: RouteRequest): RouteResult {
    // ── 1. 도구 후보 찾기 ──
    const candidates = this.toolIndex.find(request.toolName);
    if (candidates.length === 0) {
      throw new Error(`Tool "${request.toolName}" not found in any registered server.`);
    }

    // ── 2. 연결된 서버만 필터링 ──
    const available = candidates.filter((t) => {
      const server = this.registry.get(t.serverId);
      return server && server.status === 'connected';
    });

    if (available.length === 0) {
      throw new Error(`Tool "${request.toolName}" exists but no healthy server is available.`);
    }

    // ── 3. 로드밸런싱으로 하나 선택 ──
    const selected = this.balancer.select(available);
    const server = this.registry.get(selected.serverId)!;

    return { server, tool: selected };
  }

  /**
   * 도구가 라우팅 가능한지 확인 (dry-run).
   */
  canRoute(toolName: string): boolean {
    const candidates = this.toolIndex.find(toolName);
    return candidates.some((t) => {
      const server = this.registry.get(t.serverId);
      return server && server.status === 'connected';
    });
  }
}
