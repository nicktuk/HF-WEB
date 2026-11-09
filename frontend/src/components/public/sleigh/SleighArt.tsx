'use client';

import { useId } from 'react';

export function Reindeer({ rednose = false }: { rednose?: boolean }) {
  return (
    <g>
      <g className="sleigh-gallop">
        <path d="M-26 6 L-44 22 M-16 8 L-26 28 M16 8 L32 22 M24 6 L42 14" stroke="#5C3A22" strokeWidth="6" strokeLinecap="round" />
      </g>
      <ellipse cx="0" cy="0" rx="34" ry="14" fill="#8B5A3C" />
      <ellipse cx="2" cy="5" rx="21" ry="6" fill="#C49A6C" />
      <ellipse cx="-35" cy="-4" rx="6" ry="4" fill="#F3E6D2" />
      <path d="M22 -4 L34 -24 L46 -18 L32 4 Z" fill="#8B5A3C" />
      <path d="M24 -6 Q34 -2 40 -12 L42 -8 Q34 4 22 -1 Z" fill="#DC2626" />
      <circle cx="31" cy="-3" r="3.5" fill="#FACC15" />
      <ellipse cx="44" cy="-26" rx="13" ry="9" fill="#8B5A3C" />
      <ellipse cx="54" cy="-23" rx="7" ry="5" fill="#C49A6C" />
      <path d="M38 -34 C34 -46 28 -48 24 -56 M32 -44 L25 -44 M46 -34 C48 -46 54 -50 58 -58 M51 -46 L58 -46" stroke="#5C3A22" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="-29" r="2" fill="#0B1A2E" />
      {rednose && (
        <>
          <circle cx="60" cy="-24" r="5.5" fill="#EF4444" />
          <circle cx="58.5" cy="-25.5" r="2" fill="#FECACA" />
        </>
      )}
    </g>
  );
}

/** Fondo nocturno del popup del trineo: cielo, luna, estrellas, nieve, casas y árbol. */
export function NightScene() {
  const skyId = `hefa-sky-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 760 540" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1A2E" />
          <stop offset="1" stopColor="#1E3A5F" />
        </linearGradient>
      </defs>
      <rect width="760" height="540" fill={`url(#${skyId})`} />
      <circle cx="660" cy="80" r="40" fill="#FEF9C3" />
      <circle cx="648" cy="70" r="7" fill="#FDE68A" />
      <circle cx="672" cy="94" r="5" fill="#FDE68A" />
      <g className="sleigh-twinkle">
        <circle cx="60" cy="50" r="2" fill="#fff" />
        <circle cx="180" cy="110" r="1.6" fill="#fff" />
        <circle cx="300" cy="40" r="2.2" fill="#fff" />
        <circle cx="450" cy="90" r="1.5" fill="#fff" />
        <circle cx="560" cy="30" r="1.8" fill="#fff" />
        <circle cx="720" cy="170" r="1.6" fill="#fff" />
        <circle cx="110" cy="200" r="1.4" fill="#fff" />
      </g>
      <path d="M0 470 Q190 440 380 462 T760 452 V540 H0 Z" fill="#E2E8F0" />
      <rect x="40" y="448" width="60" height="44" fill="#334155" />
      <path d="M32 450 L70 420 L108 450 Z" fill="#F8FAFC" />
      <rect x="58" y="462" width="12" height="12" fill="#FDE047" />
      <rect x="600" y="444" width="64" height="48" fill="#334155" />
      <path d="M592 446 L632 414 L672 446 Z" fill="#F8FAFC" />
      <rect x="614" y="458" width="12" height="12" fill="#FDE047" />
      <rect x="640" y="466" width="10" height="26" fill="#7C2D12" />
      <polygon points="520,410 540,460 500,460" fill="#166534" />
      <polygon points="520,428 546,478 494,478" fill="#15803D" />
      <circle cx="520" cy="408" r="4" fill="#FACC15" />
    </svg>
  );
}

type TeamSpot = { x: number; y: number; s: number };

/**
 * Tiro de 4 renos en 2 parejas. La pareja de atrás va más arriba, un poco
 * más chica y más oscura para dar profundidad; el de nariz roja encabeza
 * la fila de adelante. En mobile (`compact`) el tiro es más chico y va más
 * pegado al trineo para no salirse del popup.
 */
const TEAM: Record<'wide' | 'compact', { back: TeamSpot[]; front: TeamSpot[] }> = {
  wide: {
    back: [{ x: 466, y: 240, s: 1.1 }, { x: 554, y: 212, s: 1.1 }],
    front: [{ x: 450, y: 286, s: 1.25 }, { x: 540, y: 258, s: 1.25 }],
  },
  compact: {
    back: [{ x: 450, y: 250, s: 0.9 }, { x: 528, y: 226, s: 0.9 }],
    front: [{ x: 432, y: 290, s: 1.0 }, { x: 510, y: 266, s: 1.0 }],
  },
};

/** Trineo con riendas, rastro dorado y 4 renos en 2 parejas (sin la imagen). */
export function SleighTeam({ compact = false }: { compact?: boolean }) {
  const { back, front } = TEAM[compact ? 'compact' : 'wide'];
  const reins = (row: TeamSpot[]) =>
    ['352,300', ...row.map((r) => `${r.x - 10 * r.s},${r.y - 10 * r.s}`)].join(' ');
  return (
    <svg viewBox="0 0 600 400" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <path d="M30 330 C0 336 -40 326 -80 340" stroke="#FACC15" strokeWidth="3" fill="none" strokeDasharray="2 9" strokeLinecap="round" />
      {/* Pareja de atrás */}
      <polyline points={reins(back)} fill="none" stroke="#FACC15" strokeWidth="2" opacity="0.75" />
      <g opacity="0.82">
        {back.map((r) => (
          <g key={`b${r.x}`} transform={`translate(${r.x} ${r.y}) scale(${r.s})`}><Reindeer /></g>
        ))}
      </g>
      {/* Pareja de adelante */}
      <polyline points={reins(front)} fill="none" stroke="#FACC15" strokeWidth="2.2" />
      {front.map((r, i) => (
        <g key={`f${r.x}`} transform={`translate(${r.x} ${r.y}) scale(${r.s})`}>
          <Reindeer rednose={i === front.length - 1} />
        </g>
      ))}
      <path d="M40 286 H330 L346 252 L362 252 L348 312 Q342 330 324 330 H52 Q30 330 34 304 Z" fill="#B91C1C" />
      <path d="M44 296 H332" stroke="#FACC15" strokeWidth="4" />
      <path d="M70 330 V346 M300 330 V346" stroke="#FACC15" strokeWidth="4" />
      <path d="M24 346 H340 Q362 346 366 326" stroke="#FACC15" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="350" cy="250" r="6" fill="#FACC15" />
    </svg>
  );
}
