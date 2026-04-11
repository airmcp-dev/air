import { type FC } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * air Logo Mark
 *
 * Three flowing airstream lines inside a rounded square.
 * Represents: airflow, protocol layers, data streams.
 */
const Logo: FC<LogoProps> = ({ size = 32, className = '' }) => (
  <svg
    viewBox="0 0 36 36"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="airLogoGrad" x1="4" y1="4" x2="32" y2="32">
        <stop offset="0%" stopColor="#2bfda9" />
        <stop offset="100%" stopColor="#00a87a" />
      </linearGradient>
    </defs>

    {/* Rounded square container */}
    <rect
      x="1.5" y="1.5" width="33" height="33" rx="9"
      stroke="url(#airLogoGrad)" strokeWidth="1.5" opacity="0.5"
    />

    {/* Three airflow curves -- stacked, offset */}
    {/* Top stream */}
    <path
      d="M9 13 C12 9, 18 9, 21 13 C24 17, 27 11, 27 11"
      stroke="url(#airLogoGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.5"
    />
    {/* Middle stream (primary) */}
    <path
      d="M9 18 C13 13, 19 13, 22 18 C25 23, 27 17, 27 17"
      stroke="url(#airLogoGrad)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"
    />
    {/* Bottom stream */}
    <path
      d="M9 23 C12 19, 18 19, 21 23 C24 27, 27 21, 27 21"
      stroke="url(#airLogoGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.5"
    />

    {/* Dot accent at origin */}
    <circle cx="9" cy="18" r="1.8" fill="#2bfda9" opacity="0.8" />
  </svg>
);

export default Logo;
