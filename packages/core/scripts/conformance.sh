#!/usr/bin/env bash
# MCP 공식 conformance 스위트를 픽스처 서버에 대해 실행한다.
# 사용: packages/core 에서 `pnpm conformance` (또는 직접 실행)
# 베이스라인(__tests__/conformance-baseline.yml)에 없는 실패가 생기면 exit 1.
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8

cd "$(dirname "$0")/.."
PORT=19789
OUT_DIR="${CONFORMANCE_OUT:-conformance-results}"

# pnpm이 PATH에 없으면 corepack 경유
if command -v pnpm >/dev/null 2>&1; then PNPM=pnpm; else PNPM="corepack pnpm"; fi

TSX_DISABLE_CACHE=1 $PNPM --package=tsx dlx tsx __tests__/conformance-server.ts > /tmp/air-conformance-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
  echo "conformance server failed to start:"; cat /tmp/air-conformance-server.log; exit 1
fi

# 매 실행마다 새 결과만 판정하도록 비운다
rm -rf "$OUT_DIR"

# 스위트 자체의 exit code는 무시하고(WARNING-only 시나리오 판정이 일관적이지 않음) 결과 JSON을 직접 판정한다
$PNPM --package=@modelcontextprotocol/conformance dlx conformance server \
  --url "http://localhost:${PORT}/mcp" \
  -o "$OUT_DIR" || true

node scripts/conformance-gate.mjs "$OUT_DIR" __tests__/conformance-baseline.yml
