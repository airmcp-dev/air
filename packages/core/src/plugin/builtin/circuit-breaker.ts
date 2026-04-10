// @airmcp-dev/core — plugin/builtin/circuit-breaker.ts
//
// 서킷 브레이커 플러그인.
// 연속 에러가 임계값을 넘으면 도구 호출을 차단(open).
// 일정 시간 후 반개방(half-open)으로 전환하여 재시도.
//
// @example
//   defineServer({
//     use: [circuitBreakerPlugin({
//       failureThreshold: 5,
//       resetTimeoutMs: 30_000,
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  /** 연속 실패 임계값 (기본: 5) */
  failureThreshold?: number;
  /** 서킷 오픈 후 반개방까지 대기 시간 ms (기본: 30000) */
  resetTimeoutMs?: number;
  /** 도구별 개별 서킷 (기본: true) */
  perTool?: boolean;
}

interface CircuitInfo {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
}

export function circuitBreakerPlugin(options?: CircuitBreakerOptions): AirPlugin {
  const threshold = options?.failureThreshold ?? 5;
  const resetTimeout = options?.resetTimeoutMs ?? 30_000;
  const perTool = options?.perTool !== false;

  const circuits = new Map<string, CircuitInfo>();

  function getCircuit(key: string): CircuitInfo {
    if (!circuits.has(key)) {
      circuits.set(key, { state: 'closed', failures: 0, lastFailureAt: 0 });
    }
    return circuits.get(key)!;
  }

  const middleware: AirMiddleware = {
    name: 'air:circuit-breaker',
    before: async (ctx) => {
      const key = perTool ? ctx.tool.name : '_global';
      const circuit = getCircuit(key);

      // 반개방 전환 체크
      if (circuit.state === 'open') {
        if (Date.now() - circuit.lastFailureAt > resetTimeout) {
          circuit.state = 'half-open';
        } else {
          return {
            abort: true,
            abortResponse: {
              content: [{ type: 'text', text: `[CircuitBreaker] "${ctx.tool.name}" is temporarily unavailable (circuit open). Retry in ${Math.ceil((resetTimeout - (Date.now() - circuit.lastFailureAt)) / 1000)}s.` }],
              isError: true,
            },
          };
        }
      }

      ctx.meta._circuitKey = key;
    },
    after: async (ctx) => {
      const key = ctx.meta._circuitKey as string;
      if (!key) return;

      const circuit = getCircuit(key);
      // 성공하면 서킷 리셋
      circuit.state = 'closed';
      circuit.failures = 0;
    },
    onError: async (ctx, error) => {
      const key = ctx.meta._circuitKey as string;
      if (!key) return undefined;

      const circuit = getCircuit(key);
      circuit.failures++;
      circuit.lastFailureAt = Date.now();

      if (circuit.failures >= threshold) {
        circuit.state = 'open';
        console.warn(`[air:circuit-breaker] "${ctx.tool.name}" circuit OPEN after ${circuit.failures} failures`);
      }

      return undefined; // 에러는 다음 핸들러에 위임
    },
  };

  return {
    meta: { name: 'air:circuit-breaker', version: '1.0.0' },
    middleware: [middleware],
  };
}
