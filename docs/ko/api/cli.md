# @airmcp-dev/cli

MCP 서버를 빌드, 실행, 관리하기 위한 CLI.

## 설치

```bash
npm install -g @airmcp-dev/cli
# 또는 npx
npx @airmcp-dev/cli <command>
```

전역 명령어 이름: `airmcp-dev`

## 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `create <name>` | 템플릿에서 새 프로젝트 생성 |
| `add <type> <name>` | 도구/리소스/프롬프트 스캐폴드 추가 |
| `dev` | 핫 리로드 개발 모드 |
| `start` | 프로덕션 모드 (백그라운드) |
| `stop` | 서버 중지 |
| `status` | 서버 상태 표시 |
| `list` | 등록된 도구/리소스/프롬프트 나열 |
| `inspect <tool>` | 도구 JSON 스키마 표시 |
| `connect <client>` | MCP 클라이언트에 서버 등록 |
| `disconnect <client>` | 클라이언트에서 등록 해제 |
| `check` | 프로젝트 상태 진단 |
| `license` | 라이선스 정보 표시 |

## create

```bash
airmcp-dev create <project-name> [options]
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `--template <name>` | `basic` | `basic`, `api`, `crud`, `agent` |
| `--lang <code>` | (인터랙티브) | `en`, `ko` |

→ [템플릿 가이드](/ko/guide/templates)

## dev

```bash
airmcp-dev dev [options]
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `-p, --port <n>` | `3000` | HTTP/SSE 포트 |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-c, --console` | `false` | 브라우저 테스트 콘솔 |

내부 동작:
- 엔트리 탐색: `src/index.ts` → `src/index.js` → `index.ts` → `index.js`
- `npx tsx`로 직접 실행 (빌드 불필요)
- `src/` 디렉토리의 `.ts`, `.js`, `.json` 변경 시 300ms 디바운스 후 재시작
- `--console` 시 transport가 자동으로 `sse`로 전환
- 환경 변수: `NODE_ENV=development`, `AIR_TRANSPORT`, `AIR_PORT`

→ [CLI 명령어 가이드](/ko/guide/cli)

## connect

```bash
airmcp-dev connect <client> [options]
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `-n, --name <name>` | package.json name | 클라이언트에 등록할 서버 이름 |
| `-t, --transport <type>` | `stdio` | `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE 포트 |
| `-H, --host <host>` | `localhost` | 원격 서버 호스트 |
| `--proxy <path>` | — | mcp-proxy.js 경로 |

지원 클라이언트:

| ID | 클라이언트 |
|----|----------|
| `claude-desktop` | Claude Desktop |
| `claude-code` | Claude Code |
| `cursor` | Cursor |
| `vscode` | VS Code |
| `chatgpt` | ChatGPT Desktop |
| `ollama` | Ollama |
| `vllm` | vLLM |
| `lm-studio` | LM Studio |

→ [클라이언트 연결 가이드](/ko/guide/connect)
