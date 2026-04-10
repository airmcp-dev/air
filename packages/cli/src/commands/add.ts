// air CLI — commands/add.ts
//
// airmcp-dev add <type> <name>
//
// 현재 프로젝트의 src/index.ts에 도구/리소스/프롬프트 scaffold를 추가한다.
// VS Code 스니펫과 달리 에디터에 종속되지 않는다.
//
// @example
//   airmcp-dev add tool search
//   airmcp-dev add tool search --params "query:string,limit:number"
//   airmcp-dev add resource config
//   airmcp-dev add prompt summarize

import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { printer } from '../utils/printer.js';

type AddType = 'tool' | 'resource' | 'prompt';

/** 도구 scaffold 생성 */
function toolScaffold(name: string, paramsStr?: string): string {
  let paramsBlock = `      // TODO: 파라미터를 정의하세요\n      input: { type: 'string', description: '입력값' },`;
  let destructure = 'input';

  if (paramsStr) {
    const pairs = paramsStr.split(',').map((p) => p.trim());
    const lines: string[] = [];
    const names: string[] = [];

    for (const pair of pairs) {
      const [pName, pType = 'string'] = pair.split(':').map((s) => s.trim());
      lines.push(`      ${pName}: { type: '${pType}', description: '${pName}' },`);
      names.push(pName);
    }

    paramsBlock = lines.join('\n');
    destructure = names.join(', ');
  }

  return `
    defineTool('${name}', {
      description: '${name} 도구',
      params: {
${paramsBlock}
      },
      handler: async ({ ${destructure} }) => {
        // TODO: 구현하세요
        return \`${name} 결과: \${${destructure.split(',')[0].trim()}}\`;
      },
    }),`;
}

/** 리소스 scaffold 생성 */
function resourceScaffold(name: string): string {
  return `
    defineResource({
      name: '${name}',
      uri: 'file:///${name}',
      description: '${name} 리소스',
      handler: async (uri, ctx) => {
        // TODO: 구현하세요
        return '${name} 데이터';
      },
    }),`;
}

/** 프롬프트 scaffold 생성 */
function promptScaffold(name: string): string {
  return `
    definePrompt({
      name: '${name}',
      description: '${name} 프롬프트',
      args: [
        { name: 'input', description: '입력 텍스트' },
      ],
      handler: async ({ input }) => [
        { role: 'user', content: \`\${input}\` },
      ],
    }),`;
}

/** src/index.ts에서 tools/resources/prompts 배열 끝에 삽입 */
async function insertIntoSource(
  cwd: string,
  type: AddType,
  scaffold: string,
): Promise<boolean> {
  const srcPath = resolve(cwd, 'src/index.ts');
  let src: string;

  try {
    src = await readFile(srcPath, 'utf-8');
  } catch {
    printer.error('src/index.ts not found. Run this command in an air project directory.');
    return false;
  }

  // 삽입 위치: tools: [...], resources: [...], prompts: [...]
  const sectionMap: Record<AddType, string> = {
    tool: 'tools',
    resource: 'resources',
    prompt: 'prompts',
  };

  const section = sectionMap[type];

  // import 추가 (필요한 경우)
  const importMap: Record<AddType, string> = {
    tool: 'defineTool',
    resource: 'defineResource',
    prompt: 'definePrompt',
  };

  const importName = importMap[type];
  if (!src.includes(importName)) {
    // 기존 import에 추가
    src = src.replace(
      /import\s*{([^}]+)}\s*from\s*'@air\/core'/,
      (match, imports) => {
        const existing = imports.trim();
        return `import { ${existing}, ${importName} } from '@airmcp-dev/core'`;
      },
    );
  }

  // 섹션이 있으면 마지막 요소 뒤에 삽입
  const sectionRegex = new RegExp(`${section}:\\s*\\[`);
  if (sectionRegex.test(src)) {
    // 마지막 ],  앞에 삽입
    // 해당 배열의 마지막 닫는 ] 를 찾아서 그 앞에 삽입
    const idx = src.indexOf(`${section}: [`);
    if (idx === -1) {
      printer.error(`Could not find "${section}: [" in src/index.ts.`);
      return false;
    }

    // 배열 끝 찾기 — 간단하게 마지막 ], 앞에 삽입
    let bracketCount = 0;
    let insertPos = -1;
    for (let i = idx + section.length + 3; i < src.length; i++) {
      if (src[i] === '[') bracketCount++;
      if (src[i] === ']') {
        if (bracketCount === 0) {
          insertPos = i;
          break;
        }
        bracketCount--;
      }
    }

    if (insertPos === -1) {
      printer.error(`Could not find closing bracket for "${section}" array.`);
      return false;
    }

    src = src.slice(0, insertPos) + scaffold + '\n  ' + src.slice(insertPos);
  } else {
    // 섹션이 없으면 tools 뒤에 새 섹션 추가
    const toolsEnd = src.indexOf('tools: [');
    if (toolsEnd === -1) {
      printer.error('Could not find "tools: [" in src/index.ts. Is this an air project?');
      return false;
    }

    // defineServer 닫는 }) 앞에 새 섹션 추가
    const closingIdx = src.lastIndexOf('});');
    if (closingIdx === -1) {
      printer.error('Could not find defineServer closing bracket.');
      return false;
    }

    const newSection = `\n  ${section}: [${scaffold}\n  ],\n`;
    src = src.slice(0, closingIdx) + newSection + src.slice(closingIdx);
  }

  await writeFile(srcPath, src, 'utf-8');
  return true;
}

export const addCommand = new Command('add')
  .description('Add a tool, resource, or prompt scaffold to the project')
  .argument('<type>', 'What to add: tool | resource | prompt')
  .argument('<name>', 'Name of the tool/resource/prompt')
  .option('--params <params>', 'Parameters for tool (e.g. "query:string,limit:number")')
  .action(async (type: string, name: string, opts: { params?: string }) => {
    const validTypes: AddType[] = ['tool', 'resource', 'prompt'];
    if (!validTypes.includes(type as AddType)) {
      printer.error(`Invalid type "${type}". Use: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    const cwd = process.cwd();
    let scaffold: string;

    switch (type as AddType) {
      case 'tool':
        scaffold = toolScaffold(name, opts.params);
        break;
      case 'resource':
        scaffold = resourceScaffold(name);
        break;
      case 'prompt':
        scaffold = promptScaffold(name);
        break;
      default:
        process.exit(1);
    }

    printer.blank();
    printer.step(1, 2, `Generating ${type} scaffold: "${name}"...`);

    const success = await insertIntoSource(cwd, type as AddType, scaffold);
    if (!success) process.exit(1);

    printer.step(2, 2, 'Done!');
    printer.blank();
    printer.success(`Added ${type} "${name}" to src/index.ts`);
    printer.blank();
    printer.info('Open src/index.ts and fill in the handler logic.');
    printer.blank();
  });
