// @airmcp-dev/core — plugin/plugin-schema.ts
// AirPlugin 유효성 검증

import type { AirPlugin, AirPluginFactory } from '../types/plugin.js';

/** 플러그인 또는 팩토리를 AirPlugin 인스턴스로 정규화 */
export function resolvePlugin(input: AirPlugin | AirPluginFactory): AirPlugin {
  if (typeof input === 'function') {
    return input();
  }
  return input;
}

/** 플러그인 기본 검증 */
export function validatePlugin(plugin: AirPlugin): string[] {
  const errors: string[] = [];
  if (!plugin.meta?.name) errors.push('plugin.meta.name is required');
  return errors;
}
