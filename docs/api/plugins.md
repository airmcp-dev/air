# Plugins Reference

## AirPlugin

```typescript
interface AirPlugin {
  meta: AirPluginMeta;          // Required: name is mandatory
  middleware?: AirMiddleware[];
  hooks?: PluginHooks;
  tools?: AirToolDef[];
  resources?: AirResourceDef[];
}

interface AirPluginMeta {
  name: string;               // Required — validation error if missing
  version?: string;
  description?: string;
}
```

### PluginHooks

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;
  onStart?: (ctx: PluginContext) => Promise<void> | void;
  onStop?: (ctx: PluginContext) => Promise<void> | void;
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;  // Sync
}
```

Order: `onInit` → `onStart` → (running) → `onStop`.
`onToolRegister` is **synchronous**. Return modified tool or `undefined`.

### PluginContext

```typescript
interface PluginContext {
  serverName: string;
  config: Record<string, any>;
  state: Record<string, any>;          // server.state
  log: (level: string, message: string, data?: any) => void;
}
```

### AirPluginFactory

```typescript
type AirPluginFactory = () => AirPlugin;
```

## Built-in plugin signatures

### Stability

```typescript
timeoutPlugin(timeoutMs?: number): AirPlugin;                    // Default: 30000
retryPlugin(options?: {
  maxRetries?: number; delayMs?: number;
  retryOn?: (error: Error) => boolean;
}): AirPlugin;
circuitBreakerPlugin(options?: {
  failureThreshold?: number; resetTimeoutMs?: number; perTool?: boolean;
}): AirPlugin;
fallbackPlugin(fallbacks: Record<string, string>): AirPlugin;    // tool → fallback tool
```

### Performance

```typescript
cachePlugin(options?: {
  ttlMs?: number; maxEntries?: number; exclude?: string[];
}): AirPlugin;
dedupPlugin(options?: { windowMs?: number }): AirPlugin;
queuePlugin(options?: {
  concurrency?: Record<string, number>;
  maxQueueSize?: number; queueTimeoutMs?: number;
}): AirPlugin;
```

### Security

```typescript
authPlugin(options: {
  type: 'api-key' | 'bearer'; keys?: string[];
  verify?: (token: string) => boolean | Promise<boolean>;
  publicTools?: string[]; paramName?: string;
}): AirPlugin;
sanitizerPlugin(options?: {
  stripHtml?: boolean; stripControl?: boolean;
  maxStringLength?: number; exclude?: string[];
}): AirPlugin;
validatorPlugin(options: {
  rules: Array<{ tool: string; validate: (params: any) => string | undefined }>;
}): AirPlugin;
```

### Network

```typescript
corsPlugin(options?: {
  origins?: string[]; methods?: string[];
  headers?: string[]; credentials?: boolean;
}): AirPlugin;
webhookPlugin(options: {
  url: string;
  events?: Array<'tool.call' | 'tool.error' | 'tool.slow'>;
  slowThresholdMs?: number; headers?: Record<string, string>;
  batchSize?: number;
}): AirPlugin;
```

### Data

```typescript
transformPlugin(options: {
  before?: Record<string, (params: any) => any>;
  after?: Record<string, (result: any) => any>;
}): AirPlugin;
i18nPlugin(options?: {
  defaultLang?: string;
  translations?: Record<string, Record<string, string>>;
  langParam?: string;
}): AirPlugin;
```

### Monitoring

```typescript
jsonLoggerPlugin(options?: {
  output?: 'stderr' | 'stdout';
  logParams?: boolean; extraFields?: Record<string, any>;
}): AirPlugin;
perUserRateLimitPlugin(options?: {
  maxCalls?: number; windowMs?: number; identifyBy?: string;
}): AirPlugin;
```

### Dev

```typescript
dryrunPlugin(options?: {
  enabled?: boolean; perCall?: boolean;
  mockResponse?: (toolName: string, params: Record<string, any>) => any;
}): AirPlugin;
```

## Metrics access

### getMetrics() / resetMetrics()

Builtin `builtinMetricsPlugin` data:

```typescript
import { getMetrics, resetMetrics } from '@airmcp-dev/core';

const m = getMetrics();
// { search: { calls: 150, errors: 3, totalDuration: 6750, avgDuration: 45, lastCalledAt: ... } }
resetMetrics();
```

### getMetricsSnapshot() / resetMetricsHistory()

Meter middleware data (Ring Buffer, max 10,000):

```typescript
import { getMetricsSnapshot, resetMetricsHistory } from '@airmcp-dev/core';

const s = getMetricsSnapshot();
// { totalCalls, successRate, avgLatencyMs, layerDistribution, toolCounts }
resetMetricsHistory();
```
