# @airmcp-dev/cli

CLI for building, running, and managing MCP servers.

## Installation

```bash
npm install -g @airmcp-dev/cli
# or use via npx
npx @airmcp-dev/cli <command>
```

Global command name: `airmcp-dev`

## Command summary

| Command | Description |
|---------|-------------|
| `create <n>` | Create new project from template |
| `add <type> <n>` | Add tool/resource/prompt scaffold |
| `dev` | Hot reload development mode |
| `start` | Production mode (background) |
| `stop` | Stop server |
| `status` | Show server status |
| `list` | List registered tools/resources/prompts |
| `inspect <tool>` | Show tool JSON schema |
| `connect <client>` | Register server with MCP client |
| `disconnect <client>` | Unregister from client |
| `check` | Diagnose project health |
| `license` | Show license info |

## create

```bash
airmcp-dev create <project-name> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--template <n>` | `basic` | `basic`, `api`, `crud`, `agent` |
| `--lang <code>` | (interactive) | `en`, `ko` |

→ [Templates guide](/guide/templates)

## dev

```bash
airmcp-dev dev [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <n>` | `3000` | HTTP/SSE port |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-c, --console` | `false` | Browser test console |

Internal behavior:
- Entry discovery: `src/index.ts` → `src/index.js` → `index.ts` → `index.js`
- Runs via `npx tsx` (no build needed)
- Watches `src/` for `.ts`, `.js`, `.json` changes with 300ms debounce
- `--console` auto-switches transport to `sse`
- Env vars: `NODE_ENV=development`, `AIR_TRANSPORT`, `AIR_PORT`

→ [CLI commands guide](/guide/cli)

## connect

```bash
airmcp-dev connect <client> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --name <n>` | package.json name | Server name in client config |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE port |
| `-H, --host <host>` | `localhost` | Remote server host |
| `--proxy <path>` | — | Path to mcp-proxy.js |

Supported clients:

| ID | Client |
|----|--------|
| `claude-desktop` | Claude Desktop |
| `claude-code` | Claude Code |
| `cursor` | Cursor |
| `vscode` | VS Code |
| `chatgpt` | ChatGPT Desktop |
| `ollama` | Ollama |
| `vllm` | vLLM |
| `lm-studio` | LM Studio |

→ [Client Connect guide](/guide/connect)
