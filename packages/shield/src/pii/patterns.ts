// @airmcp-dev/shield — pii/patterns.ts
//
// 정규식 기반 내장 PII 탐지 패턴.
// 기존 context-overshare.ts 패턴을 확장하고 구조화.

import type { PIIEntityType } from './types.js';

/** 패턴 정의 */
export interface PIIPattern {
  /** 엔티티 타입 */
  type: PIIEntityType;
  /** 패턴 이름 (로깅·디버깅용) */
  name: string;
  /** 정규식 — g 플래그 없이 정의, 탐지 시 동적으로 g 붙여서 사용 */
  regex: RegExp;
  /** 탐지 신뢰도 (0~1) */
  confidence: number;
  /** 비가역 마스킹 시 대체 문자열 */
  maskValue: string;
}

// ─── 전화번호 ──────────────────────────────────────

const PHONE_KR_MOBILE    = /01[016789]-?\d{3,4}-?\d{4}/;
const PHONE_KR_LANDLINE  = /0[2-6][0-9]-?\d{3,4}-?\d{4}/;
const PHONE_KR_SPECIAL   = /(?:1588|1644|1661|1566|1577|1599|1600|1670|1899|080)-?\d{3,4}/;
const PHONE_INTL         = /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/;

// ─── IP 주소 ───────────────────────────────────────

const IPV4 = /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/;
const IPV6 = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/;

// ─── CIDR ──────────────────────────────────────────

const CIDR_V4 = /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\/(?:3[0-2]|[12]?\d)\b/;

// ─── MAC 주소 ──────────────────────────────────────

const MAC_COLON = /\b[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}\b/;
const MAC_DASH  = /\b[0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5}\b/;

// ─── 내부 도메인 ───────────────────────────────────

const INTERNAL_DOMAIN = /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:internal|local|corp|intranet|private|lan|home)\b/i;

// ─── API 키·시크릿 ─────────────────────────────────

const API_KEY_PATTERN = /(?:api[_-]?key|token|secret|password|credential)\s*[:=]\s*['"]?[\w\-./+=]{16,}['"]?/i;
const BEARER_TOKEN    = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i;
const AWS_KEY         = /(?:AKIA|ASIA)[A-Z0-9]{16}/;
const ANTHROPIC_KEY   = /sk-ant-[a-zA-Z0-9\-_]{20,}/;
const OPENAI_KEY      = /sk-[a-zA-Z0-9]{20,}/;
const GOOGLE_KEY      = /AIza[0-9A-Za-z\-_]{35}/;
const GITHUB_TOKEN    = /(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/;
const SLACK_TOKEN     = /xox[bpas]-[A-Za-z0-9\-]{10,}/;
const AZURE_KEY       = /[A-Za-z0-9+/]{40,}={0,2}/; // 주의: 오탐 가능, 신뢰도 낮게

// ─── SSH·PEM 개인키 ────────────────────────────────

const PEM_PRIVATE_KEY = /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/;

// ─── 환경변수 시크릿 ───────────────────────────────

const ENV_EXPORT      = /(?:export\s+|ENV\s+|ARG\s+)(?:DB_PASSWORD|DB_PASS|SECRET_KEY|API_KEY|API_SECRET|AUTH_TOKEN|PRIVATE_KEY|ACCESS_KEY|AWS_SECRET_ACCESS_KEY|ENCRYPTION_KEY)\s*=\s*['"]?[^\s'"]{4,}['"]?/i;
const DOTENV_SECRET   = /^(?:DB_PASSWORD|DB_PASS|SECRET_KEY|API_KEY|API_SECRET|AUTH_TOKEN|PRIVATE_KEY|ACCESS_KEY|AWS_SECRET_ACCESS_KEY|ENCRYPTION_KEY)\s*=\s*['"]?[^\s'"]{4,}['"]?/im;

// ─── DB 접속 문자열 ────────────────────────────────

const DB_CONN_STRING = /(?:mongodb(?:\+srv)?|mysql|postgres(?:ql)?|mssql|redis|amqp|mariadb|cockroachdb):\/\/[^\s'"]+/i;
const JDBC_URL       = /jdbc:[a-zA-Z0-9]+:\/\/[^\s'"]+/i;

// ─── Git credential ────────────────────────────────

const GIT_CREDENTIAL = /https?:\/\/[^:@\s]+:[^@\s]+@(?:github\.com|gitlab\.com|bitbucket\.org|[a-zA-Z0-9.-]+\.(?:internal|local|corp))[^\s]*/i;

// ─── 서버·포트 ─────────────────────────────────────

const HOST_PORT = /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*:\d{2,5}\b/;

// ─── 시크릿 (패스워드 필드) ────────────────────────

const PASSWORD_FIELD    = /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/i;
const DOCKER_LOGIN_PASS = /docker\s+login\s+.*?(?:-p|--password)\s+['"]?[^\s'"]+['"]?/i;
const K8S_SECRET        = /kubectl\s+create\s+secret\s+.*?--from-literal[=\s]+[^\s]+/i;

// ═══════════════════════════════════════════════════
// 내장 패턴 목록
// ═══════════════════════════════════════════════════

export const BUILTIN_PII_PATTERNS: PIIPattern[] = [
  // ── 전화번호 ──
  { type: 'PHONE', name: 'phone-kr-mobile',   regex: PHONE_KR_MOBILE,   confidence: 0.95, maskValue: '***-****-****' },
  { type: 'PHONE', name: 'phone-kr-landline', regex: PHONE_KR_LANDLINE, confidence: 0.90, maskValue: '**-***-****' },
  { type: 'PHONE', name: 'phone-kr-special',  regex: PHONE_KR_SPECIAL,  confidence: 0.90, maskValue: '****-****' },
  { type: 'PHONE', name: 'phone-intl',        regex: PHONE_INTL,        confidence: 0.90, maskValue: '+**-****-****' },

  // ── IP 주소 ──
  { type: 'IP', name: 'ipv4', regex: IPV4, confidence: 0.95, maskValue: '***.***.***.***' },
  { type: 'IP', name: 'ipv6', regex: IPV6, confidence: 0.90, maskValue: '****:****:****:****:****:****:****:****' },

  // ── CIDR ──
  { type: 'CIDR', name: 'cidr-v4', regex: CIDR_V4, confidence: 0.95, maskValue: '***.***.***.***/**' },

  // ── MAC 주소 ──
  { type: 'MAC', name: 'mac-colon', regex: MAC_COLON, confidence: 0.90, maskValue: '**:**:**:**:**:**' },
  { type: 'MAC', name: 'mac-dash',  regex: MAC_DASH,  confidence: 0.90, maskValue: '**-**-**-**-**-**' },

  // ── 내부 도메인 ──
  { type: 'INTERNAL_DOMAIN', name: 'internal-domain', regex: INTERNAL_DOMAIN, confidence: 0.90, maskValue: '***.internal' },

  // ── API 키·토큰 ──
  { type: 'API_KEY', name: 'api-key-generic',  regex: API_KEY_PATTERN, confidence: 0.85, maskValue: '***REDACTED***' },
  { type: 'API_KEY', name: 'bearer-token',     regex: BEARER_TOKEN,    confidence: 0.90, maskValue: 'Bearer ***REDACTED***' },
  { type: 'API_KEY', name: 'aws-access-key',   regex: AWS_KEY,         confidence: 0.95, maskValue: 'AKIA***REDACTED***' },
  { type: 'API_KEY', name: 'anthropic-key',    regex: ANTHROPIC_KEY,   confidence: 0.95, maskValue: 'sk-ant-***REDACTED***' },
  { type: 'API_KEY', name: 'openai-key',       regex: OPENAI_KEY,      confidence: 0.95, maskValue: 'sk-***REDACTED***' },
  { type: 'API_KEY', name: 'google-api-key',   regex: GOOGLE_KEY,      confidence: 0.95, maskValue: 'AIza***REDACTED***' },
  { type: 'API_KEY', name: 'github-token',     regex: GITHUB_TOKEN,    confidence: 0.95, maskValue: 'ghp_***REDACTED***' },
  { type: 'API_KEY', name: 'slack-token',      regex: SLACK_TOKEN,     confidence: 0.95, maskValue: 'xox*-***REDACTED***' },
  { type: 'API_KEY', name: 'azure-key',        regex: AZURE_KEY,       confidence: 0.60, maskValue: '***REDACTED***' },

  // ── SSH·PEM 개인키 ──
  { type: 'PRIVATE_KEY', name: 'pem-private-key', regex: PEM_PRIVATE_KEY, confidence: 0.99, maskValue: '-----BEGIN PRIVATE KEY-----\n***REDACTED***\n-----END PRIVATE KEY-----' },

  // ── 환경변수 시크릿 ──
  { type: 'ENV_SECRET', name: 'env-export',    regex: ENV_EXPORT,    confidence: 0.90, maskValue: 'export ***=***REDACTED***' },
  { type: 'ENV_SECRET', name: 'dotenv-secret', regex: DOTENV_SECRET, confidence: 0.85, maskValue: '***=***REDACTED***' },

  // ── 시크릿 (패스워드·Docker·K8s) ──
  { type: 'SECRET', name: 'password-field',    regex: PASSWORD_FIELD,    confidence: 0.85, maskValue: '***REDACTED***' },
  { type: 'SECRET', name: 'docker-login-pass', regex: DOCKER_LOGIN_PASS, confidence: 0.95, maskValue: 'docker login ***REDACTED***' },
  { type: 'SECRET', name: 'k8s-secret',        regex: K8S_SECRET,        confidence: 0.95, maskValue: 'kubectl create secret ***REDACTED***' },

  // ── DB 접속 문자열 ──
  { type: 'DB_CONN', name: 'db-connection-string', regex: DB_CONN_STRING, confidence: 0.95, maskValue: '***://***REDACTED***' },
  { type: 'DB_CONN', name: 'jdbc-url',             regex: JDBC_URL,       confidence: 0.95, maskValue: 'jdbc:***REDACTED***' },

  // ── Git credential ──
  { type: 'GIT_CREDENTIAL', name: 'git-credential-url', regex: GIT_CREDENTIAL, confidence: 0.95, maskValue: 'https://***:***@***REDACTED***' },

  // ── 서버·포트 ──
  { type: 'SERVER_PORT', name: 'host-port', regex: HOST_PORT, confidence: 0.80, maskValue: '***:****' },
];
