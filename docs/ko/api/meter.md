# @airmcp-dev/meter

MCP 서버를 위한 7계층 호출 분류와 메트릭 수집.

## 설치

```bash
npm install @airmcp-dev/meter
```

Meter는 `@airmcp-dev/core`에 미들웨어로도 포함되어 있습니다. 독립 패키지는 고급 기능을 추가합니다.

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;          // 기본: true
  classify?: boolean;         // 7계층 자동 분류 (기본: true)
  trackCalls?: boolean;       // 호출 추적 (기본: true)
  trackTokens?: boolean;      // 토큰 사용 추적 (기본: false)
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## 7계층 분류

| 계층 | 매칭 패턴 | 설명 |
|------|----------|------|
| L1 | `ping`, `health`, `version`, `echo` | 정적 응답 |
| L2 | `get`, `read`, `find`, `lookup`, `list`, `show` | 단순 조회 |
| L3 | `convert`, `transform`, `format`, `parse`, `encode`, `decode` | 데이터 변환 |
| L4 | `compute`, `calculate`, `aggregate`, `analyze`, `summarize` | 집계/계산 (기본값) |
| L5 | `fetch`, `request`, `call_api`, `webhook`, `http`, `post`, `put`, `delete` | 외부 API |
| L6 | `generate`, `complete`, `chat`, `embed`, `infer`, `predict` | LLM 호출 |
| L7 | `agent`, `think`, `plan`, `execute`, `reason`, `chain`, `orchestrate` | 에이전트 체인 |

매칭 안 되면 L4. `defineTool`의 `layer` 속성으로 수동 지정 가능.

## API

### getMetricsSnapshot()

```typescript
function getMetricsSnapshot(): {
  totalCalls: number;
  successRate: number;              // 0~1
  avgLatencyMs: number;
  layerDistribution: Record<'L1'|'L2'|'L3'|'L4'|'L5'|'L6'|'L7', number>;
  toolCounts: Record<string, number>;
};
```

### resetMetricsHistory()

```typescript
function resetMetricsHistory(): void;
```

## 내부 저장

Ring Buffer (최대 10,000건). O(1) push, 가장 오래된 기록 자동 삭제. 일정 메모리 사용.

```typescript
interface CallRecord {
  tool: string;
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
  latencyMs: number;
  success: boolean;
  timestamp: number;
}
```

→ [Meter 가이드](/ko/guide/meter)
