# air v0.1.5 배포 완료 — 2026-04-12

## npm publish 완료 (5개 패키지)
- @airmcp-dev/core@0.1.5
- @airmcp-dev/cli@0.1.5
- @airmcp-dev/gateway@0.1.5
- @airmcp-dev/logger@0.1.5
- @airmcp-dev/meter@0.1.5

## v0.1.5 변경 내역 (v0.1.4 → v0.1.5)

### 버그 수정 (6건)
1. FileStore append 성능: readFile+writeFile O(n²) → appendFile O(1)
2. Shield 전역 상태 격리: rateLimitWindows/auditLog를 클로저 내부로 이동 (멀티서버 격리)
3. SSE 모드 리소스/프롬프트 누락 버그 수정
4. retryPlugin: 재시도 루프 완결 + state:{} → 서버 state 전달 + dead code 제거
5. cache abort 시 after 미들웨어 미실행 → abort 시에도 after 체인 실행 (로깅/메트릭 보장)
6. queuePlugin setTimeout 누적 방지: release 시 clearTimeout 호출

### 리팩토링 (2건)
7. SSE 팩토리 메서드 추출: registerToolToServer/registerResourceToServer/registerPromptToServer + registerAllToServer
8. SDK 타입 우회 5곳 제거: (server as any).registerResource → server.resource() 공식 API 등

### 타입/API 추가 (3건)
9. ShieldMiddleware 인터페이스 + AuditEntry 타입 export
10. AirConfig.maxSseSessions 필드 추가 (기본 200, 초과 시 503)
11. Gateway stdio proxy 에러 메시지 개선 (SSE/HTTP 사용 권장 안내)

### 테스트 추가 (34건, 165 → 199)
12. CLI 테스트 18개 신규: path-resolver, json-editor, connect 빌드 로직
13. 미들웨어 체인 엣지케이스 8개 추가 (3 → 11): abort→after, params 수정, onError recovery, _serverState 주입
14. 플러그인 조합 테스트 8개 신규: auth+cache, auth+sanitizer, retry+circuit-breaker, cache+timeout, 5플러그인 전체 조합

## 빌드/테스트 결과
- tsc --noEmit: core, gateway 에러 0
- vitest: 19파일 199테스트 전부 통과

## 다음 할 일
- GitHub tag v0.1.5 + Release 작성
- 웹사이트 Support.tsx RELEASES 배열에 v0.1.5 추가
- awesome-mcp PR
- dev.to 피드백 대응
