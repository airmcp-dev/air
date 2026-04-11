import { type FC, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks';
import { LanguageToggle, Logo } from '@/components/common';
import { NAV_ITEMS, GITHUB_URL } from '@/constants';

const Header: FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNavItem = (item: typeof NAV_ITEMS[number], className: string, onClick?: () => void) => {
    if (item.external) {
      return (
        <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
          {t(item.key)}
        </a>
      );
    }
    return (
      <Link key={item.path} to={item.path} className={className} onClick={onClick}>
        {t(item.key)}
      </Link>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-0/70 backdrop-blur-2xl border-b border-white/[0.04]">
      <div className="section-container">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
            <Logo size={30} className="transition-transform duration-300 group-hover:scale-110" />
            <span className="font-display text-lg font-extrabold text-text-primary tracking-tight
                             group-hover:text-air-400 transition-colors duration-300">air</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) =>
              renderNavItem(item, `nav-link ${!item.external && location.pathname === item.path ? 'nav-link-active' : ''}`)
            )}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <LanguageToggle />
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
               className="text-text-muted hover:text-text-primary transition-colors duration-300" aria-label="GitHub">
              <i className="fa-brands fa-github text-lg" />
            </a>
          </div>
          <button className="md:hidden p-2 text-text-secondary" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} />
          </button>
        </div>
        {mobileOpen && (
          <nav className="md:hidden py-4 border-t border-white/[0.04] space-y-1 animate-fade-in">
            {NAV_ITEMS.map((item) =>
              renderNavItem(
                item,
                `block px-4 py-2.5 rounded-xl text-sm transition-all duration-200
                  ${!item.external && location.pathname === item.path ? 'text-air-400 bg-air-500/[0.06]' : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'}`,
                () => setMobileOpen(false)
              )
            )}
            <div className="pt-3 px-4 flex items-center gap-4">
              <LanguageToggle />
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
                <i className="fa-brands fa-github text-lg" />
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
