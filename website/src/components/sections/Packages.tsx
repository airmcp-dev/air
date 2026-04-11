import { type FC } from 'react';
import { useLanguage } from '@/hooks';
import { Section } from '@/components/ui';
import { PACKAGES, NPM_URL } from '@/constants';

const PKG_ICONS: Record<string, string> = {
  '@airmcp-dev/core': 'fa-solid fa-cube',
  '@airmcp-dev/cli': 'fa-solid fa-terminal',
  '@airmcp-dev/gateway': 'fa-solid fa-network-wired',
  '@airmcp-dev/logger': 'fa-solid fa-scroll',
  '@airmcp-dev/meter': 'fa-solid fa-layer-group',
  '@airmcp-dev/shield': 'fa-solid fa-shield-halved',
  '@airmcp-dev/hive': 'fa-solid fa-server',
};

const Packages: FC = () => {
  const { t } = useLanguage();
  const openSource = PACKAGES.filter((p) => p.license === 'Apache-2.0');
  const commercial = PACKAGES.filter((p) => p.license === 'Commercial');

  return (
    <Section id="packages" className="relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-air-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-air-500/20 to-transparent" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-air-500 font-mono text-sm mb-3 flex items-center justify-center gap-2">
            <i className="fa-brands fa-npm text-xs" />
            @airmcp-dev
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight mb-3">
            {t('packages.title')}
          </h2>
          <p className="text-text-secondary text-base">{t('packages.subtitle')}</p>
        </div>

        {/* Open Source */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-air-500" />
            <span className="text-xs font-mono text-air-400 uppercase tracking-widest">{t('packages.opensource')}</span>
            <span className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs font-mono text-text-muted/40">Apache-2.0</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openSource.map((pkg, i) => (
              <a key={pkg.name} href={NPM_URL} target="_blank" rel="noopener noreferrer"
                className="opacity-0 animate-fade-in-up group block"
                style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'forwards' }}>
                <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]
                                transition-all duration-400 hover:bg-white/[0.04] hover:border-air-500/20
                                hover:shadow-[0_0_30px_-8px_rgba(0,212,170,0.1)]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-air-500/[0.08] text-air-400 text-sm
                                    group-hover:bg-air-500/15 transition-colors duration-300">
                      <i className={PKG_ICONS[pkg.name] ?? 'fa-solid fa-cube'} />
                    </div>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-text-muted/0 group-hover:text-text-muted/50 transition-all duration-300" />
                  </div>
                  <div className="font-mono text-sm text-air-400/90 font-medium mb-1.5 truncate">
                    {pkg.name.replace('@airmcp-dev/', '')}
                  </div>
                  <p className="text-text-muted text-xs leading-relaxed">{t(pkg.descriptionKey)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Commercial */}
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">{t('packages.commercial')}</span>
            <span className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs font-mono text-text-muted/40">Commercial License</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {commercial.map((pkg, i) => (
              <div key={pkg.name}
                className="opacity-0 animate-fade-in-up group block"
                style={{ animationDelay: `${(openSource.length + i) * 0.06}s`, animationFillMode: 'forwards' }}>
                <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-amber-500/10
                                transition-all duration-400 hover:bg-white/[0.04] hover:border-amber-400/20
                                hover:shadow-[0_0_30px_-8px_rgba(245,158,11,0.08)]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-500/[0.08] text-amber-400 text-sm
                                    group-hover:bg-amber-500/15 transition-colors duration-300">
                      <i className={PKG_ICONS[pkg.name] ?? 'fa-solid fa-cube'} />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded-md bg-amber-500/10 text-amber-400/80 border border-amber-500/15">
                      Enterprise
                    </span>
                  </div>
                  <div className="font-mono text-sm text-amber-300/90 font-medium mb-1.5 truncate">
                    {pkg.name.replace('@airmcp-dev/', '')}
                  </div>
                  <p className="text-text-muted text-xs leading-relaxed">{t(pkg.descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <code className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs font-mono text-text-muted">
            <span className="text-air-500/50">$</span>
            npm install @airmcp-dev/core
          </code>
        </div>
      </div>
    </Section>
  );
};

export default Packages;
