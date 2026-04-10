// scripts/build-enterprise.ts
//
// 엔터프라이즈 패키지 (shield, hive) 빌드 스크립트.
// 1. TypeScript → JavaScript 컴파일 (tsc)
// 2. JavaScript → V8 바이트코드 (.jsc) 컴파일 (bytenode)
// 3. .js 소스 제거, .jsc + 로더만 남김
// 4. .npmignore로 src/ 제외
//
// 사용: npx tsx scripts/build-enterprise.ts [shield|hive|all]

import { execSync } from 'node:child_process';
import { readdir, unlink, writeFile, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const ROOT = '/data/ssd/projects/active/air';

async function buildPackage(pkg: string) {
  const pkgDir = join(ROOT, 'packages', pkg);

  console.log(`\n  Building ${pkg}...\n`);

  // 1. TypeScript 컴파일
  console.log('  [1/4] tsc...');
  execSync('npx tsc', { cwd: pkgDir, stdio: 'inherit' });

  // 2. .npmignore 생성 (src/ 제외, dist/만 포함)
  console.log('  [2/4] .npmignore...');
  await writeFile(join(pkgDir, '.npmignore'), [
    'src/',
    '__tests__/',
    'tsconfig.json',
    '*.ts',
    '!*.d.ts',
    'node_modules/',
  ].join('\n'));

  // 3. dist/의 각 .js를 bytenode로 컴파일 (bytenode 설치 필요)
  console.log('  [3/4] bytenode compile...');
  try {
    const distDir = join(pkgDir, 'dist');
    const files = await findJsFiles(distDir);

    for (const file of files) {
      try {
        execSync(`npx bytenode -c "${file}"`, { cwd: pkgDir, stdio: 'pipe' });

        // 원본 .js를 로더로 교체
        const name = basename(file, '.js');
        const dir = join(file, '..');
        const loader = `"use strict";require("bytenode");module.exports=require("${name}.jsc");`;
        await writeFile(file, loader);
      } catch {
        // bytenode 미설치 시 스킵 (개발 환경)
        console.log(`    Skip: ${basename(file)} (bytenode not available)`);
      }
    }

    console.log(`    ${files.length} files processed`);
  } catch {
    console.log('    bytenode not installed — skipping bytecode compilation');
    console.log('    Install: npm i -g bytenode');
  }

  // 4. package.json에 "main": "dist/index.js" 확인
  console.log('  [4/4] verify package.json...');
  const pkgJson = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf-8'));
  if (!pkgJson.main || !pkgJson.main.includes('dist')) {
    console.log('    WARNING: package.json "main" should point to dist/');
  }

  console.log(`\n  ${pkg} build complete.\n`);
}

async function findJsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findJsFiles(full));
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.d.ts')) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

// ── Main ──
const target = process.argv[2] || 'all';
const packages = target === 'all' ? ['shield', 'hive'] : [target];

console.log(`\n  === Enterprise Build ===`);
console.log(`  Packages: ${packages.join(', ')}`);

for (const pkg of packages) {
  await buildPackage(pkg);
}

console.log('  === Done ===\n');
