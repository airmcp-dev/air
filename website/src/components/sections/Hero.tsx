import { type FC, useState } from 'react';
import { useLanguage } from '@/hooks';
import { AsciiCube } from '@/components/common';
import { GITHUB_URL } from '@/constants';
import { copyToClipboard } from '@/utils';

const Hero: FC = () => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopyNpm = async () => {
    await copyToClipboard('npm install @airmcp-dev/core');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background noise */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`, backgroundSize: '80px 80px' }} />
      {/* Gradient orbs */}
      <div className="absolute top-[15%] left-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-gradient-radial from-air-500/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-gradient-radial from-indigo-500/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="section-container relative z-10 py-20 w-full">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          <div className="lg:col-span-3 space-y-7 flex flex-col items-center lg:items-start">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full animate-fade-in">
              <span className="w-1.5 h-1.5 bg-air-500 rounded-full" />
              <span className="text-xs font-mono text-text-secondary tracking-wide">{t('hero.badge')}</span>
            </div>
            {/* Title */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-extrabold leading-[1.15] tracking-tight animate-fade-in-up text-center lg:text-left">
              <span className="text-text-primary">{t('hero.title.line1')}</span>
              <br />
              <span className="gradient-text">{t('hero.title.line2')}</span>
            </h1>
            {/* Description */}
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed max-w-xl text-center lg:text-left opacity-0 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
              {t('hero.description')}
            </p>
            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              <a href="https://docs.airmcp.dev/guide/getting-started" className="btn-primary">
                <i className="fa-solid fa-arrow-right text-xs" />
                {t('hero.cta.getStarted')}
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <i className="fa-brands fa-github" />
                {t('hero.cta.viewGithub')}
              </a>
            </div>
            {/* npm command */}
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              <button onClick={handleCopyNpm}
                className="inline-flex items-center gap-3 px-5 py-3 bg-white/[0.03] border border-white/[0.07]
                           rounded-xl font-mono text-sm text-text-secondary hover:border-air-500/25
                           transition-all duration-300 group">
                <span className="text-air-500/50">$</span>
                <span className="text-text-secondary/80">{t('hero.cta.npm')}</span>
                <i className={`fa-solid ${copied ? 'fa-check text-air-500' : 'fa-copy text-text-muted group-hover:text-air-500'} text-xs transition-colors`} />
              </button>
            </div>
          </div>
          <div className="hidden lg:flex lg:col-span-2 items-center justify-center">
            <AsciiCube />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
