// air CLI — commands/inspect.ts
//
// airmcp-dev inspect <tool>
//
// 특정 도구의 상세 스키마를 출력한다.
// - 파라미터 이름, 타입, 설명, 필수 여부
// - JSON 스키마 형태로도 출력 가능 (--json)
//
// @example
//   air inspect hello
//   air inspect search --json

import { Command } from 'commander';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { printer } from '../utils/printer.js';

/** 엔트리 파일 탐색 */
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

/** zod 스키마에서 파라미터 정보를 추출한다 */
function extractParams(schema: any): Array<{
  name: string;
  type: string;
  required: boolean;
  description?: string;
}> {
  const params: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }> = [];

  if (!schema || !schema.shape) return params;

  const shape = schema.shape;
  for (const [key, field] of Object.entries<any>(shape)) {
    let type = 'unknown';
    let required = true;
    let description: string | undefined;

    // zod 타입 추출
    if (field?._def) {
      const typeName = field._def.typeName;
      if (typeName === 'ZodString') type = 'string';
      else if (typeName === 'ZodNumber') type = 'number';
      else if (typeName === 'ZodBoolean') type = 'boolean';
      else if (typeName === 'ZodArray') type = 'array';
      else if (typeName === 'ZodObject') type = 'object';
      else if (typeName === 'ZodEnum') type = `enum(${field._def.values?.join('|')})`;
      else if (typeName === 'ZodOptional') {
        required = false;
        // 내부 타입 확인
        const inner = field._def.innerType?._def?.typeName;
        if (inner === 'ZodString') type = 'string';
        else if (inner === 'ZodNumber') type = 'number';
        else if (inner === 'ZodBoolean') type = 'boolean';
        else type = inner?.replace('Zod', '').toLowerCase() || 'any';
      }

      description = field._def.description || field.description;
    }

    params.push({ name: key, type, required, description });
  }

  return params;
}

export const inspectCommand = new Command('inspect')
  .description("Inspect a tool's schema and parameters")
  .argument('<tool>', 'Tool name to inspect')
  .option('--json', 'Output as JSON schema', false)
  .action(async (toolName: string, opts: { json: boolean }) => {
    const cwd = process.cwd();

    // ── 1. 엔트리 로드 ──
    let entry: string;
    try {
      entry = await findEntry(cwd);
    } catch (err: any) {
      printer.error(err.message);
      process.exit(1);
    }

    let server: any;
    try {
      const mod = await import(entry);
      server = mod.default || mod;
    } catch (err: any) {
      printer.error(`Failed to load server: ${err.message}`);
      process.exit(1);
    }

    // ── 2. 도구 찾기 ──
    if (typeof server.tools !== 'function') {
      printer.error('Server does not expose tools().');
      process.exit(1);
    }

    const tools = server.tools();
    const tool = tools.find((t: any) => t.name === toolName);

    if (!tool) {
      printer.error(`Tool "${toolName}" not found.`);
      printer.blank();
      printer.info('Available tools:');
      printer.blank();
      printer.list(tools.map((t: any) => ({ name: t.name, description: t.description })));
      printer.blank();
      process.exit(1);
    }

    // ── 3. JSON 출력 ──
    if (opts.json) {
      const output: Record<string, any> = {
        name: tool.name,
        description: tool.description,
      };

      // JSON Schema 변환 시도
      if (tool.schema && typeof tool.schema.toJsonSchema === 'function') {
        output.inputSchema = tool.schema.toJsonSchema();
      } else if (tool.jsonSchema) {
        output.inputSchema = tool.jsonSchema;
      } else {
        output.inputSchema = null;
      }

      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // ── 4. 사람용 출력 ──
    printer.blank();
    printer.heading(tool.name);

    if (tool.description) {
      printer.kv('description', tool.description);
    }

    // 파라미터 추출
    const params = extractParams(tool.schema);

    if (params.length > 0) {
      printer.blank();
      printer.info(`Parameters (${params.length}):`);
      printer.blank();

      for (const p of params) {
        const req = p.required ? ' *' : '';
        const desc = p.description ? `  ${p.description}` : '';
        console.log(`  ${p.name}${req}  (${p.type})${desc}`);
      }
    } else {
      printer.blank();
      printer.info('No parameters.');
    }

    printer.blank();
  });
