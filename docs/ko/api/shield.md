# Shield 레퍼런스

`@airmcp-dev/shield` — MCP 보안 레이어. Apache-2.0.

## ThreatDetector

```typescript
import { ThreatDetector } from '@airmcp-dev/shield';

const detector = new ThreatDetector(customPatterns?);
```

### detector.scan(params)

모든 문자열 값을 재귀적으로 스캔합니다. 매칭 전에 유니코드 호모글리프를 정규화하고 URL 인코딩을 디코딩합니다.

반환값 `ThreatResult`:

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
  evidence: string;         // 처음 200자
}
```

### detector.addPattern(pattern)

```typescript
detector.addPattern({
  type: 'custom',
  severity: 'high',
  pattern: /CONFIDENTIAL/gi,
  description: '기밀 키워드 탐지',
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
  allowedHosts?: string[];      // 화이트리스트 (*.example.com 지원)
  blockedHosts?: string[];      // 블랙리스트 (클라우드 메타데이터 자동 포함)
  blockInternalIPs?: boolean;   // 기본: true
  blockedPorts?: number[];
  dnsResolve?: boolean;         // DNS rebinding 방어, 기본: true
}
```

### guard.check(url) → 동기

`{ allowed: boolean; reason?: string }` 반환. DNS resolve 없음.

### guard.checkAsync(url) → 비동기

`check()`와 동일 + DNS rebinding 탐지. hostname을 resolve하여 IP가 내부 대역인지 확인.

### guard.scanParams(params) → 동기

파라미터에서 모든 URL을 재귀 추출하여 각각 검사.

### guard.scanParamsAsync(params) → 비동기

`scanParams()`와 동일 + DNS rebinding 탐지.

## RugPullDetector

```typescript
import { RugPullDetector } from '@airmcp-dev/shield';

const detector = new RugPullDetector();
```

### detector.capture(toolName, description, params, annotations?, outputSchema?)

도구 정의의 SHA-256 해시 스냅샷을 기록.

### detector.verify(toolName, description, params, annotations?, outputSchema?)

현재 정의를 스냅샷과 비교. 반환값 `RugPullResult`:

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

모든 도구를 일괄 검증.

### detector.maxSeverity(result)

결과에서 가장 높은 심각도 반환. 없으면 null.

## DeputyGuard

```typescript
import { DeputyGuard } from '@airmcp-dev/shield';

const guard = new DeputyGuard();
```

### guard.setPolicy(toolName, policy)

```typescript
interface DeputyPolicy {
  allowedCallees: string[];     // 호출 가능한 도구 ('*' = 전부)
  allowedResources?: string[];  // 리소스 URI (접두사 매칭)
  allowedHosts?: string[];      // 네트워크 호스트 (*.example.com 지원)
}
```

### guard.canCallTool(caller, target)
### guard.canAccessResource(toolName, resourceUri)
### guard.canAccessHost(toolName, host)

모두 `{ allowed: boolean; reason?: string }` 반환.

## ContextOvershareGuard

```typescript
import { ContextOvershareGuard } from '@airmcp-dev/shield';

const guard = new ContextOvershareGuard(config?);
```

### OvershareConfig

```typescript
interface OvershareConfig {
  maxResponseSize?: number;     // bytes, 기본: 100KB
  sensitivePatterns?: string[]; // 커스텀 정규식 패턴
  maskPII?: boolean;            // 기본: true
}
```

### guard.filter(response) → 마스킹 + 잘라내기

`{ filtered: string; issues: Array<{ type, count }>; truncated: boolean }` 반환.

### guard.scan(response) → 탐지만, 마스킹 없음

`{ hasSensitiveData: boolean; findings: Array<{ type, count }> }` 반환.

## SupplyChainVerifier

```typescript
import { SupplyChainVerifier } from '@airmcp-dev/shield';

const verifier = new SupplyChainVerifier();
```

### verifier.capture(serverId, tools, packageName?)

도구 목록의 fingerprint를 기록.

### verifier.verify(serverId, tools)

`{ verified: boolean; reason?: string }` 반환.

### verifier.checkPackageName(name)

20개 이상의 타이포스쿼팅 패턴으로 검사. `{ safe: boolean; reason?: string }` 반환.

## PolicyEngine

```typescript
import { PolicyEngine } from '@airmcp-dev/shield';

const engine = new PolicyEngine();
```

### engine.allow(name, target, priority?)
### engine.deny(name, target, priority?)

기본 규칙. 높은 priority가 먼저 평가. `target`은 `*`과 접두사 와일드카드(`db-*`) 지원.

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
  daysOfWeek?: number[];    // 0=일, 6=토
  startTime?: string;       // 'HH:mm' (24시간)
  endTime?: string;
  timezone?: string;
}
```

### engine.check(toolName, params?)

`{ allowed: boolean; rule?: PolicyRule; reason: string }` 반환.

## RateLimiter

```typescript
import { RateLimiter } from '@airmcp-dev/shield';

const limiter = new RateLimiter();
```

### limiter.addRule(config)

```typescript
interface RateLimitConfig {
  target: string;           // 도구명, '*'이면 글로벌
  windowMs: number;
  maxCalls: number;
  burstLimit?: number;      // burst 윈도우 내 최대 호출 (기본: maxCalls)
  burstWindowMs?: number;   // burst 윈도우 (기본: 1000ms)
}
```

### limiter.check(target)

`{ allowed, remaining, resetAt, burstLimited? }` 반환. 허용 시 카운터 증가.

### limiter.usage(target)

`{ used, max, windowMs }` 반환. 없으면 null.

### limiter.reset()

모든 카운터 초기화.

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

위치순 정렬, 중복 제거된 `PIIEntity[]` 반환:

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

`{ redacted: string; entities: PIIEntity[] }` 반환.

## PIITokenizer

```typescript
import { PIITokenizer } from '@airmcp-dev/shield';

const tokenizer = new PIITokenizer();
const { tokenized, mappings } = tokenizer.tokenize('이메일: john@test.com');
// tokenized === '이메일: <EMAIL_1>'

const restored = tokenizer.detokenize(tokenized, mappings);
// restored === '이메일: john@test.com'
```

처리 후 원본 값을 복원해야 하는 경우에 사용하는 가역적 토크나이징.
