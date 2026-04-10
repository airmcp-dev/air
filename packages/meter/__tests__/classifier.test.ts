// @airmcp-dev/meter — __tests__/classifier.test.ts

import { describe, it, expect } from 'vitest';
import { LayerClassifier } from '../src/classifier/layer-classifier.js';

describe('LayerClassifier', () => {
  const classifier = new LayerClassifier();

  it('should classify ping as L1', () => {
    const result = classifier.classify('ping');
    expect(result.layer).toBe('L1');
  });

  it('should classify get/read as L2', () => {
    expect(classifier.classify('get').layer).toBe('L2');
    expect(classifier.classify('read').layer).toBe('L2');
    expect(classifier.classify('list').layer).toBe('L2');
  });

  it('should classify convert/transform as L3', () => {
    expect(classifier.classify('convert').layer).toBe('L3');
    expect(classifier.classify('format').layer).toBe('L3');
  });

  it('should classify compute/analyze as L4', () => {
    expect(classifier.classify('compute').layer).toBe('L4');
    expect(classifier.classify('analyze').layer).toBe('L4');
  });

  it('should classify fetch/http as L5', () => {
    expect(classifier.classify('fetch').layer).toBe('L5');
    expect(classifier.classify('call_api').layer).toBe('L5');
  });

  it('should detect L5 by URL in params', () => {
    const result = classifier.classify('do_something', {
      url: 'https://api.example.com/data',
    });
    expect(result.layer).toBe('L5');
  });

  it('should classify generate/chat as L6', () => {
    expect(classifier.classify('generate').layer).toBe('L6');
    expect(classifier.classify('chat').layer).toBe('L6');
  });

  it('should classify agent/think as L7', () => {
    expect(classifier.classify('agent').layer).toBe('L7');
    expect(classifier.classify('think').layer).toBe('L7');
    expect(classifier.classify('orchestrate').layer).toBe('L7');
  });

  it('should default to L4 for unknown tools', () => {
    const result = classifier.classify('some_random_tool');
    expect(result.layer).toBe('L4');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should prioritize custom rules', () => {
    const custom = new LayerClassifier([
      {
        match: (name) => name === 'my_tool',
        layer: 'L1',
        confidence: 1,
        reason: 'Custom rule',
      },
    ]);

    expect(custom.classify('my_tool').layer).toBe('L1');
  });
});
