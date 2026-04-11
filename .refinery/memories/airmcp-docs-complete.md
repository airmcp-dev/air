# airmcp-docs 문서 사이트 완료 상태

## 위치
- 소스: `/data/ssd/projects/active/air/docs/`
- 배포: `airmcp-docs.pages.dev` (CF Pages)
- 커스텀 도메인: `docs.airmcp.dev` (CF Dashboard에서 연결 필요)

## 구조
- VitePress 1.6.4
- 영한 이중 언어 (EN root, KO /ko/)

## 페이지 수
| 섹션 | 페이지 | 줄 수 |
|------|--------|-------|
| 가이드 | 50 (25×2) | 11,178 |
| API 레퍼런스 | 24 (12×2) | 2,897 |
| 플러그인 상세 | 18 (9×2) | 1,463 |
| 예제 | 18 (9×2) | 3,554 |
| **합계** | **110** | **19,092** |

## 네비게이션
`Guide | Reference | Examples | Homepage`

## 가이드 사이드바
소개(air란?/시작하기/설정/마이그레이션) → 핵심(서버/도구/리소스/프롬프트) → 기능(플러그인/트랜스포트/스토리지/미들웨어/에러/로깅) → 운영(Meter/Gateway) → CLI(명령어/템플릿/연결) → 테스트 → 배포(프로덕션/CF Workers) → 고급(아키텍처/플러그인 매니페스트/AI 컨텍스트/트러블슈팅)

## 레퍼런스 사이드바
코어(서버/도구/리소스&프롬프트/미들웨어&에러/스토리지/플러그인API/설정&트랜스포트) → 플러그인 상세(개요/안정성/성능/보안/네트워크/데이터/모니터링/개발테스트/커스텀) → 패키지(cli/gateway/logger/meter)

## 예제 사이드바
REST API 래퍼 / CRUD 서버 / AI 에이전트 / 멀티서버 Gateway / Markdown 노트 / GitHub 이슈 관리 / 데이터 파이프라인 / 시스템 모니터링 / 커스텀 플러그인 만들기

## 보안/최적화
- `_headers`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- CSP 제거 (VitePress 검색의 new Function() 충돌)
- Inter → 잠실체 재정의 (프리로드 경고 해결)
- sitemap.xml 자동 생성
- robots.txt
- 콘솔 배너 (air 로고 + 링크)
- CJK 바이그램 토크나이저 (한국어 검색)

## 폰트
- TheJamsil (잠실체) 6웨이트 — jsdelivr CDN
- Inter 프리로드를 잠실체로 재정의

## 완료된 검수
- 소스 코드 25개+ 파일 1:1 대조
- 심각한 팩트 오류 8건+ 수정
- Shield/Hive 엔터프라이즈 완전 제거
- authPlugin 키 하드코딩 → process.env 수정 4곳
- 영한 동기화 완료
- 보안 검수 완료

## 다음 작업
- 메인 페이지 (airmcp.dev) 작업
