#!/usr/bin/env node
// air CLI — 엔트리포인트
//
// 모든 명령어는 commands/ 에서 정의하고 여기서 등록만 한다.
// 로직 없음. 등록 + 실행만.
//
// @example
//   npx @airmcp-dev/cli create my-tool
//   airmcp-dev dev --port 3000
//   airmcp-dev start
//   airmcp-dev connect claude-desktop

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createCommand,
  addCommand,
  devCommand,
  startCommand,
  stopCommand,
  statusCommand,
  listCommand,
  inspectCommand,
  connectCommand,
  disconnectCommand,
  checkCommand,
  licenseCommand,
} from './commands/index.js';

// ── 버전 읽기 ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

// ── 프로그램 정의 ──
const program = new Command();

program
  .name('air')
  .description('Build, run, and manage MCP servers')
  .version(pkg.version, '-v, --version');

// ── 명령어 등록 ──
program.addCommand(createCommand);
program.addCommand(addCommand);
program.addCommand(devCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(listCommand);
program.addCommand(inspectCommand);
program.addCommand(connectCommand);
program.addCommand(disconnectCommand);
program.addCommand(checkCommand);
program.addCommand(licenseCommand);

// ── 기본 동작: 도움말 ──
program.action(() => {
  program.outputHelp();
});

// ── 실행 ──
program.parse();
