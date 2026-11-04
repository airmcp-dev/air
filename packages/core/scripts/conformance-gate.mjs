#!/usr/bin/env node
// conformance 결과(-o 디렉토리)를 베이스라인과 비교해 exit code를 정한다.
//   - FAILURE 체크가 있는 시나리오 중 베이스라인에 없는 것 → 실패 (exit 1)
//   - WARNING만 있는 시나리오(예: 세션 ID 없음)는 무시 — air는 stateless
//   - 베이스라인에 있는데 통과한 시나리오 → "stale" 안내만 (exit 0)
// 사용: node scripts/conformance-gate.mjs <results-dir> <baseline.yml>

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [resultsDir, baselinePath] = process.argv.slice(2);
if (!resultsDir || !baselinePath) {
  console.error('usage: conformance-gate.mjs <results-dir> <baseline.yml>');
  process.exit(2);
}

// 베이스라인: YAML 전체 파서 대신 "  - name  # comment" 줄만 읽는다
const baseline = new Set(
  readFileSync(baselinePath, 'utf-8')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim()),
);

// 결과 디렉토리명: server-<scenario>-<timestamp>. 같은 시나리오가 여러 번 있으면 가장 최근 것만
const latest = new Map();
if (existsSync(resultsDir)) {
  for (const dir of readdirSync(resultsDir)) {
    const m = dir.match(/^server-(.+)-(\d{4}-\d{2}-\d{2}T[\d-]+Z)$/);
    if (!m) continue;
    const [, scenario, ts] = m;
    if (!latest.has(scenario) || latest.get(scenario).ts < ts) latest.set(scenario, { ts, dir: join(resultsDir, dir) });
  }
}

const failed = [];
const passed = [];
for (const [scenario, { dir }] of latest) {
  const file = join(dir, 'checks.json');
  if (!existsSync(file)) continue;
  const checks = JSON.parse(readFileSync(file, 'utf-8'));
  if (checks.some((c) => c.status === 'FAILURE')) failed.push(scenario);
  else if (checks.some((c) => c.status === 'SUCCESS')) passed.push(scenario);
  // SUCCESS도 FAILURE도 없으면(WARNING만) 판정 대상에서 제외
}

const unexpected = failed.filter((s) => !baseline.has(s));
const expected = failed.filter((s) => baseline.has(s));
const stale = [...baseline].filter((s) => passed.includes(s));

console.log(`\nconformance gate: ${passed.length} passed, ${failed.length} failed (${expected.length} expected)`);
if (expected.length) console.log(`  expected failures: ${expected.join(', ')}`);
if (stale.length) console.log(`  stale baseline entries (now passing — remove them): ${stale.join(', ')}`);
if (unexpected.length) {
  console.log(`  UNEXPECTED failures: ${unexpected.join(', ')}`);
  process.exit(1);
}
console.log('  ok');
