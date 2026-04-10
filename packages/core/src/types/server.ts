// @airmcp-dev/core — types/server.ts

import type { AirToolDef } from './tool.js';
import type { AirResourceDef } from './resource.js';
import type { AirPromptDef } from './prompt.js';
import type { AirMiddleware } from './middleware.js';
import type { AirPlugin, AirPluginFactory } from './plugin.js';
import type { AirConfig } from './config.js';

/** defineServer()에 전달하는 옵션 */
export interface AirServerOptions extends AirConfig {
  /** 도구 목록 */
  tools?: AirToolDef[];
  /** 리소스 목록 */
  resources?: AirResourceDef[];
  /** 프롬프트 목록 */
  prompts?: AirPromptDef[];
  /** 미들웨어 목록 (실행 순서 = 배열 순서) */
  middleware?: AirMiddleware[];
  /** 플러그인 목록 */
  use?: Array<AirPlugin | AirPluginFactory>;
}

/** defineServer()가 반환하는 서버 인스턴스 */
export interface AirServer {
  /** 서버 이름 */
  readonly name: string;
  /** 서버 시작 */
  start(): Promise<void>;
  /** 서버 종료 */
  stop(): Promise<void>;
  /** 서버 상태 */
  status(): AirServerStatus;
  /** 등록된 도구 목록 */
  tools(): AirToolDef[];
  /** 등록된 리소스 목록 */
  resources(): AirResourceDef[];
  /** 미들웨어 체인을 거쳐 도구를 호출한다 (shield/meter 자동 적용) */
  callTool(toolName: string, params?: Record<string, any>): Promise<any>;
  /** 런타임에 도구 추가 */
  addTool(tool: AirToolDef): void;
  /** 런타임에 미들웨어 추가 */
  addMiddleware(mw: AirMiddleware): void;
  /** 런타임에 플러그인 추가 */
  addPlugin(plugin: AirPlugin | AirPluginFactory): void;
  /** 글로벌 상태 */
  state: Record<string, any>;
}

export interface AirServerStatus {
  name: string;
  version: string;
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;
  toolCount: number;
  resourceCount: number;
  transport: string;
}
