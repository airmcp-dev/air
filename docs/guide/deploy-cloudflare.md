# Deploy to Cloudflare Workers

Deploy your air MCP server to Cloudflare Workers for edge deployment.

## Prerequisites

- Cloudflare account
- `wrangler` CLI installed: `npm install -g wrangler`

## Setup

```bash
# Create project
air create my-edge-server --template basic
cd my-edge-server

# Add wrangler config
```

Create `wrangler.toml`:

```toml
name = "my-mcp-server"
main = "dist/index.js"
compatibility_date = "2025-01-01"

[vars]
NODE_ENV = "production"
```

## Transport

Use Streamable HTTP transport for Cloudflare Workers:

```typescript
defineServer({
  name: 'edge-server',
  transport: { type: 'http' },
  tools: [ /* ... */ ],
});
```

::: warning
stdio and SSE transports are not supported on Cloudflare Workers. Use `http` transport only.
:::

## Build and deploy

```bash
# Build
npx tsc

# Deploy
wrangler deploy
```

## Limitations

- **No filesystem**: Use `MemoryStore` or external storage (KV, D1)
- **No long-running processes**: Each request is a separate invocation
- **No stdio/SSE**: Only HTTP transport works

## Cloudflare KV for storage

```typescript
defineServer({
  storage: { type: 'memory' },  // Per-request only
  // For persistence, use Cloudflare KV directly in tool handlers
  tools: [
    defineTool('save', {
      description: 'Save data',
      params: {
        key: { type: 'string', description: 'Key' },
        value: { type: 'string', description: 'Value' },
      },
      handler: async ({ key, value }, context) => {
        await context.state.kv.put(key, JSON.stringify(value));
        return 'Saved';
      },
    }),
  ],
});
```

Add KV binding to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-namespace-id"
```
