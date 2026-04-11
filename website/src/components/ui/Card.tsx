import { type FC, type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

const Card: FC<CardProps> = ({ children, className = '', hover = true }) => (
  <div className={`${hover ? 'glass-card-hover' : 'glass-card'} p-6 ${className}`}>
    {children}
  </div>
);

export default Card;
