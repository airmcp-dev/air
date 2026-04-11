# air 프로젝트 최종 상태 — 2026-04-11

## 배포 현황
- docs.airmcp.dev — VitePress, CF Pages (airmcp-docs), 커스텀 도메인 연결 완료
- airmcp.dev — React+Vite+Tailwind, CF Pages (airmcp-web), 커스텀 도메인 연결 완료
- npm v0.1.4 — core, cli, gateway, logger, meter 전부 publish 완료
- GitHub Discussions — Welcome 공지 게시 완료
- dev.to — 블로그 포스트 게시 완료: https://dev.to/airmcpdev/a-simpler-way-to-build-mcp-servers-would-love-feedback-30h6

## npm 패키지 수정 (v0.1.3 → v0.1.4)
- 5개 패키지 전부 README.md 생성 (이전에는 npm 페이지가 빈 상태)
- exports: ./src/index.ts → { types: ./dist/index.d.ts, import: ./dist/index.js }
- core: homepage, repository, bugs, keywords 10개, engines, scripts 추가
- cli: 중복 keywords/repository 정리
- 루트: packageManager: pnpm@9.15.4 추가
- core에 scripts 섹션 추가 (누락되어 turbo가 No tasks 출력)
- 라이선스: 93개 의존성 전부 MIT/ISC/BSD/Apache-2.0 (위반 0건)
- 보안: core 0건, website 0건, docs esbuild moderate (프로덕션 무관)

## 문서 사이트 변경
- clearShutdownHandlers 제거 (api/server.md 영/한) — 실제 미export

## 웹사이트 변경
- /docs → docs.airmcp.dev 리다이렉트 (라우터 + _redirects)
- /community → GitHub Discussions 리다이렉트
- pages/community/ 디렉토리 삭제
- Hero: Link→a, 모바일 가운데 정렬 (flex items-center lg:items-start)
- Enterprise: Link→a, 비교표 overflow-x-auto + min-w-[500px]
- Foundation: 6→9섹션 (원칙/로드맵/기여하기/숫자보강)
- Support: 전면 재작성 (FAQ 검색 10개 + 릴리즈 노트 타임라인)
- Footer: docs→외부, changelog→릴리즈노트(/support), contributing→외부, status/pricing/codeOfConduct 제거
- 네비: community→외부 링크
- 모바일: overflow-x-hidden, gradient orb 축소, whitespace-nowrap 제거
- 보안: _headers, OG/Twitter 메타, preconnect 4개, robots.txt, sitemap.xml
- 기타: 콘솔 배너, @types/node, .gitignore, sk-xxx→process.env

## README 재작성
- 루트 README.md/README.ko.md: Before/After, 실사용 예제 3개, Ollama 연동, sk-xxx 제거
- 블로그 초안: blog/devto-en.md, blog/velog-ko.md

## E2E 검증
- 14개 기능 테스트 PASS
- llama3.1 통합 5개 시나리오 PASS
- 36/37 export 확인 (clearShutdownHandlers만 미export)

## 경쟁 분석
- 공식 MCP SDK: 월 9700만 다운로드, 저수준 SDK (air가 이 위에 빌드)
- FastMCP: v3.35, 787 dependents, 3000+ star — 가장 직접적 경쟁자
  - FastMCP > air: Edge Runtime, OAuth 2.1, 스트리밍, 프로그레스, 세션, HTTPS, Inspector CLI
  - air > FastMCP: 19 플러그인, 파라미터 단축, 내장 스토리지, 7-Layer Meter, Gateway
- mcp-framework: 클래스 기반, 디렉토리 자동 발견

## 마케팅
- dev.to 게시 완료
- X/Reddit/HN/벨로그/awesome-mcp는 사용자 패싱 (나중에)
- dev.to 피드백 대기 중

## 다음 할 일
- dev.to 피드백 오면 대응
- 릴리즈 노트 JSON 분리 (나중에)
- 새 버전 릴리즈 시 Support.tsx RELEASES 배열에 추가
