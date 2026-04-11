import { type FC } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}

const SectionHeader: FC<SectionHeaderProps> = ({ title, subtitle, align = 'center' }) => {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`mb-14 ${alignClass}`}>
      <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className={`text-text-secondary text-lg max-w-2xl ${align === 'center' ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
