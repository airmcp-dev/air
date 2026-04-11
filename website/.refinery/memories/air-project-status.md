# air 프로젝트 현재 상태 — 2026-04-11

## npm 패키지 v0.1.4 publish 완료
- @airmcp-dev/core — README, homepage, repository, keywords, exports 수정
- @airmcp-dev/cli — 중복 필드 정리, exports 수정
- @airmcp-dev/gateway — exports 수정, README 추가
- @airmcp-dev/logger — exports 수정, README 추가
- @airmcp-dev/meter — exports 수정, README 추가
- 루트 package.json에 `"packageManager": "pnpm@9.15.4"` 추가

## 웹사이트
- docs.airmcp.dev — VitePress, CF Pages (airmcp-docs)
- airmcp.dev — React+Vite, CF Pages (airmcp-web)
- 커스텀 도메인 연결 완료

## 주요 변경 (이번 세션)
- /docs → docs.airmcp.dev 리다이렉트
- /community → GitHub Discussions 외부 링크
- Foundation 페이지 풍성하게 (원칙/로드맵/기여하기 추가)
- Support 페이지 재작성 (FAQ 검색 + 릴리즈 노트 타임라인)
- Footer 정리 (죽은 링크 제거)
- 모바일 레이아웃 수정 (overflow-x-hidden, gradient orb 축소, flex items-center)
- 보안 헤더, SEO 메타, preconnect, 콘솔 배너
- clearShutdownHandlers 문서 제거 (미export)
- E2E 14개 테스트 통과
- llama3.1 통합 테스트 5개 시나리오 통과
- README 전면 재작성 (Before/After, 실 사용 예제 3개, Ollama 연동)

## 다음 단계
- 블로그 포스트 작성 (dev.to / 벨로그)
- awesome-mcp 리스트 PR
- 트위터/X 홍보
- GitHub star 확보
