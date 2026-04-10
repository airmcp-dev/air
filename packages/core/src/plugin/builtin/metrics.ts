// @airmcp-dev/core — plugin/builtin/metrics.ts
// 내장 메트릭 플러그인 — 호출 수, 에러율, 지연시간 자동 수집

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface ToolMetric {
  calls: number;
  errors: number;
  totalDuration: number;
  lastCalledAt: number;
}

const metrics = new Map<string, ToolMetric>();

export function getMetrics(): Record<string, ToolMetric & { avgDuration: number }> {
  const result: Record<string, any> = {};
  for (const [name, m] of metrics) {
    result[name] = {
      ...m,
      avgDuration: m.calls > 0 ? Math.round(m.totalDuration / m.calls) : 0,
    };
  }
  return result;
}

export function resetMetrics() {
  metrics.clear();
}

export function builtinMetricsPlugin(): AirPlugin {
  const mw: AirMiddleware = {
    name: 'air:builtin-metrics',
    after: async (ctx) => {
      const m = metrics.get(ctx.tool.name) || {
        calls: 0,
        errors: 0,
        totalDuration: 0,
        lastCalledAt: 0,
      };
      m.calls++;
      m.totalDuration += ctx.duration;
      m.lastCalledAt = Date.now();
      metrics.set(ctx.tool.name, m);
    },
    onError: async (ctx, _error) => {
      const m = metrics.get(ctx.tool.name) || {
        calls: 0,
        errors: 0,
        totalDuration: 0,
        lastCalledAt: 0,
      };
      m.calls++;
      m.errors++;
      m.lastCalledAt = Date.now();
      metrics.set(ctx.tool.name, m);
      return undefined; // 에러를 먹지 않음
    },
  };

  return {
    meta: {
      name: 'air:builtin-metrics',
      version: '0.1.0',
      description: 'Built-in metrics collection',
    },
    middleware: [mw],
  };
}
