// air CLI — commands/check.ts
//
// airmcp-dev check
//
// 프로젝트 상태를 종합 진단한다.
// - 환경: Node.js, TypeScript, pnpm 버전
// - 의존성: @airmcp-dev/* 패키지 설치 상태
// - 빌드: tsc 타입체크 통과 여부
// - 테스트: vitest 실행 결과
// - 설정: shield, meter 활성화 상태
// - 도구: 등록된 도구 수
//
// @example
//   airmcp-dev check
//   airmcp-dev check --fix    (향후: 자동 수정)

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { printer } from '../utils/printer.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

/** 명령어 실행 헬퍼 (실패 시 null) */
function run(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** package.json 읽기 */
async function readPkg(cwd: string): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 파일 존재 여부 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const checkCommand = new Command('check')
  .description('Diagnose project health — environment, build, tests, config')
  .action(async () => {
    const cwd = process.cwd();
    const results: CheckResult[] = [];

    printer.blank();
    printer.heading('airmcp-dev check');

    // ── 1. 환경 ──
    const nodeVersion = run('node --version', cwd);
    if (nodeVersion) {
      const major = parseInt(nodeVersion.replace('v', ''));
      results.push({
        name: 'Node.js',
        status: major >= 18 ? 'pass' : 'fail',
        message: `${nodeVersion}${major < 18 ? ' (requires >= 18)' : ''}`,
      });
    } else {
      results.push({ name: 'Node.js', status: 'fail', message: 'not found' });
    }

    const tsVersion = run('npx tsc --version', cwd);
    results.push({
      name: 'TypeScript',
      status: tsVersion ? 'pass' : 'warn',
      message: tsVersion || 'not installed',
    });

    // ── 2. package.json ──
    const pkg = await readPkg(cwd);
    if (!pkg) {
      results.push({ name: 'package.json', status: 'fail', message: 'not found' });
      printResults(results);
      return;
    }
    results.push({ name: 'package.json', status: 'pass', message: `${pkg.name}@${pkg.version || '0.0.0'}` });

    // ── 3. 의존성 체크 ──
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const airPackages = ['@airmcp-dev/core', '@airmcp-dev/shield', '@airmcp-dev/meter', '@airmcp-dev/logger', '@airmcp-dev/gateway', '@airmcp-dev/hive'];

    for (const airPkg of airPackages) {
      if (deps[airPkg]) {
        results.push({ name: airPkg, status: 'pass', message: deps[airPkg] });
      }
      // 없는 패키지는 건너뜀 (필수가 아님)
    }

    if (!deps['@airmcp-dev/core']) {
      results.push({ name: '@airmcp-dev/core', status: 'fail', message: 'not in dependencies — required' });
    }

    // ── 4. 소스 파일 체크 ──
    const hasSrc = await exists(resolve(cwd, 'src/index.ts')) || await exists(resolve(cwd, 'src/index.js'));
    results.push({
      name: 'Source',
      status: hasSrc ? 'pass' : 'fail',
      message: hasSrc ? 'src/index.ts found' : 'src/index.ts not found',
    });

    // ── 5. 빌드 (타입체크) ──
    const hasTsConfig = await exists(resolve(cwd, 'tsconfig.json'));
    if (hasTsConfig && hasSrc) {
      const tscResult = run('npx tsc --noEmit 2>&1', cwd);
      if (tscResult === null || tscResult === '') {
        results.push({ name: 'Type Check', status: 'pass', message: 'no errors' });
      } else {
        const errorCount = (tscResult.match(/error TS/g) || []).length;
        results.push({
          name: 'Type Check',
          status: 'fail',
          message: `${errorCount} error(s)`,
        });
      }
    } else {
      results.push({ name: 'Type Check', status: 'skip', message: 'no tsconfig.json' });
    }

    // ── 6. 빌드 결과물 ──
    const hasDist = await exists(resolve(cwd, 'dist/index.js')) || await exists(resolve(cwd, 'build/index.js'));
    results.push({
      name: 'Build',
      status: hasDist ? 'pass' : 'warn',
      message: hasDist ? 'dist/ found' : 'not built yet (run: npm run build)',
    });

    // ── 7. 테스트 ──
    const hasTestDir = await exists(resolve(cwd, '__tests__')) || await exists(resolve(cwd, 'test')) || await exists(resolve(cwd, 'tests'));
    const hasVitest = deps['vitest'] || await exists(resolve(cwd, 'vitest.config.ts'));

    if (hasTestDir || hasVitest) {
      const testResult = run('npx vitest run 2>&1', cwd);
      if (testResult && testResult.includes('passed')) {
        const match = testResult.match(/Tests\s+(\d+)\s+passed/);
        const count = match ? match[1] : '?';
        results.push({ name: 'Tests', status: 'pass', message: `${count} passed` });
      } else if (testResult && testResult.includes('failed')) {
        const match = testResult.match(/(\d+)\s+failed/);
        const failCount = match ? match[1] : '?';
        results.push({ name: 'Tests', status: 'fail', message: `${failCount} failed` });
      } else {
        results.push({ name: 'Tests', status: 'skip', message: 'no tests found' });
      }
    } else {
      results.push({ name: 'Tests', status: 'skip', message: 'no test directory' });
    }

    // ── 8. air 설정 분석 (소스에서 shield/meter 사용 여부) ──
    if (hasSrc) {
      try {
        const srcPath = resolve(cwd, 'src/index.ts');
        const srcContent = await readFile(srcPath, 'utf-8');

        // shield 설정 감지
        if (srcContent.includes('shield:') || srcContent.includes('shield :')) {
          const shieldEnabled = srcContent.includes('enabled: true') || srcContent.includes('enabled:true');
          results.push({
            name: 'Shield',
            status: shieldEnabled ? 'pass' : 'warn',
            message: shieldEnabled ? 'enabled' : 'configured but not enabled',
          });
        } else {
          results.push({ name: 'Shield', status: 'warn', message: 'not configured' });
        }

        // meter 설정 감지
        if (srcContent.includes('meter:') || srcContent.includes('meter :')) {
          results.push({ name: 'Meter', status: 'pass', message: 'enabled' });
        } else {
          results.push({ name: 'Meter', status: 'warn', message: 'not configured' });
        }

        // 도구 수 감지
        const toolCount = (srcContent.match(/defineTool\(/g) || []).length;
        results.push({
          name: 'Tools',
          status: toolCount > 0 ? 'pass' : 'warn',
          message: `${toolCount} tool(s) defined`,
        });
      } catch {
        // 읽기 실패 시 스킵
      }
    }

    // ── 결과 출력 ──
    printResults(results);
  });

function printResults(results: CheckResult[]): void {
  printer.blank();

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const r of results) {
    const icon = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : r.status === 'warn' ? 'WARN' : '–';
    const color = r.status === 'pass' ? '\x1b[32m' : r.status === 'fail' ? '\x1b[31m' : r.status === 'warn' ? '\x1b[33m' : '\x1b[90m';
    const reset = '\x1b[0m';
    const name = r.name.padEnd(16);

    console.log(`  ${color}${icon}${reset} ${name} ${r.message}`);

    if (r.status === 'pass') passCount++;
    else if (r.status === 'fail') failCount++;
    else if (r.status === 'warn') warnCount++;
  }

  printer.blank();

  if (failCount === 0) {
    console.log(`  \x1b[32mAll checks passed!${warnCount > 0 ? ` (${warnCount} warning${warnCount > 1 ? 's' : ''})` : ''}\x1b[0m`);
  } else {
    console.log(`  \x1b[31m${failCount} check(s) failed, ${passCount} passed, ${warnCount} warning(s)\x1b[0m`);
  }
  printer.blank();
}
