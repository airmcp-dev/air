import { type FC, useState, useMemo } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn } from '@/components/common';


const FAQ_KEYS = Array.from({ length: 15 }, (_, i) => i + 1);

const RELEASES = [
  {
    version: 'v0.5.0',
    date: '2026-09-25',
    type: 'minor' as const,
    changes: {
      en: [
        'MCP SDK fully removed — zero dependency on @modelcontextprotocol/sdk',
        'McpProtocolEngine: self-implemented MCP 2026-07-28 stateless protocol core',
        'server/discover: advertise supported versions, capabilities, and server info',
        'Per-request _meta parsing: protocolVersion, clientInfo, clientCapabilities',
        'resultType: all responses carry "complete" (modern protocol)',
        'ttlMs + cacheScope: cache hints on tools/list, resources/list, prompts/list',
        'Legacy initialize fallback: 2025-11-25 and 2024-11-05 clients fully compatible',
        'AirStdioTransport: self-implemented stdio with Content-Length framing, batch requests',
        'AirHttpTransport: self-implemented Streamable HTTP (stateless, Mcp-Method/Mcp-Name headers)',
        'Mcp-Method header mismatch detection (-32020 HeaderMismatchError)',
        'Workers fetch handler unified with protocol engine',
        'SDK adapter files removed (stdio-adapter, sse-adapter, http-adapter)',
        'Only dependency remaining: zod',
        'New tests: 18 protocol engine + HTTP E2E (total 313 tests)',
      ],
      ko: [
        'MCP SDK 완전 제거 — @modelcontextprotocol/sdk 의존성 0',
        'McpProtocolEngine: MCP 2026-07-28 stateless 프로토콜 엔진 자체 구현',
        'server/discover: 지원 버전, capabilities, 서버 정보 광고',
        '요청별 _meta 파싱: protocolVersion, clientInfo, clientCapabilities',
        'resultType: 모든 응답에 "complete" 포함 (modern 프로토콜)',
        'ttlMs + cacheScope: tools/list, resources/list, prompts/list에 캐시 힌트',
        '레거시 initialize 폴백: 2025-11-25, 2024-11-05 클라이언트 완전 호환',
        'AirStdioTransport: Content-Length 프레이밍, 배치 요청 자체 구현',
        'AirHttpTransport: Streamable HTTP 자체 구현 (stateless, Mcp-Method/Mcp-Name 헤더)',
        'Mcp-Method 헤더 불일치 감지 (-32020 HeaderMismatchError)',
        'Workers fetch 핸들러를 프로토콜 엔진으로 통합',
        'SDK 어댑터 파일 제거 (stdio-adapter, sse-adapter, http-adapter)',
        '남은 외부 의존성: zod만',
        '새 테스트: 프로토콜 엔진 18개 + HTTP E2E (전체 313 테스트)',
      ],
    },
  },
  {
    version: 'v0.4.0',
    date: '2026-09-25',
    type: 'minor' as const,
    changes: {
      en: [
        'AirSSETransport: self-implemented SSE transport replacing MCP SDK dependency',
        'SSE heartbeat: periodic ping (30s default) detects dead connections early',
        'SSE reconnection: Last-Event-ID based message replay on reconnect',
        'SSE session manager: idle timeout auto-cleanup, max session limit enforcement',
        'SSE DNS rebinding protection: Host/Origin header validation',
        'SSE /health endpoint added for gateway integration',
        'Workers transport: resources/read handler with static URI + template matching',
        'Workers transport: prompts/get handler with argument passing',
        'Workers initialize: declares resources and prompts capabilities',
        'Gateway health checker: initialDelayMs (default 10s) prevents premature unhealthy on cold start',
        'Gateway health checker: parallel checkAll via Promise.allSettled',
        'AirConfig: sseHeartbeatMs, sseReplayBufferSize, sseReplayTtlMs, sseIdleTimeoutMs options',
        'Shield open-sourced: Apache-2.0 license, free for everyone',
        'Shield SSRF Guard: DNS rebinding detection via async DNS resolve',
        'Shield SSRF Guard: dangerous protocol blocking (non-HTTP/HTTPS)',
        'Shield Threat Detector: Unicode homoglyph normalization to prevent bypass',
        'Shield Threat Detector: URL encoding / zero-width character stripping',
        'Shield Supply Chain: 20+ typosquatting patterns (scope squatting, Cyrillic homoglyphs)',
        'Shield Policy Engine: conditional rules (paramEquals, paramGreaterThan, paramExists, custom)',
        'Shield Policy Engine: time-based policies (daysOfWeek, startTime/endTime schedule)',
        'Shield Rate Limiter: burst limiting with configurable burst window',
        'Added 35 new tests (260 → 295): SSE transport, workers adapter, health checker',
        'Resolved AIR-008 (Workers resources/read + prompts/get) and AIR-009 (Gateway cold start)',
      ],
      ko: [
        'AirSSETransport: MCP SDK 의존 없이 자체 구현한 SSE 트랜스포트',
        'SSE 하트비트: 주기적 ping(기본 30초)으로 끊어진 연결 조기 감지',
        'SSE 재연결 복구: Last-Event-ID 기반 누락 메시지 자동 재전송',
        'SSE 세션 관리자: 유휴 타임아웃 자동 정리, 최대 세션 수 제한',
        'SSE DNS rebinding 방어: Host/Origin 헤더 검증',
        'SSE /health 엔드포인트 추가 (게이트웨이 연동용)',
        'Workers 트랜스포트: resources/read 핸들러 (정적 URI + 템플릿 매칭)',
        'Workers 트랜스포트: prompts/get 핸들러 (인자 전달 지원)',
        'Workers initialize: resources, prompts capabilities 선언',
        'Gateway 헬스체커: initialDelayMs(기본 10초)로 콜드 스타트 시 premature unhealthy 방지',
        'Gateway 헬스체커: Promise.allSettled로 병렬 체크',
        'AirConfig: sseHeartbeatMs, sseReplayBufferSize, sseReplayTtlMs, sseIdleTimeoutMs 옵션 추가',
        'Shield 오픈소스 전환: Apache-2.0 라이선스, 모두에게 무료',
        'Shield SSRF Guard: 비동기 DNS resolve로 DNS rebinding 탐지',
        'Shield SSRF Guard: 위험 프로토콜 차단 (HTTP/HTTPS 외 거부)',
        'Shield Threat Detector: 유니코드 호모글리프 정규화로 우회 방지',
        'Shield Threat Detector: URL 인코딩 / 제로폭 문자 제거',
        'Shield Supply Chain: 20개 이상 타이포스쿼팅 패턴 (스코프 스쿼팅, 키릴 호모글리프)',
        'Shield Policy Engine: 조건부 규칙 (paramEquals, paramGreaterThan, paramExists, custom)',
        'Shield Policy Engine: 시간 기반 정책 (daysOfWeek, startTime/endTime 스케줄)',
        'Shield Rate Limiter: burst 제한 (burstLimit, burstWindowMs)',
        '테스트 35개 추가 (260 → 295): SSE 트랜스포트, Workers 어댑터, 헬스체커',
        'AIR-008 (Workers resources/read + prompts/get), AIR-009 (Gateway 콜드 스타트) 해결',
      ],
    },
  },
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
