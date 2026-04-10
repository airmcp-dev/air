#!/bin/bash
# scripts/publish.sh
#
# air 프레임워크 npm publish 스크립트
# 1. 빌드
# 2. exports 필드를 dist로 변경
# 3. publish
# 4. exports 필드를 src로 복원

set -e

ROOT="/data/ssd/projects/active/air"
VERSION="0.1.0"

# 오픈소스 패키지 (먼저 publish — 다른 패키지가 의존)
OS_PACKAGES="core logger meter gateway"
# CLI (core 의존)
CLI_PACKAGE="cli"
# 엔터프라이즈 (나중에)
ENT_PACKAGES="shield hive"

echo ""
echo "  === air npm publish v${VERSION} ==="
echo ""

# 1. 전체 빌드
echo "  [1/5] Building all packages..."
for pkg in $OS_PACKAGES $CLI_PACKAGE $ENT_PACKAGES; do
  echo "    Building $pkg..."
  cd "$ROOT/packages/$pkg"
  npx tsc 2>/dev/null || true
done

# CLI 빌드 (templates 포함)
cd "$ROOT/packages/cli"
npx tsc && rm -rf dist/templates && cp -r src/templates dist/templates

echo "  Done."
echo ""

# 2. exports 필드를 dist로 변경
echo "  [2/5] Switching exports to dist..."
for pkg in $OS_PACKAGES $ENT_PACKAGES; do
  f="$ROOT/packages/$pkg/package.json"
  sed -i 's|"./src/index.ts"|"./dist/index.js"|g' "$f"
  echo "    $pkg: exports → dist"
done
echo ""

# 3. 오픈소스 패키지 publish
echo "  [3/5] Publishing open source packages..."
for pkg in $OS_PACKAGES; do
  echo "    Publishing @airmcp-dev/$pkg..."
  cd "$ROOT/packages/$pkg"
  npm publish --access public  2>&1 | tail -3
  echo ""
done

# 4. CLI publish
echo "  [4/5] Publishing CLI (air)..."
cd "$ROOT/packages/cli"
npm publish --access public  2>&1 | tail -3
echo ""

# 5. exports 복원
echo "  [5/5] Restoring exports to src..."
for pkg in $OS_PACKAGES $ENT_PACKAGES; do
  f="$ROOT/packages/$pkg/package.json"
  sed -i 's|"./dist/index.js"|"./src/index.ts"|g' "$f"
  echo "    $pkg: exports → src (restored)"
done
echo ""

echo "  === Publish complete ==="
echo ""
echo "  Published packages:"
echo "    @airmcp-dev/core@0.1.0"
echo "    @airmcp-dev/logger@0.1.0"
echo "    @airmcp-dev/meter@0.1.0"
echo "    @airmcp-dev/gateway@0.1.0"
echo "    air@0.1.0 (CLI)"
echo ""
