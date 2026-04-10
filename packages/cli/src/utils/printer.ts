// air CLI — utils/printer.ts
//
// 터미널 출력 헬퍼.
// chalk 기반 색상 + 아이콘으로 일관된 CLI 경험 제공.
//
// @example
//   printer.success('Server started on port 3000');
//   printer.error('Failed to load config');
//   printer.info('Watching for changes...');
//   printer.step(1, 4, 'Installing dependencies');
//   printer.banner();

import chalk from 'chalk';

export const printer = {
  /** 성공 메시지 */
  success(msg: string): void {
    console.log(chalk.green('  [OK]'), msg);
  },

  /** 에러 메시지 */
  error(msg: string): void {
    console.error(chalk.red('  [ERR]'), msg);
  },

  /** 경고 메시지 */
  warn(msg: string): void {
    console.log(chalk.yellow('  [WARN]'), msg);
  },

  /** 정보 메시지 (ℹ 파랑) */
  info(msg: string): void {
    console.log(chalk.blue('  ℹ'), msg);
  },

  /** 단계 표시 (1/4 등) */
  step(current: number, total: number, msg: string): void {
    const label = chalk.dim(`[${current}/${total}]`);
    console.log(`  ${label} ${msg}`);
  },

  /** 빈 줄 */
  blank(): void {
    console.log();
  },

  /** 제목 (굵은 글씨) */
  heading(msg: string): void {
    console.log(chalk.bold(`\n  ${msg}\n`));
  },

  /** 키-값 출력 (상태 표시 등) */
  kv(key: string, value: string): void {
    console.log(`  ${chalk.dim(key + ':')} ${value}`);
  },

  /** 테이블 형태 목록 (도구 목록 등) */
  list(items: Array<{ name: string; description?: string }>): void {
    const maxLen = Math.max(...items.map((i) => i.name.length));
    for (const item of items) {
      const name = chalk.cyan(item.name.padEnd(maxLen + 2));
      const desc = item.description ? chalk.dim(item.description) : '';
      console.log(`  ${name}${desc}`);
    }
  },

  /** air 배너 (초기 출력용) */
  banner(version: string): void {
    console.log();
    console.log(chalk.bold('  air'), chalk.dim(`v${version}`));
    console.log(chalk.dim('  Build, run, and manage MCP servers'));
    console.log();
  },
};
