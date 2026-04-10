// air CLI — utils/path-resolver.ts
//
// OS별 MCP 클라이언트 설정 파일 경로를 해석한다.
// connect/disconnect 명령에서 사용.
//
// 지원 클라이언트:
//   claude-desktop, claude-code, cursor, vscode,
//   chatgpt, ollama, vllm, lm-studio, custom
//
// @example
//   const configPath = resolveClientConfig('claude-desktop');
//   // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
//   // Windows: %APPDATA%/Claude/claude_desktop_config.json
//   // Linux: ~/.config/Claude/claude_desktop_config.json

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export type SupportedClient =
  | 'claude-desktop'
  | 'claude-code'
  | 'cursor'
  | 'vscode'
  | 'chatgpt'
  | 'ollama'
  | 'vllm'
  | 'lm-studio'
  | 'custom';

export interface ClientPathInfo {
  /** 설정 파일 절대 경로 */
  configPath: string;
  /** MCP 서버 등록 키 (JSON 내부 위치) */
  mcpKey: string;
  /** 클라이언트 표시 이름 */
  displayName: string;
}

/** 홈 디렉토리 기준 OS별 config 루트 */
function configRoot(): string {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') return join(home, 'Library', 'Application Support');
  if (os === 'win32') return process.env.APPDATA || join(home, 'AppData', 'Roaming');
  // linux, freebsd 등
  return process.env.XDG_CONFIG_HOME || join(home, '.config');
}

/** 클라이언트별 설정 경로 매핑 */
const CLIENT_PATHS: Record<string, (root: string) => ClientPathInfo> = {
  'claude-desktop': (root) => ({
    configPath: join(root, 'Claude', 'claude_desktop_config.json'),
    mcpKey: 'mcpServers',
    displayName: 'Claude Desktop',
  }),

  'claude-code': (root) => ({
    configPath: join(root, 'claude-code', 'config.json'),
    mcpKey: 'mcpServers',
    displayName: 'Claude Code',
  }),

  cursor: (root) => ({
    configPath: join(root, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'config.json'),
    mcpKey: 'mcpServers',
    displayName: 'Cursor',
  }),

  vscode: (root) => ({
    configPath: join(root, 'Code', 'User', 'settings.json'),
    mcpKey: 'mcp.servers',
    displayName: 'VS Code',
  }),

  chatgpt: (root) => ({
    configPath: join(root, 'ChatGPT', 'mcp_config.json'),
    mcpKey: 'mcpServers',
    displayName: 'ChatGPT Desktop',
  }),

  ollama: (_root) => ({
    configPath: join(homedir(), '.ollama', 'mcp.json'),
    mcpKey: 'servers',
    displayName: 'Ollama',
  }),

  vllm: (_root) => ({
    configPath: join(homedir(), '.vllm', 'mcp.json'),
    mcpKey: 'servers',
    displayName: 'vLLM',
  }),

  'lm-studio': (root) => ({
    configPath: join(root, 'LM Studio', 'mcp.json'),
    mcpKey: 'servers',
    displayName: 'LM Studio',
  }),

  custom: (_root) => ({
    configPath: '',
    mcpKey: 'mcpServers',
    displayName: 'Custom',
  }),
};

/**
 * 클라이언트의 설정 파일 경로를 반환한다.
 *
 * @param client 클라이언트 식별자
 * @returns 경로 정보 (configPath, mcpKey, displayName)
 * @throws 지원하지 않는 클라이언트
 */
export function resolveClientConfig(client: string): ClientPathInfo {
  const resolver = CLIENT_PATHS[client];
  if (!resolver) {
    const supported = Object.keys(CLIENT_PATHS).join(', ');
    throw new Error(`Unknown client "${client}". Supported: ${supported}`);
  }
  return resolver(configRoot());
}

/**
 * 지원하는 클라이언트 목록 반환.
 */
export function listClients(): Array<{ id: string; name: string }> {
  return Object.entries(CLIENT_PATHS).map(([id, resolver]) => ({
    id,
    name: resolver(configRoot()).displayName,
  }));
}

/**
 * air 프로젝트의 설정 파일(air.config.ts / air.config.json) 경로를 탐색한다.
 * cwd 기준으로 찾고 없으면 null.
 */
export function resolveAirConfig(cwd: string = process.cwd()): string | null {
  const candidates = ['air.config.ts', 'air.config.json', 'air.config.js'];
  for (const name of candidates) {
    const full = join(cwd, name);
    try {
      // 존재 여부만 확인 (import 없이)
      const { accessSync } = require('node:fs');
      accessSync(full);
      return full;
    } catch {
      continue;
    }
  }
  return null;
}
