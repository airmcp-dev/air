# Transport

air supports three MCP transport types. Set via the `transport` config.

## stdio

Standard input/output. Claude Desktop launches your server as a child process and communicates via stdin/stdout.

```typescript
defineServer({
  transport: { type: 'stdio' },
});
```

No port needed. Logs are sent to **stderr** (stdout is reserved for MCP protocol).

## SSE (Server-Sent Events)

HTTP-based remote connection. A separate MCP server instance is created per session.

```typescript
defineServer({
  transport: { type: 'sse', port: 3510 },
});
```

### SSE endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sse` | Open SSE stream (creates new session) |
| `POST` | `/message?sessionId=xxx` | Send message |
| `GET` | `/` | Server status JSON |
| `OPTIONS` | `*` | CORS preflight (auto-handled) |

Client connection flow:
1. `GET /sse` → establishes SSE connection, assigns session ID
2. `POST /message?sessionId=xxx` → sends MCP messages
3. On disconnect, session is automatically cleaned up

Terminal output:

```
[air] SSE server listening on port 3510
[air] SSE client connected (session: a1b2c3d4-...)
[air] SSE client disconnected (session: a1b2c3d4-...)
```

### CORS

SSE transport sets CORS headers automatically:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

Use `corsPlugin` for custom configuration.

## Streamable HTTP

Latest MCP transport spec. Single endpoint handles all communication.

```typescript
defineServer({
  transport: { type: 'http', port: 3510 },
});
```

| Method | Description |
|--------|-------------|
| `POST` | MCP message handling |
| `GET` | Server status JSON |
| `DELETE` | Session termination |

Each session gets a unique ID via `crypto.randomUUID()`.

## auto (default)

Omit `type` or set `'auto'` to auto-detect based on environment:

```typescript
defineServer({
  transport: { type: 'auto', port: 3510 },
});
```

Detection order:

1. `MCP_TRANSPORT` env variable overrides everything (`stdio`, `http`, `sse`)
2. stdin is not TTY → `stdio` (MCP client spawned the process)
3. stdin is TTY → `http` (developer running directly)

```bash
# Force via env variable
MCP_TRANSPORT=sse node dist/index.js

# Piped → auto-detects stdio
echo '{}' | node dist/index.js

# Direct terminal → auto-detects http
node dist/index.js
```

## TransportConfig

```typescript
interface TransportConfig {
  type?: 'stdio' | 'sse' | 'http' | 'auto';  // Default: 'auto'
  port?: number;                               // HTTP/SSE port
  host?: string;                               // Default: 'localhost'
  basePath?: string;                           // Default: '/'
}
```

### Port resolution order

Port is determined by:

1. `transport.port` (explicit)
2. `dev.port` (dev mode setting)
3. `3100` (hardcoded default)

```typescript
// transport.port takes priority
defineServer({ transport: { type: 'sse', port: 3510 } });  // → 3510

// Falls back to dev.port
defineServer({ transport: { type: 'sse' }, dev: { port: 4000 } });  // → 4000

// Falls back to 3100
defineServer({ transport: { type: 'sse' } });  // → 3100
```

## Which to use?

| Transport | Use case | Client |
|-----------|----------|--------|
| `stdio` | Local tools, Claude Desktop direct | Claude Desktop, `mcp-cli` |
| `sse` | Remote servers, existing MCP infra, `mcp-proxy` compat | Cursor, VS Code, `mcp-proxy` |
| `http` | New deployments, Streamable HTTP spec, behind reverse proxy | Latest MCP clients |

::: tip
When deploying behind a reverse proxy (Nginx, Cloudflare), use `http` transport. SSE requires special proxy config for long-lived connections (`proxy_read_timeout 86400`).
:::

::: info
With `stdio` transport, all `console.log` output can mix into the MCP protocol stream. air's builtin logger automatically redirects to `stderr`.
:::
