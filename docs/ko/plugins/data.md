# 데이터 플러그인

## transformPlugin

도구 입출력을 선언적으로 변환합니다. 도구별 또는 글로벌(`'*'`)로 before/after 변환 함수를 등록합니다.

```typescript
import { transformPlugin } from '@airmcp-dev/core';

use: [transformPlugin({
  before: {
    '*': (params) => ({ ...params, _caller: 'air' }),          // 모든 도구
    'search': (params) => ({ ...params, query: params.query.trim() }),  // search만
  },
  after: {
    '*': (result) => ({ ...result, _processedAt: new Date().toISOString() }),
  },
})]
```

| 옵션 | 타입 | 설명 |
|------|------|------|
| `before` | `Record<string, (params) => params>` | 입력 파라미터 변환 (도구명 또는 `'*'`) |
| `after` | `Record<string, (result) => result>` | 출력 결과 변환 |

실행 순서: 글로벌(`'*'`) 변환 먼저, 그 다음 도구별 변환.

## i18nPlugin

도구 응답을 사용자의 언어에 맞게 변환합니다. `{{key}}` 플레이스홀더를 번역 사전에서 치환합니다.

```typescript
import { i18nPlugin } from '@airmcp-dev/core';

use: [i18nPlugin({
  defaultLang: 'ko',
  translations: {
    'saved': { ko: '저장 완료', en: 'Saved', ja: '保存完了' },
    'not_found': { ko: '찾을 수 없습니다', en: 'Not found', ja: '見つかりません' },
  },
})]
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|-------|------|
| `defaultLang` | `string` | `'en'` | 기본 언어 |
| `translations` | `Record<string, Record<string, string>>` | `{}` | 번역 사전: 키 → { 언어: 텍스트 } |
| `langParam` | `string` | `'_lang'` | 언어 감지 파라미터 이름 |

사용 방식: 도구 핸들러가 `"{{saved}}"` 또는 `"결과: {{not_found}}"` 같은 문자열을 반환하면, 파라미터의 `_lang` 값(또는 기본 언어)에 따라 번역이 적용됩니다.

```typescript
// 도구 호출 시
server.callTool('save', { data: '...', _lang: 'ja' });
// 핸들러가 "{{saved}}" 반환 → "保存完了"
```

내부 동작:
- `before`: `_lang` 파라미터를 `meta._lang`에 저장 후 params에서 제거
- `after`: 결과가 string이면 `{{key}}`를 번역 사전에서 치환
