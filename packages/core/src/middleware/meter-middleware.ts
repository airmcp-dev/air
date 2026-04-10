// @airmcp-dev/core — middleware/meter-middleware.ts
//
// MeterConfig → AirMiddleware 자동 생성.
// defineServer에서 meter 설정이 있으면 이 미들웨어가 체인에 자동 등록된다.
//
// 담당: 7-Layer 분류, 호출 추적, 지연시간 측정

import type { AirMiddleware, MiddlewareContext, MiddlewareResult } from '../types/middleware.js';
import type { MeterConfig } from '../types/config.js';

// ── 내장 7-Layer 분류 규칙 (경량 버전) ──
type Layer = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

const CLASSIFY_RULES: Array<{
  match: (name: string, params?: Record<string, any>) => boolean;
  layer: Layer;
}> = [
  { match: (n) => /^(ping|health|version|echo)$/i.test(n), layer: 'L1' },
  { match: (n) => /^(get|read|find|lookup|list|show)$/i.test(n), layer: 'L2' },
  { match: (n) => /^(convert|transform|format|parse|encode|decode)$/i.test(n), layer: 'L3' },
  { match: (n) => /^(compute|calculate|aggregate|analyze|summarize)$/i.test(n), layer: 'L4' },
  {
    match: (n, p) => {
      if (/^(fetch|request|call_api|webhook|http|post|put|delete)$/i.test(n)) return true;
      if (p) return Object.values(p).some((v) => typeof v === 'string' && /^https?:\/\//.test(v));
      return false;
    },
    layer: 'L5',
  },
  { match: (n) => /^(generate|complete|chat|embed|infer|predict)$/i.test(n), layer: 'L6' },
  { match: (n) => /^(agent|think|plan|execute|reason|chain|orchestrate)$/i.test(n), layer: 'L7' },
];

function classify(toolName: string, params?: Record<string, any>): Layer {
  for (const rule of CLASSIFY_RULES) {
    if (rule.match(toolName, params)) return rule.layer;
  }
  return 'L4'; // 기본값
}

// ── 내장 메트릭 저장소 (Ring Buffer — O(1) push) ──
interface CallRecord {
  tool: string;
  layer: Layer;
  latencyMs: number;
  success: boolean;
  timestamp: number;
}

const MAX_HISTORY = 10_000;
const callBuffer: (CallRecord | null)[] = new Array(MAX_HISTORY).fill(null);
let bufferHead = 0;
let bufferCount = 0;

function pushRecord(record: CallRecord): void {
  callBuffer[bufferHead] = record;
  bufferHead = (bufferHead + 1) % MAX_HISTORY;
  if (bufferCount < MAX_HISTORY) bufferCount++;
}

function getRecords(): CallRecord[] {
  const result: CallRecord[] = [];
  const start = bufferCount < MAX_HISTORY ? 0 : bufferHead;
  for (let i = 0; i < bufferCount; i++) {
    const idx = (start + i) % MAX_HISTORY;
    if (callBuffer[idx]) result.push(callBuffer[idx]!);
  }
  return result;
}

/**
 * MeterConfig로부터 측정 미들웨어를 생성한다.
 */
export function createMeterMiddleware(config: MeterConfig): AirMiddleware {
  const classifyEnabled = config.classify !== false;
  const trackEnabled = config.trackCalls !== false;

  return {
    name: 'air:meter',

    before: async (ctx: MiddlewareContext): Promise<MiddlewareResult | void> => {
      // 분류 결과를 meta에 저장 (after에서 사용)
      if (classifyEnabled) {
        const layer = classify(ctx.tool.name, ctx.params);
        ctx.meta.meter = { layer, startedAt: Date.now() };
      } else {
        ctx.meta.meter = { layer: 'L4', startedAt: Date.now() };
      }
    },

    after: async (ctx: MiddlewareContext & { result: any; duration: number }): Promise<void> => {
      if (!trackEnabled) return;

      const layer = ctx.meta.meter?.layer || 'L4';

      const record: CallRecord = {
        tool: ctx.tool.name,
        layer,
        latencyMs: ctx.duration,
        success: true,
        timestamp: Date.now(),
      };

      pushRecord(record);
    },

    onError: async (ctx: MiddlewareContext, error: Error): Promise<any> => {
      if (!trackEnabled) return undefined;

      const layer = ctx.meta.meter?.layer || 'L4';
      const latency = Date.now() - (ctx.meta.meter?.startedAt || ctx.startedAt);

      pushRecord({
        tool: ctx.tool.name,
        layer,
        latencyMs: latency,
        success: false,
        timestamp: Date.now(),
      });

      // 에러는 처리하지 않고 다음으로 넘김
      return undefined;
    },
  };
}

/** 메트릭 스냅샷 조회 */
export function getMetricsSnapshot(): {
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  layerDistribution: Record<Layer, number>;
  toolCounts: Record<string, number>;
} {
  const records = getRecords();
  const total = records.length;
  if (total === 0) {
    return {
      totalCalls: 0,
      successRate: 1,
      avgLatencyMs: 0,
      layerDistribution: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0 },
      toolCounts: {},
    };
  }

  let successCount = 0;
  let latencySum = 0;
  const layers = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0 } as Record<Layer, number>;
  const tools: Record<string, number> = {};

  for (const r of records) {
    if (r.success) successCount++;
    latencySum += r.latencyMs;
    layers[r.layer]++;
    tools[r.tool] = (tools[r.tool] || 0) + 1;
  }

  return {
    totalCalls: total,
    successRate: successCount / total,
    avgLatencyMs: latencySum / total,
    layerDistribution: layers,
    toolCounts: tools,
  };
}

/** 메트릭 초기화 */
export function resetMetricsHistory() {
  callBuffer.fill(null);
  bufferHead = 0;
  bufferCount = 0;
}
