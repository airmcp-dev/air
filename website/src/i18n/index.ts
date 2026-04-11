import { createContext } from 'react';
import type { Language } from '@/types';
import en from './en';
import ko from './ko';

export type { TranslationKey } from './en';

const translations: Record<Language, Record<string, string>> = { en, ko };

export function getTranslation(lang: Language, key: string): string {
  return translations[lang]?.[key] ?? key;
}

export function detectLanguage(): Language {
  const stored = localStorage.getItem('air-lang');
  if (stored === 'ko' || stored === 'en') return stored;
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('ko') ? 'ko' : 'en';
}

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key,
});
