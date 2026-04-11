// @airmcp-dev/core — plugin/builtin/queue.ts
//
// 동시성 제어 큐 플러그인.
// 도구별로 동시 실행 수를 제한. 초과 시 대기열에 넣고 순차 처리.
// DB 커넥션 풀, 외부 API 호출 제한 등에 사용.
//
// @example
//   defineServer({
//     use: [queuePlugin({
//       concurrency: { 'db_query': 3, '*': 10 },
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface QueueOptions {
  /** 도구별 동시 실행 수 (기본: '*': 10) */
  concurrency?: Record<string, number>;
  /** 대기열 최대 크기 (기본: 100) */
  maxQueueSize?: number;
  /** 대기 타임아웃 ms (기본: 30000) */
  queueTimeoutMs?: number;
}

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  addedAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export function queuePlugin(options?: QueueOptions): AirPlugin {
  const concurrencyMap = options?.concurrency ?? { '*': 10 };
  const maxQueueSize = options?.maxQueueSize ?? 100;
  const queueTimeoutMs = options?.queueTimeoutMs ?? 30_000;

  const active = new Map<string, number>();
  const queues = new Map<string, QueueEntry[]>();

  function getLimit(toolName: string): number {
    return concurrencyMap[toolName] ?? concurrencyMap['*'] ?? 10;
  }

  function getActive(toolName: string): number {
    return active.get(toolName) ?? 0;
  }

  function acquire(toolName: string): Promise<void> {
    const limit = getLimit(toolName);
    const current = getActive(toolName);

    if (current < limit) {
      active.set(toolName, current + 1);
      return Promise.resolve();
    }

    // 대기열에 추가
    const queue = queues.get(toolName) ?? [];
    if (queue.length >= maxQueueSize) {
      return Promise.reject(new Error(`[Queue] Queue full for "${toolName}" (max: ${maxQueueSize})`));
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, addedAt: Date.now(), timer: null as any };
      queue.push(entry);
      queues.set(toolName, queue);

      // 타임아웃 — 정상 resolve 시 clearTimeout으로 정리됨
      entry.timer = setTimeout(() => {
        const idx = queue.indexOf(entry);
        if (idx >= 0) {
          queue.splice(idx, 1);
          reject(new Error(`[Queue] Timeout waiting for "${toolName}" (${queueTimeoutMs}ms)`));
        }
      }, queueTimeoutMs);
    });
  }

  function release(toolName: string): void {
    const current = getActive(toolName);
    if (current <= 0) return;

    const queue = queues.get(toolName);
    if (queue && queue.length > 0) {
      // 대기 중인 요청을 깨움 — 타이머 정리
      const next = queue.shift()!;
      clearTimeout(next.timer);
      next.resolve();
    } else {
      active.set(toolName, current - 1);
    }
  }

  const middleware: AirMiddleware = {
    name: 'air:queue',
    before: async (ctx) => {
      try {
        await acquire(ctx.tool.name);
        ctx.meta._queued = true;
      } catch (err: any) {
        return {
          abort: true,
          abortResponse: {
            content: [{ type: 'text', text: err.message }],
            isError: true,
          },
        };
      }
    },
    after: async (ctx) => {
      if (ctx.meta._queued) release(ctx.tool.name);
    },
    onError: async (ctx) => {
      if (ctx.meta._queued) release(ctx.tool.name);
      return undefined;
    },
  };

  return {
    meta: { name: 'air:queue', version: '1.0.0' },
    middleware: [middleware],
  };
}
