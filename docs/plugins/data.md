# Data Plugins

## transformPlugin

Declaratively transform tool inputs and outputs. Register before/after transform functions per tool or globally (`'*'`).

```typescript
import { transformPlugin } from '@airmcp-dev/core';

use: [transformPlugin({
  before: {
    '*': (params) => ({ ...params, _caller: 'air' }),
    'search': (params) => ({ ...params, query: params.query.trim() }),
  },
  after: {
    '*': (result) => ({ ...result, _processedAt: new Date().toISOString() }),
  },
})]
```

| Option | Type | Description |
|--------|------|-------------|
| `before` | `Record<string, (params) => params>` | Input transform (tool name or `'*'`) |
| `after` | `Record<string, (result) => result>` | Output transform |

Execution order: global (`'*'`) first, then tool-specific.

## i18nPlugin

Localize tool responses. Substitutes `{{key}}` placeholders from a translation dictionary.

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultLang` | `string` | `'en'` | Default language |
| `translations` | `Record<string, Record<string, string>>` | `{}` | Translation dict: key → { lang: text } |
| `langParam` | `string` | `'_lang'` | Language detection parameter name |

Usage: when a handler returns strings containing `"{{saved}}"`, the `_lang` parameter (or default language) determines which translation is applied.

```typescript
server.callTool('save', { data: '...', _lang: 'ja' });
// Handler returns "{{saved}}" → "保存完了"
```

Internal:
- `before`: saves `_lang` param to `meta._lang`, removes it from params
- `after`: if result is a string, substitutes `{{key}}` with translations
