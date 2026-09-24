// @airmcp-dev/shield — license/index.ts
//
// 엔터프라이즈 모듈 진입점에서 라이선스를 검증하는 게이트.
// shield/hive를 import하면 이 모듈이 자동으로 라이선스를 체크한다.
//
// 사용자 관점:
//   import { PolicyEngine } from '@airmcp-dev/shield';
//   // → 내부적으로 라이선스 검증 후 동작
//
// 환경변수:
//   AIR_LICENSE_KEY  — 라이선스 키 JSON 문자열
//   AIR_LICENSE_FILE — 라이선스 키 파일 경로

export { LicenseGuard, generateMachineId } from './license-guard.js';
export type { LicenseKey, LicenseValidation } from './license-guard.js';

import { LicenseGuard } from './license-guard.js';

let _shieldGuard: LicenseGuard | null = null;
let _validated = false;

/**
 * Shield 모듈 사용 전에 호출해야 하는 라이선스 게이트.
 * 한 번 검증하면 프로세스 종료까지 유효.
 */
export async function requireShieldLicense(): Promise<void> {
  if (_validated) return;

  const keyOrPath =
    process.env.AIR_LICENSE_KEY ||
    process.env.AIR_LICENSE_FILE ||
    '.air/license.json';

  _shieldGuard = new LicenseGuard('shield');
  const result = await _shieldGuard.activate(keyOrPath);

  if (!result.valid) {
    const msg = [
      '',
      '  [air/shield] Enterprise license required.',
      `  Reason: ${result.reason}`,
      '',
      '  To get a license:',
      '    1. Get your machine ID: npx @airmcp-dev/cli license --machine-id',
      '    2. Purchase at https://airmcp.dev/pricing',
      '    3. Set AIR_LICENSE_KEY or place .air/license.json',
      '',
      '  Contact: labs@codepedia.kr',
      '',
    ].join('\n');

    console.error(msg);
    throw new Error(`[air/shield] ${result.reason}`);
  }

  _validated = true;

  const days = Math.ceil((result.expiresIn || 0) / 86_400_000);
  if (days <= 30) {
    console.warn(`[air/shield] License expires in ${days} days. Renew at https://airmcp.dev/pricing`);
  }
}

/** 현재 라이선스 가드 인스턴스 */
export function getShieldGuard(): LicenseGuard | null {
  return _shieldGuard;
}
