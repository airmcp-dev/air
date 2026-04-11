# Cloudflare Workers 배포

air MCP 서버를 Cloudflare Workers에 배포하여 엣지에서 실행합니다.

## 사전 요구사항

- Cloudflare 계정
- `wrangler` CLI: `npm install -g wrangler`

## 설정

```bash
# 프로젝트 생성
air create my-edge-server --template basic
cd my-edge-server
```

## 트랜스포트

Cloudflare Workers에서는 Streamable HTTP 트랜스포트를 사용합니다:

```typescript
defineServer({
  name: 'edge-server',
  transport: { type: 'http' },
  tools: [ /* ... */ ],
});
```

::: warning
stdio와 SSE 트랜스포트는 Cloudflare Workers에서 지원되지 않습니다. `http` 트랜스포트만 사용하세요.
:::

## wrangler.toml 생성

```toml
name = "my-mcp-server"
main = "dist/index.js"
compatibility_date = "2025-01-01"

[vars]
NODE_ENV = "production"
```

## 빌드 및 배포

```bash
# TypeScript 컴파일
npx tsc

# Cloudflare에 배포
wrangler deploy
```

## 제한사항

- **파일시스템 없음**: `FileStore` 사용 불가. `MemoryStore` 또는 Cloudflare KV, D1 사용
- **장기 실행 프로세스 없음**: 각 요청이 별도 호출로 처리됨
- **stdio/SSE 불가**: HTTP 트랜스포트만 동작
- **Node.js API 제한**: 일부 Node.js 전용 API (fs, child_process 등) 사용 불가

## Cloudflare KV로 스토리지

요청 간 데이터를 유지하려면 Cloudflare KV를 사용합니다:

```typescript
defineServer({
  storage: { type: 'memory' },  // 요청 단위만 (영속 아님)
  tools: [
    defineTool('save', {
      description: '데이터 저장',
      params: {
        key: { type: 'string', description: '키' },
        value: { type: 'string', description: '값' },
      },
      handler: async ({ key, value }, context) => {
        // Cloudflare KV를 직접 사용
        await context.state.kv.put(key, JSON.stringify(value));
        return '저장 완료';
      },
    }),
  ],
});
```

## wrangler.toml에 KV 바인딩

```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-namespace-id"
```
