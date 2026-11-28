import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useChristmasTheme } from '../lib/christmasTheme';

interface Flake {
  x: number;
  y: number;
  r: number;
  speedY: number;
  driftAmp: number;
  driftFreq: number;
  phase: number;
  opacity: number;
  warm: boolean;
}

const FAIRY_LIGHTS = Array.from({ length: 18 }, (_, i) => {
  const t = (i + 0.5) / 18;
  // Gentle scalloped festoon wave across 1440px width (3 arches)
  const archPhase = (t * 3) % 1;
  const sag = Math.sin(archPhase * Math.PI) * 14;
  return {
    id: i,
    x: t * 1440,
    y: 4 + sag,
    warmGold: i % 3 !== 1,
    delay: ((i * 0.43) % 3.2).toFixed(2),
    duration: (2.6 + (i % 4) * 0.65).toFixed(2),
  };
});

export function ChristmasAtmosphere() {
  const { isActive } = useChristmasTheme();
  const { pathname } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const lowerPath = pathname.toLowerCase();
  const isAdmin = lowerPath.startsWith('/beheer');
  const isMusic = lowerPath.startsWith('/music') || lowerPath.startsWith('/@music');
  const isMinimalOverlay =
    isAdmin ||
    isMusic ||
    lowerPath.startsWith('/video-play') ||
    lowerPath.startsWith('/inkijkexemplaar');

  useEffect(() => {
    if (!isActive) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const flakeCount = isMusic ? 26 : width < 640 ? 36 : 58;
    const flakes: Flake[] = Array.from({ length: flakeCount }, () => {
      const depth = Math.random(); // 0 = far/tiny, 1 = closer/softer
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.9 + depth * 2.1,
        speedY: 0.25 + depth * 0.65,
        driftAmp: 0.2 + Math.random() * 0.55,
        driftFreq: 0.004 + Math.random() * 0.008,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.22 + depth * 0.45,
        warm: Math.random() < 0.22,
      };
    });

    let rafId = 0;
    let tick = 0;

    const render = () => {
      if (!document.hidden) {
        ctx.clearRect(0, 0, width, height);
        tick += 1;

        for (let i = 0; i < flakes.length; i++) {
          const f = flakes[i];
          f.y += f.speedY;
          f.x += Math.sin(tick * f.driftFreq + f.phase) * f.driftAmp;

          if (f.y > height + 8) {
            f.y = -8;
            f.x = Math.random() * width;
          }
          if (f.x > width + 10) f.x = -10;
          if (f.x < -10) f.x = width + 10;

          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = f.warm
            ? `rgba(246, 224, 178, ${f.opacity})`
            : `rgba(255, 252, 246, ${f.opacity})`;
          ctx.fill();
        }
      }
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [isActive, isMusic]);

  if (!isActive) return null;

  return (
    <>
      {/* Subtle twinkling golden fairy-lights festoon along the top edge */}
      {!isMinimalOverlay && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[55] pointer-events-none select-none overflow-hidden h-9"
        >
          <svg
            viewBox="0 0 1440 36"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <defs>
              <radialGradient id="pvgWarmBulb" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF8DC" stopOpacity="1" />
                <stop offset="45%" stopColor="#E6B86A" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#C89B54" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="pvgAmberBulb" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFE8B5" stopOpacity="1" />
                <stop offset="45%" stopColor="#D98B38" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#B86B22" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Delicate scalloped golden wire */}
            <path
              d="M 0 4 Q 240 24 480 4 Q 720 24 960 4 Q 1200 24 1440 4"
              fill="none"
              stroke="rgba(212, 175, 106, 0.35)"
              strokeWidth="1"
            />

            {FAIRY_LIGHTS.map((bulb) => (
              <g key={bulb.id}>
                <circle
                  cx={bulb.x}
                  cy={bulb.y}
                  r="10"
                  fill={bulb.warmGold ? 'url(#pvgWarmBulb)' : 'url(#pvgAmberBulb)'}
                >
                  <animate
                    attributeName="opacity"
                    values="0.35;0.95;0.45;0.85;0.35"
                    dur={`${bulb.duration}s`}
                    begin={`${bulb.delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={bulb.x}
                  cy={bulb.y}
                  r="2.1"
                  fill={bulb.warmGold ? '#FFF8E1' : '#FFD89B'}
                >
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.7;1;0.6"
                    dur={`${bulb.duration}s`}
                    begin={`${bulb.delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Lightweight gentle snowfall canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`fixed inset-0 w-full h-full pointer-events-none select-none z-[45] ${
          isAdmin ? 'opacity-35' : isMusic ? 'opacity-60' : 'opacity-90'
        }`}
      />
    </>
  );
}
