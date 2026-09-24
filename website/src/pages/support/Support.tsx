import { type FC, useState, useMemo } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn } from '@/components/common';


const FAQ_KEYS = Array.from({ length: 15 }, (_, i) => i + 1);

const RELEASES = [
  {
    version: 'v0.3.0',
    date: '2026-06-14',
    type: 'minor' as const,
    changes: {
      en: [
        'Cloudflare Workers transport: native JSON-RPC 2.0 handling without SDK dependency',
        'Transport auto-detection: stdio/HTTP/SSE/Workers selected automatically by environment',
        'Elicitation support: tools can request additional user input via elicit() in context',
        'Tool annotations: readOnlyHint, destructiveHint, idempotentHint, openWorldHint support',
        'Shield middleware: integrated into core MiddlewareChain with per-instance state isolation',
        'Meter middleware: integrated into core with 7-layer classification and ring buffer metrics',
        'MCP protocol version updated to 2025-03-26',
        'Shield package: OWASP MCP Top 10 guards (RugPull, ConfusedDeputy, ContextOvershare, SSRF, SupplyChain)',
        'Shield package: PII detection, tokenization, and redaction module',
        'Shield package: LicenseGuard for commercial license validation',
      ],
      ko: [
        'Cloudflare Workers 트랜스포트: SDK 의존 없이 JSON-RPC 2.0 네이티브 처리',
        '트랜스포트 자동 감지: 환경에 따라 stdio/HTTP/SSE/Workers 자동 선택',
        'Elicitation 지원: 도구에서 elicit()로 사용자 추가 입력 요청 가능',
        '도구 어노테이션: readOnlyHint, destructiveHint, idempotentHint, openWorldHint 지원',
        'Shield 미들웨어: 코어 MiddlewareChain에 통합, 인스턴스별 상태 격리',
        'Meter 미들웨어: 코어에 통합, 7계층 분류 + 링 버퍼 메트릭',
        'MCP 프로토콜 버전 2025-03-26 업데이트',
        'Shield 패키지: OWASP MCP Top 10 가드 (RugPull, ConfusedDeputy, ContextOvershare, SSRF, SupplyChain)',
        'Shield 패키지: PII 탐지, 토크나이징, 마스킹 모듈',
        'Shield 패키지: 상용 라이선스 검증 LicenseGuard',
      ],
    },
  },
  {
    version: 'v0.2.0',
    date: '2026-05-10',
    type: 'minor' as const,
    changes: {
      en: [
        'Streamable HTTP transport added (MCP SDK StreamableHTTPServerTransport)',
        'Logger package: standalone structured logging with JSON/Pretty formatters and file rotation',
        'Meter package: standalone 7-layer classification, call tracking, cost estimation',
        'Shield package: PolicyEngine, ThreatDetector, AuditLogger, RateLimiter, Sandbox (Isolator + ScopeLimiter)',
        'Hive package: process pool, auto-restart, tenant isolation, clustering',
        'Plugin factory/manifest spec (AirPluginFactory, air-plugin.json)',
        'Plugin lifecycle hooks: onInit, onStart, onStop, onToolRegister',
        'Telemetry manager for usage tracking and event collection',
        'CLI: added license, update, check commands (12 → 14 total)',
      ],
      ko: [
        'Streamable HTTP 트랜스포트 추가 (MCP SDK StreamableHTTPServerTransport)',
        'Logger 패키지: JSON/Pretty 포매터, 파일 로테이션 포함 독립 구조화 로깅',
        'Meter 패키지: 7계층 분류, 호출 추적, 비용 추정 독립 패키지',
        'Shield 패키지: PolicyEngine, ThreatDetector, AuditLogger, RateLimiter, Sandbox (Isolator + ScopeLimiter)',
        'Hive 패키지: 프로세스 풀, 자동 재시작, 테넌트 격리, 클러스터링',
        '플러그인 팩토리/매니페스트 규격 (AirPluginFactory, air-plugin.json)',
        '플러그인 라이프사이클 훅: onInit, onStart, onStop, onToolRegister',
        '텔레메트리 매니저: 사용량 추적 및 이벤트 수집',
        'CLI: license, update, check 명령어 추가 (12 → 14개)',
      ],
    },
  },
  {
    version: 'v0.1.5',
    date: '2026-04-12',
    type: 'patch' as const,
    changes: {
      en: [
        'Fixed FileStore append performance: O(n²) → O(1) using appendFile',
        'Shield state isolation: rate limits and audit logs are now per-server instance',
        'Fixed SSE mode not registering resources/prompts to session servers',
        'retryPlugin: complete internal retry loop with proper server state passthrough',
        'MiddlewareChain: after middleware now runs on abort (logging/metrics guaranteed)',
        'queuePlugin: fixed setTimeout leak on release',
        'Replaced SDK type workarounds with official McpServer.resource() API',
        'Removed 5 unsafe "as any" casts across core and gateway packages',
        'Added 34 new tests (165 → 199): CLI, middleware edge cases, plugin combos',
      ],
      ko: [
        'FileStore append 성능 수정: O(n²) → O(1) appendFile 사용',
        'Shield 상태 격리: 레이트 리밋/감사 로그가 서버 인스턴스별 독립',
        'SSE 모드에서 리소스/프롬프트가 세션 서버에 등록되지 않던 버그 수정',
        'retryPlugin: 내부 재시도 루프 완결 + 서버 state 전달',
        '미들웨어 체인: abort 시에도 after 미들웨어 실행 (로깅/메트릭 보장)',
        'queuePlugin: release 시 setTimeout 누적 방지',
        'SDK 타입 우회를 공식 McpServer.resource() API로 전환',
        'core/gateway에서 unsafe "as any" 캐스트 5곳 제거',
        '테스트 34개 추가 (165 → 199): CLI, 미들웨어 엣지케이스, 플러그인 조합',
      ],
    },
  },
  {
    version: 'v0.1.4',
    date: '2026-04-11',
    type: 'patch' as const,
    changes: {
      en: [
        'Added README.md to all 5 npm packages (previously blank on npmjs.com)',
        'Fixed package exports: ./src/index.ts → dist paths for proper npm usage',
        'Added homepage, repository, bugs, keywords, engines to core package.json',
        'Cleaned up duplicate fields in CLI package.json',
      ],
      ko: [
        '5개 npm 패키지에 README.md 추가 (이전에는 npmjs.com에서 빈 페이지)',
        '패키지 exports 수정: ./src/index.ts → dist 경로로 npm 사용자 호환',
        'core package.json에 homepage, repository, bugs, keywords, engines 추가',
        'CLI package.json 중복 필드 정리',
      ],
    },
  },
  {
    version: 'v0.1.3',
    date: '2025-04-10',
    type: 'patch' as const,
    changes: {
      en: [
        'Fixed CLI license command output format',
        'Renamed CLI commands for consistency (air → airmcp-dev)',
        'Updated documentation links across all packages',
        'Fixed authPlugin key validation edge case',
      ],
      ko: [
        'CLI license 명령어 출력 형식 수정',
        'CLI 명령어 이름 일관성 개선 (air → airmcp-dev)',
        '모든 패키지의 문서 링크 업데이트',
        'authPlugin 키 검증 엣지 케이스 수정',
      ],
    },
  },
  {
    version: 'v0.1.2',
    date: '2025-04-08',
    type: 'patch' as const,
    changes: {
      en: [
        'Added perUserRateLimitPlugin for per-user call throttling',
        'Fixed FileStore flush timer cleanup on close()',
        'Improved Meter ring buffer memory efficiency',
        'Added Gateway health check retry logic',
      ],
      ko: [
        '사용자별 호출 제한 perUserRateLimitPlugin 추가',
        'FileStore close() 시 flush 타이머 정리 수정',
        'Meter 링 버퍼 메모리 효율 개선',
        'Gateway 헬스 체크 재시도 로직 추가',
      ],
    },
  },
  {
    version: 'v0.1.1',
    date: '2025-04-05',
    type: 'patch' as const,
    changes: {
      en: [
        'Fixed SSE transport reconnection handling',
        'Added dryrunPlugin for testing without side effects',
        'Improved error messages for invalid plugin configurations',
        'Fixed CJK character handling in sanitizerPlugin',
      ],
      ko: [
        'SSE 트랜스포트 재연결 처리 수정',
        '사이드 이펙트 없는 테스트용 dryrunPlugin 추가',
        '잘못된 플러그인 설정의 에러 메시지 개선',
        'sanitizerPlugin의 CJK 문자 처리 수정',
      ],
    },
  },
  {
    version: 'v0.1.0',
    date: '2025-04-01',
    type: 'major' as const,
    changes: {
      en: [
        'Initial release of air MCP framework',
        '5 packages: core, cli, gateway, logger, meter',
        '19 built-in plugins (stability, performance, security, network, data, monitoring, dev)',
        'stdio, SSE, HTTP transports with auto-detection',
        'FileStore and MemoryStore storage adapters',
        '7-Layer Meter classification system',
        'CLI with 12 commands including create, dev, connect',
        'Gateway with load balancing and health checks',
      ],
      ko: [
        'air MCP 프레임워크 초기 릴리즈',
        '5개 패키지: core, cli, gateway, logger, meter',
        '19개 내장 플러그인 (안정성, 성능, 보안, 네트워크, 데이터, 모니터링, 개발)',
        'stdio, SSE, HTTP 트랜스포트 + 자동 감지',
        'FileStore, MemoryStore 스토리지 어댑터',
        '7계층 Meter 분류 시스템',
        'CLI 12개 명령어 (create, dev, connect 등)',
        'Gateway 로드밸런싱 및 헬스 체크',
      ],
    },
  },
];

const Support: FC = () => {
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_KEYS;
    const q = searchQuery.toLowerCase();
    return FAQ_KEYS.filter((i) => {
      const question = t(`support.faq.q${i}`).toLowerCase();
      const answer = t(`support.faq.a${i}`).toLowerCase();
      return question.includes(q) || answer.includes(q);
    });
  }, [searchQuery, t]);

  return (
    <div>

      {/* ━━━ HERO ━━━ */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-air-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="section-container relative z-10 max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted tracking-wider uppercase mb-5">Support</p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="font-display text-[1.5rem] sm:text-[1.8rem] lg:text-[2.1rem] font-extrabold leading-[1.25] tracking-tight text-text-primary mb-4">
              {t('support.title')}
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-text-secondary text-[15px] sm:text-base leading-[1.8] max-w-3xl">
              {t('support.subtitle')}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ Repository Notice ━━━ */}
      <section className="border-t border-white/[0.04]">
        <div className="section-container max-w-4xl py-6">
          <FadeIn>
            <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-air-500/[0.04] border border-air-500/10">
              <i className="fa-solid fa-circle-info text-air-400/60 mt-0.5" />
              <div className="text-sm text-text-secondary leading-relaxed">
                <span className="text-text-primary font-medium">{t('support.repo.title')}</span>
                <span className="mx-1.5">—</span>
                {t('support.repo.desc')}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ FAQ 검색 + 목록 ━━━ */}
      <section className="py-16 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('support.faq.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-8">
              {t('support.faq.title')}
            </h2>
          </FadeIn>

          {/* 검색 */}
          <FadeIn delay={80}>
            <div className="relative mb-8">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('support.search.placeholder')}
                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl
                           text-sm text-text-primary placeholder:text-text-muted/40
                           focus:outline-none focus:border-air-500/30 focus:bg-white/[0.04]
                           transition-all duration-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              )}
            </div>
          </FadeIn>

          {/* FAQ 아코디언 */}
          <div className="space-y-2">
            {filteredFaqs.length === 0 ? (
              <FadeIn>
                <div className="text-center py-12 text-text-muted text-sm">
                  <i className="fa-solid fa-circle-info text-xl mb-3 block text-text-muted/30" />
                  {t('support.search.noResults')}
                </div>
              </FadeIn>
            ) : (
              filteredFaqs.map((i, idx) => (
                <FadeIn key={i} delay={idx * 50}>
                  <div className={`rounded-xl border transition-all duration-300
                    ${expandedFaq === i
                      ? 'bg-white/[0.03] border-air-500/15'
                      : 'bg-white/[0.015] border-white/[0.04] hover:border-white/[0.08]'
                    }`}>
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="text-sm font-medium text-text-primary pr-4">{t(`support.faq.q${i}`)}</span>
                      <i className={`fa-solid fa-chevron-down text-[10px] text-text-muted/40 transition-transform duration-300
                        ${expandedFaq === i ? 'rotate-180 text-air-400' : ''}`} />
                    </button>
                    {expandedFaq === i && (
                      <div className="px-5 pb-4 -mt-1">
                        <p className="text-text-secondary text-[13px] leading-relaxed border-t border-white/[0.04] pt-3">
                          {t(`support.faq.a${i}`)}
                        </p>
                      </div>
                    )}
                  </div>
                </FadeIn>
              ))
            )}
          </div>

          {/* 더 보기 링크 */}
          <FadeIn delay={200}>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://docs.airmcp.dev/guide/troubleshooting"
                 target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]
                            hover:border-air-500/15 hover:bg-white/[0.04] transition-all duration-300
                            text-sm text-text-secondary hover:text-text-primary">
                <i className="fa-solid fa-book text-air-400/50 text-xs" />
                {t('support.faq.moreLink')}
                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-text-muted/30" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 릴리즈 노트 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('support.releases.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-10">
              {t('support.releases.title')}
            </h2>
          </FadeIn>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] sm:left-[22px] top-0 bottom-0 w-px bg-white/[0.06]" />

            <div className="space-y-6">
              {RELEASES.map((release, i) => (
                <FadeIn key={release.version} delay={i * 100}>
                  <div className="relative flex gap-5">
                    {/* Version badge */}
                    <div className={`relative z-10 flex-shrink-0 w-[38px] sm:w-[46px] h-[38px] sm:h-[46px] rounded-xl flex items-center justify-center
                      ${i === 0
                        ? 'bg-air-500/20 border-2 border-air-500/40 shadow-[0_0_20px_-4px_rgba(0,212,170,0.3)]'
                        : release.type === 'major'
                          ? 'bg-air-500/[0.08] border border-air-500/20'
                          : 'bg-white/[0.03] border border-white/[0.06]'
                      }`}>
                      <i className={`fa-solid ${release.type === 'major' ? 'fa-rocket' : 'fa-code-branch'} text-xs
                        ${i === 0 ? 'text-air-400' : release.type === 'major' ? 'text-air-400/60' : 'text-text-muted/40'}`} />
                    </div>

                    {/* Content */}
                    <div className={`flex-1 p-5 rounded-xl border transition-all duration-300
                      ${i === 0
                        ? 'bg-air-500/[0.03] border-air-500/15 hover:border-air-500/25'
                        : 'bg-white/[0.015] border-white/[0.04] hover:border-white/[0.08]'
                      }`}>
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`font-mono text-sm font-bold ${i === 0 ? 'text-air-400' : 'text-text-primary'}`}>
                          {release.version}
                        </span>
                        <span className="text-text-muted/40 text-xs font-mono">{release.date}</span>
                        {i === 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-air-500/10 border border-air-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-air-500 animate-glow-pulse" />
                            <span className="font-mono text-[9px] text-air-400 uppercase">Latest</span>
                          </span>
                        )}
                        {release.type === 'major' && i !== 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08]">
                            <span className="font-mono text-[9px] text-text-muted uppercase">Major</span>
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {(lang === 'ko' ? release.changes.ko : release.changes.en).map((change, j) => (
                          <li key={j} className="flex items-start gap-2 text-[13px] text-text-muted leading-relaxed">
                            <span className="text-air-500/40 mt-1.5 text-[6px]">●</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* npm 링크 */}
          <FadeIn delay={300}>
            <div className="mt-8 text-center">
              <a href="https://www.npmjs.com/org/airmcp-dev" target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]
                            hover:border-air-500/15 hover:bg-white/[0.04] transition-all duration-300
                            text-sm text-text-secondary hover:text-text-primary">
                <i className="fa-brands fa-npm text-xs text-air-400/50" />
                View all packages on npm
                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-text-muted/30" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 연락 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-xl text-center">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('support.contact.label')}</p>
            <h2 className="font-display text-lg font-extrabold text-text-primary tracking-tight mb-3">
              {t('support.contact.title')}
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-8 whitespace-pre-line">{t('support.contact.desc')}</p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="mailto:labs@codepedia.kr" className="btn-primary">
                <i className="fa-solid fa-envelope text-xs" /> {t('support.contact.email')}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

    </div>
  );
};

export default Support;
