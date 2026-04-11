import { type FC, type ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

const Section: FC<SectionProps> = ({ children, className = '', id }) => (
  <section id={id} className={`py-20 md:py-28 ${className}`}>
    <div className="section-container">{children}</div>
  </section>
);

export default Section;
