# air MCP Server -- AI Context

This project is an MCP server built with the air framework.

## Stack
- TypeScript + Node.js
- @airmcp-dev/core for server definition
- MCP protocol (JSON-RPC 2.0)

## Key APIs
- defineServer({ name, tools, resources, prompts, use, shield, meter })
- defineTool(name, { params, handler })
- defineResource({ uri, name, handler })
- definePrompt(name, { args, handler })

## Adding Features
- Add tool: `airmcp-dev add tool <name> --params "key:type"`
- Add resource: `airmcp-dev add resource <name>`
- Add prompt: `airmcp-dev add prompt <name>`

## Plugins (import from @airmcp-dev/core)
timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin,
cachePlugin, dedupPlugin, queuePlugin,
authPlugin, sanitizerPlugin, validatorPlugin,
corsPlugin, webhookPlugin, transformPlugin, i18nPlugin,
jsonLoggerPlugin, perUserRateLimitPlugin, dryrunPlugin

## Transport
- stdio (default): for Claude Desktop direct execution
- sse: for remote connections (set transport.type and transport.port)
- http: for Streamable HTTP

## Commands
- `airmcp-dev dev --console` -- dev mode with test console
- `airmcp-dev connect claude-desktop` -- register with client
- `airmcp-dev check` -- project diagnostics
