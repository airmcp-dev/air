import { type FC } from 'react';
import { useLanguage } from '@/hooks';
import type { Language } from '@/types';

const LanguageToggle: FC = () => {
  const { lang, setLang } = useLanguage();

  const toggle = () => {
    const next: Language = lang === 'en' ? 'ko' : 'en';
    setLang(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono 
                 text-text-secondary border border-surface-4 rounded-md
                 transition-all duration-200 hover:border-air-500/40 hover:text-air-500"
      aria-label="Toggle language"
    >
      <span className={lang === 'en' ? 'text-air-500' : 'text-text-muted'}>EN</span>
      <span className="text-surface-4">/</span>
      <span className={lang === 'ko' ? 'text-air-500' : 'text-text-muted'}>KO</span>
    </button>
  );
};

export default LanguageToggle;
