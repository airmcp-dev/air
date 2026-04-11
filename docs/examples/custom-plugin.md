# Example: Building Custom Plugins

A hands-on guide to building custom plugins from scratch. Three plugins, increasing in complexity.

## 1. Basic — Execution Timer

Measure and log execution time for every tool call.

```typescript
// plugins/timing.ts
import type { AirPlugin } from '@airmcp-dev/core';

interface TimingOptions {
  slowMs?: number;  // Default: 1000
  log?: boolean;    // Default: true
}

export function timingPlugin(options?: TimingOptions): AirPlugin {
  const slowMs = options?.slowMs ?? 1000;
  const shouldLog = options?.log !== false;

  return {
    meta: { name: 'my-timing', version: '1.0.0' },
    middleware: [{
      name: 'my-timing:mw',
      before: async (ctx) => { ctx.meta._timing_start = performance.now(); },
      after: async (ctx) => {
        const ms = Math.round((performance.now() - (ctx.meta._timing_start || 0)) * 100) / 100;
        if (shouldLog) console.log(`${ms > slowMs ? '🐌 SLOW' : '✅'} ${ctx.tool.name}: ${ms}ms`);
        ctx.meta._timing_ms = ms;
      },
    }],
  };
}
```

Usage: `defineServer({ use: [timingPlugin({ slowMs: 500 })] })`

## 2. Intermediate — Usage Tracker

Track per-user per-tool call counts with auto-registered report tools.

```typescript
// plugins/usage-tracker.ts
import type { AirPlugin, AirMiddleware } from '@airmcp-dev/core';

interface UsageTrackerOptions { identifyBy?: string; }

interface UsageRecord { calls: number; lastCalledAt: string; tools: Record<string, number>; }

export function usageTrackerPlugin(options?: UsageTrackerOptions): AirPlugin {
  const identifyBy = options?.identifyBy ?? '_userId';
  const usage = new Map<string, UsageRecord>();

  function track(userId: string, toolName: string) {
    const r = usage.get(userId) || { calls: 0, lastCalledAt: '', tools: {} };
    r.calls++; r.lastCalledAt = new Date().toISOString();
    r.tools[toolName] = (r.tools[toolName] || 0) + 1;
    usage.set(userId, r);
  }

  return {
    meta: { name: 'usage-tracker', version: '1.0.0' },
    middleware: [{
      name: 'usage-tracker:mw',
      after: async (ctx) => { track((ctx.params[identifyBy] as string) || 'anonymous', ctx.tool.name); },
    }],
    tools: [
      { name: '_usage_report', description: 'Per-user usage report',
        handler: async () => ({ totalUsers: usage.size, users: Object.fromEntries(usage) }) },
      { name: '_usage_reset', description: 'Reset usage data',
        handler: async () => { const n = usage.size; usage.clear(); return { message: `Cleared ${n} users` }; } },
    ],
  };
}
```

Auto-registers `_usage_report` and `_usage_reset` tools.

## 3. Advanced — DB Connection Pool

Manage a database connection pool with lifecycle hooks, exposing `state.db` to all tools.

```typescript
// plugins/postgres.ts
import type { AirPlugin, PluginContext } from '@airmcp-dev/core';

interface PostgresOptions { connectionString: string; poolSize?: number; }

export function postgresPlugin(options: PostgresOptions): AirPlugin {
  const poolSize = options.poolSize ?? 10;
  let pool: any = null;

  return {
    meta: { name: 'air-postgres', version: '1.0.0' },
    hooks: {
      onInit: async (ctx: PluginContext) => {
        // Replace with: import { Pool } from 'pg';
        pool = createPool(options.connectionString, poolSize);
        ctx.state.db = pool;
        ctx.log('info', `PostgreSQL connected (pool: ${poolSize})`);
      },
      onStop: async (ctx: PluginContext) => {
        if (pool) { await pool.end(); pool = null; ctx.log('info', 'PostgreSQL disconnected'); }
      },
      onToolRegister: (tool) => {
        if (tool.name.startsWith('db_')) return { ...tool, description: `[DB] ${tool.description || tool.name}` };
      },
    },
    tools: [
      { name: 'db_query', description: 'Execute SQL query',
        params: { sql: { type: 'string', description: 'SQL query' } },
        handler: async ({ sql }, ctx) => {
          if (!ctx.state.db) throw new Error('DB not initialized');
          return ctx.state.db.query(sql);
        } },
      { name: 'db_health', description: 'Check DB connection',
        handler: async (_, ctx) => {
          try { await ctx.state.db.query('SELECT 1'); return { status: 'healthy' }; }
          catch (e: any) { return { status: 'unhealthy', error: e.message }; }
        } },
    ],
  };
}
```

Usage:

```typescript
defineServer({
  use: [postgresPlugin({ connectionString: process.env.DATABASE_URL!, poolSize: 20 })],
  tools: [
    defineTool('get_users', {
      handler: async (_, ctx) => ctx.state.db.query('SELECT id, name FROM users LIMIT 50'),
    }),
  ],
});
```

## Plugin structure summary

```typescript
interface AirPlugin {
  meta: { name: string; version?: string };  // Required

  middleware?: AirMiddleware[];  // Intercept every tool call
  //   before: pre-call (modify params, auth check, cache lookup)
  //   after:  post-call (logging, metrics, transform result)
  //   onError: error recovery (retry, fallback)

  hooks?: PluginHooks;  // Server lifecycle
  //   onInit: initialization (DB connect, load resources)
  //   onStart: server started (start workers, register health checks)
  //   onStop: server stopping (close DB, cleanup)
  //   onToolRegister: tool registration (modify description, wrap handler)

  tools?: AirToolDef[];          // Auto-register tools
  resources?: AirResourceDef[];  // Auto-register resources
}
```

## Key patterns

### Middleware: shared data between before/after

```typescript
before: async (ctx) => { ctx.meta.startTime = performance.now(); },
after: async (ctx) => { const elapsed = performance.now() - ctx.meta.startTime; },
```

### Hooks: shared state via ctx.state

```typescript
onInit: async (ctx) => { ctx.state.cache = new Map(); },
// All tool handlers: ctx.state.cache
```

### Convention: prefix internal tools with `_`

```typescript
tools: [{ name: '_my_plugin_status', handler: async () => ({ status: 'ok' }) }]
```

## Publishing to NPM

```json
// package.json
{ "name": "air-plugin-postgres", "main": "dist/index.js",
  "peerDependencies": { "@airmcp-dev/core": ">=0.1.0" } }
```

```json
// air-plugin.json (optional, for plugin registry)
{ "name": "air-plugin-postgres", "version": "1.0.0",
  "air": { "minVersion": "0.1.0", "category": "storage", "entry": "dist/index.js", "factory": "postgresPlugin" } }
```
