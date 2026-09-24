// @airmcp-dev/shield — threat/patterns.ts
//
// 알려진 위협 패턴 정의.
// OWASP MCP Top 10 + Pylon 시리즈 연구 기반.

import type { ThreatType } from '../types.js';

export interface ThreatPattern {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 정규식 패턴 */
  pattern: RegExp;
  description: string;
}

/** 내장 위협 패턴 (OWASP MCP Top 10 기준) */
export const BUILTIN_PATTERNS: ThreatPattern[] = [
  // ═══════════════════════════════════════════
  // MCP-01: Prompt Injection
  // ═══════════════════════════════════════════
  {
    type: 'prompt-injection',
    severity: 'high',
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    description: 'Prompt injection: ignore previous instructions',
  },
  {
    type: 'prompt-injection',
    severity: 'high',
    pattern: /you\s+are\s+now\s+(a|an)\s+/i,
    description: 'Prompt injection: role reassignment',
  },
  {
    type: 'prompt-injection',
    severity: 'medium',
    pattern: /\bsystem\s*:\s*/i,
    description: 'Prompt injection: system prompt attempt',
  },
  {
    type: 'prompt-injection',
    severity: 'high',
    pattern: /do\s+not\s+follow\s+(any\s+)?(previous|prior|above)\s+(rules|instructions)/i,
    description: 'Prompt injection: override attempt',
  },
  {
    type: 'prompt-injection',
    severity: 'high',
    pattern: /forget\s+(everything|all|your)\s+(you|instructions|rules)/i,
    description: 'Prompt injection: memory wipe attempt',
  },
  {
    type: 'prompt-injection',
    severity: 'medium',
    pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
    description: 'Prompt injection: raw prompt template tokens',
  },

  // ═══════════════════════════════════════════
  // MCP-02: Tool Poisoning
  // ═══════════════════════════════════════════
  {
    type: 'tool-poisoning',
    severity: 'high',
    pattern: /<tool_description>|<function_call>|<tool_use>/i,
    description: 'Tool poisoning: embedded tool definition in input',
  },
  {
    type: 'tool-poisoning',
    severity: 'high',
    pattern: /"name"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*"/i,
    description: 'Tool poisoning: JSON tool schema injection',
  },
  {
    type: 'tool-poisoning',
    severity: 'critical',
    pattern: /when\s+called\s+by\s+.+\s*,?\s*(also|first|secretly|quietly)\s+(send|post|fetch|call)/i,
    description: 'Tool poisoning: hidden action in description',
  },

  // ═══════════════════════════════════════════
  // MCP-03: Path Traversal
  // ═══════════════════════════════════════════
  {
    type: 'path-traversal',
    severity: 'high',
    pattern: /\.\.\//g,
    description: 'Path traversal: directory escape',
  },
  {
    type: 'path-traversal',
    severity: 'critical',
    pattern: /\/etc\/(passwd|shadow|hosts|sudoers)/i,
    description: 'Path traversal: sensitive system file access',
  },
  {
    type: 'path-traversal',
    severity: 'high',
    pattern: /~\/\.(ssh|aws|gnupg|config|env)/i,
    description: 'Path traversal: user credential directory access',
  },

  // ═══════════════════════════════════════════
  // MCP-04: Command Injection
  // ═══════════════════════════════════════════
  {
    type: 'command-injection',
    severity: 'critical',
    pattern: /[;&|`$]\s*(rm|chmod|chown|curl|wget|nc|bash|sh|python|node|eval)\b/i,
    description: 'Command injection: shell command in parameter',
  },
  {
    type: 'command-injection',
    severity: 'high',
    pattern: /\$\(.*\)/,
    description: 'Command injection: command substitution',
  },
  {
    type: 'command-injection',
    severity: 'high',
    pattern: /`[^`]*`/,
    description: 'Command injection: backtick execution',
  },

  // ═══════════════════════════════════════════
  // MCP-05: SQL Injection
  // ═══════════════════════════════════════════
  {
    type: 'sql-injection',
    severity: 'high',
    pattern: /('\s*(OR|AND)\s+'[^']*'\s*=\s*'[^']*')/i,
    description: 'SQL injection: tautology pattern',
  },
  {
    type: 'sql-injection',
    severity: 'high',
    pattern: /(UNION\s+SELECT|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO)\b/i,
    description: 'SQL injection: dangerous SQL statement',
  },
  {
    type: 'sql-injection',
    severity: 'medium',
    pattern: /;\s*(SELECT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b/i,
    description: 'SQL injection: stacked query',
  },

  // ═══════════════════════════════════════════
  // MCP-06: SSRF
  // ═══════════════════════════════════════════
  {
    type: 'ssrf',
    severity: 'critical',
    pattern: /https?:\/\/(169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/i,
    description: 'SSRF: internal IP address in URL',
  },
  {
    type: 'ssrf',
    severity: 'critical',
    pattern: /https?:\/\/metadata\.google\.internal/i,
    description: 'SSRF: cloud metadata service access',
  },

  // ═══════════════════════════════════════════
  // MCP-07: Data Exfiltration
  // ═══════════════════════════════════════════
  {
    type: 'data-exfiltration',
    severity: 'medium',
    pattern: /https?:\/\/[^\/\s]+\.(ngrok|loca\.lt|trycloudflare|serveo\.net|localtunnel)/i,
    description: 'Data exfiltration: tunnel service URL detected',
  },
  {
    type: 'data-exfiltration',
    severity: 'high',
    pattern: /https?:\/\/[a-z0-9]+\.burpcollaborator\.net/i,
    description: 'Data exfiltration: Burp collaborator (security testing tool)',
  },

  // ═══════════════════════════════════════════
  // MCP-08: Rug Pull (런타임 변조 시도)
  // ═══════════════════════════════════════════
  {
    type: 'rug-pull',
    severity: 'critical',
    pattern: /\btool[_.]?(description|definition|schema)\s*[=:]/i,
    description: 'Rug pull: attempt to modify tool definition via input',
  },
];
