import { useState, useCallback, useContext, useMemo } from 'react';
import type { Language } from '@/types';
import { I18nContext, getTranslation, detectLanguage } from '@/i18n';

export function useLanguageProvider() {
  const [lang, setLangState] = useState<Language>(detectLanguage);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('air-lang', newLang);
    document.documentElement.lang = newLang;
  }, []);

  const t = useCallback((key: string) => getTranslation(lang, key), [lang]);

  return useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
}

export function useLanguage() {
  return useContext(I18nContext);
}
