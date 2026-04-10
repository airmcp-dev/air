// plugin-showcase — src/index.ts
//
// air 빌트인 플러그인 쇼케이스 서버.
// 실용적인 시나리오로 플러그인 동작을 검증한다.
//
// 사용 플러그인:
//   1. timeoutPlugin     — 도구 실행 타임아웃 (10초)
//   2. retryPlugin       — 외부 API 호출 재시도
//   3. cachePlugin       — 검색 결과 60초 캐시
//   4. sanitizerPlugin   — 입력 XSS 제거
//   5. validatorPlugin   — 금액 상한 검증
//   6. authPlugin        — API 키 인증
//   7. circuitBreakerPlugin — 외부 서비스 서킷 브레이커
//   8. queuePlugin       — DB 쿼리 동시성 제한
//   9. transformPlugin   — 입력 트림 + 출력 메타 추가
//  10. i18nPlugin        — 다국어 응답
//  11. jsonLoggerPlugin  — JSON 구조화 로깅
//  12. perUserRateLimitPlugin — 사용자별 레이트 리밋
//  13. dryrunPlugin      — 테스트용 드라이런
//  14. webhookPlugin     — 에러 알림 (mock)

import {
  defineServer,
  defineTool,
  defineResource,
  definePrompt,
  // 플러그인
  timeoutPlugin,
  retryPlugin,
  cachePlugin,
  sanitizerPlugin,
  validatorPlugin,
  authPlugin,
  circuitBreakerPlugin,
  queuePlugin,
  transformPlugin,
  i18nPlugin,
  jsonLoggerPlugin,
  perUserRateLimitPlugin,
  dryrunPlugin,
  // storage
  MemoryStore,
} from '@airmcp-dev/core';

// ── Storage ──
const store = new MemoryStore();
await store.init();

// ── Server ──
const server = defineServer({
  name: 'plugin-showcase',
  version: '1.0.0',
  description: '19개 빌트인 플러그인 쇼케이스',

  transport: { type: 'sse', port: 3520 },

  // ── Shield (내장 보안) ──
  shield: {
    enabled: true,
    policies: [
      { name: 'allow-all', target: '*', action: 'allow', priority: 1 },
    ],
    threatDetection: true,
    audit: true,
  },

  // ── Meter (내장 측정) ──
  meter: { enabled: true, classify: true, trackCalls: true },

  // ── 플러그인 체인 (순서 중요!) ──
  use: [
    // 1. 드라이런 — 제일 먼저 체크, _dryrun=true면 여기서 바로 반환
    dryrunPlugin({ perCall: true }),

    // 2. 타임아웃 — 10초
    timeoutPlugin(10_000),

    // 3. 재시도 — 최대 2회, 100ms 대기
    retryPlugin({ maxRetries: 2, delayMs: 100 }),

    // 4. 서킷 브레이커 — 3회 연속 실패 시 30초 차단
    circuitBreakerPlugin({ failureThreshold: 3, resetTimeoutMs: 30_000 }),

    // 4. 캐시 — 60초, search/translate만 캐시 (write 제외)
    cachePlugin({ ttlMs: 60_000, exclude: ['note_add', 'note_delete', 'note_get', 'transfer'] }),

    // 5. 큐 — DB 도구 동시 2개 제한
    queuePlugin({ concurrency: { note_add: 2, note_list: 5, '*': 10 } }),

    // 6. 입력 정제 — HTML/제어문자 제거
    sanitizerPlugin({ maxStringLength: 5000 }),

    // 7. 비즈니스 검증
    validatorPlugin({
      rules: {
        transfer: (params) => {
          if (typeof params.amount === 'number' && params.amount > 100_000) {
            return `Transfer amount ${params.amount} exceeds maximum 100,000`;
          }
          return null;
        },
      },
    }),

    // 8. 입출력 변환
    transformPlugin({
      before: {
        '*': (params) => {
          // 모든 문자열 파라미터 트림
          const cleaned: Record<string, any> = {};
          for (const [k, v] of Object.entries(params)) {
            cleaned[k] = typeof v === 'string' ? v.trim() : v;
          }
          return cleaned;
        },
      },
    }),

    // 9. 다국어 — 기본 한국어
    i18nPlugin({
      defaultLang: 'ko',
      translations: {
        saved: { ko: '저장 완료', en: 'Saved', ja: '保存完了' },
        deleted: { ko: '삭제 완료', en: 'Deleted', ja: '削除完了' },
        not_found: { ko: '찾을 수 없습니다', en: 'Not found', ja: '見つかりません' },
      },
    }),

    // 10. 사용자별 레이트 리밋 — 분당 20회
    perUserRateLimitPlugin({ maxCalls: 20, windowMs: 60_000 }),

    // 13. JSON 로깅 (stderr)
    jsonLoggerPlugin({ output: 'stderr' }),
  ],

  tools: [
    // ── 노트 CRUD ──
    defineTool('note_add', {
      description: '노트를 추가합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
        text: { type: 'string', description: '내용' },
      },
      handler: async ({ id, text }) => {
        await store.set('notes', id, { text, createdAt: new Date().toISOString() });
        return `"${id}" {{saved}} (${(await store.list('notes')).length}개)`;
      },
    }),

    defineTool('note_get', {
      description: '노트를 조회합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
      },
      handler: async ({ id }) => {
        const note = await store.get('notes', id);
        if (!note) return `"${id}" {{not_found}}`;
        return JSON.stringify(note);
      },
    }),

    defineTool('note_list', {
      description: '전체 노트 목록',
      params: {},
      handler: async () => {
        const entries = await store.entries('notes');
        if (entries.length === 0) return '노트가 없습니다';
        return entries.map((e) => `- ${e.key}: ${e.value.text}`).join('\n');
      },
    }),

    defineTool('note_delete', {
      description: '노트를 삭제합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
      },
      handler: async ({ id }) => {
        const existed = await store.delete('notes', id);
        if (!existed) return `"${id}" {{not_found}}`;
        return `"${id}" {{deleted}}`;
      },
    }),

    // ── 검색 (캐시 대상) ──
    defineTool('search', {
      description: '키워드로 노트를 검색합니다',
      params: {
        query: { type: 'string', description: '검색어' },
      },
      handler: async ({ query }) => {
        const entries = await store.entries('notes');
        const results = entries.filter((e) =>
          e.key.includes(query) || e.value.text.includes(query),
        );
        if (results.length === 0) return `"${query}" {{not_found}}`;
        return results.map((e) => `- ${e.key}: ${e.value.text}`).join('\n');
      },
    }),

    // ── 송금 (검증 대상) ──
    defineTool('transfer', {
      description: '가상 송금 (validatorPlugin 검증 데모)',
      params: {
        to: { type: 'string', description: '수신자' },
        amount: { type: 'number', description: '금액' },
      },
      handler: async ({ to, amount }) => {
        return `${to}에게 ${amount.toLocaleString()}원 송금 완료`;
      },
    }),

    // ── 서버 상태 ──
    defineTool('status', {
      description: '서버 상태를 반환합니다',
      params: {},
      handler: async () => {
        return JSON.stringify(server.status(), null, 2);
      },
    }),
  ],

  resources: [
    defineResource({
      name: 'plugin-list',
      uri: 'file:///plugins',
      description: '활성화된 플러그인 목록',
      handler: async () => {
        return JSON.stringify([
          'timeoutPlugin(10s)', 'retryPlugin(2x)', 'circuitBreakerPlugin(3/30s)',
          'cachePlugin(60s)', 'queuePlugin(2-10)', 'sanitizerPlugin',
          'validatorPlugin', 'transformPlugin', 'i18nPlugin(ko/en/ja)',
          'perUserRateLimitPlugin(20/min)', 'jsonLoggerPlugin', 'dryrunPlugin',
        ], null, 2);
      },
    }),
  ],

  prompts: [
    definePrompt({
      name: 'note-assistant',
      description: '노트 관리 어시스턴트 프롬프트',
      args: [{ name: 'task', description: '작업 설명' }],
      handler: async ({ task }) => [
        { role: 'user', content: `당신은 노트 관리 어시스턴트입니다. 다음 작업을 수행하세요: ${task}\n\n사용 가능한 도구: note_add, note_get, note_list, note_delete, search` },
      ],
    }),
  ],
});

server.start();
