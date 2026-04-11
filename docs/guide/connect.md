# Client Connect

The `air connect` command auto-registers your MCP server with AI clients.

## Supported clients

| Client | ID | Config path (macOS) |
|--------|-----|-------------------|
| Claude Desktop | `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `claude-code` | `~/Library/Application Support/claude-code/config.json` |
| Cursor | `cursor` | `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/config.json` |
| VS Code | `vscode` | `~/Library/Application Support/Code/User/settings.json` |
| ChatGPT Desktop | `chatgpt` | `~/Library/Application Support/ChatGPT/mcp_config.json` |
| Ollama | `ollama` | `~/.ollama/mcp.json` |
| vLLM | `vllm` | `~/.vllm/mcp.json` |
| LM Studio | `lm-studio` | `~/Library/Application Support/LM Studio/mcp.json` |

On Windows, `~/Library/Application Support` becomes `%APPDATA%`. On Linux, `~/.config`.

## Basic usage

```bash
# Register with Claude Desktop (stdio default)
npx @airmcp-dev/cli connect claude-desktop

# Specify server name
npx @airmcp-dev/cli connect cursor --name my-db-tool

# SSE transport
npx @airmcp-dev/cli connect vscode --transport sse --port 3510

# HTTP transport
npx @airmcp-dev/cli connect claude-desktop --transport http --port 3510

# Remote server
npx @airmcp-dev/cli connect cursor --transport http --host mcp.example.com --port 443
```

## Connect options

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --name <n>` | package.json name | Server name in client config |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE port |
| `-H, --host <host>` | `localhost` | Remote server host |
| `--proxy <path>` | — | Path to mcp-proxy.js |

## Generated config formats

### stdio (default)

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["tsx", "/path/to/my-server/src/index.ts"]
    }
  }
}
```

Client launches the server as a child process. No need to start the server separately.

### SSE

```json
{
  "mcpServers": {
    "my-server": {
      "url": "http://localhost:3510/sse",
      "transport": "sse"
    }
  }
}
```

Start the server first: `npx @airmcp-dev/cli start --transport sse --port 3510`

### HTTP

```json
{
  "mcpServers": {
    "my-server": {
      "url": "http://localhost:3510",
      "transport": "http"
    }
  }
}
```

### SSE + mcp-proxy

```bash
npx @airmcp-dev/cli connect claude-desktop --transport sse --port 3510 --proxy ./node_modules/.bin/mcp-proxy
```

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./node_modules/.bin/mcp-proxy", "http://localhost:3510"]
    }
  }
}
```

## Disconnect

```bash
npx @airmcp-dev/cli disconnect claude-desktop
npx @airmcp-dev/cli disconnect cursor
```

## Already registered

If the same name is already registered, a warning is shown:

```
⚠ "my-server" already registered — overwriting.
```

## Manual configuration

For unsupported clients, edit the config file directly using the formats above.
