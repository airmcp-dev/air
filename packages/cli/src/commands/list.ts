// air CLI — commands/list.ts
//
// airmcp-dev list
//
// 현재 프로젝트의 MCP 서버에 등록된 도구/리소스/프롬프트 목록을 출력한다.
// 소스 파일을 동적 import해서 defineServer()가 반환한 정보를 읽는다.
//
// @example
//   air list
//   air list --json

import { Command } from 'commander';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { printer } from '../utils/printer.js';

/** 엔트리 파일 탐색 (tsx로 실행하므로 ts 우선) */
async function findEntry(cwd: string): Promise<string> {
  const candidates = ['src/index.ts', 'src/index.js', 'dist/index.js', 'index.ts', 'index.js'];

  for (const candidate of candidates) {
    const full = resolve(cwd, candidate);
    try {
      await access(full);
      return full;
    } catch {
      continue;
    }
  }

  throw new Error('No entry file found. Expected src/index.ts or index.ts');
}

export const listCommand = new Command('list')
  .description('List tools, resources, and prompts in the MCP server')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: { json: boolean }) => {
    const cwd = process.cwd();

    // ── 1. 엔트리 파일 찾기 ──
    let entry: string;
    try {
      entry = await findEntry(cwd);
    } catch (err: any) {
      printer.error(err.message);
      process.exit(1);
    }

    // ── 2. 동적 import로 서버 정의 로드 ──
    let server: any;
    try {
      const mod = await import(entry);
      server = mod.default || mod;
    } catch (err: any) {
      printer.error(`Failed to load server: ${err.message}`);
      printer.info('Make sure the entry file exports a defineServer() result as default.');
      process.exit(1);
    }

    // ── 3. 도구/리소스 정보 추출 ──
    const tools: Array<{ name: string; description?: string }> = [];
    const resources: Array<{ name: string; description?: string }> = [];

    if (typeof server.tools === 'function') {
      const toolList = server.tools();
      for (const t of toolList) {
        tools.push({ name: t.name, description: t.description });
      }
    }

    if (typeof server.resources === 'function') {
      const resList = server.resources();
      for (const r of resList) {
        resources.push({ name: r.name, description: r.description });
      }
    }

    // ── 4. JSON 출력 ──
    if (opts.json) {
      console.log(JSON.stringify({ tools, resources }, null, 2));
      return;
    }

    // ── 5. 사람용 출력 ──
    printer.blank();
    printer.heading(`${server.name || 'MCP Server'}`);

    if (tools.length > 0) {
      printer.info(`Tools (${tools.length}):`);
      printer.blank();
      printer.list(
        tools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      );
    } else {
      printer.info('No tools registered.');
    }

    if (resources.length > 0) {
      printer.blank();
      printer.info(`Resources (${resources.length}):`);
      printer.blank();
      printer.list(
        resources.map((r) => ({
          name: r.name,
          description: r.description,
        })),
      );
    }

    printer.blank();
  });
