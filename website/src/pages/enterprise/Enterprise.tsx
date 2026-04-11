import { type FC } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn } from '@/components/common';

const Enterprise: FC = () => {
  const { t } = useLanguage();

  return (
    <div>

      {/* ━━━ HERO ━━━ */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-air-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="section-container relative z-10 max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted tracking-wider uppercase mb-5">Shield + Hive + Meter</p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="font-display text-[1.8rem] sm:text-[2.2rem] lg:text-[2.6rem] font-extrabold leading-[1.2] tracking-tight text-text-primary mb-6">
              {t('ent.hero.title')}
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-text-secondary text-[15px] sm:text-base leading-[1.8] mb-10 max-w-3xl">
              {t('ent.hero.sub')}
            </p>
          </FadeIn>
          <FadeIn delay={240}>
            <div className="flex flex-wrap gap-3">
              <a href="mailto:labs@codepedia.kr" className="btn-primary">
                {t('ent.cta.contact')} <i className="fa-solid fa-arrow-right text-xs" />
              </a>
              <a href="https://docs.airmcp.dev" className="btn-secondary" target="_blank" rel="noopener noreferrer">
                <i className="fa-solid fa-book text-xs" /> {t('ent.cta.docs')}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 시나리오 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container">
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted/60 tracking-wider uppercase mb-3">{t('ent.scenario.label')}</p>
            <h2 className="font-display text-xl md:text-2xl font-extrabold text-text-primary tracking-tight mb-12 max-w-2xl">
              {t('ent.scenario.title')}
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: 'fa-syringe', color: 'red', num: '01', titleKey: 'ent.sc1.title', descKey: 'ent.sc1.desc', resultKey: 'ent.sc1.result' },
              { icon: 'fa-server', color: 'amber', num: '02', titleKey: 'ent.sc2.title', descKey: 'ent.sc2.desc', resultKey: 'ent.sc2.result' },
              { icon: 'fa-chart-line', color: 'violet', num: '03', titleKey: 'ent.sc3.title', descKey: 'ent.sc3.desc', resultKey: 'ent.sc3.result' },
            ].map(({ icon, color, num, titleKey, descKey, resultKey }, i) => (
              <FadeIn key={num} delay={i * 120}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-[11px] text-text-muted/30">{num}</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                      ${color === 'red' ? 'bg-red-500/[0.08] text-red-400' : color === 'amber' ? 'bg-amber-500/[0.08] text-amber-400' : 'bg-violet-500/[0.08] text-violet-400'}`}>
                      <i className={`fa-solid ${icon} text-sm`} />
                    </div>
                  </div>
                  <h3 className="font-display text-base font-bold text-text-primary mb-2">{t(titleKey)}</h3>
                  <p className="text-text-secondary text-[13px] leading-relaxed mb-4 flex-1">{t(descKey)}</p>
                  <div className={`text-[12px] font-medium px-3 py-2 rounded-lg
                    ${color === 'red' ? 'bg-red-500/[0.05] text-red-400/80 border border-red-500/10'
                      : color === 'amber' ? 'bg-amber-500/[0.05] text-amber-400/80 border border-amber-500/10'
                      : 'bg-violet-500/[0.05] text-violet-400/80 border border-violet-500/10'}`}>
                    <i className="fa-solid fa-arrow-right text-[9px] mr-1.5" />{t(resultKey)}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SHIELD ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container">
          <div className="grid lg:grid-cols-12 gap-14">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <FadeIn>
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fa-solid fa-shield-halved text-air-500 text-sm" />
                    <span className="font-display text-xl font-bold text-text-primary">Shield</span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-text-primary tracking-tight mb-4 leading-tight">
                    {t('ent.shield.headline')}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-6">{t('ent.shield.sub')}</p>
                  <div className="font-mono text-[11px] text-text-muted/40 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] inline-block">
                    npm i @airmcp-dev/shield
                  </div>
                </FadeIn>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {[
                { icon: 'fa-crosshairs', titleKey: 'ent.sh.1.t', descKey: 'ent.sh.1.d' },
                { icon: 'fa-gavel', titleKey: 'ent.sh.2.t', descKey: 'ent.sh.2.d' },
                { icon: 'fa-shield-halved', titleKey: 'ent.sh.3.t', descKey: 'ent.sh.3.d' },
                { icon: 'fa-box', titleKey: 'ent.sh.4.t', descKey: 'ent.sh.4.d' },
                { icon: 'fa-gauge-high', titleKey: 'ent.sh.5.t', descKey: 'ent.sh.5.d' },
                { icon: 'fa-clipboard-list', titleKey: 'ent.sh.6.t', descKey: 'ent.sh.6.d' },
              ].map(({ icon, titleKey, descKey }, i) => (
                <FadeIn key={titleKey} delay={i * 80}>
                  <div className="group flex gap-4 p-4 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                  hover:border-air-500/15 hover:bg-white/[0.03] transition-all duration-300">
                    <div className="w-8 h-8 rounded-lg bg-air-500/[0.06] flex items-center justify-center flex-shrink-0 text-air-400/50 group-hover:text-air-400 transition-colors">
                      <i className={`fa-solid ${icon} text-xs`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary mb-0.5">{t(titleKey)}</h4>
                      <p className="text-text-muted text-[13px] leading-relaxed">{t(descKey)}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ HIVE ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container">
          <div className="grid lg:grid-cols-12 gap-14">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <FadeIn>
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fa-solid fa-server text-amber-400 text-sm" />
                    <span className="font-display text-xl font-bold text-text-primary">Hive</span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-text-primary tracking-tight mb-4 leading-tight">
                    {t('ent.hive.headline')}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-6">{t('ent.hive.sub')}</p>
                  <div className="font-mono text-[11px] text-text-muted/40 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] inline-block">
                    npm i @airmcp-dev/hive
                  </div>
                </FadeIn>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {[
                { icon: 'fa-cubes', titleKey: 'ent.hv.1.t', descKey: 'ent.hv.1.d' },
                { icon: 'fa-rotate', titleKey: 'ent.hv.2.t', descKey: 'ent.hv.2.d' },
                { icon: 'fa-users-between-lines', titleKey: 'ent.hv.3.t', descKey: 'ent.hv.3.d' },
                { icon: 'fa-circle-nodes', titleKey: 'ent.hv.4.t', descKey: 'ent.hv.4.d' },
                { icon: 'fa-eye', titleKey: 'ent.hv.5.t', descKey: 'ent.hv.5.d' },
              ].map(({ icon, titleKey, descKey }, i) => (
                <FadeIn key={titleKey} delay={i * 80}>
                  <div className="group flex gap-4 p-4 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                  hover:border-amber-500/15 hover:bg-white/[0.03] transition-all duration-300">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/[0.06] flex items-center justify-center flex-shrink-0 text-amber-400/50 group-hover:text-amber-400 transition-colors">
                      <i className={`fa-solid ${icon} text-xs`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary mb-0.5">{t(titleKey)}</h4>
                      <p className="text-text-muted text-[13px] leading-relaxed">{t(descKey)}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ METER ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-3xl">
          <FadeIn>
            <div className="flex items-center gap-2 mb-4">
              <i className="fa-solid fa-layer-group text-air-500 text-sm" />
              <span className="font-display text-xl font-bold text-text-primary">Meter</span>
              <span className="font-mono text-[9px] text-air-500/50 ml-1">Apache-2.0</span>
            </div>
            <h3 className="font-display text-xl font-extrabold text-text-primary tracking-tight mb-3 leading-tight">
              {t('ent.meter.headline')}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-10 max-w-2xl">{t('ent.meter.sub')}</p>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="p-5 rounded-xl bg-air-500/[0.03] border border-air-500/10 hover:border-air-500/20 transition-colors duration-300">
                <div className="font-mono text-[11px] text-air-400/60 mb-2">L1 -- Static Response</div>
                <div className="font-display text-3xl font-extrabold text-air-400 mb-1">1</div>
                <div className="text-text-muted text-[12px]">{t('ent.meter.l1')}</div>
              </div>
              <div className="p-5 rounded-xl bg-red-500/[0.03] border border-red-500/10 hover:border-red-500/20 transition-colors duration-300">
                <div className="font-mono text-[11px] text-red-400/60 mb-2">L7 -- Multi-Step Agent</div>
                <div className="font-display text-3xl font-extrabold text-red-400 mb-1">100</div>
                <div className="text-text-muted text-[12px]">{t('ent.meter.l7')}</div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-text-muted text-[13px] leading-relaxed">{t('ent.meter.body')}</p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 비교표 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <h3 className="font-display text-lg font-extrabold text-text-primary tracking-tight mb-8">
              {t('ent.compare.title')}
            </h3>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-white/[0.06] overflow-x-auto bg-white/[0.01]">
              {/* Header */}
              <div className="grid grid-cols-4 min-w-[500px] bg-white/[0.03] border-b border-white/[0.06]">
                <div className="px-5 py-4 font-mono text-[10px] text-text-muted/40 uppercase tracking-wider">{t('ent.compare.feature')}</div>
                <div className="px-5 py-4 text-center">
                  <div className="font-display text-sm font-bold text-text-primary">Core</div>
                  <div className="font-mono text-[9px] text-air-500/50 mt-0.5">Apache-2.0</div>
                </div>
                <div className="px-5 py-4 text-center">
                  <div className="font-display text-sm font-bold text-air-400">+ Shield</div>
                  <div className="font-mono text-[9px] text-text-muted/40 mt-0.5">Commercial</div>
                </div>
                <div className="px-5 py-4 text-center">
                  <div className="font-display text-sm font-bold text-amber-400">+ Hive</div>
                  <div className="font-mono text-[9px] text-text-muted/40 mt-0.5">Commercial</div>
                </div>
              </div>
              {/* Rows */}
              {[
                { feature: t('ent.cmp.server'), core: true, shield: true, hive: true },
                { feature: t('ent.cmp.plugins'), core: '19', shield: '19', hive: '19' },
                { feature: t('ent.cmp.transport'), core: true, shield: true, hive: true },
                { feature: t('ent.cmp.meter'), core: true, shield: true, hive: true },
                { feature: t('ent.cmp.threat'), core: false, shield: true, hive: false },
                { feature: t('ent.cmp.policy'), core: false, shield: true, hive: false },
                { feature: t('ent.cmp.owasp'), core: false, shield: '5', hive: false },
                { feature: t('ent.cmp.sandbox'), core: false, shield: true, hive: false },
                { feature: t('ent.cmp.audit'), core: false, shield: true, hive: false },
                { feature: t('ent.cmp.process'), core: false, shield: false, hive: true },
                { feature: t('ent.cmp.restart'), core: false, shield: false, hive: true },
                { feature: t('ent.cmp.tenant'), core: false, shield: false, hive: true },
                { feature: t('ent.cmp.cluster'), core: false, shield: false, hive: true },
                { feature: t('ent.cmp.support'), core: false, shield: true, hive: true },
              ].map(({ feature, core, shield, hive }, i) => (
                <div key={i} className={`grid grid-cols-4 min-w-[500px] border-b border-white/[0.03] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}
                                         hover:bg-white/[0.03] transition-colors duration-200`}>
                  <div className="px-5 py-3 text-[13px] text-text-secondary">{feature}</div>
                  {[core, shield, hive].map((val, j) => (
                    <div key={j} className="px-5 py-3 flex items-center justify-center">
                      {val === true ? <i className="fa-solid fa-check text-air-500 text-sm" />
                        : val === false ? <span className="text-text-muted/15 text-xs">--</span>
                        : <span className="font-mono text-[13px] text-air-400/80 font-medium">{val}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-text-muted/30 text-[11px] mt-4 font-mono text-center">{t('ent.compare.note')}</p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ 기술 지원 ━━━ */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="section-container max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-air-500/60 tracking-wider uppercase mb-3">{t('ent.support.label')}</p>
            <h3 className="font-display text-xl font-extrabold text-text-primary tracking-tight mb-10">
              {t('ent.support.title')}
            </h3>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: 'fa-headset', titleKey: 'ent.sup.1.t', descKey: 'ent.sup.1.d' },
              { icon: 'fa-code-branch', titleKey: 'ent.sup.2.t', descKey: 'ent.sup.2.d' },
              { icon: 'fa-graduation-cap', titleKey: 'ent.sup.3.t', descKey: 'ent.sup.3.d' },
              { icon: 'fa-wrench', titleKey: 'ent.sup.4.t', descKey: 'ent.sup.4.d' },
              { icon: 'fa-clock', titleKey: 'ent.sup.5.t', descKey: 'ent.sup.5.d' },
              { icon: 'fa-file-contract', titleKey: 'ent.sup.6.t', descKey: 'ent.sup.6.d' },
            ].map(({ icon, titleKey, descKey }, i) => (
              <FadeIn key={titleKey} delay={i * 80}>
                <div className="p-5 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:border-air-500/10 transition-colors duration-300 h-full">
                  <div className="w-8 h-8 rounded-lg bg-air-500/[0.06] flex items-center justify-center mb-3 text-air-400/60">
                    <i className={`fa-solid ${icon} text-xs`} />
                  </div>
                  <h4 className="text-sm font-bold text-text-primary mb-1">{t(titleKey)}</h4>
                  <p className="text-text-muted text-[12px] leading-relaxed">{t(descKey)}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <section className="py-24 border-t border-white/[0.04]">
        <div className="section-container text-center max-w-md mx-auto">
          <FadeIn>
            <h3 className="font-display text-xl font-extrabold text-text-primary mb-3">{t('ent.cta.title')}</h3>
            <p className="text-text-secondary text-sm mb-8 leading-relaxed">{t('ent.cta.desc')}</p>
            <a href="mailto:labs@codepedia.kr" className="btn-primary">
              <i className="fa-solid fa-envelope text-xs" /> labs@codepedia.kr
            </a>
            <p className="text-text-muted text-xs mt-4">{t('ent.cta.note')}</p>
          </FadeIn>
        </div>
      </section>

    </div>
  );
};

export default Enterprise;
