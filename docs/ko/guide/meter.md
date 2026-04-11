# Meter

Meter는 모든 MCP 호출을 7개 계층으로 자동 분류하고 호출량, 지연시간, 성공률을 추적합니다. `@airmcp-dev/core`에 포함되어 있으며 별도 설치가 필요 없습니다.

## Meter 활성화

```typescript
defineServer({
  meter: { classify: true, trackCalls: true },
});
```

Meter는 기본 활성입니다 (`meter.enabled`의 기본값은 `true`). `defineServer` 호출 시 자동으로 meter 미들웨어가 체인에 등록됩니다.

## 7계층 자동 분류

Meter는 도구 이름 패턴을 기반으로 호출을 자동 분류합니다:

| 계층 | 매칭 패턴 | 설명 |
|------|----------|------|
| L1 | `ping`, `health`, `version`, `echo` | 정적 응답, 비용 거의 없음 |
| L2 | `get`, `read`, `find`, `lookup`, `list`, `show` | 단순 조회 |
| L3 | `convert`, `transform`, `format`, `parse`, `encode`, `decode` | 데이터 변환 |
| L4 | `compute`, `calculate`, `aggregate`, `analyze`, `summarize` | 집계/계산 (기본값) |
| L5 | `fetch`, `request`, `call_api`, `webhook`, `http`, `post`, `put`, `delete` | 외부 API 호출 |
| L6 | `generate`, `complete`, `chat`, `embed`, `infer`, `predict` | LLM 호출 |
| L7 | `agent`, `think`, `plan`, `execute`, `reason`, `chain`, `orchestrate` | 에이전트 체인 |

L5는 도구 이름 외에도 파라미터 값에 `http://` 또는 `https://`가 포함되면 자동 매칭됩니다.

**매칭되지 않는 도구는 L4(기본값)로 분류됩니다.**

### 수동 분류

`defineTool`의 `layer` 속성으로 자동 분류를 오버라이드합니다:

```typescript
defineTool('my-cache', {
  layer: 1,   // L1로 강제 분류 (이름이 cache라서 자동 분류 안 됨)
  handler: async ({ key }) => cache.get(key),
});

defineTool('custom-llm-call', {
  layer: 6,   // L6으로 강제
  handler: async ({ prompt }) => callMyLLM(prompt),
});
```

## MeterConfig

```typescript
interface MeterConfig {
  enabled?: boolean;        // 기본: true
  classify?: boolean;       // 7계층 분류 활성화 (기본: true)
  trackCalls?: boolean;     // 호출 추적 (기본: true)
  trackTokens?: boolean;    // 토큰 사용 추적 (기본: false)
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    maxTokensPerCall?: number;
    onExceed?: 'warn' | 'block';
  };
}
```

## 메트릭 조회

```typescript
import { getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

const snapshot = getMetricsSnapshot();
// {
//   totalCalls: 1500,
//   successRate: 0.98,              // 성공률 (0~1)
//   avgLatencyMs: 45.2,             // 평균 지연시간
//   layerDistribution: {
//     L1: 200, L2: 400, L3: 100, L4: 300,
//     L5: 250, L6: 200, L7: 50,
//   },
//   toolCounts: {
//     search: 500,
//     greet: 300,
//     fetch: 250,
//     // ...
//   },
// }

resetMetricsHistory();  // 모든 메트릭 초기화
```

### 반환값 상세

| 필드 | 타입 | 설명 |
|------|------|------|
| `totalCalls` | `number` | 총 호출 수 |
| `successRate` | `number` | 성공률 (0~1, 에러 미포함) |
| `avgLatencyMs` | `number` | 전체 평균 지연시간 (ms) |
| `layerDistribution` | `Record<Layer, number>` | 계층별 호출 수 |
| `toolCounts` | `Record<string, number>` | 도구별 호출 수 |

## 내부 저장소

Meter는 Ring Buffer (최대 10,000건)로 호출 기록을 저장합니다. O(1) push, 가장 오래된 기록이 자동 삭제됩니다. 메모리 사용량이 일정합니다.

```typescript
// 각 호출 기록
interface CallRecord {
  tool: string;        // 도구 이름
  layer: Layer;        // 분류된 계층
  latencyMs: number;   // 지연시간
  success: boolean;    // 성공 여부
  timestamp: number;   // 타임스탬프
}
```

## 에러 시 동작

도구 호출이 실패해도 Meter는 기록합니다 (`success: false`). Meter 자체는 에러를 처리하지 않고 다음 미들웨어로 전달합니다.

## 실전 활용

### 계층별 모니터링

```typescript
const snapshot = getMetricsSnapshot();

// L6/L7 비율이 높으면 토큰 비용 주의
const heavyRatio = (snapshot.layerDistribution.L6 + snapshot.layerDistribution.L7) / snapshot.totalCalls;
if (heavyRatio > 0.3) {
  console.warn(`Heavy call ratio: ${(heavyRatio * 100).toFixed(1)}%`);
}
```

### 주기적 리포트

```typescript
setInterval(() => {
  const s = getMetricsSnapshot();
  console.log(JSON.stringify({
    totalCalls: s.totalCalls,
    successRate: s.successRate,
    avgLatencyMs: s.avgLatencyMs,
    layers: s.layerDistribution,
  }));
}, 60_000);  // 1분마다
```
