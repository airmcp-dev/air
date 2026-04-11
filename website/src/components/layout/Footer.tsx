import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks';
import { Logo } from '@/components/common';
import { FOOTER_SECTIONS, LABS_URL, GITHUB_URL } from '@/constants';

const Footer: FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/[0.04] bg-surface-0">
      <div className="section-container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <Logo size={26} />
              <span className="font-display text-base font-extrabold text-text-primary">air</span>
            </Link>
            <p className="text-text-muted text-sm leading-relaxed mb-5">Build, run, and manage<br />MCP servers.</p>
            <div className="flex items-center gap-4 mb-4">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-air-400 transition-colors"><i className="fa-brands fa-github text-base" /></a>
              <a href="https://www.npmjs.com/org/airmcp-dev" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-air-400 transition-colors"><i className="fa-brands fa-npm text-base" /></a>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>{t('footer.builtBy')}</span>
              <a href={LABS_URL} target="_blank" rel="noopener noreferrer" className="text-air-500/80 hover:text-air-400 transition-colors">CodePedia Labs</a>
            </div>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <h4 className="font-display text-xs font-bold text-text-primary mb-4 uppercase tracking-wider">{t(section.titleKey)}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-200">{t(link.labelKey)}</a>
                    ) : (
                      <Link to={link.href} className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-200">{t(link.labelKey)}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted/60">&copy; {new Date().getFullYear()} {t('footer.copyright')}</p>
          <span className="text-xs font-mono text-text-muted/40">Apache-2.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
