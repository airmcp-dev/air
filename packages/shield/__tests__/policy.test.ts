// @airmcp-dev/shield — __tests__/policy.test.ts

import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../src/policy/engine.js';

describe('PolicyEngine', () => {
  it('should allow by default when no rules', () => {
    const engine = new PolicyEngine();
    const decision = engine.check('any-tool');
    expect(decision.allowed).toBe(true);
  });

  it('should deny when deny rule matches', () => {
    const engine = new PolicyEngine();
    engine.deny('block-delete', 'delete', 10);

    const decision = engine.check('delete');
    expect(decision.allowed).toBe(false);
  });

  it('should allow when allow rule matches', () => {
    const engine = new PolicyEngine();
    engine.allow('allow-read', 'read', 10);

    const decision = engine.check('read');
    expect(decision.allowed).toBe(true);
  });

  it('should deny with higher priority over allow', () => {
    const engine = new PolicyEngine();
    engine.allow('allow-all', '*', 1);
    engine.deny('block-delete', 'delete', 10);

    const decision = engine.check('delete');
    expect(decision.allowed).toBe(false);
  });

  it('should match wildcard patterns', () => {
    const engine = new PolicyEngine();
    engine.deny('block-db', 'db-*', 10);

    expect(engine.check('db-query').allowed).toBe(false);
    expect(engine.check('db-insert').allowed).toBe(false);
    expect(engine.check('search').allowed).toBe(true);
  });
});
