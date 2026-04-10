// @airmcp-dev/core — plugin/builtin/webhook.ts
//
// 도구 호출 결과를 외부 웹훅으로 전송하는 플러그인.
// 모니터링, Slack 알림, 로그 수집 등에 사용.
//
// @example
//   defineServer({
//     use: [webhookPlugin({
//       url: 'https://hooks.slack.com/services/xxx',
//       events: ['tool.call', 'tool.error'],
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface WebhookOptions {
  /** 웹훅 URL */
  url: string;
  /** 전송할 이벤트 타입 (기본: ['tool.call']) */
  events?: Array<'tool.call' | 'tool.error' | 'tool.slow'>;
  /** 느린 호출 기준 ms (기본: 5000) */
  slowThresholdMs?: number;
  /** 요청 헤더 */
  headers?: Record<string, string>;
  /** 배치 크기 (기본: 1, 즉시 전송) */
  batchSize?: number;
}

export function webhookPlugin(options: WebhookOptions): AirPlugin {
  const events = new Set(options.events || ['tool.call']);
  const slowMs = options.slowThresholdMs || 5000;
  const batch: any[] = [];
  const batchSize = options.batchSize || 1;

  async function sendWebhook(payload: any): Promise<void> {
    batch.push(payload);
    if (batch.length < batchSize) return;

    const items = batch.splice(0);
    try {
      await fetch(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(items.length === 1 ? items[0] : { events: items }),
      });
    } catch (err: any) {
      console.error(`[air:webhook] Failed to send: ${err.message}`);
    }
  }

  const middleware: AirMiddleware = {
    name: 'air:webhook',
    after: async (ctx) => {
      if (events.has('tool.call')) {
        await sendWebhook({
          event: 'tool.call',
          tool: ctx.tool.name,
          duration: ctx.duration,
          timestamp: new Date().toISOString(),
          server: ctx.serverName,
        });
      }
      if (events.has('tool.slow') && ctx.duration > slowMs) {
        await sendWebhook({
          event: 'tool.slow',
          tool: ctx.tool.name,
          duration: ctx.duration,
          threshold: slowMs,
          timestamp: new Date().toISOString(),
        });
      }
    },
    onError: async (ctx, error) => {
      if (events.has('tool.error')) {
        await sendWebhook({
          event: 'tool.error',
          tool: ctx.tool.name,
          error: error.message,
          timestamp: new Date().toISOString(),
          server: ctx.serverName,
        });
      }
      return undefined;
    },
  };

  return {
    meta: { name: 'air:webhook', version: '1.0.0' },
    middleware: [middleware],
  };
}
