// @airmcp-dev/core — config/loader.ts
// air.config.ts / air.config.json 로더

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AirConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';

/** air.config.ts 또는 air.config.json을 로드하여 기본값과 병합 */
export async function loadConfig(cwd?: string): Promise<AirConfig> {
  const dir = cwd || process.cwd();

  // 1. air.config.ts (ESM dynamic import)
  const tsPath = resolve(dir, 'air.config.ts');
  if (existsSync(tsPath)) {
    try {
      const mod = await import(tsPath);
      return mergeConfig(mod.default || mod);
    } catch {
      // ts 로드 실패 시 json으로 폴백
    }
  }

  // 2. air.config.json
  const jsonPath = resolve(dir, 'air.config.json');
  if (existsSync(jsonPath)) {
    try {
      const raw = readFileSync(jsonPath, 'utf-8');
      return mergeConfig(JSON.parse(raw));
    } catch {
      // json 파싱 실패
    }
  }

  // 3. package.json의 "air" 필드
  const pkgPath = resolve(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.air) return mergeConfig(pkg.air);
    } catch {
      // 무시
    }
  }

  return mergeConfig({ name: 'air-server' });
}

function mergeConfig(userConfig: Partial<AirConfig>): AirConfig {
  return {
    name: userConfig.name || 'air-server',
    version: userConfig.version || DEFAULT_CONFIG.version,
    description: userConfig.description,
    transport: { ...DEFAULT_CONFIG.transport, ...userConfig.transport },
    storage: { ...DEFAULT_CONFIG.storage, ...userConfig.storage },
    logging: { ...DEFAULT_CONFIG.logging, ...userConfig.logging },
    metrics: { ...DEFAULT_CONFIG.metrics, ...userConfig.metrics },
    dev: { ...DEFAULT_CONFIG.dev, ...userConfig.dev },
    plugins: userConfig.plugins,
  };
}
