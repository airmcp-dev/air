// @airmcp-dev/meter — classifier/layer-defs.ts
//
// Pylon-7 기반 7계층 정의.
// 상위(L1)→하위(L7)로 갈수록 토큰 소모와 위험도 증가.

import type { Layer, LayerDef } from '../types.js';

export const LAYER_DEFINITIONS: Record<Layer, LayerDef> = {
  L1: {
    layer: 'L1',
    name: 'Static Response',
    description: 'No LLM needed. Cached/static data return.',
    costWeight: 1,
    riskLevel: 0,
  },
  L2: {
    layer: 'L2',
    name: 'Simple Lookup',
    description: 'DB query, file read. Minimal processing.',
    costWeight: 3,
    riskLevel: 0.1,
  },
  L3: {
    layer: 'L3',
    name: 'Transform',
    description: 'Data transformation, format conversion.',
    costWeight: 5,
    riskLevel: 0.15,
  },
  L4: {
    layer: 'L4',
    name: 'Compute',
    description: 'Calculation, aggregation, analysis.',
    costWeight: 10,
    riskLevel: 0.2,
  },
  L5: {
    layer: 'L5',
    name: 'External API',
    description: 'External service call. Network I/O.',
    costWeight: 20,
    riskLevel: 0.4,
  },
  L6: {
    layer: 'L6',
    name: 'LLM Inference',
    description: 'AI model call. High token cost.',
    costWeight: 50,
    riskLevel: 0.6,
  },
  L7: {
    layer: 'L7',
    name: 'Multi-Step Agent',
    description: 'Autonomous agent with tool chaining. Highest cost/risk.',
    costWeight: 100,
    riskLevel: 0.9,
  },
};

export function getLayerDef(layer: Layer): LayerDef {
  return LAYER_DEFINITIONS[layer];
}
