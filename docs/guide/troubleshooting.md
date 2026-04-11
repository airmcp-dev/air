# Troubleshooting & FAQ

## Connection issues

### Server not showing in Claude Desktop

1. **Register the server:**
   ```bash
   npx @airmcp-dev/cli connect claude-desktop
   ```

2. **Restart Claude Desktop.** Config is read at startup only.

3. **Check config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

   Verify the entry exists and uses **absolute paths**:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "npx",
         "args": ["tsx", "/absolute/path/to/my-server/src/index.ts"]
       }
     }
   }
   ```

4. **For SSE/HTTP, verify server is running:** `curl http://localhost:3510/`

5. **Use absolute paths.** Claude Desktop doesn't run in a shell environment — relative paths won't work.

### Cursor/VS Code connection fails

1. **Register:** `npx @airmcp-dev/cli connect cursor` or `connect vscode`
2. **Restart the IDE.** Required after config changes.
3. **VS Code:** Ensure MCP extension is installed.
4. **Cursor config path:**
   - macOS: `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/config.json`
   - Windows: `%APPDATA%/Cursor/User/globalStorage/cursor.mcp/config.json`

### No logs in stdio mode

Expected. In stdio transport, stdout is reserved for MCP protocol. All logs go to **stderr**.

```bash
node dist/index.js 2>server.log
node dist/index.js 2>&1 | tee server.log
```

::: warning
Using `console.log()` in stdio mode will break the MCP protocol. Use air's built-in logger or `console.error()`.
:::

### SSE connection keeps dropping

Reverse proxies may close long-lived connections:

```nginx
proxy_read_timeout 86400;
proxy_send_timeout 86400;
proxy_buffering off;
proxy_cache off;
proxy_set_header Connection "";
```

Cloudflare may drop SSE after ~100 seconds. Switch to `http` transport in that case.

::: tip
Use `http` transport behind reverse proxies. HTTP request-response is more proxy-friendly.
:::

### "Server not responding" error

1. **Check server status:** `npx @airmcp-dev/cli status`
2. **Check port conflicts:** `lsof -i :3510` (macOS/Linux) or `netstat -ano | findstr :3510` (Windows)
3. **Check firewall.** Local firewalls may block the port.

## Development issues

### Entry file not found with `dev` command

Search order: `src/index.ts` → `src/index.js` → `index.ts` → `index.js`. Run from the project root:

```bash
ls src/index.ts   # Must exist
npx @airmcp-dev/cli dev
```

### Hot reload not working

`dev` watches `src/` for `.ts`, `.js`, `.json` files only.

Checklist:
- Edited file is inside `src/`
- `.env` changes are not detected (restart needed)
- 300ms debounce — wait briefly after save
- WSL: `fs.watch` may not work across filesystem boundaries

### TypeScript compile errors

air requires ESM. In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist"
  }
}
```

In `package.json`: `"type": "module"`

### `Cannot find module` error

ESM requires `.js` extension in imports:

```typescript
// ❌ Error
import { myHelper } from './utils/helper';

// ✅ Works
import { myHelper } from './utils/helper.js';
```

Use `.js` even for TypeScript files. This is a Node.js ESM rule.

### `top-level await` error

`createStorage` needs `await`. Top-level await requires `"module": "NodeNext"` in tsconfig. Or wrap in async IIFE:

```typescript
(async () => {
  const store = await createStorage({ type: 'file' });
  const server = defineServer({ ... });
  server.start();
})();
```

## Plugin issues

### Why does plugin order matter?

`use` array order = middleware execution order. Recommended:

```typescript
use: [
  authPlugin(),          // 1. Auth first (reject early)
  sanitizerPlugin(),     // 2. Sanitize input
  timeoutPlugin(),       // 3. Timeout
  retryPlugin(),         // 4. Retry (within timeout)
  cachePlugin(),         // 5. Cache (check before retry)
  queuePlugin(),         // 6. Concurrency limit
]
```

### cachePlugin not working

1. **Cache key:** Same tool + same params = hit. Any param difference = miss. Param key **sort order** matters too.
2. **`exclude` list:** Check if the tool is excluded.
3. **TTL:** Default 60s. Expired entries return miss.
4. **`maxEntries`:** Default 1000. Excess entries evicted FIFO.

### authPlugin `_auth` parameter not reaching server

MCP protocol strips params not in schema. Define `_auth` in tool params:

```typescript
params: { query: 'string', _auth: { type: 'string', optional: true } }
```

::: info
This is MCP SDK behavior, not an air limitation. `dryrunPlugin`'s `perCall` mode has the same issue.
:::

### retryPlugin not retrying

1. **`retryOn` filter:** Default retries all errors. Custom filters may exclude the error.
2. **`maxRetries`:** Default 3. May have already exhausted retries.
3. **Error must be thrown:** `return { error: '...' }` is a normal response, not retried. Use `throw` for retry.

### circuitBreakerPlugin blocking all tools

Check `perTool` option:
```typescript
circuitBreakerPlugin({ perTool: true })   // Default: independent per tool
circuitBreakerPlugin({ perTool: false })  // Global: one failure affects all
```

## Storage issues

### FileStore data not persisting

FileStore flushes every 5s. Force-killing (`kill -9`) loses last ~5s. Always use:

```typescript
onShutdown(async () => { await store.close(); });
```

### TTL unit confusion

- `cachePlugin({ ttlMs: 60000 })` — **milliseconds**
- `store.set('ns', 'key', value, 3600)` — **seconds**

Rule: option names with `Ms` suffix = milliseconds. Without = seconds.

### MemoryStore data disappears on restart

Expected. `MemoryStore` is ephemeral. Use `FileStore` for persistence:

```typescript
const store = await createStorage({ type: 'file', path: '.air/data' });
```

### FileStore concurrent access

FileStore is single-process only. Multiple processes sharing the same directory causes data corruption. For multi-process, use an external DB (PostgreSQL, Redis, etc.).

## Deploy issues

### FileStore fails on Cloudflare Workers

Workers have no persistent filesystem. Use `MemoryStore` or Cloudflare KV/D1.

### Lambda FileStore initialization error

Lambda's `/tmp` is writable but ephemeral:

```typescript
const store = await createStorage({ type: 'file', path: '/tmp/air-data' });
```

### Docker `.air/data` permission error

```dockerfile
RUN mkdir -p /app/.air/data && chown -R node:node /app/.air
USER node
```

### PM2 keeps restarting

1. **Node.js 18+** required.
2. **ESM:** `"type": "module"` in package.json.
3. **Ecosystem file:**
   ```javascript
   // ecosystem.config.cjs
   module.exports = {
     apps: [{ name: 'mcp', script: 'dist/index.js',
       env: { NODE_ENV: 'production', MCP_TRANSPORT: 'http', PORT: '3510' } }],
   };
   ```

## Performance

### Meter Ring Buffer full?

Max 10,000 records. Oldest auto-evicted. Constant memory. For more history, use `webhookPlugin` or `jsonLoggerPlugin` to stream to external systems.

### Many tools slow?

No impact up to 100+ tools. Tool lookup is `Map` O(1). Chain time scales with middleware count, not tool count.

### Memory keeps growing

1. **cachePlugin `maxEntries`:** Default 1000. Large responses consume memory fast.
2. **dedupPlugin inflight:** Large `windowMs` grows the map. Default 1000ms is fine.
3. **FileStore cache:** Many namespaces = many in-memory caches.

## Gateway issues

### Duplicate tools in Gateway

Expected when multiple servers provide the same tool. Gateway's Tool Index handles routing. For unique tools, use distinct names per server.

### Server stuck in "error" status

Health Checker runs every `healthCheckInterval` (default 15s). Server auto-recovers on next successful check. If not recovering, check server logs.

---

## Other issues

If your problem isn't listed here, please report it on GitHub Issues:

**[github.com/airmcp-dev/air/issues](https://github.com/airmcp-dev/air/issues)**

When filing an issue, please include:

- air version (`npx @airmcp-dev/cli license`)
- Node.js version (`node -v`)
- OS and environment (macOS/Windows/Linux, Docker)
- Transport type (stdio/SSE/HTTP)
- MCP client (Claude Desktop, Cursor, VS Code, etc.)
- Full error message
- Minimal reproduction code
