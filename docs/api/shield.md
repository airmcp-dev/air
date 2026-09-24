# Shield Reference

`@airmcp-dev/shield` — MCP security layer. Apache-2.0.

## ThreatDetector

```typescript
import { ThreatDetector } from '@airmcp-dev/shield';

const detector = new ThreatDetector(customPatterns?);
```

### detector.scan(params)

Scans all string values recursively. Normalizes Unicode homoglyphs and decodes URL encoding before matching.

Returns `ThreatResult`:

```typescript
interface ThreatResult {
  detected: boolean;
  threats: ThreatItem[];
  score: number;            // 0.0 - 1.0
}

interface ThreatItem {
  type: ThreatType;         // 'prompt-injection' | 'tool-poisoning' | 'path-traversal' | ...
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string;         // first 200 chars
}
```

### detector.addPattern(pattern)

```typescript
detector.addPattern({
  type: 'custom',
  severity: 'high',
  pattern: /CONFIDENTIAL/gi,
  description: 'Confidential keyword detected',
});
```

## SSRFGuard

```typescript
import { SSRFGuard } from '@airmcp-dev/shield';

const guard = new SSRFGuard(config?);
```

### SSRFConfig

```typescript
interface SSRFConfig {
  allowedHosts?: string[];      // whitelist (supports *.example.com)
  blockedHosts?: string[];      // blacklist (cloud metadata auto-included)
  blockInternalIPs?: boolean;   // default: true
  blockedPorts?: number[];
  dnsResolve?: boolean;         // DNS rebinding protection, default: true
}
```

### guard.check(url) → sync

Returns `{ allowed: boolean; reason?: string }`. No DNS resolve.

### guard.checkAsync(url) → async

Same as `check()` plus DNS rebinding detection. Resolves hostname → checks if IP is internal.

### guard.scanParams(params) → sync

Extracts all URLs from params recursively, checks each.

### guard.scanParamsAsync(params) → async

Same as `scanParams()` with DNS rebinding detection.

## RugPullDetector

```typescript
import { RugPullDetector } from '@airmcp-dev/shield';

const detector = new RugPullDetector();
```

### detector.capture(toolName, description, params, annotations?, outputSchema?)

Records SHA-256 hash snapshot of tool definition.

### detector.verify(toolName, description, params, annotations?, outputSchema?)

Compares current definition against snapshot. Returns `RugPullResult`:

```typescript
interface RugPullResult {
  detected: boolean;
  changes: Array<{
    toolName: string;
    field: 'description' | 'params' | 'annotations' | 'outputSchema';
    previousHash: string;
    currentHash: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}
```

### detector.verifyAll(tools)

Batch verify all tools at once.

### detector.maxSeverity(result)

Returns highest severity from result, or null.

## DeputyGuard

```typescript
import { DeputyGuard } from '@airmcp-dev/shield';

const guard = new DeputyGuard();
```

### guard.setPolicy(toolName, policy)

```typescript
interface DeputyPolicy {
  allowedCallees: string[];     // tools this tool can call ('*' = any)
  allowedResources?: string[];  // resource URIs (prefix match)
  allowedHosts?: string[];      // network hosts (supports *.example.com)
}
```

### guard.canCallTool(caller, target)
### guard.canAccessResource(toolName, resourceUri)
### guard.canAccessHost(toolName, host)

All return `{ allowed: boolean; reason?: string }`.

## ContextOvershareGuard

```typescript
import { ContextOvershareGuard } from '@airmcp-dev/shield';

const guard = new ContextOvershareGuard(config?);
```

### OvershareConfig

```typescript
interface OvershareConfig {
  maxResponseSize?: number;     // bytes, default: 100KB
  sensitivePatterns?: string[]; // custom regex patterns
  maskPII?: boolean;            // default: true
}
```

### guard.filter(response) → masks + truncates

Returns `{ filtered: string; issues: Array<{ type, count }>; truncated: boolean }`.

### guard.scan(response) → detect only, no masking

Returns `{ hasSensitiveData: boolean; findings: Array<{ type, count }> }`.

## SupplyChainVerifier

```typescript
import { SupplyChainVerifier } from '@airmcp-dev/shield';

const verifier = new SupplyChainVerifier();
```

### verifier.capture(serverId, tools, packageName?)

Records tool list fingerprint.

### verifier.verify(serverId, tools)

Returns `{ verified: boolean; reason?: string }`.

### verifier.checkPackageName(name)

Checks against 20+ typosquatting patterns. Returns `{ safe: boolean; reason?: string }`.

## PolicyEngine

```typescript
import { PolicyEngine } from '@airmcp-dev/shield';

const engine = new PolicyEngine();
```

### engine.allow(name, target, priority?)
### engine.deny(name, target, priority?)

Basic rules. Higher priority evaluates first. `target` supports `*` and prefix wildcards (`db-*`).

### engine.denyIf(name, target, condition, priority?)

```typescript
interface PolicyCondition {
  paramEquals?: Record<string, any>;
  paramGreaterThan?: Record<string, number>;
  paramLessThan?: Record<string, number>;
  paramExists?: string[];
  custom?: (params: Record<string, any>) => boolean;
}
```

### engine.denyDuring(name, target, schedule, priority?)
### engine.allowDuring(name, target, schedule, priority?)

```typescript
interface PolicySchedule {
  daysOfWeek?: number[];    // 0=Sun, 6=Sat
  startTime?: string;       // 'HH:mm' (24h)
  endTime?: string;
  timezone?: string;
}
```

### engine.check(toolName, params?)

Returns `{ allowed: boolean; rule?: PolicyRule; reason: string }`.

## RateLimiter

```typescript
import { RateLimiter } from '@airmcp-dev/shield';

const limiter = new RateLimiter();
```

### limiter.addRule(config)

```typescript
interface RateLimitConfig {
  target: string;           // tool name, '*' for global
  windowMs: number;
  maxCalls: number;
  burstLimit?: number;      // max calls in burst window (default: maxCalls)
  burstWindowMs?: number;   // burst window (default: 1000ms)
}
```

### limiter.check(target)

Returns `{ allowed, remaining, resetAt, burstLimited? }`. Increments counter if allowed.

### limiter.usage(target)

Returns `{ used, max, windowMs }` or null.

### limiter.reset()

Clears all counters.

## PIIDetector

```typescript
import { PIIDetector } from '@airmcp-dev/shield';

const detector = new PIIDetector({
  minConfidence: 0.7,
  enabledTypes: ['email', 'phone', 'credit-card'],
  customPatterns: [{ type: 'custom', pattern: /PROJ-\d+/g, confidence: 0.9 }],
});
```

### detector.detect(text)

Returns `PIIEntity[]` sorted by position, deduplicated:

```typescript
interface PIIEntity {
  type: PIIEntityType;
  value: string;
  start: number;
  end: number;
  confidence: number;
  source: 'regex' | 'dictionary';
}
```

## PIIRedactor

```typescript
import { PIIRedactor } from '@airmcp-dev/shield';

const redactor = new PIIRedactor({ mode: 'mask' });
```

### redactor.redact(text)

Returns `{ redacted: string; entities: PIIEntity[] }`.

## PIITokenizer

```typescript
import { PIITokenizer } from '@airmcp-dev/shield';

const tokenizer = new PIITokenizer();
const { tokenized, mappings } = tokenizer.tokenize('email: john@test.com');
// tokenized === 'email: <EMAIL_1>'

const restored = tokenizer.detokenize(tokenized, mappings);
// restored === 'email: john@test.com'
```

Reversible tokenization for cases where you need to restore original values after processing.
