#!/bin/bash
# air MCP 적합성 테스트 실행 스크립트
# 사용법: ./run-conformance.sh [spec-version]
# 예: ./run-conformance.sh 2025-11-25
#     ./run-conformance.sh draft

set -e

SPEC_VERSION="${1:-draft}"
PORT=19789
SERVER_PID=""

echo "╔═══════════════════════════════════════════╗"
echo "║  air MCP Conformance Test                  ║"
echo "║  spec-version: $SPEC_VERSION              ║"
echo "╚═══════════════════════════════════════════╝"

# 적합성 테스트 서버 시작
echo "[1/3] Starting conformance server on port $PORT..."
cd "$(dirname "$0")"

# 기존 포트 점유 프로세스 정리
kill $(lsof -t -i:$PORT) 2>/dev/null || true
sleep 1

npx tsx __tests__/conformance-server.ts &
SERVER_PID=$!

# 서버 준비 대기
sleep 3

# 서버가 살아있는지 확인
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ Server failed to start"
  exit 1
fi

echo "[2/3] Running conformance tests..."
echo ""

# 적합성 테스트 실행
npx @modelcontextprotocol/conformance server \
  --url "http://localhost:$PORT/mcp" \
  --spec-version "$SPEC_VERSION" \
  -o "./conformance-results" || true

echo ""
echo "[3/3] Cleaning up..."

# 서버 종료
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results saved to ./conformance-results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
