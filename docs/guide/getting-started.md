# Getting Started

Create and run your first MCP server in 5 minutes.

## Prerequisites

- **Node.js** 18 or higher (`node -v` to check)
- **npm**, **pnpm**, or **yarn**

## Step 1: Create a project (~1 min)

```bash
npx @airmcp-dev/cli create my-server
```

A language selection prompt appears:

```
  Select language / 언어를 선택하세요:

    1) English
    2) 한국어

  > 1
```

Skip the interactive prompt with `--template` and `--lang`:

```bash
npx @airmcp-dev/cli create my-server --template basic --lang en
```

Available templates: `basic` (default), `api`, `crud`, `agent`. See [Templates](/guide/templates) for details.

Install dependencies:

```bash
cd my-server
npm install
```

Generated structure:

```
my-server/
├── src/
│   └── index.ts          # Server definition
├── package.json          # Includes @airmcp-dev/core dependency
└── tsconfig.json         # TypeScript ESM config
```

`package.json` contents:

```json
{
  "name": "my-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "npx @airmcp-dev/cli dev"
  },
  "dependencies": {
    "@airmcp-dev/core": "^0.1.3"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

## Step 2: Write server code (~1 min)

Open `src/index.ts` (basic template):

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('greet', {
      description: 'Say hello to someone',
      params: {
        name: { type: 'string', description: 'Person to greet' },
      },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),
  ],
});

server.start();
```

Key structure:
- `defineServer` — defines the server. Takes name, version, transport, and tool list
- `defineTool` — defines a single tool. Takes name, description, params, handler
- `server.start()` — starts the server

## Step 3: Start dev mode (~30 sec)

```bash
npx @airmcp-dev/cli dev --console -p 3510
```

Terminal output:

```
[air] Starting dev mode...
[air] Transport: sse (port 3510)
[air] Tools: greet
[air] Test console: http://localhost:3510
[air] Watching for file changes...
```

Features:
- **Hot reload** — auto-restart on `src/` file changes
- **Test console** — test tools in the browser at `http://localhost:3510`

::: tip
Omit `-p` to use the default port 3100 (`dev.port` default in air.config.ts).
:::

## Step 4: Test your tool (~1 min)

### Browser test console

Open `http://localhost:3510`:
1. Select the `greet` tool
2. Enter a value for `name` (e.g., `World`)
3. Click Run
4. Result: `Hello, World!`

### Programmatic testing

```typescript
const result = await server.callTool('greet', { name: 'World' });
console.log(result); // "Hello, World!"
```

`callTool` goes through the full middleware chain (validation, error handling, plugins). Test code runs the exact same path as production.

## Step 5: Connect to Claude Desktop (~30 sec)

```bash
npx @airmcp-dev/cli connect claude-desktop
```

This adds the server to Claude Desktop's MCP config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop and the `greet` tool appears in the tool list.

::: info
With `stdio` transport, Claude Desktop launches the server as a child process. With `sse` or `http`, you need to run the server separately.
:::

## Add more tools

Register multiple tools in the same server:

```typescript
const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  tools: [
    defineTool('greet', {
      description: 'Say hello',
      params: { name: 'string' },
      handler: async ({ name }) => `Hello, ${name}!`,
    }),

    defineTool('add', {
      description: 'Add two numbers',
      params: { a: 'number', b: 'number' },
      handler: async ({ a, b }) => a + b,
    }),

    defineTool('now', {
      description: 'Return current time',
      handler: async () => new Date().toISOString(),
    }),
  ],
});
```

Tools without `params` are also valid (see `now`).

## Add plugins

Add plugins to the `use` array. They execute in array order.

```typescript
import {
  defineServer, defineTool,
  cachePlugin, retryPlugin, timeoutPlugin,
} from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  use: [
    timeoutPlugin(10_000),             // Abort after 10s
    retryPlugin({ maxRetries: 2 }),    // Retry 2x on failure (200ms → 400ms backoff)
    cachePlugin({ ttlMs: 30_000 }),    // Cache identical calls for 30s
  ],
  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      handler: async ({ query, limit }) => {
        return { results: [], total: 0 };
      },
    }),
  ],
});

server.start();
```

Execution order: timeout → retry → cache → handler. See [Plugins](/guide/plugins) for all 19 built-in plugins.

## Production build

```bash
# Compile TypeScript
npx tsc

# Run production
node dist/index.js
```

## Next steps

- [Configuration](/guide/configuration) — separate settings with air.config.ts
- [Define a Server](/guide/server) — full defineServer options and AirServer interface
- [Tools](/guide/tools) — 3 parameter formats (shorthand, object, Zod), handler context, response types
- [Plugins](/guide/plugins) — 19 built-in plugins and execution order
- [Transport](/guide/transport) — stdio vs SSE vs HTTP and when to use each
- [CLI Commands](/guide/cli) — all 12 CLI commands
- [Writing Tests](/guide/testing) — test tools with vitest
