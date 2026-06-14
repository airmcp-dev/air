// air CLI — commands/update.ts
//
// 업데이트 체크 + 자동 업데이트
//
// @example
//   air update          # 모든 @airmcp-dev 패키지 업데이트
//   air update --check  # 업데이트 확인만

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { printer } from '../utils/printer.js';

const PACKAGES = [
  '@airmcp-dev/core',
  '@airmcp-dev/logger',
  '@airmcp-dev/meter',
  '@airmcp-dev/gateway',
  '@airmcp-dev/cli',
];

interface VersionInfo {
  name: string;
  current: string | null;
  latest: string;
  updateAvailable: boolean;
}

/** npm registry에서 최신 버전 조회 */
function getLatestVersion(pkg: string): string | null {
  try {
    const result = execSync(`npm view ${pkg} version 2>/dev/null`, { encoding: 'utf-8' }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/** package.json에서 현재 설치된 버전 조회 */
function getInstalledVersion(pkg: string): string | null {
  try {
    const pkgJsonPath = resolve(process.cwd(), 'node_modules', ...pkg.split('/'), 'package.json');
    if (!existsSync(pkgJsonPath)) return null;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return pkgJson.version || null;
  } catch {
    return null;
  }
}

/** 현재 프로젝트의 package.json에서 의존성 버전 범위 조회 */
function getDeclaredVersion(pkg: string): string | null {
  try {
    const pkgJsonPath = resolve(process.cwd(), 'package.json');
    if (!existsSync(pkgJsonPath)) return null;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return pkgJson.dependencies?.[pkg] || pkgJson.devDependencies?.[pkg] || null;
  } catch {
    return null;
  }
}

/** 업데이트 가능한 패키지 확인 */
export async function checkUpdates(): Promise<VersionInfo[]> {
  const results: VersionInfo[] = [];

  for (const pkg of PACKAGES) {
    const current = getInstalledVersion(pkg);
    const latest = getLatestVersion(pkg);
    if (!latest) continue;

    results.push({
      name: pkg,
      current,
      latest,
      updateAvailable: current !== null && current !== latest,
    });
  }

  return results;
}

/** CLI 시작 시 업데이트 알림 (non-blocking) */
export async function notifyUpdateIfAvailable(): Promise<void> {
  try {
    // CLI 자체의 최신 버전만 빠르게 체크
    const latest = getLatestVersion('@airmcp-dev/cli');
    if (!latest) return;

    // 현재 CLI 버전
    const cliPkgPath = resolve(
      new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      '..', '..', 'package.json'
    );
    if (!existsSync(cliPkgPath)) return;
    const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf-8'));
    const current = cliPkg.version;

    if (current !== latest) {
      console.log();
      console.log(chalk.yellow(`  ⚡ air v${latest} 사용 가능`) + chalk.dim(` (현재 v${current})`));
      console.log(chalk.dim(`     npm install -g @airmcp-dev/cli@latest 로 업데이트`));
      console.log();
    }
  } catch {
    // 실패해도 무시 — 사용자 경험 방해 안 함
  }
}

export const updateCommand = new Command('update')
  .description('Update all @airmcp-dev packages to latest')
  .option('-c, --check', 'Check for updates only (no install)')
  .action(async (opts) => {
    printer.heading('air update');

    printer.info('Checking for updates...');
    printer.blank();

    const updates = await checkUpdates();

    if (updates.length === 0) {
      printer.info('No @airmcp-dev packages found in this project.');
      return;
    }

    // 결과 표시
    let hasUpdates = false;
    for (const u of updates) {
      if (!u.current) {
        printer.kv(u.name, chalk.dim('not installed'));
      } else if (u.updateAvailable) {
        printer.kv(u.name, `${chalk.red(u.current)} → ${chalk.green(u.latest)}`);
        hasUpdates = true;
      } else {
        printer.kv(u.name, chalk.green(`${u.current} ✓`));
      }
    }

    printer.blank();

    if (!hasUpdates) {
      printer.success('All packages are up to date!');
      return;
    }

    if (opts.check) {
      printer.info('Run `air update` to install updates.');
      return;
    }

    // 자동 업데이트 실행
    const toUpdate = updates.filter(u => u.updateAvailable && u.current);
    printer.info(`Updating ${toUpdate.length} package(s)...`);
    printer.blank();

    for (const u of toUpdate) {
      const declared = getDeclaredVersion(u.name);
      const installCmd = `npm install ${u.name}@${u.latest}`;

      try {
        printer.step(toUpdate.indexOf(u) + 1, toUpdate.length, `${u.name}@${u.latest}`);
        execSync(installCmd, { stdio: 'pipe', cwd: process.cwd() });
        printer.success(`${u.name} ${u.current} → ${u.latest}`);
      } catch (err: any) {
        printer.error(`${u.name}: ${err.message?.split('\n')[0] || 'update failed'}`);
      }
    }

    printer.blank();
    printer.success('Update complete!');
  });
