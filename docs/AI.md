# air Framework -- AI Reference

This document is for AI assistants to understand the air framework and generate correct code.

## Architecture

air is a TypeScript monorepo (pnpm + turborepo) for building MCP (Model Context Protocol) servers.

Packages:
- @airmcp-dev/core -- server definition, tools, resources, prompts, plugins, storage, transport, middleware
- air (CLI) -- scaffolding, dev server, client registration
- @airmcp-dev/gateway -- multi-server proxy, routing, load balancing
- @airmcp-dev/logger -- structured logging (JSON, pretty, file, remote)
- @airmcp-dev/meter -- 7-layer classification, call tracking, budget management
- @airmcp-dev/shield (commercial) -- OWASP MCP Top 10, advanced threat detection, sandboxing
- @airmcp-dev/hive (commercial) -- process pool, auto-restart, multi-tenant, cluster

## Core API

### defineServer

```typescript
import { defineServer, defineTool, defineResource, definePrompt } from '@airmcp-dev/core';

const server = defineServer({
  name: string,
  version?: string,
  description?: string,
  transport?: { type: 'stdio' | 'sse' | 'http', port?: number },
  shield?: ShieldConfig,
  meter?: MeterConfig,
  use?: AirPlugin[],
  tools?: AirToolDef[],
  resources?: AirResourceDef[],
  prompts?: AirPromptDef[],
  middleware?: AirMiddleware[],
  storage?: StoreOptions,
});
```

Returns: `{ start(), stop(), status(), tools(), resources(), callTool(name, params) }`

### defineTool

Two forms:
```typescript
// Form 1: name + options
defineTool('tool_name', {
  description: string,
  params: { key: ParamDef, ... },
  handler: async (params, ctx) => result,
})

// ParamDef: 'string' | 'number' | 'boolean' | { type, description?, optional? }
```

Handler return types:
- string -- converted to `[{ type: 'text', text }]`
- object -- JSON stringified to text content
- `{ text, isError? }` -- direct MCP content

### defineResource

```typescript
// Form 1
defineResource('file:///path', { name, description?, handler })

// Form 2
defineResource({ uri, name, description?, handler })
```

Handler: `(uri: string, ctx) => string | { text, mimeType? } | { blob, mimeType }`

### definePrompt

```typescript
// Form 1
definePrompt('name', { description?, args?, handler })

// Form 2
definePrompt({ name, description?, args?, handler })
```

Handler: `(args) => [{ role: 'user' | 'assistant', content: string }]`

## Plugins (19 built-in)

All plugins follow the `AirPlugin` interface:
```typescript
interface AirPlugin {
  meta: { name: string, version?: string },
  middleware?: AirMiddleware[],
  tools?: AirToolDef[],
  hooks?: PluginHooks,
}
```

Available plugins (import from '@airmcp-dev/core'):

| Plugin | Factory | Key Options |
|--------|---------|-------------|
| timeoutPlugin | timeoutPlugin(ms) | timeout in milliseconds |
| retryPlugin | retryPlugin({ maxRetries, delayMs }) | exponential backoff |
| circuitBreakerPlugin | circuitBreakerPlugin({ failureThreshold, resetTimeoutMs }) | per-tool circuit |
| fallbackPlugin | fallbackPlugin({ primary: 'backup' }) | tool name mapping |
| cachePlugin | cachePlugin({ ttlMs, maxEntries, exclude }) | result caching |
| dedupPlugin | dedupPlugin({ windowMs }) | request deduplication |
| queuePlugin | queuePlugin({ concurrency: { tool: N } }) | concurrency control |
| authPlugin | authPlugin({ type, keys, publicTools }) | API key / bearer auth |
| sanitizerPlugin | sanitizerPlugin({ stripHtml, maxStringLength }) | input sanitization |
| validatorPlugin | validatorPlugin({ rules: { tool: fn } }) | business logic validation |
| corsPlugin | corsPlugin({ origins }) | CORS headers |
| webhookPlugin | webhookPlugin({ url, events }) | external notifications |
| transformPlugin | transformPlugin({ before, after }) | input/output transform |
| i18nPlugin | i18nPlugin({ defaultLang, translations }) | multilingual responses |
| jsonLoggerPlugin | jsonLoggerPlugin({ output }) | JSON structured logging |
| perUserRateLimitPlugin | perUserRateLimitPlugin({ maxCalls, windowMs }) | per-user rate limit |
| dryrunPlugin | dryrunPlugin({ enabled }) | dry-run mode |

## Shield Config

```typescript
shield: {
  enabled: true,
  policies: [{ name, target (glob), action: 'allow' | 'deny', priority }],
  threatDetection: boolean,
  rateLimit: {
    perTool: { [toolName]: { maxCalls, windowMs } },
    default: { maxCalls, windowMs },
  },
  audit: boolean,
}
```

## Meter Config

```typescript
meter: {
  enabled: boolean,
  classify: boolean,    // 7-layer classification
  trackCalls: boolean,  // call history (ring buffer)
}
```

## Storage

```typescript
import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// MemoryStore -- in-memory, TTL support
// FileStore -- JSON files + .jsonl append logs, periodic flush
// createStorage({ type: 'memory' | 'file' | 'sqlite', path? })

interface StorageAdapter {
  init(): Promise<void>;
  set(namespace, key, value, ttl?): Promise<void>;
  get<T>(namespace, key): Promise<T | null>;
  delete(namespace, key): Promise<boolean>;
  list(namespace, prefix?): Promise<string[]>;
  entries<T>(namespace, prefix?): Promise<{ key, value }[]>;
  append(namespace, entry): Promise<void>;
  query(namespace, opts?): Promise<any[]>;
  close(): Promise<void>;
}
```

## Transport

- stdio: default, Claude Desktop subprocess
- sse: GET /sse + POST /message?sessionId=xxx, multi-session
- http: Streamable HTTP (POST /, Accept header, Mcp-Session-Id)

## Middleware Chain Order

1. errorBoundary (built-in)
2. validation (built-in, zod passthrough)
3. shield (if enabled)
4. meter (if enabled)
5. builtin logger/metrics plugins
6. user plugins (in `use` array order)
7. user middleware (in `middleware` array order)

## Error Handling

```typescript
import { AirError, McpErrors } from '@airmcp-dev/core';

// McpErrors factory
McpErrors.toolNotFound(name)       // -32601
McpErrors.invalidParams(msg)       // -32602
McpErrors.internal(msg)            // -32603
McpErrors.forbidden(msg)           // -32000
McpErrors.rateLimited(tool, ms)    // -32001
McpErrors.threatDetected(type, sev) // -32002
McpErrors.timeout(tool, ms)        // -32003
```

## CLI Commands

```
air create <name> [--template basic|crud|api|agent] [--lang ko|en]
air add <type> <name> [--params "key:type,..."]
air dev [--console] [-p port] [-t stdio|sse|http]
air start [-p port] [-t transport] [--foreground]
air stop [name]
air status
air list [--json]
air inspect <tool>
air connect <client> [-t transport] [-p port] [-H host] [--proxy path]
air disconnect <client>
air check
```

Supported clients: claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## Project Structure (generated by air create)

```
my-server/
  src/
    index.ts        -- server definition
  package.json
  tsconfig.json
```

## File Structure (framework)

```
packages/
  core/src/
    server/          -- defineServer, server-runner, lifecycle
    tool/            -- defineTool, tool-schema, tool-result
    resource/        -- defineResource, resource-template
    prompt/          -- definePrompt
    middleware/      -- chain, error-handler, before-hook, after-hook, shield-middleware, meter-middleware
    plugin/builtin/  -- 19 built-in plugins
    storage/         -- MemoryStore, FileStore, storage-adapter
    transport/       -- stdio, sse, http adapters, auto-detect
    config/          -- defaults, loader
    context/         -- request-context, server-context
    types/           -- all TypeScript interfaces
  cli/src/
    commands/        -- 11 CLI commands
    utils/           -- printer, path-resolver, json-editor, process-manager, test-console
    templates/       -- project templates (basic, crud, api, agent x ko/en)
```
