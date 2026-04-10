// @airmcp-dev/gateway — registry/health-checker.ts
//
// 등록된 서버들의 헬스체크를 주기적으로 수행한다.
// 응답 없는 서버는 status를 'error'로 전환.

import type { ServerEntry, HealthCheckResult } from '../types.js';
import { ServerRegistry } from './server-registry.js';

export class HealthChecker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private results = new Map<string, HealthCheckResult>();

  constructor(
    private registry: ServerRegistry,
    private checkIntervalMs: number = 30_000,
    private timeoutMs: number = 5_000,
  ) {}

  /**
   * 주기적 헬스체크를 시작한다.
   */
  start(): void {
    if (this.interval) return;

    // 즉시 1회 실행
    this.checkAll();

    this.interval = setInterval(() => {
      this.checkAll();
    }, this.checkIntervalMs);
  }

  /**
   * 헬스체크를 중지한다.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * 모든 connected 서버를 체크한다.
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    const servers = this.registry.listAll();
    const results: HealthCheckResult[] = [];

    for (const server of servers) {
      if (server.status === 'stopped') continue;
      const result = await this.checkOne(server);
      results.push(result);
    }

    return results;
  }

  /**
   * 단일 서버를 체크한다.
   */
  async checkOne(server: ServerEntry): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      if (server.connection.type === 'stdio') {
        // stdio 서버는 프로세스 존재 여부로 판단
        // (실제로는 PID 체크 또는 ping 메시지)
        const result: HealthCheckResult = {
          serverId: server.id,
          healthy: server.status === 'connected',
          latencyMs: Date.now() - start,
          checkedAt: new Date(),
        };
        this.results.set(server.id, result);
        return result;
      }

      // http/sse 서버는 URL로 health 체크
      const url = (server.connection as any).url;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${url}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const healthy = res.ok;
        const result: HealthCheckResult = {
          serverId: server.id,
          healthy,
          latencyMs: Date.now() - start,
          checkedAt: new Date(),
        };

        this.registry.updateStatus(server.id, healthy ? 'connected' : 'error');
        this.results.set(server.id, result);
        return result;
      } catch (err: any) {
        clearTimeout(timeout);
        throw err;
      }
    } catch (err: any) {
      const result: HealthCheckResult = {
        serverId: server.id,
        healthy: false,
        latencyMs: Date.now() - start,
        error: err.message,
        checkedAt: new Date(),
      };
      this.registry.updateStatus(server.id, 'error');
      this.results.set(server.id, result);
      return result;
    }
  }

  /**
   * 마지막 헬스체크 결과를 조회한다.
   */
  getLastResult(serverId: string): HealthCheckResult | undefined {
    return this.results.get(serverId);
  }

  /**
   * 전체 마지막 결과.
   */
  getAllResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }
}
