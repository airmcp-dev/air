# CLI Commands

The air CLI (`@airmcp-dev/cli`) provides 12 commands for the full MCP server development lifecycle.

## Installation

```bash
# Use via npx (no install)
npx @airmcp-dev/cli <command>

# Global install
npm install -g @airmcp-dev/cli
airmcp-dev <command>
```

::: info
The global command name is `airmcp-dev` (not `air`).
:::

## create

Create a new MCP server project from a template.

```bash
npx @airmcp-dev/cli create my-server
npx @airmcp-dev/cli create my-server --template api
npx @airmcp-dev/cli create my-server --template crud --lang ko
```

| Option | Default | Description |
|--------|---------|-------------|
| `--template <n>` | `basic` | Template: `basic`, `api`, `crud`, `agent` |
| `--lang <code>` | (interactive) | Comment language: `en`, `ko` |

Omit `--lang` for an interactive language prompt. See [Templates](/guide/templates) for details.

## add

Add a tool, resource, or prompt scaffold to an existing project.

```bash
npx @airmcp-dev/cli add tool search
npx @airmcp-dev/cli add resource config
npx @airmcp-dev/cli add prompt summarize
```

## dev

Start the server in development mode with hot reload and test console.

```bash
npx @airmcp-dev/cli dev
npx @airmcp-dev/cli dev -p 3510
npx @airmcp-dev/cli dev --console -p 3510
npx @airmcp-dev/cli dev --transport sse -p 3510
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <n>` | `3000` | HTTP/SSE port |
| `-t, --transport <type>` | `stdio` | Transport: `stdio`, `http`, `sse` |
| `-c, --console` | `false` | Open browser test console |

### Internal behavior

1. **Entry file discovery**: `src/index.ts` → `src/index.js` → `index.ts` → `index.js`
2. **Runs via tsx**: Executes TypeScript directly without build (`npx tsx`)
3. **File watching**: Watches `src/` for `.ts`, `.js`, `.json` changes with 300ms debounce, then auto-restarts
4. **Console mode**: `--console` automatically switches `stdio` to `sse`

Auto-set environment variables:
- `NODE_ENV=development`
- `AIR_TRANSPORT=<transport>`
- `AIR_PORT=<port>`

## start

Start the server in production mode (background process).

```bash
npx @airmcp-dev/cli start
npx @airmcp-dev/cli start --port 3510
```

## stop

Stop a running server.

```bash
npx @airmcp-dev/cli stop
```

## status

Show server status (running/stopped, PID, uptime, tool count).

```bash
npx @airmcp-dev/cli status
```

## list

List registered tools, resources, and prompts.

```bash
npx @airmcp-dev/cli list
npx @airmcp-dev/cli list --tools
npx @airmcp-dev/cli list --resources
```

## inspect

Show a tool's JSON schema and metadata.

```bash
npx @airmcp-dev/cli inspect search
```

## connect

Auto-register the server with an MCP client's config file. See [Client Connect](/guide/connect) for details.

```bash
npx @airmcp-dev/cli connect claude-desktop
npx @airmcp-dev/cli connect cursor --name my-tool
npx @airmcp-dev/cli connect vscode --transport http --port 3510
```

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --name <n>` | package.json name | Server name in client config |
| `-t, --transport <type>` | `stdio` | Transport: `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE port |
| `-H, --host <host>` | `localhost` | Remote server host |
| `--proxy <path>` | — | Path to mcp-proxy.js (stdio→SSE bridge) |

## disconnect

Remove server registration from an MCP client.

```bash
npx @airmcp-dev/cli disconnect claude-desktop
```

## check

Diagnose project health — check config, dependencies, build status.

```bash
npx @airmcp-dev/cli check
```

## license

Show license information for installed air packages.

```bash
npx @airmcp-dev/cli license
```
