#!/usr/bin/env bash
# MCP 공식 conformance 스위트를 픽스처 서버에 대해 실행한다.
# 사용: packages/core 에서 `pnpm conformance` (또는 직접 실행)
# 베이스라인(__tests__/conformance-baseline.yml)에 없는 실패가 생기면 exit 1.
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8

cd "$(dirname "$0")/.."
PORT=19789
OUT_DIR="${CONFORMANCE_OUT:-conformance-results}"

TSX_DISABLE_CACHE=1 npx -y tsx __tests__/conformance-server.ts > /tmp/air-conformance-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
  echo "conformance server failed to start:"; cat /tmp/air-conformance-server.log; exit 1
fi

npx -y @modelcontextprotocol/conformance server \
  --url "http://localhost:${PORT}/mcp" \
  --expected-failures __tests__/conformance-baseline.yml \
  -o "$OUT_DIR"
