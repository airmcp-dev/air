// @airmcp-dev/core — types/plugin.ts

import type { AirMiddleware } from './middleware.js';
import type { AirToolDef } from './tool.js';
import type { AirResourceDef } from './resource.js';

/** 플러그인 메타 정보 */
export interface AirPluginMeta {
  /** 플러그인 이름 */
  name: string;
  /** 버전 */
  version?: string;
  /** 설명 */
  description?: string;
}

/** 플러그인 훅 — 서버 라이프사이클에 끼어드는 확장점 */
export interface PluginHooks {
  /** 서버 초기화 직후 */
  onInit?: (ctx: PluginContext) => Promise<void> | void;
  /** 서버 시작 직후 */
  onStart?: (ctx: PluginContext) => Promise<void> | void;
  /** 서버 종료 직전 */
  onStop?: (ctx: PluginContext) => Promise<void> | void;
  /** 도구가 등록될 때 */
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;
}

/** 플러그인 컨텍스트 — 플러그인이 서버에 접근하는 통로 */
export interface PluginContext {
  /** 서버 이름 */
  serverName: string;
  /** 서버 설정 */
  config: Record<string, any>;
  /** 글로벌 상태 */
  state: Record<string, any>;
  /** 로거 */
  log: (level: string, message: string, data?: any) => void;
}

/** 플러그인 정의 — 서드파티가 구현하는 인터페이스 */
export interface AirPlugin {
  /** 메타 정보 */
  meta: AirPluginMeta;
  /** 미들웨어 추가 */
  middleware?: AirMiddleware[];
  /** 도구 추가 */
  tools?: AirToolDef[];
  /** 리소스 추가 */
  resources?: AirResourceDef[];
  /** 라이프사이클 훅 */
  hooks?: PluginHooks;
}

/** 플러그인 팩토리 — 설정을 받아서 플러그인 인스턴스 반환 */
export type AirPluginFactory<T = any> = (options?: T) => AirPlugin;
