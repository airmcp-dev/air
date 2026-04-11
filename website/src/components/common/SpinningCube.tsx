import { type FC } from 'react';

interface SpinningCubeProps {
  size?: number;
  className?: string;
}

const SpinningCube: FC<SpinningCubeProps> = ({ size = 160, className = '' }) => {
  const half = size / 2;
  const faceStyle = (transform: string): React.CSSProperties => ({
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    border: '1px solid rgba(0, 212, 170, 0.2)',
    background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.06) 0%, rgba(0, 212, 170, 0.02) 100%)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    transform,
  });

  return (
    <div className={`perspective-1000 ${className}`} style={{ width: size, height: size }}>
      <div
        className="preserve-3d animate-spin-cube relative"
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div style={faceStyle(`translateZ(${half}px)`)}>
          <span className="font-mono text-air-500 text-lg font-bold tracking-wider">air</span>
        </div>
        {/* Back */}
        <div style={faceStyle(`rotateY(180deg) translateZ(${half}px)`)}>
          <span className="font-mono text-air-500/60 text-xs tracking-widest">MCP</span>
        </div>
        {/* Right */}
        <div style={faceStyle(`rotateY(90deg) translateZ(${half}px)`)}>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-[1px] bg-air-500/40" />
            <div className="w-4 h-[1px] bg-air-500/30" />
            <div className="w-8 h-[1px] bg-air-500/40" />
          </div>
        </div>
        {/* Left */}
        <div style={faceStyle(`rotateY(-90deg) translateZ(${half}px)`)}>
          <div className="flex flex-col items-center gap-1">
            <div className="w-3 h-3 border border-air-500/30 rounded-sm" />
          </div>
        </div>
        {/* Top */}
        <div style={faceStyle(`rotateX(90deg) translateZ(${half}px)`)}>
          <div className="w-4 h-4 border border-air-500/20 rotate-45" />
        </div>
        {/* Bottom */}
        <div style={faceStyle(`rotateX(-90deg) translateZ(${half}px)`)}>
          <div className="w-2 h-2 bg-air-500/30 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default SpinningCube;
