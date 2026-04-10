// @airmcp-dev/core — plugin/plugin-manager.ts
// 플러그인 등록, 로드, 해제

import type { AirPlugin, AirPluginFactory, PluginContext } from '../types/plugin.js';
import type { AirMiddleware } from '../types/middleware.js';
import type { AirToolDef } from '../types/tool.js';
import type { AirResourceDef } from '../types/resource.js';
import { resolvePlugin, validatePlugin } from './plugin-schema.js';
import { PluginHookRunner } from './plugin-hook.js';

export class PluginManager {
  private plugins: AirPlugin[] = [];
  readonly hookRunner = new PluginHookRunner();

  /** 플러그인 등록 */
  register(input: AirPlugin | AirPluginFactory) {
    const plugin = resolvePlugin(input);
    const errors = validatePlugin(plugin);
    if (errors.length > 0) {
      throw new Error(`Invalid plugin "${plugin.meta?.name}": ${errors.join(', ')}`);
    }

    this.plugins.push(plugin);

    // 훅 등록
    if (plugin.hooks) {
      this.hookRunner.register(plugin.meta.name, plugin.hooks);
    }
  }

  /** 등록된 모든 플러그인의 미들웨어를 수집 */
  collectMiddleware(): AirMiddleware[] {
    const result: AirMiddleware[] = [];
    for (const p of this.plugins) {
      if (p.middleware) result.push(...p.middleware);
    }
    return result;
  }

  /** 등록된 모든 플러그인의 도구를 수집 */
  collectTools(): AirToolDef[] {
    const result: AirToolDef[] = [];
    for (const p of this.plugins) {
      if (p.tools) result.push(...p.tools);
    }
    return result;
  }

  /** 등록된 모든 플러그인의 리소스를 수집 */
  collectResources(): AirResourceDef[] {
    const result: AirResourceDef[] = [];
    for (const p of this.plugins) {
      if (p.resources) result.push(...p.resources);
    }
    return result;
  }

  /** 등록된 플러그인 목록 */
  list() {
    return this.plugins.map((p) => p.meta);
  }

  /** 플러그인 컨텍스트 생성 */
  createContext(
    serverName: string,
    config: Record<string, any>,
    state: Record<string, any>,
  ): PluginContext {
    return {
      serverName,
      config,
      state,
      log: (level, message, data) => {
        const prefix = `[air:plugin]`;
        if (level === 'error') console.error(prefix, message, data || '');
        else if (level === 'warn') console.warn(prefix, message, data || '');
        else console.log(prefix, message, data || '');
      },
    };
  }
}
