# @airmcp-dev/cli

CLI for building, running, and managing air MCP servers.

## Install

```bash
npm install -g @airmcp-dev/cli
# or use npx
npx @airmcp-dev/cli create my-server
```

## Commands

```
airmcp-dev create <name>          Create a new MCP server project
airmcp-dev dev [--console]        Dev mode with hot reload
airmcp-dev start                  Production mode (background)
airmcp-dev stop                   Stop server
airmcp-dev status                 Show running servers
airmcp-dev list                   List tools/resources/prompts
airmcp-dev inspect <tool>         Inspect tool schema
airmcp-dev connect <client>       Register with Claude Desktop, Cursor, VS Code
airmcp-dev disconnect <client>    Unregister
airmcp-dev check                  Diagnose project health
```

## Quick Start

```bash
npx @airmcp-dev/cli create my-server --template basic
cd my-server && npm install
npx @airmcp-dev/cli dev --console -p 3510
```

## Supported Clients

claude-desktop, claude-code, cursor, vscode, chatgpt, ollama, vllm, lm-studio

## Documentation

Full docs: **[docs.airmcp.dev](https://docs.airmcp.dev)**

## License

Apache-2.0 — [GitHub](https://github.com/airmcp-dev/air)
