import { type FC, useEffect, useRef } from 'react';

interface AsciiCubeProps {
  className?: string;
}

const AsciiCube: FC<AsciiCubeProps> = ({ className = '' }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const width = 80;
    const height = 50;
    const buffer: string[] = new Array(width * height);
    const zBuffer: number[] = new Array(width * height);

    let A = 0;
    let B = 0;
    let C = 0;

    const cubeWidth = 22;
    const distFromCam = 80;
    const K1 = 52;
    const incrementSpeed = 0.03;

    function calculateX(i: number, j: number, k: number): number {
      return (
        j * Math.sin(A) * Math.sin(B) * Math.cos(C) -
        k * Math.cos(A) * Math.sin(B) * Math.cos(C) +
        j * Math.cos(A) * Math.sin(C) +
        k * Math.sin(A) * Math.sin(C) +
        i * Math.cos(B) * Math.cos(C)
      );
    }

    function calculateY(i: number, j: number, k: number): number {
      return (
        j * Math.cos(A) * Math.cos(C) +
        k * Math.sin(A) * Math.cos(C) -
        j * Math.sin(A) * Math.sin(B) * Math.sin(C) +
        k * Math.cos(A) * Math.sin(B) * Math.sin(C) -
        i * Math.cos(B) * Math.sin(C)
      );
    }

    function calculateZ(i: number, j: number, k: number): number {
      return (
        k * Math.cos(A) * Math.cos(B) -
        j * Math.sin(A) * Math.cos(B) +
        i * Math.sin(B)
      );
    }

    function calculateSurface(
      cubeX: number,
      cubeY: number,
      cubeZ: number,
      ch: string
    ): void {
      const x = calculateX(cubeX, cubeY, cubeZ);
      const y = calculateY(cubeX, cubeY, cubeZ);
      const z = calculateZ(cubeX, cubeY, cubeZ) + distFromCam;

      const ooz = 1 / z;
      const xp = Math.floor(width / 2 + K1 * ooz * x);
      const yp = Math.floor(height / 2 + K1 * ooz * y * 0.55);

      const idx = xp + yp * width;
      if (idx >= 0 && idx < width * height && xp >= 0 && xp < width && yp >= 0 && yp < height) {
        if (ooz > zBuffer[idx]!) {
          zBuffer[idx] = ooz;
          buffer[idx] = ch;
        }
      }
    }

    function renderFrame(): void {
      buffer.fill(' ');
      zBuffer.fill(0);

      const step = 0.45;
      for (let cubeX = -cubeWidth; cubeX < cubeWidth; cubeX += step) {
        for (let cubeY = -cubeWidth; cubeY < cubeWidth; cubeY += step) {
          calculateSurface(cubeX, cubeY, -cubeWidth, '.');
          calculateSurface(cubeWidth, cubeY, cubeX, '$');
          calculateSurface(-cubeWidth, cubeY, -cubeX, '~');
          calculateSurface(-cubeX, cubeY, cubeWidth, '#');
          calculateSurface(cubeX, -cubeWidth, -cubeY, ';');
          calculateSurface(cubeX, cubeWidth, cubeY, '+');
        }
      }

      let output = '';
      for (let k = 0; k < width * height; k++) {
        output += k % width === 0 && k > 0 ? '\n' : '';
        output += buffer[k];
      }

      if (preRef.current) {
        preRef.current.textContent = output;
      }

      A += incrementSpeed * 0.8;
      B += incrementSpeed * 0.6;
      C += incrementSpeed * 0.3;

      frameRef.current = requestAnimationFrame(renderFrame);
    }

    frameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-air-500/[0.06] rounded-full blur-[100px] animate-glow-pulse" />
      </div>
      <pre
        ref={preRef}
        className="font-mono text-[11px] leading-[12px] text-air-500/70
                   whitespace-pre select-none relative z-10
                   drop-shadow-[0_0_14px_rgba(0,212,170,0.1)]"
        style={{ letterSpacing: '1.5px' }}
      />
    </div>
  );
};

export default AsciiCube;
