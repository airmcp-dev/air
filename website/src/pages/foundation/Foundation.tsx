import { type FC } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn } from '@/components/common';
import { LABS_URL, GITHUB_URL } from '@/constants';

const ROADMAP_ITEMS = [
  { versionKey: 'fnd.rm.1.version', titleKey: 'fnd.rm.1.title', statusKey: 'fnd.rm.1.status', itemsKey: 'fnd.rm.1.items' },
  { versionKey: 'fnd.rm.2.version', titleKey: 'fnd.rm.2.title', statusKey: 'fnd.rm.2.status', itemsKey: 'fnd.rm.2.items' },
  { versionKey: 'fnd.rm.3.version', titleKey: 'fnd.rm.3.title', statusKey: 'fnd.rm.3.status', itemsKey: 'fnd.rm.3.items' },
  { versionKey: 'fnd.rm.4.version', titleKey: 'fnd.rm.4.title', statusKey: 'fnd.rm.4.status', itemsKey: 'fnd.rm.4.items' },
];

const Foundation: FC = () => {
  const { t } = useLanguage();

  return (
    <div>

      {/* ━━━ HERO ━━━ */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-air-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="section-container relative z-10 max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted tracking-wider uppercase mb-5">Air Foundation</p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="font-display text-[1.5rem] sm:text-[1.8rem] lg:text-[2.1rem] font-extrabold leading-[1.25] tracking-tight text-text-primary mb-6">
              {t('fnd.hero.title')}
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-text-secondary text-[15px] sm:text-base leading-[1.8] max-w-3xl mb-8">
              {t('fnd.hero.sub')}
            </p>
          </FadeIn>
          <FadeIn delay={240}>
            <div className="flex flex-wrap gap-3">
              <a href="https://docs.airmcp.dev" className="btn-primary">
                <i className="fa-solid fa-book text-xs" /> {t('fnd.hero.cta.docs')}
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <i className="fa-brands fa-github" /> {t('fnd.hero.cta.github')}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 숫자 ━━━ */}
      <section className="py-14 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { value: '7', label: t('fnd.num.packages') },
                { value: '19', label: t('fnd.num.plugins') },
                { value: '110', label: t('fnd.num.pages') },
                { value: 'Apache-2.0', label: t('fnd.num.license'), small: true },
              ].map((s) => (
                <div key={s.label} className="text-center py-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                  <div className={`font-mono ${s.small ? 'text-lg' : 'text-3xl'} font-extrabold text-air-400 mb-1`}>{s.value}</div>
                  <div className="text-[11px] text-text-muted">{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 미션 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">Mission</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-6">
              {t('fnd.mission.title')}
            </h2>
          </FadeIn>
          <FadeIn delay={80}>
            <p className="text-text-secondary text-sm leading-[1.8] max-w-4xl">
              {t('fnd.mission.desc')}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 원칙 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('fnd.principles.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-10">
              {t('fnd.principles.title')}
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: 'fa-sliders', titleKey: 'fnd.pr.1.t', descKey: 'fnd.pr.1.d' },
              { icon: 'fa-cubes', titleKey: 'fnd.pr.2.t', descKey: 'fnd.pr.2.d' },
              { icon: 'fa-microscope', titleKey: 'fnd.pr.3.t', descKey: 'fnd.pr.3.d' },
              { icon: 'fa-wand-magic-sparkles', titleKey: 'fnd.pr.4.t', descKey: 'fnd.pr.4.d' },
            ].map(({ icon, titleKey, descKey }, i) => (
              <FadeIn key={titleKey} delay={i * 100}>
                <div className="group p-5 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                hover:border-air-500/10 hover:bg-white/[0.03] transition-all duration-300 h-full">
                  <div className="w-9 h-9 rounded-xl bg-air-500/[0.06] flex items-center justify-center mb-4
                                  text-air-400/50 group-hover:text-air-400 group-hover:bg-air-500/10 transition-all duration-300">
                    <i className={`fa-solid ${icon} text-sm`} />
                  </div>
                  <h3 className="font-display text-sm font-bold text-text-primary mb-1.5">{t(titleKey)}</h3>
                  <p className="text-text-muted text-[13px] leading-relaxed">{t(descKey)}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 하는 일 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('fnd.what.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-10">
              {t('fnd.what.title')}
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: 'fa-cube', titleKey: 'fnd.do.1.t', descKey: 'fnd.do.1.d' },
              { icon: 'fa-book-open', titleKey: 'fnd.do.2.t', descKey: 'fnd.do.2.d' },
              { icon: 'fa-puzzle-piece', titleKey: 'fnd.do.3.t', descKey: 'fnd.do.3.d' },
              { icon: 'fa-shield-halved', titleKey: 'fnd.do.4.t', descKey: 'fnd.do.4.d' },
            ].map(({ icon, titleKey, descKey }, i) => (
              <FadeIn key={titleKey} delay={i * 100}>
                <div className="group p-5 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                hover:border-air-500/10 hover:bg-white/[0.03] transition-all duration-300 h-full">
                  <div className="w-9 h-9 rounded-xl bg-air-500/[0.06] flex items-center justify-center mb-4
                                  text-air-400/50 group-hover:text-air-400 group-hover:bg-air-500/10 transition-all duration-300">
                    <i className={`fa-solid ${icon} text-sm`} />
                  </div>
                  <h3 className="font-display text-sm font-bold text-text-primary mb-1.5">{t(titleKey)}</h3>
                  <p className="text-text-muted text-[13px] leading-relaxed">{t(descKey)}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 로드맵 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('fnd.roadmap.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-10">
              {t('fnd.roadmap.title')}
            </h2>
          </FadeIn>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[18px] sm:left-[22px] top-0 bottom-0 w-px bg-white/[0.06]" />

            <div className="space-y-6">
              {ROADMAP_ITEMS.map(({ versionKey, titleKey, statusKey, itemsKey }, i) => {
                const status = t(statusKey);
                const isCurrent = status === 'current';
                const isNext = status === 'next';

                return (
                  <FadeIn key={versionKey} delay={i * 120}>
                    <div className="relative flex gap-5">
                      {/* Dot */}
                      <div className={`relative z-10 flex-shrink-0 w-[38px] sm:w-[46px] h-[38px] sm:h-[46px] rounded-xl flex items-center justify-center
                        ${isCurrent
                          ? 'bg-air-500/20 border-2 border-air-500/40 shadow-[0_0_20px_-4px_rgba(0,212,170,0.3)]'
                          : isNext
                            ? 'bg-air-500/[0.08] border border-air-500/20'
                            : 'bg-white/[0.03] border border-white/[0.06]'
                        }`}>
                        <span className={`font-mono text-[11px] font-bold ${isCurrent ? 'text-air-400' : isNext ? 'text-air-400/60' : 'text-text-muted/40'}`}>
                          {t(versionKey)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className={`flex-1 p-5 rounded-xl border transition-all duration-300
                        ${isCurrent
                          ? 'bg-air-500/[0.03] border-air-500/15 hover:border-air-500/25'
                          : 'bg-white/[0.015] border-white/[0.04] hover:border-white/[0.08]'
                        }`}>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className={`font-display text-sm font-bold ${isCurrent ? 'text-air-400' : 'text-text-primary'}`}>
                            {t(titleKey)}
                          </h3>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-air-500/10 border border-air-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-air-500 animate-glow-pulse" />
                              <span className="font-mono text-[9px] text-air-400 uppercase">Current</span>
                            </span>
                          )}
                          {isNext && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08]">
                              <span className="font-mono text-[9px] text-text-muted uppercase">Next</span>
                            </span>
                          )}
                        </div>
                        <p className="text-text-muted text-[13px] leading-relaxed">{t(itemsKey)}</p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 기여 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('fnd.contribute.label')}</p>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-text-primary tracking-tight mb-3">
              {t('fnd.contribute.title')}
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-10 max-w-2xl">{t('fnd.contribute.desc')}</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: 'fa-bug', titleKey: 'fnd.ct.1.t', descKey: 'fnd.ct.1.d', href: `${GITHUB_URL}/issues/new`, color: 'red' },
              { icon: 'fa-puzzle-piece', titleKey: 'fnd.ct.2.t', descKey: 'fnd.ct.2.d', href: 'https://docs.airmcp.dev/examples/custom-plugin', color: 'air' },
              { icon: 'fa-pen-to-square', titleKey: 'fnd.ct.3.t', descKey: 'fnd.ct.3.d', href: `${GITHUB_URL}/tree/main/docs`, color: 'amber' },
              { icon: 'fa-comments', titleKey: 'fnd.ct.4.t', descKey: 'fnd.ct.4.d', href: `${GITHUB_URL}/discussions`, color: 'violet' },
            ].map(({ icon, titleKey, descKey, href, color }, i) => (
              <FadeIn key={titleKey} delay={i * 100}>
                <a href={href} target="_blank" rel="noopener noreferrer"
                   className="group block p-5 rounded-xl bg-white/[0.015] border border-white/[0.04]
                              hover:border-air-500/15 hover:bg-white/[0.03] transition-all duration-300 h-full">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 transition-all duration-300
                    ${color === 'red' ? 'bg-red-500/[0.06] text-red-400/50 group-hover:text-red-400 group-hover:bg-red-500/10'
                      : color === 'amber' ? 'bg-amber-500/[0.06] text-amber-400/50 group-hover:text-amber-400 group-hover:bg-amber-500/10'
                      : color === 'violet' ? 'bg-violet-500/[0.06] text-violet-400/50 group-hover:text-violet-400 group-hover:bg-violet-500/10'
                      : 'bg-air-500/[0.06] text-air-400/50 group-hover:text-air-400 group-hover:bg-air-500/10'
                    }`}>
                    <i className={`fa-solid ${icon} text-sm`} />
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-sm font-bold text-text-primary mb-1.5">{t(titleKey)}</h3>
                      <p className="text-text-muted text-[13px] leading-relaxed">{t(descKey)}</p>
                    </div>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-text-muted/0 group-hover:text-text-muted/40 transition-all duration-300 mt-1 ml-2 flex-shrink-0" />
                  </div>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 거버넌스 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <div className="grid lg:grid-cols-2 gap-12">
            <FadeIn>
              <div>
                <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">Governance</p>
                <h2 className="font-display text-lg font-extrabold text-text-primary tracking-tight mb-4">
                  {t('fnd.gov.title')}
                </h2>
                <p className="text-text-secondary text-sm leading-[1.8]">{t('fnd.gov.desc')}</p>
              </div>
            </FadeIn>

            <div className="space-y-3">
              {[
                { icon: 'fa-scale-balanced', titleKey: 'fnd.gov.1.t', descKey: 'fnd.gov.1.d' },
                { icon: 'fa-code-branch', titleKey: 'fnd.gov.2.t', descKey: 'fnd.gov.2.d' },
                { icon: 'fa-comments', titleKey: 'fnd.gov.3.t', descKey: 'fnd.gov.3.d' },
              ].map(({ icon, titleKey, descKey }, i) => (
                <FadeIn key={titleKey} delay={i * 100}>
                  <div className="flex gap-3 p-4 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                  hover:border-air-500/10 hover:bg-white/[0.03] transition-all duration-300">
                    <div className="w-7 h-7 rounded-lg bg-air-500/[0.06] flex items-center justify-center flex-shrink-0 text-air-400/50">
                      <i className={`fa-solid ${icon} text-[11px]`} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-text-primary mb-0.5">{t(titleKey)}</h4>
                      <p className="text-text-muted text-[12px] leading-relaxed">{t(descKey)}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 팀 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">Team</p>
            <h2 className="font-display text-lg font-extrabold text-text-primary tracking-tight mb-4">
              {t('fnd.team.title')}
            </h2>
            <p className="text-text-secondary text-sm leading-[1.8] mb-8 max-w-2xl">{t('fnd.team.desc')}</p>
          </FadeIn>

          <div className="flex flex-wrap gap-3">
            {[
              { href: LABS_URL, icon: 'fa-solid fa-globe', label: 'CodePedia Labs', external: true },
              { href: GITHUB_URL, icon: 'fa-brands fa-github', label: 'github.com/airmcp-dev', external: true },
              { href: 'mailto:labs@codepedia.kr', icon: 'fa-solid fa-envelope', label: 'labs@codepedia.kr', external: false },
            ].map(({ href, icon, label, external }, i) => (
              <FadeIn key={label} delay={i * 100}>
                <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                   className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]
                              hover:border-air-500/15 hover:bg-white/[0.04] transition-all duration-300
                              text-sm text-text-secondary hover:text-text-primary">
                  <i className={`${icon} text-air-400/50 text-xs`} />
                  {label}
                  {external && <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-text-muted/30" />}
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Foundation;
