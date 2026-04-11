# Custom Plugins

Build your own air plugins.

## Plugin structure

An `AirPlugin` has four optional parts: meta, middleware, tools, hooks.

```typescript
import type { AirPlugin } from '@airmcp-dev/core';

const myPlugin: AirPlugin = {
  meta: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Does something useful',
  },

  middleware: [
    {
      name: 'my-plugin:mw',
      before: async (ctx) => { /* runs before every tool call */ },
      after: async (ctx) => { /* runs after every tool call */ },
      onError: async (ctx, error) => { /* runs on error */ },
    },
  ],

  tools: [
    // Plugin can register its own tools
  ],

  resources: [
    // Plugin can register its own resources
  ],

  hooks: {
    onInit: async (ctx) => { /* server initialized */ },
    onStart: async (ctx) => { /* server started */ },
    onStop: async (ctx) => { /* server stopping */ },
    onToolRegister: (tool, ctx) => {
      // Modify tool before registration
      return { ...tool, description: `[Enhanced] ${tool.description}` };
    },
  },
};
```

## Plugin factory

Most plugins accept options. Use a factory function:

```typescript
import type { AirPlugin } from '@airmcp-dev/core';

interface MyPluginOptions {
  prefix?: string;
  verbose?: boolean;
}

export function myPlugin(options?: MyPluginOptions): AirPlugin {
  const prefix = options?.prefix ?? '[my-plugin]';
  const verbose = options?.verbose ?? false;

  return {
    meta: { name: 'my-plugin', version: '1.0.0' },
    middleware: [
      {
        name: 'my-plugin:logger',
        before: async (ctx) => {
          if (verbose) {
            console.log(`${prefix} calling ${ctx.tool.name}`, ctx.params);
          }
        },
        after: async (ctx) => {
          console.log(`${prefix} ${ctx.tool.name} done in ${ctx.duration}ms`);
        },
      },
    ],
  };
}

// Usage
defineServer({
  use: [myPlugin({ prefix: '[APP]', verbose: true })],
});
```

## Lifecycle hooks

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;
  onStart?: (ctx: PluginContext) => Promise<void> | void;
  onStop?: (ctx: PluginContext) => Promise<void> | void;
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;
}
```

### PluginContext

```typescript
interface PluginContext {
  serverName: string;                   // Server name
  config: Record<string, any>;         // Server config
  state: Record<string, any>;          // Global state
  log: (level: string, message: string, data?: any) => void;
}
```

### onToolRegister

Intercept and modify tools as they are registered:

```typescript
hooks: {
  onToolRegister: (tool, ctx) => {
    // Add a tag to every tool
    return {
      ...tool,
      tags: [...(tool.tags || []), 'monitored'],
    };
  },
}
```

## Plugin with tools

Plugins can add their own tools to the server:

```typescript
export function healthPlugin(): AirPlugin {
  return {
    meta: { name: 'health', version: '1.0.0' },
    tools: [
      {
        name: '_health',
        description: 'Health check',
        handler: async (_, ctx) => ({
          status: 'ok',
          server: ctx.serverName,
          timestamp: Date.now(),
        }),
      },
    ],
  };
}
```

## Middleware meta sharing

Use `ctx.meta` to pass data between `before` and `after`:

```typescript
middleware: [{
  name: 'timing',
  before: async (ctx) => {
    ctx.meta.startTime = performance.now();
  },
  after: async (ctx) => {
    const elapsed = performance.now() - ctx.meta.startTime;
    console.log(`${ctx.tool.name}: ${elapsed.toFixed(1)}ms`);
  },
}]
```

## Type reference

```typescript
import type {
  AirPlugin,
  AirPluginFactory,
  AirPluginMeta,
  PluginHooks,
  PluginContext,
  AirMiddleware,
  MiddlewareContext,
  MiddlewareResult,
} from '@airmcp-dev/core';
```
