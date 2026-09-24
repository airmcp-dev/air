// @airmcp-dev/shield — sandbox/scope-limiter.ts
//
// 도구별 접근 범위를 제한한다.
// 특정 도구가 접근할 수 있는 경로, 파라미터, 리소스를 제어.

import type { ScopeConfig } from '../types.js';
import { resolve, normalize } from 'node:path';

export class ScopeLimiter {
  private scopes = new Map<string, ScopeConfig>();

  /** 도구에 범위 제한을 설정한다 */
  setScope(toolName: string, scope: ScopeConfig): void {
    this.scopes.set(toolName, scope);
  }

  /** 도구의 범위 제한을 제거한다 */
  removeScope(toolName: string): void {
    this.scopes.delete(toolName);
  }

  /** 파라미터가 범위 내인지 확인한다 */
  checkParams(
    toolName: string,
    params: Record<string, any>,
  ): {
    allowed: boolean;
    reason?: string;
  } {
    const scope = this.scopes.get(toolName);
    if (!scope) return { allowed: true };

    // 차단 파라미터 체크
    if (scope.deniedParams) {
      for (const key of scope.deniedParams) {
        if (key in params) {
          return { allowed: false, reason: `Parameter "${key}" is denied for tool "${toolName}"` };
        }
      }
    }

    // 허용 파라미터 체크
    if (scope.allowedParams) {
      for (const key of Object.keys(params)) {
        if (!scope.allowedParams.includes(key)) {
          return {
            allowed: false,
            reason: `Parameter "${key}" is not allowed for tool "${toolName}"`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /** 경로가 허용 범위 내인지 확인한다 */
  checkPath(
    toolName: string,
    path: string,
  ): {
    allowed: boolean;
    reason?: string;
  } {
    const scope = this.scopes.get(toolName);
    if (!scope || !scope.allowedPaths || scope.allowedPaths.length === 0) {
      return { allowed: true };
    }

    const normalized = normalize(resolve(path));
    const inScope = scope.allowedPaths.some((allowed) => {
      const normalizedAllowed = normalize(resolve(allowed));
      return normalized.startsWith(normalizedAllowed);
    });

    if (!inScope) {
      return {
        allowed: false,
        reason: `Path "${path}" is outside allowed scope for tool "${toolName}"`,
      };
    }

    return { allowed: true };
  }
}
