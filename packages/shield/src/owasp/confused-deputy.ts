// @airmcp-dev/shield — owasp/confused-deputy.ts
//
// OWASP MCP-04: Confused Deputy 방지.
// 도구 A가 도구 B의 권한을 이용해 허가되지 않은 작업을 수행하는 것을 차단.
// 각 도구에 허용된 호출 대상/리소스/네트워크를 제한한다.

import type { DeputyPolicy } from '../types.js';

export class DeputyGuard {
  private policies = new Map<string, DeputyPolicy>();

  /** 도구에 deputy 정책을 설정한다 */
  setPolicy(toolName: string, policy: DeputyPolicy): void {
    this.policies.set(toolName, policy);
  }

  /** 도구가 다른 도구를 호출할 수 있는지 확인한다 */
  canCallTool(callerTool: string, targetTool: string): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.policies.get(callerTool);
    if (!policy) return { allowed: true }; // 정책 없으면 허용

    if (policy.allowedCallees.length === 0) {
      return { allowed: false, reason: `Tool "${callerTool}" is isolated — no outbound tool calls allowed` };
    }

    const isAllowed = policy.allowedCallees.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern === targetTool) return true;
      if (pattern.endsWith('*') && targetTool.startsWith(pattern.slice(0, -1))) return true;
      return false;
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Tool "${callerTool}" is not allowed to call "${targetTool}"`,
      };
    }

    return { allowed: true };
  }

  /** 도구가 특정 리소스에 접근할 수 있는지 확인한다 */
  canAccessResource(toolName: string, resourceUri: string): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.policies.get(toolName);
    if (!policy || !policy.allowedResources) return { allowed: true };

    const isAllowed = policy.allowedResources.some((pattern) => {
      if (pattern === '*') return true;
      if (resourceUri.startsWith(pattern)) return true;
      return false;
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" cannot access resource "${resourceUri}"`,
      };
    }

    return { allowed: true };
  }

  /** 도구가 특정 호스트에 네트워크 요청할 수 있는지 확인한다 */
  canAccessHost(toolName: string, host: string): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.policies.get(toolName);
    if (!policy || !policy.allowedHosts) return { allowed: true };

    const isAllowed = policy.allowedHosts.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed === host) return true;
      // 서브도메인 매칭: *.example.com → api.example.com
      if (allowed.startsWith('*.') && host.endsWith(allowed.slice(1))) return true;
      return false;
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" cannot access host "${host}"`,
      };
    }

    return { allowed: true };
  }
}
