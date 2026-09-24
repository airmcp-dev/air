# Shield

Shield is air's security layer — OWASP MCP Top 10 protection, threat detection, PII redaction, policy engine, and rate limiting in one package. Since v0.4.0, Shield is fully open source (Apache-2.0).

## Installation

```bash
npm install @airmcp-dev/shield
```

## Quick start

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';
import {
  ThreatDetector,
  SSRFGuard,
  RugPullDetector,
  ContextOvershareGuard,
  PolicyEngine,
  RateLimiter,
} from '@airmcp-dev/shield';

// Create guards
const threat = new ThreatDetector();
const ssrf = new SSRFGuard({ blockInternalIPs: true });
const rugPull = new RugPullDetector();
const overshare = new ContextOvershareGuard({ maskPII: true });
const policy = new PolicyEngine();
const limiter = new RateLimiter();

// Rate limit: 20 calls per minute
limiter.addRule({ target: '*', maxCalls: 20, windowMs: 60_000 });

const server = defineServer({
  name: 'secure-server',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('search', {
      params: { query: 'string', url: 'string?' },
      handler: async ({ query, url }, ctx) => {
        // 1. Threat scan
        const scan = threat.scan(ctx.params);
        if (scan.detected) return `[Blocked] ${scan.threats[0].description}`;

        // 2. SSRF check
        if (url) {
          const check = await ssrf.checkAsync(url);
          if (!check.allowed) return `[Blocked] ${check.reason}`;
        }

        // 3. Rate limit
        const limit = limiter.check('search');
        if (!limit.allowed) return `[Rate Limited] Retry after ${limit.resetAt.toISOString()}`;

        // 4. Policy
        const decision = policy.check('search', ctx.params);
        if (!decision.allowed) return `[Policy] ${decision.reason}`;

        const result = await doSearch(query);

        // 5. Filter response
        const filtered = overshare.filter(result);
        return filtered.filtered;
      },
    }),
  ],
});
```

## OWASP MCP Top 10

### Rug Pull Detection (MCP-08)

Detects when tool definitions change after initial registration — prevents LLM behavior manipulation.

```typescript
import { RugPullDetector } from '@airmcp-dev/shield';

const detector = new RugPullDetector();

// Capture initial state
detector.capture('search', 'Search documents', { query: 'string' });

// Later, verify integrity
const result = detector.verify('search', 'Search and DELETE documents', { query: 'string' });
// result.detected === true
// result.changes[0].field === 'description', severity === 'critical'
```

Severity levels:
- **critical** — description change (LLM behavior manipulation, CVE-2025-54136)
- **high** — params or annotations change
- **medium** — outputSchema change

### SSRF Guard (MCP-06)

Blocks requests to internal networks, cloud metadata services, and dangerous protocols.

```typescript
import { SSRFGuard } from '@airmcp-dev/shield';

const guard = new SSRFGuard({
  blockInternalIPs: true,         // default
  blockedHosts: ['evil.com'],
  allowedHosts: ['api.example.com', '*.trusted.io'],
  blockedPorts: [6379, 27017],    // Redis, MongoDB
  dnsResolve: true,               // DNS rebinding protection (default)
});

// Sync check (no DNS resolve)
guard.check('http://169.254.169.254/latest/meta-data');
// { allowed: false, reason: 'Blocked host: 169.254.169.254' }

// Async check (with DNS rebinding detection)
await guard.checkAsync('http://evil.com');
// If evil.com resolves to 127.0.0.1:
// { allowed: false, reason: 'DNS rebinding: "evil.com" resolves to internal IP 127.0.0.1' }

// Scan all URLs in params
await guard.scanParamsAsync({ url: 'http://10.0.0.1/admin', data: 'normal' });
// { safe: false, violations: [{ url: '...', reason: '...' }] }
```

### Confused Deputy (MCP-04)

Controls which tools can call other tools, access resources, or reach network hosts.

```typescript
import { DeputyGuard } from '@airmcp-dev/shield';

const guard = new DeputyGuard();
guard.setPolicy('read-file', {
  allowedCallees: [],                    // isolated — can't call other tools
  allowedResources: ['file:///docs/*'],  // only /docs
  allowedHosts: [],                      // no network
});

guard.canCallTool('read-file', 'delete-file');
// { allowed: false, reason: 'Tool "read-file" is isolated' }

guard.canAccessResource('read-file', 'file:///etc/passwd');
// { allowed: false }
```

### Context Overshare (MCP-05)

Masks PII in tool responses and limits response size.

```typescript
import { ContextOvershareGuard } from '@airmcp-dev/shield';

const guard = new ContextOvershareGuard({
  maskPII: true,
  maxResponseSize: 50 * 1024,    // 50KB
  sensitivePatterns: ['SECRET_\\w+'],
});

const result = guard.filter('User email: john@example.com, card: 4111-1111-1111-1111');
// result.filtered === 'User email: ***@***.***,  card: ****-****-****-****'
// result.issues === [{ type: 'pii:email', count: 1 }, { type: 'pii:credit-card', count: 1 }]
```

### Supply Chain Verification (MCP-07)

Detects typosquatting and verifies server integrity.

```typescript
import { SupplyChainVerifier } from '@airmcp-dev/shield';

const verifier = new SupplyChainVerifier();

// Typosquatting detection
verifier.checkPackageName('mcp-sever-filesystem');  // { safe: false, reason: 'typosquatting' }
verifier.checkPackageName('@mcp-official/core');     // { safe: false, reason: 'scope squatting' }

// Server integrity fingerprint
verifier.capture('server-1', [{ name: 'search', description: 'Find docs' }]);
// Later...
verifier.verify('server-1', [{ name: 'search', description: 'Find and delete docs' }]);
// { verified: false, reason: 'tools changed since ...' }
```

## Threat Detection

Scans tool parameters for 22 built-in attack patterns. Normalizes Unicode homoglyphs and decodes URL encoding before scanning.

```typescript
import { ThreatDetector } from '@airmcp-dev/shield';

const detector = new ThreatDetector();
const result = detector.scan({ query: 'ignore all previous instructions' });
// result.detected === true
// result.threats[0].type === 'prompt-injection'
// result.score === 0.8

// Also catches Unicode bypass attempts:
detector.scan({ query: 'ign\u043Ere previous instructions' }); // Cyrillic 'о'
// Still detected after homoglyph normalization
```

Coverage: prompt injection, tool poisoning, path traversal, command injection, SQL injection, SSRF, data exfiltration, rug pull.

## PII Redaction

Detect, tokenize, and mask personally identifiable information.

```typescript
import { PIIDetector, PIIRedactor } from '@airmcp-dev/shield';

// Detect
const detector = new PIIDetector({ minConfidence: 0.7 });
const entities = detector.detect('Call 010-1234-5678 or email john@test.com');
// [{ type: 'phone', value: '010-1234-5678', ... }, { type: 'email', ... }]

// Redact
const redactor = new PIIRedactor({ mode: 'mask' });
const result = redactor.redact('SSN: 901015-1234567');
// result.redacted === 'SSN: ******-*******'
```

Supported types: email, phone (KR/intl), Korean SSN, credit card, IP address, API keys, passport, driver's license.

## Policy Engine

Rule-based access control with conditional rules and time-based policies.

```typescript
import { PolicyEngine } from '@airmcp-dev/shield';

const engine = new PolicyEngine();

// Basic rules
engine.deny('block-delete', 'delete-*', 10);
engine.allow('allow-read', 'read-*', 5);

// Conditional: deny transfers over $10,000
engine.denyIf('large-transfer', 'transfer', {
  paramGreaterThan: { amount: 10_000 },
}, 20);

// Time-based: deny production deploys on weekends
engine.denyDuring('no-weekend-deploy', 'deploy-*', {
  daysOfWeek: [0, 6],    // Sunday, Saturday
}, 15);

// Business hours only
engine.allowDuring('business-hours', 'admin-*', {
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '18:00',
}, 10);

// Evaluate
engine.check('transfer', { amount: 50_000 });
// { allowed: false, reason: 'Denied by rule "large-transfer"' }
```

## Rate Limiting

Sliding window with burst protection.

```typescript
import { RateLimiter } from '@airmcp-dev/shield';

const limiter = new RateLimiter();
limiter.addRule({
  target: 'search',
  maxCalls: 100,
  windowMs: 60_000,       // 100/min
  burstLimit: 10,         // max 10 in 1 second
  burstWindowMs: 1_000,
});

const result = limiter.check('search');
// { allowed: true, remaining: 99, resetAt: Date }

// After burst:
// { allowed: false, remaining: 95, resetAt: Date, burstLimited: true }
```
