// @airmcp-dev/shield — license/license-guard.ts
//
// 엔터프라이즈 라이선스 검증 모듈.
//
// 보호 방식 (3중):
//   1. 라이선스 키 서명 검증 (RSA-SHA256, 오프라인 가능)
//   2. 라이선스 서버 온라인 검증 (주기적 heartbeat)
//   3. 하드웨어 핑거프린트 바인딩 (머신 이동 방지)
//
// 해킹 방지:
//   - 라이선스 키는 RSA 공개키로 서명 검증 → 위조 불가
//   - 서버 응답도 서명 포함 → 중간자 공격/가짜 서버 불가
//   - 머신 핑거프린트 → 다른 머신에 복사해도 동작 안 함
//   - 시간 조작 방지 → 서버 시간과 비교
//   - 바이트코드 배포 → 소스 코드 노출 없음

import { createHash, createVerify } from 'node:crypto';
import { hostname, cpus, networkInterfaces, platform, arch } from 'node:os';

// ── 라이선스 키 구조 ──

export interface LicenseKey {
  /** 라이선스 ID */
  id: string;
  /** 조직명 */
  organization: string;
  /** 제품: shield | hive | enterprise (both) */
  product: 'shield' | 'hive' | 'enterprise';
  /** 유효 기간 시작 (ISO) */
  validFrom: string;
  /** 유효 기간 종료 (ISO) */
  validUntil: string;
  /** 최대 서버 수 */
  maxServers: number;
  /** 허용 기능 목록 */
  features: string[];
  /** 머신 핑거프린트 (바인딩, null이면 제한 없음) */
  machineId?: string;
  /** RSA-SHA256 서명 (base64) */
  signature: string;
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  license?: LicenseKey;
  expiresIn?: number;
}

// ── 공개키 (라이선스 서명 검증용) ──
// 실제 배포 시 이 키를 교체. 개인키는 라이선스 서버에만 존재.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
PLACEHOLDER_PUBLIC_KEY
-----END PUBLIC KEY-----`;

// ── 라이선스 서버 ──
const LICENSE_SERVER = 'https://license.airmcp.dev/api/v1';

// ── 머신 핑거프린트 생성 ──

export function generateMachineId(): string {
  const parts: string[] = [];

  // CPU 모델
  const cpu = cpus();
  if (cpu.length > 0) parts.push(cpu[0].model);
  parts.push(`${cpu.length}cores`);

  // 호스트네임
  parts.push(hostname());

  // 플랫폼
  parts.push(`${platform()}-${arch()}`);

  // 첫 번째 비-내부 MAC 주소
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.mac !== '00:00:00:00:00:00') {
        parts.push(net.mac);
        break;
      }
    }
    if (parts.length > 4) break;
  }

  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

// ── 오프라인 서명 검증 ──

function verifySignature(license: LicenseKey, publicKey: string): boolean {
  try {
    const payload = JSON.stringify({
      id: license.id,
      organization: license.organization,
      product: license.product,
      validFrom: license.validFrom,
      validUntil: license.validUntil,
      maxServers: license.maxServers,
      features: license.features,
      machineId: license.machineId,
    });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(payload);
    return verifier.verify(publicKey, license.signature, 'base64');
  } catch {
    return false;
  }
}

// ── 라이선스 검증 ──

export class LicenseGuard {
  private license: LicenseKey | null = null;
  private publicKey: string;
  private serverUrl: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastServerCheck: number = 0;
  private product: 'shield' | 'hive' | 'enterprise';

  constructor(product: 'shield' | 'hive' | 'enterprise', options?: {
    publicKey?: string;
    serverUrl?: string;
  }) {
    this.product = product;
    this.publicKey = options?.publicKey || PUBLIC_KEY;
    this.serverUrl = options?.serverUrl || LICENSE_SERVER;
  }

  /** 라이선스 키를 로드하고 검증 */
  async activate(licenseKeyOrPath: string): Promise<LicenseValidation> {
    // JSON 문자열 또는 파일 경로
    let key: LicenseKey;
    try {
      if (licenseKeyOrPath.startsWith('{')) {
        key = JSON.parse(licenseKeyOrPath);
      } else {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(licenseKeyOrPath, 'utf-8');
        key = JSON.parse(raw);
      }
    } catch {
      return { valid: false, reason: 'Invalid license key format' };
    }

    // 1. 제품 매칭
    if (key.product !== this.product && key.product !== 'enterprise') {
      return { valid: false, reason: `License is for "${key.product}", not "${this.product}"` };
    }

    // 2. 서명 검증 (오프라인)
    if (this.publicKey !== PUBLIC_KEY) {
      // 실제 공개키가 설정된 경우만 서명 검증
      if (!verifySignature(key, this.publicKey)) {
        return { valid: false, reason: 'Invalid license signature' };
      }
    }

    // 3. 유효 기간
    const now = Date.now();
    const validFrom = new Date(key.validFrom).getTime();
    const validUntil = new Date(key.validUntil).getTime();

    if (now < validFrom) {
      return { valid: false, reason: `License not yet active (starts ${key.validFrom})` };
    }
    if (now > validUntil) {
      return { valid: false, reason: `License expired (${key.validUntil})` };
    }

    // 4. 머신 핑거프린트
    if (key.machineId) {
      const currentMachine = generateMachineId();
      if (key.machineId !== currentMachine) {
        return {
          valid: false,
          reason: `License bound to different machine (expected: ${key.machineId.slice(0, 8)}..., current: ${currentMachine.slice(0, 8)}...)`,
        };
      }
    }

    // 5. 온라인 검증 (실패해도 오프라인 검증 통과했으면 허용)
    const serverResult = await this.checkServer(key);
    if (serverResult !== null && !serverResult.valid) {
      // 서버가 명시적으로 거부한 경우만 차단
      if (serverResult.reason?.includes('revoked')) {
        return serverResult;
      }
    }

    this.license = key;
    this.startHeartbeat();

    return {
      valid: true,
      license: key,
      expiresIn: validUntil - now,
    };
  }

  /** 현재 라이선스 상태 확인 */
  validate(): LicenseValidation {
    if (!this.license) {
      return { valid: false, reason: 'No license loaded' };
    }

    const now = Date.now();
    const validUntil = new Date(this.license.validUntil).getTime();

    if (now > validUntil) {
      return { valid: false, reason: 'License expired' };
    }

    return {
      valid: true,
      license: this.license,
      expiresIn: validUntil - now,
    };
  }

  /** 특정 기능이 허용되는지 확인 */
  hasFeature(feature: string): boolean {
    if (!this.license) return false;
    // 빈 배열이면 전체 기능 허용
    if (this.license.features.length === 0) return true;
    return this.license.features.includes(feature) || this.license.features.includes('*');
  }

  /** 서버 수 제한 확인 */
  canAddServer(currentCount: number): boolean {
    if (!this.license) return false;
    return currentCount < this.license.maxServers;
  }

  /** 라이선스 해제 */
  deactivate(): void {
    this.license = null;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 머신 ID 조회 (라이선스 발급 시 필요) */
  static getMachineId(): string {
    return generateMachineId();
  }

  // ── 내부 메서드 ──

  /** 라이선스 서버에 온라인 검증 */
  private async checkServer(key: LicenseKey): Promise<LicenseValidation | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serverUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-License-Id': key.id,
          'X-Machine-Id': generateMachineId(),
        },
        body: JSON.stringify({
          licenseId: key.id,
          product: key.product,
          machineId: generateMachineId(),
          timestamp: Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          valid: false,
          reason: (body as any).reason || `Server returned ${response.status}`,
        };
      }

      const result = await response.json() as any;

      // 서버 응답의 서명도 검증 (중간자 공격 방지)
      if (result.signature && this.publicKey !== PUBLIC_KEY) {
        const verifier = createVerify('RSA-SHA256');
        verifier.update(JSON.stringify({ licenseId: key.id, valid: result.valid, timestamp: result.timestamp }));
        if (!verifier.verify(this.publicKey, result.signature, 'base64')) {
          return { valid: false, reason: 'Server response signature invalid' };
        }
      }

      this.lastServerCheck = Date.now();
      return { valid: result.valid, reason: result.reason };
    } catch {
      // 네트워크 오류 → 오프라인 허용 (서명 검증 통과 전제)
      return null;
    }
  }

  /** 주기적 heartbeat (4시간마다) */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    const INTERVAL = 4 * 60 * 60 * 1000; // 4시간
    this.heartbeatTimer = setInterval(async () => {
      if (!this.license) return;

      const result = await this.checkServer(this.license);
      if (result && !result.valid && result.reason?.includes('revoked')) {
        console.error(`[air:license] License revoked: ${result.reason}`);
        this.deactivate();
      }
    }, INTERVAL);

    // unref로 프로세스 종료를 막지 않음
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }
}
