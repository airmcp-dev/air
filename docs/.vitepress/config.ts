import { defineConfig } from 'vitepress';

/* ── 사이드바 빌더 ── */
const guideSidebar = (prefix: string, ko = false) => [
  {
    text: ko ? '소개' : 'Introduction',
    items: [
      { text: ko ? 'air란?' : 'What is air?', link: `${prefix}/guide/what-is-air` },
      { text: ko ? '시작하기' : 'Getting Started', link: `${prefix}/guide/getting-started` },
      { text: ko ? '설정 파일' : 'Configuration', link: `${prefix}/guide/configuration` },
      { text: ko ? 'MCP SDK에서 마이그레이션' : 'Migrate from MCP SDK', link: `${prefix}/guide/migration` },
    ],
  },
  {
    text: ko ? '핵심' : 'Essentials',
    items: [
      { text: ko ? '서버 정의' : 'Define a Server', link: `${prefix}/guide/server` },
      { text: ko ? '도구' : 'Tools', link: `${prefix}/guide/tools` },
      { text: ko ? '리소스' : 'Resources', link: `${prefix}/guide/resources` },
      { text: ko ? '프롬프트' : 'Prompts', link: `${prefix}/guide/prompts` },
    ],
  },
  {
    text: ko ? '기능' : 'Features',
    items: [
      { text: ko ? '플러그인' : 'Plugins', link: `${prefix}/guide/plugins` },
      { text: ko ? '트랜스포트' : 'Transport', link: `${prefix}/guide/transport` },
      { text: ko ? '스토리지' : 'Storage', link: `${prefix}/guide/storage` },
      { text: ko ? '미들웨어' : 'Middleware', link: `${prefix}/guide/middleware` },
      { text: ko ? '에러 처리' : 'Error Handling', link: `${prefix}/guide/error-handling` },
      { text: ko ? '로깅' : 'Logging', link: `${prefix}/guide/logging` },
    ],
  },
  {
    text: ko ? '운영' : 'Operations',
    items: [
      { text: 'Meter', link: `${prefix}/guide/meter` },
      { text: 'Gateway', link: `${prefix}/guide/gateway` },
    ],
  },
  {
    text: 'CLI',
    items: [
      { text: ko ? '명령어' : 'Commands', link: `${prefix}/guide/cli` },
      { text: ko ? '템플릿' : 'Templates', link: `${prefix}/guide/templates` },
      { text: ko ? '클라이언트 연결' : 'Client Connect', link: `${prefix}/guide/connect` },
    ],
  },
  {
    text: ko ? '테스트' : 'Testing',
    items: [
      { text: ko ? '테스트 작성' : 'Writing Tests', link: `${prefix}/guide/testing` },
    ],
  },
  {
    text: ko ? '배포' : 'Deploy',
    items: [
      { text: ko ? '프로덕션' : 'Production', link: `${prefix}/guide/deploy` },
      { text: 'Cloudflare Workers', link: `${prefix}/guide/deploy-cloudflare` },
    ],
  },
  {
    text: ko ? '고급' : 'Advanced',
    items: [
      { text: ko ? '아키텍처' : 'Architecture', link: `${prefix}/guide/architecture` },
      { text: ko ? '플러그인 매니페스트' : 'Plugin Manifest', link: `${prefix}/guide/plugin-registry` },
      { text: ko ? 'AI 컨텍스트 문서' : 'AI Context Document', link: `${prefix}/guide/ai-context` },
      { text: ko ? '알려진 문제 & FAQ' : 'Troubleshooting & FAQ', link: `${prefix}/guide/troubleshooting` },
    ],
  },
];

const examplesSidebar = (prefix: string, ko = false) => [
  {
    text: ko ? '예제' : 'Examples',
    items: [
      { text: ko ? 'REST API 래퍼' : 'REST API Wrapper', link: `${prefix}/examples/rest-api` },
      { text: ko ? 'CRUD 서버' : 'CRUD Server', link: `${prefix}/examples/crud` },
      { text: ko ? 'AI 에이전트' : 'AI Agent', link: `${prefix}/examples/agent` },
      { text: ko ? '멀티서버 Gateway' : 'Multi-Server Gateway', link: `${prefix}/examples/gateway` },
      { text: ko ? 'Markdown 노트' : 'Markdown Notes', link: `${prefix}/examples/notes` },
      { text: ko ? 'GitHub 이슈 관리' : 'GitHub Issues', link: `${prefix}/examples/github-issues` },
      { text: ko ? '데이터 파이프라인' : 'Data Pipeline', link: `${prefix}/examples/data-pipeline` },
      { text: ko ? '시스템 모니터링' : 'System Monitoring', link: `${prefix}/examples/monitoring` },
      { text: ko ? '커스텀 플러그인 만들기' : 'Building Custom Plugins', link: `${prefix}/examples/custom-plugin` },
    ],
  },
];

const apiSidebar = (prefix: string, ko = false) => [
  {
    text: ko ? '코어 레퍼런스' : 'Core Reference',
    items: [
      { text: ko ? '서버' : 'Server', link: `${prefix}/api/server` },
      { text: ko ? '도구' : 'Tools', link: `${prefix}/api/tools` },
      { text: ko ? '리소스 & 프롬프트' : 'Resources & Prompts', link: `${prefix}/api/resources-prompts` },
      { text: ko ? '미들웨어 & 에러' : 'Middleware & Errors', link: `${prefix}/api/middleware` },
      { text: ko ? '스토리지' : 'Storage', link: `${prefix}/api/storage` },
      { text: ko ? '플러그인 API' : 'Plugin API', link: `${prefix}/api/plugins` },
      { text: ko ? '설정 & 트랜스포트' : 'Config & Transport', link: `${prefix}/api/config` },
    ],
  },
  {
    text: ko ? '플러그인 상세' : 'Plugin Details',
    items: [
      { text: ko ? '개요' : 'Overview', link: `${prefix}/plugins/` },
      { text: ko ? '안정성' : 'Stability', link: `${prefix}/plugins/stability` },
      { text: ko ? '성능' : 'Performance', link: `${prefix}/plugins/performance` },
      { text: ko ? '보안' : 'Security', link: `${prefix}/plugins/security` },
      { text: ko ? '네트워크' : 'Network', link: `${prefix}/plugins/network` },
      { text: ko ? '데이터' : 'Data', link: `${prefix}/plugins/data` },
      { text: ko ? '모니터링' : 'Monitoring', link: `${prefix}/plugins/monitoring` },
      { text: ko ? '개발/테스트' : 'Dev / Test', link: `${prefix}/plugins/dev` },
      { text: ko ? '커스텀 플러그인' : 'Custom Plugins', link: `${prefix}/plugins/custom` },
    ],
  },
  {
    text: ko ? '패키지' : 'Packages',
    items: [
      { text: '@airmcp-dev/cli', link: `${prefix}/api/cli` },
      { text: '@airmcp-dev/gateway', link: `${prefix}/api/gateway` },
      { text: '@airmcp-dev/logger', link: `${prefix}/api/logger` },
      { text: '@airmcp-dev/meter', link: `${prefix}/api/meter` },
    ],
  },
];

const siteNav = (ko = false) => [
  {
    text: ko ? '가이드' : 'Guide',
    link: ko ? '/ko/guide/getting-started' : '/guide/getting-started',
    activeMatch: ko ? '/ko/guide/' : '/guide/',
  },
  {
    text: ko ? '레퍼런스' : 'Reference',
    link: ko ? '/ko/api/server' : '/api/server',
    activeMatch: ko ? '(/ko/api/|/ko/plugins/)' : '(/api/|/plugins/)',
  },
  {
    text: ko ? '예제' : 'Examples',
    link: ko ? '/ko/examples/rest-api' : '/examples/rest-api',
    activeMatch: ko ? '/ko/examples/' : '/examples/',
  },
  { text: ko ? '홈페이지' : 'Homepage', link: 'https://airmcp.dev' },
];

/* ── VitePress Config ── */
export default defineConfig({
  title: 'air',
  titleTemplate: ':title — air docs',
  description: 'Build, run, and manage MCP servers with TypeScript.',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://docs.airmcp.dev' },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#00d4aa' }],
    // Font Awesome
    ['link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css', integrity: 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==', crossorigin: 'anonymous', referrerpolicy: 'no-referrer' }],
    // SEO
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'air — MCP Server Framework' }],
    ['meta', { property: 'og:description', content: 'Build, run, and manage MCP servers with TypeScript.' }],
    ['meta', { property: 'og:url', content: 'https://docs.airmcp.dev' }],
    ['meta', { property: 'og:site_name', content: 'air docs' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'air — MCP Server Framework' }],
    ['meta', { name: 'twitter:description', content: 'Build, run, and manage MCP servers with TypeScript.' }],
    // 보안
    ['meta', { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' }],
    ['meta', { name: 'referrer', content: 'strict-origin-when-cross-origin' }],
    // 성능
    ['link', { rel: 'dns-prefetch', href: 'https://cdn.jsdelivr.net' }],
    ['link', { rel: 'dns-prefetch', href: 'https://cdnjs.cloudflare.com' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: siteNav(),
        sidebar: {
          '/guide/': guideSidebar(''),
          '/examples/': examplesSidebar(''),
          '/api/': apiSidebar(''),
          '/plugins/': apiSidebar(''),
        },
      },
    },
    ko: {
      label: '한국어',
      lang: 'ko',
      themeConfig: {
        nav: siteNav(true),
        sidebar: {
          '/ko/guide/': guideSidebar('/ko', true),
          '/ko/examples/': examplesSidebar('/ko', true),
          '/ko/api/': apiSidebar('/ko', true),
          '/ko/plugins/': apiSidebar('/ko', true),
        },
        outlineTitle: '이 페이지',
        lastUpdatedText: '마지막 수정',
        docFooter: { prev: '이전', next: '다음' },
        returnToTopLabel: '맨 위로',
        sidebarMenuLabel: '메뉴',
        darkModeSwitchLabel: '다크 모드',
      },
    },
  },

  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'air',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/airmcp-dev/air' },
      { icon: 'npm', link: 'https://www.npmjs.com/org/airmcp-dev' },
    ],

    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: `Copyright © ${new Date().getFullYear()} Air Foundation. Built by CodePedia Labs.`,
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          ko: {
            translations: {
              button: { buttonText: '검색', buttonAriaLabel: '검색' },
              modal: {
                displayDetails: '상세 표시',
                resetButtonTitle: '초기화',
                backButtonTitle: '뒤로',
                noResultsText: '결과 없음',
                footer: { selectText: '선택', navigateText: '이동', closeText: '닫기' },
              },
            },
          },
        },
        miniSearch: {
          options: {
            tokenize: (text: string) => {
              // CJK 문자를 개별 토큰으로 분리 + 일반 단어 분리
              const tokens: string[] = [];
              // 일반 단어 (영문, 숫자, 하이픈)
              const wordRegex = /[\w-]+/g;
              let match;
              while ((match = wordRegex.exec(text)) !== null) {
                tokens.push(match[0].toLowerCase());
              }
              // CJK 바이그램 (한국어, 중국어, 일본어)
              const cjk = text.replace(/[\x00-\x7F]+/g, ' ').trim();
              if (cjk) {
                const chars = [...cjk.replace(/\s+/g, '')];
                for (let i = 0; i < chars.length; i++) {
                  tokens.push(chars[i]);
                  if (i + 1 < chars.length) tokens.push(chars[i] + chars[i + 1]);
                }
              }
              return tokens;
            },
          },
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, text: 2 },
          },
        },
      },
    },
    lastUpdated: { text: 'Last updated' },
  },
});
