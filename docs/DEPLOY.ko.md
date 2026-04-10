# air 프레임워크 — 내부 배포 가이드

이 문서는 air 프레임워크의 npm 배포 절차를 정리한 내부 문서입니다.

## 배포 정보

| 항목 | 값 |
|---|---|
| npm org | @airmcp-dev |
| GitHub | github.com/airmcp-dev/air |
| 도메인 | airmcp.dev |
| 이메일 | labs@codepedia.kr |
| 개발사 | CodePedia Labs (labs.codepedia.kr) |

## 배포된 패키지

| 패키지 | 라이선스 | 설명 |
|---|---|---|
| @airmcp-dev/core | Apache-2.0 | 서버, 도구, 플러그인 19개, 스토리지, 트랜스포트 |
| @airmcp-dev/cli | Apache-2.0 | CLI 12개 명령, 템플릿 8개 (ko/en x 4) |
| @airmcp-dev/gateway | Apache-2.0 | 멀티 서버 프록시, 로드밸런싱 |
| @airmcp-dev/logger | Apache-2.0 | 구조화된 로깅 |
| @airmcp-dev/meter | Apache-2.0 | 7-Layer 분류, 비용 추적 |
| @airmcp-dev/shield | Commercial | OWASP MCP Top 10, 고급 보안 (미배포) |
| @airmcp-dev/hive | Commercial | 프로세스 풀, 멀티테넌트 (미배포) |

## 배포 전 체크리스트

1. 테스트 통과 확인
   ```bash
   cd /data/ssd/projects/active/air
   npx vitest run    # 17파일 165개 전부 통과해야 함
   ```

2. 타입체크
   ```bash
   for pkg in core cli gateway logger meter shield hive; do
     cd /data/ssd/projects/active/air/packages/$pkg
     npx tsc --noEmit
   done
   ```

3. 버전 올리기 (모든 패키지 동시)
   ```bash
   # 현재 버전 확인
   grep '"version"' packages/*/package.json

   # 버전 올리기 (예: 0.1.0 → 0.2.0)
   find packages -name "package.json" -not -path "*/node_modules/*" \
     -exec sed -i 's/"version": "0.1.0"/"version": "0.2.0"/g' {} +

   # 의존성 버전도 동시에
   find packages examples -name "package.json" -not -path "*/node_modules/*" \
     -exec sed -i 's/"^0.1.0"/"^0.2.0"/g' {} +
   ```

## 배포 절차

### 1. npm 로그인

```bash
npm login
```

### 2. Access Token 설정 (2FA 활성화 시)

npm 사이트에서 Classic Token (Publish 타입) 생성 후:
```bash
npm config set //registry.npmjs.org/:_authToken=토큰값
```

토큰 관리: https://www.npmjs.com/settings/airmcp/tokens

### 3. 배포 스크립트 실행

```bash
cd /data/ssd/projects/active/air
bash scripts/publish.sh
```

스크립트가 하는 일:
1. 전체 패키지 tsc 빌드
2. exports 필드를 dist로 변경 (npm용)
3. 오픈소스 패키지 5개 publish
4. exports 필드를 src로 복원 (개발용)

### 4. 수동 배포 (개별 패키지)

```bash
# 빌드
cd packages/core && npx tsc

# exports를 dist로 변경
sed -i 's|./src/index.ts|./dist/index.js|g' package.json

# 배포
npm publish --access public

# exports 복원
sed -i 's|./dist/index.js|./src/index.ts|g' package.json
```

## 엔터프라이즈 패키지 배포 (shield, hive)

엔터프라이즈 패키지는 bytenode 바이트코드 컴파일 후 배포:

```bash
npx tsx scripts/build-enterprise.ts
```

라이선스 검증:
- RSA-SHA256 서명 (오프라인 검증)
- 라이선스 서버: license.airmcp.dev
- 머신 핑거프린트 바인딩
- 4시간마다 heartbeat

## 배포 후 확인

```bash
# npm에서 설치 테스트
mkdir /tmp/test && cd /tmp/test && npm init -y
npm install @airmcp-dev/core
npm install @airmcp-dev/cli

# CLI 동작 확인
npx @airmcp-dev/cli --help

# 프로젝트 생성 확인
npx @airmcp-dev/cli create test-server --lang ko
```

## 배포 롤백

```bash
# 특정 버전 unpublish (72시간 이내만 가능)
npm unpublish @airmcp-dev/core@0.1.0

# 또는 deprecate (삭제 대신 경고 표시)
npm deprecate @airmcp-dev/core@0.1.0 "이 버전에 버그가 있습니다. 0.2.0을 사용하세요."
```

## 주의사항

- exports 필드: 개발 시 `./src/index.ts`, npm publish 시 `./dist/index.js`
- workspace:* 의존성: 현재 실제 버전(`^0.1.0`)으로 교체됨. 새 버전 배포 시 함께 올려야 함
- 2FA: npm 계정에 2FA 활성화 권장. publish 시 Classic Token 사용
- shield/hive: 오픈소스 패키지와 별도 배포. bytenode 컴파일 필수
- bin 이름: `airmcp-dev` (npx @airmcp-dev/cli 또는 글로벌 설치 후 airmcp-dev)

## 파일 위치

| 파일 | 용도 |
|---|---|
| scripts/publish.sh | 오픈소스 패키지 배포 스크립트 |
| scripts/build-enterprise.ts | 엔터프라이즈 바이트코드 빌드 |
| packages/*/LICENSE | 패키지별 라이선스 파일 |
| packages/*/.npmignore | npm publish 시 제외 파일 |
