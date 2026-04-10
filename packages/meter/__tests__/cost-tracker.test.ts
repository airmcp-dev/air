// @airmcp-dev/meter — __tests__/cost-tracker.test.ts

import { describe, it, expect } from 'vitest';
import { TokenTracker } from '../src/cost/token-tracker.js';
import { CallTracker } from '../src/cost/call-tracker.js';

describe('TokenTracker', () => {
  it('should record and sum tokens', () => {
    const tracker = new TokenTracker();
    tracker.record('tool-a', 100, 200, 0.00001);
    tracker.record('tool-b', 50, 100, 0.00001);

    expect(tracker.totalTokens()).toBe(450);
  });

  it('should calculate total cost', () => {
    const tracker = new TokenTracker();
    tracker.record('tool-a', 1000, 500, 0.00003);

    expect(tracker.totalCost()).toBeCloseTo(0.045);
  });

  it('should break down by tool', () => {
    const tracker = new TokenTracker();
    tracker.record('search', 100, 200);
    tracker.record('search', 50, 50);
    tracker.record('generate', 500, 1000);

    const byTool = tracker.byTool();
    expect(byTool['search']).toBe(400);
    expect(byTool['generate']).toBe(1500);
  });
});

describe('CallTracker', () => {
  it('should record calls and compute stats', () => {
    const tracker = new CallTracker();
    tracker.record('search', 'L2', 50, true);
    tracker.record('search', 'L2', 100, true);
    tracker.record('search', 'L2', 150, false);

    expect(tracker.totalCalls()).toBe(3);
    expect(tracker.avgLatency()).toBe(100);
    expect(tracker.successRate()).toBeCloseTo(0.6667, 3);
  });

  it('should track layer distribution', () => {
    const tracker = new CallTracker();
    tracker.record('ping', 'L1', 1, true);
    tracker.record('get', 'L2', 10, true);
    tracker.record('generate', 'L6', 500, true);
    tracker.record('agent', 'L7', 1000, true);

    const dist = tracker.layerDistribution();
    expect(dist.L1).toBe(1);
    expect(dist.L2).toBe(1);
    expect(dist.L6).toBe(1);
    expect(dist.L7).toBe(1);
    expect(dist.L3).toBe(0);
  });

  it('should count by tool name', () => {
    const tracker = new CallTracker();
    tracker.record('search', 'L2', 10, true);
    tracker.record('search', 'L2', 20, true);
    tracker.record('create', 'L3', 30, true);

    const counts = tracker.toolCounts();
    expect(counts['search']).toBe(2);
    expect(counts['create']).toBe(1);
  });
});
