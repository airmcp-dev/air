import { type FC } from 'react';
import { useLanguage } from '@/hooks';
import { Section, SectionHeader, Card } from '@/components/ui';

const FEATURE_KEYS = [
  { key: 'plugins', icon: 'fa-puzzle-piece' },
  { key: 'security', icon: 'fa-shield-halved' },
  { key: 'transport', icon: 'fa-right-left' },
  { key: 'cli', icon: 'fa-terminal' },
  { key: 'meter', icon: 'fa-layer-group' },
  { key: 'gateway', icon: 'fa-server' },
] as const;

const Features: FC = () => {
  const { t } = useLanguage();

  return (
    <Section id="features">
      <SectionHeader title={t('features.title')} subtitle={t('features.subtitle')} />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURE_KEYS.map(({ key, icon }, i) => (
          <Card key={key} className="group">
            <div
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'forwards' }}
            >
              <div className="icon-box icon-box-hover mb-5">
                <i className={`fa-solid ${icon}`} />
              </div>
              <h3 className="font-display text-base font-bold text-text-primary mb-2 tracking-tight">
                {t(`features.${key}.title`)}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {t(`features.${key}.desc`)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
};

export default Features;
