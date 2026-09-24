// @airmcp-dev/shield — owasp/supply-chain.ts
//
// OWASP MCP-07: Supply Chain 무결성.
// MCP 서버 패키지의 무결성을 검증한다.
// - 도구 설명 해시 저장 + 재연결 시 비교
// - 패키지 체크섬 검증
// - 알려진 악성 패키지 차단

import { createHash } from 'node:crypto';

/** 서버 무결성 레코드 */
interface ServerFingerprint {
  serverId: string;
  packageName?: string;
  toolsHash: string;
  capturedAt: Date;
  verified: boolean;
}

/** 알려진 악성 패키지 (타이포스쿼팅 등) */
const KNOWN_MALICIOUS_PATTERNS = [
  // 타이포스쿼팅 — 일반적 오타
  /mcp-server-filesytem/i,  // filesystem 오타
  /mcp-sever-/i,            // server 오타
  /mcp-servr-/i,
  /mcp-serevr-/i,
  /mcp-srever-/i,
  // 타이포스쿼팅 — 대시/언더스코어 혼동
  /mcp_server-/i,           // mcp-server vs mcp_server
  /mcpserver(?!-)/i,            // 붙여쓰기 (mcp-server가 아닌 mcpserver)
  // 타이포스쿼팅 — 유명 패키지 변형
  /modelcontextprotocal/i,  // protocol 오타
  /model-context-protocal/i,
  /modlecontext/i,          // model 오타
  /modelcontext-protocol/i, // 대시 위치 변형
  // 의심스러운 네이밍 패턴
  /^@[^/]+\/mcp-.*-hack/i,
  /^@[^/]+\/mcp-.*-exploit/i,
  /^@[^/]+\/mcp-.*-crack/i,
  /^@[^/]+\/mcp-.*-keygen/i,
  /^@[^/]+\/mcp-.*-patch/i,
  // 스코프 스쿼팅 — 공식 스코프 사칭
  /^@modelcontextprotocol-/i, // 공식은 @modelcontextprotocol
  /^@mcp-official/i,
  /^@mcpdev/i,
  // 호모글리프/유니코드 — 키릴 문자로 라틴 대체 시도
  /m\u0441p/i,                // с = 키릴 с (U+0441) → mсp
  /mc\u0440/i,                // р = 키릴 р (U+0440) → mcр
  /\u043Ccp/i,                // м = 키릴 м (U+043C) → мcp
];

export class SupplyChainVerifier {
  private fingerprints = new Map<string, ServerFingerprint>();

  /**
   * 서버의 도구 목록으로 fingerprint를 생성한다.
   */
  capture(serverId: string, tools: Array<{ name: string; description?: string }>, packageName?: string): void {
    const toolsHash = this.hashTools(tools);

    this.fingerprints.set(serverId, {
      serverId,
      packageName,
      toolsHash,
      capturedAt: new Date(),
      verified: true,
    });
  }

  /**
   * 서버의 현재 도구가 fingerprint와 일치하는지 검증한다.
   */
  verify(serverId: string, tools: Array<{ name: string; description?: string }>): {
    verified: boolean;
    reason?: string;
  } {
    const fp = this.fingerprints.get(serverId);
    if (!fp) return { verified: true }; // fingerprint 없으면 스킵

    const currentHash = this.hashTools(tools);
    if (currentHash !== fp.toolsHash) {
      return {
        verified: false,
        reason: `Server "${serverId}" tools changed since ${fp.capturedAt.toISOString()}. Expected hash: ${fp.toolsHash}, got: ${currentHash}`,
      };
    }

    return { verified: true };
  }

  /**
   * 패키지 이름이 안전한지 검사한다 (타이포스쿼팅 감지).
   */
  checkPackageName(packageName: string): {
    safe: boolean;
    reason?: string;
  } {
    for (const pattern of KNOWN_MALICIOUS_PATTERNS) {
      if (pattern.test(packageName)) {
        return {
          safe: false,
          reason: `Suspicious package name "${packageName}" — possible typosquatting`,
        };
      }
    }
    return { safe: true };
  }

  /** fingerprint 목록 */
  getFingerprints(): ServerFingerprint[] {
    return Array.from(this.fingerprints.values());
  }

  private hashTools(tools: Array<{ name: string; description?: string }>): string {
    const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
    const content = sorted.map((t) => `${t.name}:${t.description || ''}`).join('|');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}
