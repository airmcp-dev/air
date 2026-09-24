// @airmcp-dev/shield — owasp/ssrf-guard.ts
//
// OWASP MCP-06: SSRF(Server-Side Request Forgery) 방지.
// 도구가 내부 네트워크(169.254.x.x, 10.x.x.x 등)나
// 차단된 호스트로 요청하는 것을 방지.

import type { SSRFConfig } from '../types.js';
import { resolve as dnsResolve } from 'node:dns/promises';

/** 내부 IP 대역 */
const INTERNAL_IP_PATTERNS = [
  /^127\./,                  // loopback
  /^10\./,                   // class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // class B private
  /^192\.168\./,             // class C private
  /^169\.254\./,             // link-local (AWS metadata)
  /^0\./,                    // current network
  /^::1$/,                   // IPv6 loopback
  /^fc00:/i,                 // IPv6 ULA
  /^fe80:/i,                 // IPv6 link-local
];

/** 메타데이터 서비스 호스트 (클라우드) */
const METADATA_HOSTS = [
  '169.254.169.254',        // AWS/GCP metadata
  'metadata.google.internal', // GCP
  '169.254.170.2',          // AWS ECS
  'fd00:ec2::254',          // AWS IPv6 metadata
];

/** IP 주소 형태인지 체크 */
function isIPAddress(hostname: string): boolean {
  return /^[\d.]+$/.test(hostname) || hostname.includes(':');
}

/** IP가 내부 대역인지 체크 */
function isInternalIP(ip: string): boolean {
  return INTERNAL_IP_PATTERNS.some(p => p.test(ip));
}

export class SSRFGuard {
  private allowedHosts: Set<string>;
  private blockedHosts: Set<string>;
  private blockInternalIPs: boolean;
  private blockedPorts: Set<number>;
  private dnsResolve: boolean;

  constructor(config?: SSRFConfig) {
    this.allowedHosts = new Set(config?.allowedHosts || []);
    this.blockedHosts = new Set([...METADATA_HOSTS, ...(config?.blockedHosts || [])]);
    this.blockInternalIPs = config?.blockInternalIPs !== false;
    this.blockedPorts = new Set(config?.blockedPorts || []);
    this.dnsResolve = config?.dnsResolve !== false; // 기본 활성
  }

  /**
   * URL이 안전한지 동기적으로 검사한다.
   * DNS rebinding은 체크하지 않음 — 완전한 검사는 checkAsync() 사용.
   */
  check(url: string): {
    allowed: boolean;
    reason?: string;
  } {
    return this._checkParsed(url);
  }

  /**
   * URL이 안전한지 비동기로 검사한다.
   * DNS resolve를 수행하여 DNS rebinding 공격도 탐지.
   */
  async checkAsync(url: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // 1. 기본 체크 (동기)
    const syncResult = this._checkParsed(url);
    if (!syncResult.allowed) return syncResult;

    // 2. DNS rebinding 체크 — hostname이 IP가 아닌 경우 resolve
    if (this.blockInternalIPs && this.dnsResolve) {
      let parsed: URL;
      try { parsed = new URL(url); } catch { return syncResult; }

      const hostname = parsed.hostname;
      if (!isIPAddress(hostname)) {
        try {
          const addresses = await dnsResolve(hostname);
          for (const ip of addresses) {
            if (isInternalIP(ip)) {
              return {
                allowed: false,
                reason: `DNS rebinding: "${hostname}" resolves to internal IP ${ip}`,
              };
            }
          }
        } catch {
          // DNS 실패 → 보수적으로 허용 (네트워크 이슈일 수 있음)
        }
      }
    }

    return { allowed: true };
  }

  /**
   * 파라미터 값들에서 URL을 추출하고 전부 검사한다 (동기).
   */
  scanParams(params: Record<string, any>): {
    safe: boolean;
    violations: Array<{ url: string; reason: string }>;
  } {
    const violations: Array<{ url: string; reason: string }> = [];
    const urls = this.extractURLs(params);

    for (const url of urls) {
      const result = this.check(url);
      if (!result.allowed) {
        violations.push({ url, reason: result.reason! });
      }
    }

    return { safe: violations.length === 0, violations };
  }

  /**
   * 파라미터 값들에서 URL을 추출하고 DNS rebinding 포함 전부 검사한다 (비동기).
   */
  async scanParamsAsync(params: Record<string, any>): Promise<{
    safe: boolean;
    violations: Array<{ url: string; reason: string }>;
  }> {
    const violations: Array<{ url: string; reason: string }> = [];
    const urls = this.extractURLs(params);

    const results = await Promise.all(
      urls.map(async (url) => {
        const result = await this.checkAsync(url);
        if (!result.allowed) {
          violations.push({ url, reason: result.reason! });
        }
      }),
    );

    return { safe: violations.length === 0, violations };
  }

  /** 내부 파싱 + 동기 체크 로직 */
  private _checkParsed(url: string): { allowed: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { allowed: false, reason: `Invalid URL: ${url}` };
    }

    const hostname = parsed.hostname;
    const port = parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);

    // ── 1. 위험한 스킴 차단 ──
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { allowed: false, reason: `Blocked protocol: ${parsed.protocol}` };
    }

    // ── 2. 차단 호스트 체크 ──
    if (this.blockedHosts.has(hostname)) {
      return { allowed: false, reason: `Blocked host: ${hostname}` };
    }

    // ── 3. 내부 IP 체크 ──
    if (this.blockInternalIPs) {
      if (isInternalIP(hostname)) {
        return { allowed: false, reason: `Internal IP blocked: ${hostname}` };
      }
    }

    // ── 4. 차단 포트 체크 ──
    if (this.blockedPorts.has(port)) {
      return { allowed: false, reason: `Blocked port: ${port}` };
    }

    // ── 5. 화이트리스트 체크 (설정된 경우) ──
    if (this.allowedHosts.size > 0) {
      const isAllowed = Array.from(this.allowedHosts).some((allowed) => {
        if (allowed === hostname) return true;
        if (allowed.startsWith('*.') && hostname.endsWith(allowed.slice(1))) return true;
        return false;
      });

      if (!isAllowed) {
        return { allowed: false, reason: `Host "${hostname}" not in allowlist` };
      }
    }

    return { allowed: true };
  }

  /** 재귀적으로 모든 URL을 추출한다 */
  private extractURLs(obj: any): string[] {
    const urls: string[] = [];
    if (typeof obj === 'string') {
      const urlPattern = /https?:\/\/[^\s'"<>]+/gi;
      const matches = obj.match(urlPattern);
      if (matches) urls.push(...matches);
    } else if (Array.isArray(obj)) {
      for (const item of obj) urls.push(...this.extractURLs(item));
    } else if (obj && typeof obj === 'object') {
      for (const val of Object.values(obj)) urls.push(...this.extractURLs(val));
    }
    return urls;
  }
}
