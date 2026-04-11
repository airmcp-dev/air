# 프롬프트

프롬프트는 MCP 클라이언트가 호출할 수 있는 재사용 가능한 메시지 템플릿입니다. LLM 대화에 구조화된 메시지를 생성합니다.

## 도구 vs 프롬프트

| | 도구 (Tool) | 프롬프트 (Prompt) |
|---|---|---|
| **용도** | AI가 코드를 실행 | AI에게 보낼 메시지 템플릿 |
| **호출 주체** | AI가 자동으로 선택·실행 | 사용자가 명시적으로 선택 |
| **반환값** | 실행 결과 (텍스트, 이미지 등) | 메시지 배열 (role + content) |
| **예시** | DB 쿼리 실행, 파일 생성 | "이 코드를 리뷰해줘" 템플릿 |

간단한 규칙: **서버에서 뭔가 실행하면 도구**, **AI에게 보낼 메시지를 조립하면 프롬프트**.

## 기본 프롬프트

```typescript
import { definePrompt } from '@airmcp-dev/core';

const summarize = definePrompt('summarize', {
  description: '콘텐츠 요약',
  arguments: [
    { name: 'text', description: '요약할 텍스트', required: true },
    { name: 'style', description: '요약 스타일 (간략/상세)', required: false },
  ],
  handler: async ({ text, style }) => [
    {
      role: 'user',
      content: `다음을 ${style || '간략'}하게 요약해주세요:\n\n${text}`,
    },
  ],
});
```

## definePrompt API

두 가지 호출 방식:

```typescript
// 방식 1: 이름 + 옵션
definePrompt('summarize', { description, arguments, handler });

// 방식 2: 단일 객체
definePrompt({ name: 'summarize', description, arguments, handler });
```

### AirPromptDef

```typescript
interface AirPromptDef {
  name: string;                     // 프롬프트 이름
  description?: string;             // 설명
  arguments?: AirPromptArg[];       // 인자 정의
  handler: (args: Record<string, string>) => Promise<AirPromptMessage[]> | AirPromptMessage[];
}
```

`handler`는 동기 함수와 비동기 함수 모두 가능합니다.

### AirPromptArg

```typescript
interface AirPromptArg {
  name: string;          // 인자 이름
  description?: string;  // 설명
  required?: boolean;    // 기본: false
}
```

### AirPromptMessage

```typescript
interface AirPromptMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

내부적으로 MCP SDK에 등록될 때 `{ role, content: { type: 'text', text: content } }` 형식으로 변환됩니다.

## 인자

프롬프트 인자는 모두 `string` 타입입니다 (도구의 params와 달리 타입 지정 불가). MCP 프로토콜 스펙에 의한 제약입니다.

```typescript
definePrompt('search-help', {
  arguments: [
    { name: 'topic', description: '검색 주제', required: true },
    { name: 'language', description: '응답 언어', required: false },
  ],
  handler: ({ topic, language }) => [
    {
      role: 'user',
      content: `${topic}에 대해 ${language || '한국어'}로 설명해주세요.`,
    },
  ],
});
```

인자가 없는 프롬프트:

```typescript
definePrompt('greeting', {
  description: '기본 인사 메시지',
  handler: () => [
    { role: 'user', content: '안녕하세요! 무엇을 도와드릴까요?' },
  ],
});
```

## 멀티턴 프롬프트

여러 메시지를 반환하여 대화 템플릿을 만들 수 있습니다:

```typescript
definePrompt('code-review', {
  description: '코드 리뷰 및 개선 제안',
  arguments: [
    { name: 'code', description: '리뷰할 코드', required: true },
    { name: 'language', description: '프로그래밍 언어', required: true },
  ],
  handler: ({ code, language }) => [
    {
      role: 'user',
      content: `이 ${language} 코드를 버그와 개선점 위주로 리뷰해주세요:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    },
    {
      role: 'assistant',
      content: '잠재적 버그, 성능 문제, 스타일 개선점을 살펴보겠습니다.',
    },
    {
      role: 'user',
      content: '보안 취약점이 있다면 집중해주세요.',
    },
  ],
});
```

## 실전 사용 사례

### 문서 작성 도우미

```typescript
definePrompt('write-doc', {
  description: 'API 문서 작성 템플릿',
  arguments: [
    { name: 'functionName', description: '함수 이름', required: true },
    { name: 'signature', description: '함수 시그니처', required: true },
    { name: 'purpose', description: '함수 목적', required: true },
  ],
  handler: ({ functionName, signature, purpose }) => [
    {
      role: 'user',
      content: `다음 함수에 대한 API 문서를 작성해주세요.

함수: ${functionName}
시그니처: ${signature}
목적: ${purpose}

다음 형식으로 작성해주세요:
- 설명
- 파라미터 표
- 반환값
- 사용 예제
- 주의사항`,
    },
  ],
});
```

### SQL 쿼리 도우미

```typescript
definePrompt('sql-help', {
  description: 'SQL 쿼리 작성 도우미',
  arguments: [
    { name: 'tables', description: '사용 가능한 테이블 목록', required: true },
    { name: 'question', description: '자연어 질문', required: true },
  ],
  handler: ({ tables, question }) => [
    {
      role: 'user',
      content: `다음 테이블 구조를 참고하여 SQL 쿼리를 작성해주세요.

테이블:
${tables}

질문: ${question}

PostgreSQL 문법으로 작성하고, 설명도 함께 제공해주세요.`,
    },
  ],
});
```

### 에러 분석

```typescript
definePrompt('analyze-error', {
  description: '에러 로그 분석 및 해결 방안 제시',
  arguments: [
    { name: 'error', description: '에러 메시지 또는 스택 트레이스', required: true },
    { name: 'context', description: '에러 발생 맥락', required: false },
  ],
  handler: ({ error, context }) => [
    {
      role: 'user',
      content: `다음 에러를 분석하고 해결 방안을 제시해주세요.

에러:
${error}
${context ? `\n맥락:\n${context}` : ''}

다음을 포함해주세요:
1. 에러 원인 분석
2. 해결 방안 (코드 포함)
3. 재발 방지 조치`,
    },
  ],
});
```

## 서버에 등록

```typescript
defineServer({
  prompts: [
    definePrompt('summarize', {
      description: '텍스트 요약',
      arguments: [{ name: 'text', required: true }],
      handler: ({ text }) => [
        { role: 'user', content: `요약해주세요: ${text}` },
      ],
    }),
    definePrompt('translate', {
      description: '텍스트 번역',
      arguments: [
        { name: 'text', description: '번역할 텍스트', required: true },
        { name: 'to', description: '대상 언어', required: true },
      ],
      handler: ({ text, to }) => [
        { role: 'user', content: `${to}(으)로 번역해주세요: ${text}` },
      ],
    }),
  ],
});
```
