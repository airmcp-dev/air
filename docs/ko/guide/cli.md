# CLI 명령어

air CLI(`@airmcp-dev/cli`)는 MCP 서버의 전체 개발 라이프사이클을 위한 12개 명령어를 제공합니다.

## 설치

```bash
# npx로 사용 (설치 불필요)
npx @airmcp-dev/cli <command>

# 전역 설치
npm install -g @airmcp-dev/cli
airmcp-dev <command>
```

::: info
전역 설치 시 명령어 이름은 `airmcp-dev`입니다 (`air`가 아닙니다).
:::

## create

템플릿에서 새 MCP 서버 프로젝트를 생성합니다.

```bash
npx @airmcp-dev/cli create my-server
npx @airmcp-dev/cli create my-server --template api
npx @airmcp-dev/cli create my-server --template crud --lang ko
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `--template <n>` | `basic` | 템플릿: `basic`, `api`, `crud`, `agent` |
| `--lang <code>` | (인터랙티브) | 주석 언어: `en`, `ko` |

`--lang`을 생략하면 인터랙티브 프롬프트로 언어를 선택합니다. 자세한 내용은 [템플릿](/ko/guide/templates)을 참고하세요.

## add

기존 프로젝트에 도구, 리소스, 프롬프트 스캐폴드를 추가합니다.

```bash
npx @airmcp-dev/cli add tool search
npx @airmcp-dev/cli add resource config
npx @airmcp-dev/cli add prompt summarize
```

## dev

개발 모드로 서버를 실행합니다. 핫 리로드와 테스트 콘솔을 지원합니다.

```bash
npx @airmcp-dev/cli dev
npx @airmcp-dev/cli dev -p 3510
npx @airmcp-dev/cli dev --console -p 3510
npx @airmcp-dev/cli dev --transport sse -p 3510
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `-p, --port <n>` | `3000` | HTTP/SSE 포트 |
| `-t, --transport <type>` | `stdio` | 트랜스포트: `stdio`, `http`, `sse` |
| `-c, --console` | `false` | 브라우저 테스트 콘솔 열기 |

### 내부 동작

1. **엔트리 파일 탐색**: `src/index.ts` → `src/index.js` → `index.ts` → `index.js` 순서로 찾음
2. **tsx로 실행**: TypeScript 파일을 빌드 없이 직접 실행 (`npx tsx`)
3. **파일 감시**: `src/` 디렉토리의 `.ts`, `.js`, `.json` 파일 변경 시 300ms 디바운스 후 자동 재시작
4. **콘솔 모드**: `--console` 사용 시 `stdio`가 자동으로 `sse`로 전환됨

환경 변수가 자동 설정됩니다:
- `NODE_ENV=development`
- `AIR_TRANSPORT=<transport>`
- `AIR_PORT=<port>`

## start

프로덕션 모드로 서버를 시작합니다 (백그라운드 프로세스).

```bash
npx @airmcp-dev/cli start
npx @airmcp-dev/cli start --port 3510
```

## stop

실행 중인 서버를 중지합니다.

```bash
npx @airmcp-dev/cli stop
```

## status

서버 상태를 표시합니다 (실행/중지, PID, 가동시간, 도구 수).

```bash
npx @airmcp-dev/cli status
```

## list

등록된 도구, 리소스, 프롬프트를 나열합니다.

```bash
npx @airmcp-dev/cli list
npx @airmcp-dev/cli list --tools
npx @airmcp-dev/cli list --resources
```

## inspect

도구의 JSON 스키마와 메타데이터를 표시합니다.

```bash
npx @airmcp-dev/cli inspect search
```

## connect

MCP 클라이언트의 설정 파일에 서버를 자동 등록합니다. 자세한 내용은 [클라이언트 연결](/ko/guide/connect)을 참고하세요.

```bash
npx @airmcp-dev/cli connect claude-desktop
npx @airmcp-dev/cli connect cursor --name my-tool
npx @airmcp-dev/cli connect vscode --transport http --port 3510
```

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `-n, --name <n>` | package.json의 name | 클라이언트 설정에 등록할 서버 이름 |
| `-t, --transport <type>` | `stdio` | 트랜스포트: `stdio`, `http`, `sse` |
| `-p, --port <port>` | `3000` | HTTP/SSE 포트 |
| `-H, --host <host>` | `localhost` | 원격 서버 호스트 |
| `--proxy <path>` | — | mcp-proxy.js 경로 (stdio→SSE 브릿지) |
| `-g, --gateway <url...>` | — | 이 서버 대신 `air bridge`를 이 게이트웨이(들)로 등록 (v0.3.0+) |
| `--gateway-token <token>` | — | 게이트웨이 Bearer 토큰 |

## bridge

모든 요청을 air 게이트웨이로 전달하는 stdio MCP 서버를 띄웁니다. 게이트웨이를 여러 개 주면 현재 것이 죽었을 때 다음으로 넘어가고, 우선순위가 높은 것이 복구되면 되돌아갑니다. 서버 주소를 하나만 받는 클라이언트(Claude Desktop, Cursor)에 nginx나 VIP 없이 게이트웨이 HA를 붙이는 방법입니다.

```bash
npx @airmcp-dev/cli bridge --gateway http://gw1:4000 --gateway http://gw2:4000 --token $TOKEN
npx @airmcp-dev/cli connect claude-desktop --gateway http://gw1:4000 --gateway http://gw2:4000
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `-g, --gateway <url...>` | 필수 | 게이트웨이 베이스 URL (페일오버 순서) |
| `--token <token>` | — | 게이트웨이에 보낼 Bearer 토큰 |
| `--timeout <ms>` | `60000` | 요청당 타임아웃 |
| `--failback-probe <ms>` | `10000` | 우선순위 높은 게이트웨이 복구 확인 주기 |

`tools/call`은 스트리밍되어 progress/log 알림과 elicitation 요청이 클라이언트까지 가고, 클라이언트의 답은 게이트웨이로 되돌아갑니다. 페일오버 시 클라이언트의 `initialize`를 새 게이트웨이에 다시 보내고, 아직 아무것도 못 받은 요청은 한 번 재시도합니다. 로그는 stderr로, stdout엔 MCP 메시지만 나갑니다.

## disconnect

MCP 클라이언트에서 서버 등록을 해제합니다.

```bash
npx @airmcp-dev/cli disconnect claude-desktop
```

## check

프로젝트 상태를 진단합니다 — 설정, 의존성, 빌드 상태 확인.

```bash
npx @airmcp-dev/cli check
```

## license

설치된 air 패키지의 라이선스 정보를 표시합니다.

```bash
npx @airmcp-dev/cli license
```
