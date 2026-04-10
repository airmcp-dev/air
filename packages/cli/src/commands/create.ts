// air CLI — commands/create.ts
//
// air create <name> [--template basic|crud|api|agent] [--lang en|ko]
//
// 새 MCP 서버 프로젝트를 스캐폴딩한다.
// 언어를 선택하면 해당 언어의 템플릿(주석/설명)이 적용된다.
//
// @example
//   npx air create my-tool
//   npx air create my-tool --lang ko
//   npx air create db-server --template crud --lang en

import { Command } from 'commander';
import { cp, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { printer } from '../utils/printer.js';

const TEMPLATES = ['basic', 'crud', 'api', 'agent'] as const;
type TemplateName = (typeof TEMPLATES)[number];

type Lang = 'en' | 'ko';

/** 인터랙티브 언어 선택 */
async function askLanguage(): Promise<Lang> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log();
    console.log('  Select language / 언어를 선택하세요:');
    console.log();
    console.log('    1) English');
    console.log('    2) 한국어');
    console.log();

    rl.question('  > ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === '2' || trimmed.toLowerCase() === 'ko' || trimmed === '한국어') {
        resolve('ko');
      } else {
        resolve('en');
      }
    });
  });
}

/** 언어별 메시지 */
const MESSAGES = {
  en: {
    creating: (name: string) => `Creating MCP server: ${name}`,
    copying: 'Copying template files...',
    configuring: 'Configuring project...',
    done: 'Done!',
    created: (name: string, template: string) =>
      `Project "${name}" created with "${template}" template.`,
    nextSteps: 'Next steps:',
  },
  ko: {
    creating: (name: string) => `MCP 서버 생성: ${name}`,
    copying: '템플릿 파일 복사 중...',
    configuring: '프로젝트 설정 중...',
    done: '완료!',
    created: (name: string, template: string) =>
      `"${name}" 프로젝트가 "${template}" 템플릿으로 생성되었습니다.`,
    nextSteps: '다음 단계:',
  },
};

/** 템플릿 디렉토리 절대 경로 (빌드 후 dist/ 기준) */
function templatesRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return resolve(__dirname, '..', 'templates');
}

export const createCommand = new Command('create')
  .description('Create a new MCP server project')
  .argument('<name>', 'Project name (directory name)')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-l, --lang <lang>', 'Language: en | ko')
  .action(async (name: string, opts: { template: string; lang?: string }) => {
    const template = opts.template as TemplateName;

    // ── 1. 템플릿 유효성 검사 ──
    if (!TEMPLATES.includes(template)) {
      printer.error(`Unknown template "${template}". Available: ${TEMPLATES.join(', ')}`);
      process.exit(1);
    }

    // ── 2. 언어 선택 ──
    let lang: Lang;
    if (opts.lang === 'ko' || opts.lang === 'en') {
      lang = opts.lang;
    } else {
      lang = await askLanguage();
    }

    const msg = MESSAGES[lang];

    // ── 3. 대상 디렉토리 확인 ──
    const targetDir = resolve(process.cwd(), name);
    try {
      await access(targetDir);
      printer.error(`Directory "${name}" already exists.`);
      process.exit(1);
    } catch {
      // 존재하지 않으면 정상
    }

    const totalSteps = 3;
    printer.blank();
    printer.heading(msg.creating(name));

    // ── 4. 언어별 템플릿 디렉토리 결정 ──
    // ko면 basic-ko, en이면 basic
    const templateDirName = lang === 'ko' ? `${template}-ko` : template;
    let templateDir = join(templatesRoot(), templateDirName);

    // 한글 템플릿이 없으면 영어로 폴백
    try {
      await access(templateDir);
    } catch {
      templateDir = join(templatesRoot(), template);
    }

    try {
      await access(templateDir);
    } catch {
      printer.error(`Template "${template}" not found at ${templateDir}`);
      process.exit(1);
    }

    // ── 5. 템플릿 복사 ──
    printer.step(1, totalSteps, msg.copying);
    await cp(templateDir, targetDir, { recursive: true });

    // ── 6. package.json name 교체 ──
    printer.step(2, totalSteps, msg.configuring);
    const pkgPath = join(targetDir, 'package.json');
    try {
      const raw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      pkg.name = name;
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    } catch {
      // package.json이 없는 템플릿이면 스킵
    }

    // ── 7. 완료 안내 ──
    printer.step(3, totalSteps, msg.done);
    printer.blank();
    printer.success(msg.created(name, template));
    printer.blank();
    printer.info(msg.nextSteps);
    printer.blank();
    console.log(`  cd ${name}`);
    console.log('  npm install');
    console.log('  air dev');
    printer.blank();
  });
