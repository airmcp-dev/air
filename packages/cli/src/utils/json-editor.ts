// air CLI — utils/json-editor.ts
//
// JSON 설정 파일을 안전하게 읽기/수정/쓰기.
// 기존 포매팅(들여쓰기, 후행 줄바꿈)을 최대한 보존한다.
// connect/disconnect에서 클라이언트 config.json을 조작할 때 사용.
//
// @example
//   const editor = await JsonEditor.load('~/.config/Claude/claude_desktop_config.json');
//   editor.set('mcpServers.my-tool', { command: 'air', args: ['start'] });
//   editor.delete('mcpServers.old-tool');
//   await editor.save();

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonEditor {
  private data: Record<string, any>;
  private indent: number;
  private trailingNewline: boolean;

  private constructor(
    private readonly filePath: string,
    raw: string,
  ) {
    // 들여쓰기 감지 (2 or 4 스페이스, 기본 2)
    const indentMatch = raw.match(/^(\s+)"/m);
    this.indent = indentMatch ? indentMatch[1].length : 2;

    // 후행 줄바꿈 감지
    this.trailingNewline = raw.endsWith('\n');

    this.data = JSON.parse(raw);
  }

  /**
   * JSON 파일을 로드한다.
   * 파일이 없으면 빈 객체로 시작.
   */
  static async load(filePath: string): Promise<JsonEditor> {
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      raw = '{}';
    }
    return new JsonEditor(filePath, raw);
  }

  /**
   * dot-path로 값을 가져온다.
   *
   * @example editor.get('mcpServers.my-tool')
   */
  get<T = any>(path: string): T | undefined {
    const keys = path.split('.');
    let current: any = this.data;
    for (const key of keys) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current as T;
  }

  /**
   * dot-path로 값을 설정한다.
   * 중간 경로가 없으면 자동 생성.
   *
   * @example editor.set('mcpServers.my-tool', { command: 'air', args: ['start'] })
   */
  set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current: any = this.data;

    for (const key of keys) {
      if (current[key] == null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
  }

  /**
   * dot-path의 값을 삭제한다.
   *
   * @returns 삭제 성공 여부
   */
  delete(path: string): boolean {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current: any = this.data;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') return false;
      current = current[key];
    }

    if (current == null || typeof current !== 'object') return false;
    if (!(lastKey in current)) return false;

    delete current[lastKey];
    return true;
  }

  /**
   * dot-path에 값이 존재하는지 확인.
   */
  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  /**
   * 전체 데이터를 반환한다 (읽기 전용 용도).
   */
  toJSON(): Record<string, any> {
    return structuredClone(this.data);
  }

  /**
   * 파일에 저장한다.
   * 디렉토리가 없으면 자동 생성.
   */
  async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    let content = JSON.stringify(this.data, null, this.indent);
    if (this.trailingNewline) content += '\n';

    await writeFile(this.filePath, content, 'utf-8');
  }
}
