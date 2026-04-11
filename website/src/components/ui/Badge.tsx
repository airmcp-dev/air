import { type FC, type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'commercial';
}

const Badge: FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const variants = {
    default: 'bg-surface-3 text-text-secondary border-surface-4',
    accent: 'bg-air-500/10 text-air-400 border-air-500/20',
    commercial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono rounded-full border ${variants[variant]}`}>
      {children}
    </span>
  );
};

export default Badge;
