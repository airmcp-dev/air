// @airmcp-dev/shield — sandbox/resource-limit.ts
//
// 프로세스 리소스 제한 설정.

import type { SandboxConfig } from '../types.js';

/** 기본 샌드박스 설정 */
export const DEFAULT_SANDBOX_CONFIG: Required<SandboxConfig> = {
  cpuLimit: 30_000, // 30초 CPU 시간
  memoryLimit: 256 * 1024 * 1024, // 256MB
  networkAccess: false,
  allowedPaths: [],
  timeout: 60_000, // 60초 전체 타임아웃
};

/**
 * 설정을 기본값과 병합한다.
 */
export function mergeConfig(config?: SandboxConfig): Required<SandboxConfig> {
  return { ...DEFAULT_SANDBOX_CONFIG, ...config };
}

/**
 * 리소스 제한이 유효한지 검증한다.
 */
export function validateConfig(config: SandboxConfig): string[] {
  const errors: string[] = [];

  if (config.cpuLimit !== undefined && config.cpuLimit <= 0) {
    errors.push('cpuLimit must be positive');
  }
  if (config.memoryLimit !== undefined && config.memoryLimit < 1024 * 1024) {
    errors.push('memoryLimit must be at least 1MB');
  }
  if (config.timeout !== undefined && config.timeout <= 0) {
    errors.push('timeout must be positive');
  }

  return errors;
}
