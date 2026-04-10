// @airmcp-dev/core — plugin/plugin-hook.ts
// 플러그인 훅 실행기

import type { PluginHooks, PluginContext } from '../types/plugin.js';
import type { AirToolDef } from '../types/tool.js';

export class PluginHookRunner {
  private hooks: Array<{ name: string; hooks: PluginHooks }> = [];

  register(pluginName: string, hooks: PluginHooks) {
    this.hooks.push({ name: pluginName, hooks });
  }

  async runOnInit(ctx: PluginContext) {
    for (const { hooks } of this.hooks) {
      if (hooks.onInit) await hooks.onInit(ctx);
    }
  }

  async runOnStart(ctx: PluginContext) {
    for (const { hooks } of this.hooks) {
      if (hooks.onStart) await hooks.onStart(ctx);
    }
  }

  async runOnStop(ctx: PluginContext) {
    for (const { hooks } of this.hooks) {
      if (hooks.onStop) await hooks.onStop(ctx);
    }
  }

  runOnToolRegister(tool: AirToolDef, ctx: PluginContext): AirToolDef {
    let result = tool;
    for (const { hooks } of this.hooks) {
      if (hooks.onToolRegister) {
        const modified = hooks.onToolRegister(result, ctx);
        if (modified) result = modified;
      }
    }
    return result;
  }
}
