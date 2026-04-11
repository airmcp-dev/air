# AI 컨텍스트 문서

AI 코딩 어시스턴트에게 air 프레임워크를 알려주는 컨텍스트 문서입니다. 프로젝트에 이 파일을 포함하면 AI가 air API를 정확하게 사용합니다.

## 사용 방법

### Claude

**Claude Desktop — 프로젝트 지식에 추가:**

프로젝트를 만들고 Knowledge에 컨텍스트 파일을 업로드합니다. 이후 해당 프로젝트에서 air 관련 질문 시 AI가 정확한 API를 사용합니다.

**Claude Code — 프로젝트에 파일 추가:**

아래 내용을 복사하여 프로젝트 루트에 `CLAUDE.md`로 저장합니다. Claude Code는 이 파일을 자동으로 읽습니다.

### Cursor

아래 내용을 복사하여 프로젝트 루트에 `.cursorrules`로 저장합니다. Cursor는 이 파일을 자동으로 컨텍스트에 포함합니다.

### GitHub Copilot

아래 내용을 복사하여 `.github/copilot-instructions.md`로 저장합니다.

### 기타 AI 어시스턴트

Windsurf, Cline, Aider 등 대부분의 AI 코딩 도구에서 사용할 수 있습니다. 각 도구의 컨텍스트 파일 규칙에 맞게 저장하거나, 대화 시작 시 첫 메시지에 내용을 붙여넣으세요.

## 컨텍스트 문서 내용

아래 내용을 복사하여 사용하세요. AI 컨텍스트는 호환성을 위해 영문으로 작성되어 있습니다.

::: details 전체 내용 보기 (클릭하여 펼치기)

<<< @/public/air-context.md

:::

## 포함 내용

- defineServer, defineTool, defineResource, definePrompt 전체 API
- 19개 내장 플러그인 시그니처와 권장 순서
- StorageAdapter 전체 메서드 (set/get/delete/list/entries/append/query)
- 미들웨어 작성법 (before/after/onError)
- McpErrors 팩토리 전체
- CLI 명령어와 지원 클라이언트 목록
- Gateway 설정
- 커스텀 플러그인 구조
- 주의사항 (ESM, stdio 로그, TTL 단위 등)
