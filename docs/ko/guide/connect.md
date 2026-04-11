# 클라이언트 연결

`air connect` 명령어는 MCP 서버를 AI 클라이언트에 자동 등록합니다.

## 지원 클라이언트

| 클라이언트 | ID | 설정 파일 경로 (macOS) |
|-----------|-----|----------------------|
| Claude Desktop | `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `claude-code` | `~/Library/Application Support/claude-code/config.json` |
| Cursor | `cursor` | `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/config.json` |
| VS Code | `vscode` | `~/Library/Application Support/Code/User/settings.json` |
| ChatGPT Desktop | `chatgpt` | `~/Library/Application Support/ChatGPT/mcp_config.json` |
| Ollama | `ollama` | `~/.ollama/mcp.json` |
| vLLM | `vllm` | `~/.vllm/mcp.json` |
| LM Studio | `lm-studio` | `~/Library/Application Support/LM Studio/mcp.json` |

Windows에서는 `~/Library/Application Support` 대신 `%APPDATA%`, Linux에서는 `~/.config`가 사용됩니다.

## 기본 사용법

```bash
# Claude Desktop에 등록 (stdio 기본)
npx @airmcp-dev/cli connect claude-desktop

# 서버 이름 지정
npx @airmcp-dev/cli connect cursor --name my-db-tool

# SSE 트랜스포트로 등록
npx @airmcp-dev/cli connect vscode --transport sse --port 3510

# HTTP 트랜스포트로 등록
npx @airmcp-dev/cli connect claude-desktop --transport http --port 3510

# 원격 서버
npx @airmcp-dev/cli connect cursor --transport http --host mcp.example.com --port 443
```

## connect 옵션

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `-n, --name <n>` | package.json의 name | 클라이언트에 등록할 서버 이름 |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE 포트 |
| `-H, --host <host>` | `localhost` | 원격 서버 호스트 |
| `--proxy <path>` | — | mcp-proxy.js 경로 |

## 등록되는 설정 형식

### stdio (기본)

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

클라이언트가 서버를 자식 프로세스로 직접 실행합니다. 별도로 서버를 시작할 필요 없습니다.

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

서버를 별도로 실행해야 합니다: `npx @airmcp-dev/cli start --transport sse --port 3510`

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

`--proxy` 옵션으로 stdio↔SSE 브릿지를 설정합니다:

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

## 연결 해제

```bash
npx @airmcp-dev/cli disconnect claude-desktop
npx @airmcp-dev/cli disconnect cursor
```

## 이미 등록된 경우

같은 이름으로 이미 등록되어 있으면 덮어쓰기 경고가 표시됩니다:

```
⚠ "my-server" already registered — overwriting.
```

## 수동 설정

`connect` 명령이 지원하지 않는 클라이언트는 설정 파일을 직접 편집합니다. 형식은 위의 stdio/SSE/HTTP 예제를 참고하세요.
