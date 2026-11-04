// @airmcp-dev/core — server/gateway-registration.ts
//
// 게이트웨이 자기 등록 클라이언트.
// 서버가 뜨면 게이트웨이(들)의 POST /registry에 등록하고, heartbeatMs마다 같은 요청을 다시 보낸다(하트비트).
// 게이트웨이가 내려가 있어도 서버 기동을 막지 않는다 — 조용히 재시도하고, 상태 변화만 로그한다.
// stop()에서 DELETE /registry/:id로 등록을 지운다.

import { hostname } from 'node:os';
import type { GatewayRegistrationConfig } from '../types/config.js';

export interface GatewayRegistrationTarget {
  /** 이 서버의 Streamable HTTP 엔드포인트 (게이트웨이가 호출할 주소) */
  advertiseUrl: string;
  name: string;
}

export class GatewayRegistration {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly urls: string[];
  private readonly id: string;
  private readonly heartbeatMs: number;
  /** 게이트웨이별 마지막 상태 — 변화 시에만 로그 */
  private state = new Map<string, 'registered' | 'unreachable'>();

  constructor(private readonly config: GatewayRegistrationConfig, private readonly target: GatewayRegistrationTarget) {
    this.urls = (Array.isArray(config.url) ? config.url : [config.url]).map((u) => u.replace(/\/+$/, ''));
    this.id = config.id ?? target.name;
    this.heartbeatMs = config.heartbeatMs ?? 5_000;
  }

  /** advertiseUrl 계산: 설정값 > http://<host>:<port>/mcp (0.0.0.0이면 hostname) */
  static advertiseUrl(config: GatewayRegistrationConfig, host: string, port: number): string {
    if (config.advertiseUrl) return config.advertiseUrl;
    const h = host === '0.0.0.0' || host === '::' ? hostname() : host;
    return `http://${h}:${port}/mcp`;
  }

  start(): void {
    if (this.timer) return;
    void this.announce();
    this.timer = setInterval(() => void this.announce(), this.heartbeatMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    await Promise.all(this.urls.map(async (base) => {
      try {
        await fetch(`${base}/registry/${encodeURIComponent(this.id)}`, { method: 'DELETE', headers: this.headers() });
      } catch { /* 게이트웨이가 없으면 그만 */ }
    }));
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
    };
  }

  /** 모든 게이트웨이에 등록/하트비트 */
  private async announce(): Promise<void> {
    const body = JSON.stringify({
      id: this.id,
      name: this.target.name,
      url: this.target.advertiseUrl,
      ...(this.config.weight !== undefined ? { weight: this.config.weight } : {}),
    });
    await Promise.all(this.urls.map(async (base) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), Math.min(this.heartbeatMs, 5_000));
      try {
        const res = await fetch(`${base}/registry`, { method: 'POST', headers: this.headers(), body, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (this.state.get(base) !== 'registered') {
          this.state.set(base, 'registered');
          console.log(`[air] registered with gateway ${base} as "${this.id}" (${this.target.advertiseUrl})`);
        }
      } catch (err: any) {
        if (this.state.get(base) !== 'unreachable') {
          this.state.set(base, 'unreachable');
          console.warn(`[air] gateway ${base} unreachable (${err?.message ?? err}) — will keep retrying every ${this.heartbeatMs}ms`);
        }
      } finally {
        clearTimeout(t);
      }
    }));
  }
}
