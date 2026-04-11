# Architecture

Internal structure and execution flow of air.

## Overall structure

```mermaid
graph TB
    Client[MCP Client<br/>Claude Desktop / Cursor / VS Code]
    Transport[Transport<br/>stdio | SSE | HTTP]
    Server[AirServer<br/>defineServer]
    Chain[Middleware Chain]
    Plugins[Plugin Manager]
    Tools[Tool Registry]
    Resources[Resource Registry]
    Storage[Storage<br/>MemoryStore | FileStore]
    Meter[Meter Middleware<br/>7-Layer Classification]

    Client --> Transport
    Transport --> Server
    Server --> Chain
    Server --> Plugins
    Server --> Tools
    Server --> Resources
    Plugins --> Chain
    Chain --> Tools
    Server --> Storage
    Server --> Meter
```

## Tool call flow

```mermaid
sequenceDiagram
    participant C as Client
    participant T as Transport
    participant V as Validation MW
    participant M as Meter MW
    participant P as Plugin MW
    participant U as User MW
    participant H as Handler
    participant E as Error Boundary

    C->>T: tools/call { name, arguments }
    T->>V: 1. Parameter validation (Zod)
    V->>M: 2. Layer classification + start time
    M->>P: 3. Plugin before (array order)
    P->>U: 4. User before
    U->>H: 5. Handler execution
    H-->>U: return value
    U-->>P: 6. User after
    P-->>M: 7. Plugin after
    M-->>V: 8. Meter record
    V-->>T: 9. normalizeResult → MCP content
    T-->>C: { content: [...] }

    Note over E: On error anywhere
    H--xE: throw Error
    E-->>T: { content: [{ text: "[-32603] ..." }], isError: true }
```

## Middleware chain

Onion model execution:

```
→ errorBoundary.before
  → validation.before (Zod)
    → meter.before (classify)
      → plugin[0].before (timeout)
        → plugin[1].before (retry)
          → plugin[2].before (cache — hit → abort)
            → user[0].before
              → handler()
            ← user[0].after
          ← plugin[2].after (cache — store result)
        ← plugin[1].after
      ← plugin[0].after (timeout — warning check)
    ← meter.after (record call)
  ← validation.after
← errorBoundary.after
```

### before hook return effects

```typescript
return undefined;                    // Continue to next
return { params: { ... } };          // Replace params
return { abort: true, abortResponse: '...' };  // Stop chain, respond immediately
return { meta: { key: 'value' } };   // Add metadata
```

### Error handling flow

```
Handler throws
  → plugin onError middleware (reverse order)
    → return value → convert to normal response
    → return undefined → pass to next
  → user onError middleware
  → errorBoundaryMiddleware (final catch)
    → AirError → MCP error code
    → plain Error → -32603 Internal Error
```

## Plugin lifecycle

```mermaid
graph LR
    R[register] --> V[validatePlugin]
    V --> I[onInit]
    I --> S[onStart]
    S --> TR[onToolRegister<br/>once per tool]
    S --> RUN[Running<br/>middleware active]
    RUN --> ST[onStop]
    ST --> END[Exit]
```

## Transport layer

### Auto-detection (type: 'auto')

```
MCP_TRANSPORT env var?
  ├─ set → use that type
  └─ not set → process.stdin.isTTY?
                 ├─ false (piped) → stdio (client spawned)
                 └─ true (terminal) → http (developer running)
```

## Storage layer

```
createStorage({ type })
  ├─ 'memory' → MemoryStore (Map, lost on restart)
  └─ 'file' → FileStore
        ├─ .air/data/{ns}.json      (key-value)
        ├─ .air/data/{ns}.log.jsonl (append-only)
        ├─ In-memory cache per namespace
        ├─ Dirty tracking
        └─ 5s periodic flush (dirty only)
```

## Gateway architecture

```mermaid
graph TB
    C[Client] --> G[Gateway :4000]
    G --> R[Request Router]
    R --> TI[Tool Index]
    R --> LB[Load Balancer]
    LB --> S1[Server A :3510 SSE]
    LB --> S2[Server B :3511 SSE]
    LB --> S3[Server C stdio]
    HC[Health Checker 15s] --> S1
    HC --> S2
    HC --> S3
```

Routing: client calls tool → Gateway checks Tool Index → Load Balancer selects server → proxy request → return result. Unhealthy servers auto-excluded, auto-restored on recovery.
