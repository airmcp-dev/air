// @airmcp-dev/core — plugin/builtin/i18n.ts
//
// 다국어 응답 변환 플러그인.
// 도구 응답을 사용자의 언어에 맞게 변환.
// 번역 사전을 등록하면 자동으로 매칭.
//
// @example
//   defineServer({
//     use: [i18nPlugin({
//       defaultLang: 'ko',
//       translations: {
//         'saved': { ko: '저장 완료', en: 'Saved', ja: '保存完了' },
//         'not_found': { ko: '찾을 수 없습니다', en: 'Not found', ja: '見つかりません' },
//       },
//     })],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface I18nOptions {
  /** 기본 언어 (기본: 'en') */
  defaultLang?: string;
  /** 번역 사전: key → { lang: text } */
  translations?: Record<string, Record<string, string>>;
  /** 언어 감지 파라미터 이름 (기본: '_lang') */
  langParam?: string;
}

export function i18nPlugin(options?: I18nOptions): AirPlugin {
  const defaultLang = options?.defaultLang ?? 'en';
  const translations = options?.translations ?? {};
  const langParam = options?.langParam ?? '_lang';

  function translate(text: string, lang: string): string {
    let result = text;
    for (const [key, dict] of Object.entries(translations)) {
      const translated = dict[lang] || dict[defaultLang] || key;
      result = result.replaceAll(`{{${key}}}`, translated);
    }
    return result;
  }

  const middleware: AirMiddleware = {
    name: 'air:i18n',
    before: async (ctx) => {
      // 언어 파라미터를 meta에 저장하고 params에서 제거
      const lang = (ctx.params[langParam] as string) || defaultLang;
      ctx.meta._lang = lang;
      const { [langParam]: _, ...cleanParams } = ctx.params;
      return { params: cleanParams };
    },
    after: async (ctx) => {
      const lang = (ctx.meta._lang as string) || defaultLang;
      if (typeof ctx.result === 'string') {
        ctx.result = translate(ctx.result, lang);
      }
    },
  };

  return {
    meta: { name: 'air:i18n', version: '1.0.0' },
    middleware: [middleware],
  };
}
