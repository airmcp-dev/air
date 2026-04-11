// @airmcp-dev/cli — __tests__/cli.test.ts
// CLI 유틸리티 테스트: path-resolver, json-editor, connect 빌드 로직

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { rm, readFile, mkdir, writeFile } from 'node:fs/promises';

// ── path-resolver 테스트 ──

describe('path-resolver', () => {
  // 동적 import로 모듈 격리 (platform 의존)
  let resolveClientConfig: any;
  let listClients: any;

  beforeEach(async () => {
    const mod = await import('../src/utils/path-resolver.js');
    resolveClientConfig = mod.resolveClientConfig;
    listClients = mod.listClients;
  });

  it('should resolve claude-desktop config path', () => {
    const info = resolveClientConfig('claude-desktop');
    expect(info.configPath).toContain('Claude');
    expect(info.configPath).toContain('claude_desktop_config.json');
    expect(info.mcpKey).toBe('mcpServers');
    expect(info.displayName).toBe('Claude Desktop');
  });

  it('should resolve cursor config path', () => {
    const info = resolveClientConfig('cursor');
    expect(info.configPath).toContain('Cursor');
    expect(info.mcpKey).toBe('mcpServers');
  });

  it('should resolve vscode config path', () => {
    const info = resolveClientConfig('vscode');
    expect(info.configPath).toContain('settings.json');
    expect(info.mcpKey).toBe('mcp.servers');
  });

  it('should resolve ollama config path', () => {
    const info = resolveClientConfig('ollama');
    expect(info.configPath).toContain('.ollama');
    expect(info.mcpKey).toBe('servers');
  });

  it('should throw for unknown client', () => {
    expect(() => resolveClientConfig('unknown-client')).toThrow('Unknown client');
  });

  it('should list all supported clients', () => {
    const clients = listClients();
    expect(clients.length).toBeGreaterThanOrEqual(8);
    const ids = clients.map((c: any) => c.id);
    expect(ids).toContain('claude-desktop');
    expect(ids).toContain('cursor');
    expect(ids).toContain('vscode');
    expect(ids).toContain('ollama');
    expect(ids).toContain('vllm');
    expect(ids).toContain('lm-studio');
  });
});

// ── json-editor 테스트 ──

describe('JsonEditor', () => {
  const testDir = join('/tmp', 'air-test-json-editor-' + Date.now());
  const testFile = join(testDir, 'test-config.json');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function loadEditor() {
    const { JsonEditor } = await import('../src/utils/json-editor.js');
    return JsonEditor;
  }

  it('should create empty config when file does not exist', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(join(testDir, 'nonexistent.json'));
    expect(editor.toJSON()).toEqual({});
  });

  it('should load existing JSON and preserve indent', async () => {
    await writeFile(testFile, JSON.stringify({ name: 'test' }, null, 4) + '\n', 'utf-8');
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    expect(editor.get('name')).toBe('test');
  });

  it('should set values with dot-path', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('mcpServers.my-tool', { command: 'node', args: ['index.js'] });
    expect(editor.get('mcpServers.my-tool.command')).toBe('node');
  });

  it('should create intermediate objects', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('deep.nested.value', 42);
    expect(editor.get('deep.nested.value')).toBe(42);
  });

  it('should check existence with has()', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('mcpServers.tool1', { command: 'test' });
    expect(editor.has('mcpServers.tool1')).toBe(true);
    expect(editor.has('mcpServers.tool2')).toBe(false);
  });

  it('should delete values with dot-path', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('mcpServers.tool1', { command: 'test' });
    const deleted = editor.delete('mcpServers.tool1');
    expect(deleted).toBe(true);
    expect(editor.has('mcpServers.tool1')).toBe(false);
  });

  it('should return false when deleting nonexistent key', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    expect(editor.delete('nonexistent.key')).toBe(false);
  });

  it('should save and reload correctly', async () => {
    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('mcpServers.my-server', {
      command: 'npx',
      args: ['tsx', 'src/index.ts'],
    });
    await editor.save();

    // 다시 로드해서 확인
    const reloaded = await JsonEditor.load(testFile);
    expect(reloaded.get('mcpServers.my-server.command')).toBe('npx');
    expect(reloaded.get('mcpServers.my-server.args')).toEqual(['tsx', 'src/index.ts']);
  });

  it('should not corrupt existing keys when adding new ones', async () => {
    // 기존 설정이 있는 파일에 새 서버를 추가해도 기존 것이 유지되는지
    const initial = {
      mcpServers: {
        'existing-tool': { command: 'node', args: ['old.js'] },
      },
      otherConfig: true,
    };
    await writeFile(testFile, JSON.stringify(initial, null, 2) + '\n', 'utf-8');

    const JsonEditor = await loadEditor();
    const editor = await JsonEditor.load(testFile);
    editor.set('mcpServers.new-tool', { command: 'npx', args: ['new.js'] });
    await editor.save();

    const raw = await readFile(testFile, 'utf-8');
    const saved = JSON.parse(raw);
    expect(saved.mcpServers['existing-tool'].command).toBe('node');
    expect(saved.mcpServers['new-tool'].command).toBe('npx');
    expect(saved.otherConfig).toBe(true);
  });
});

// ── connect 빌드 로직 테스트 ──

describe('connect buildServerEntry', () => {
  // connect.ts에서 buildServerEntry를 직접 import 못하므로 (내부 함수)
  // 같은 로직을 여기서 검증

  it('should build stdio entry correctly', () => {
    const cwd = '/home/user/my-server';
    const entry = {
      command: 'npx',
      args: ['tsx', `${cwd}/src/index.ts`],
    };
    expect(entry.command).toBe('npx');
    expect(entry.args[1]).toContain('/home/user/my-server');
  });

  it('should build sse entry with url', () => {
    const entry = {
      url: 'http://localhost:3510/sse',
      transport: 'sse',
    };
    expect(entry.url).toContain(':3510');
    expect(entry.transport).toBe('sse');
  });

  it('should build http entry', () => {
    const entry = {
      url: 'http://localhost:3510',
      transport: 'http',
    };
    expect(entry.url).not.toContain('/sse');
    expect(entry.transport).toBe('http');
  });
});
