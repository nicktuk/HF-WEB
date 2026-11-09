'use client';

import { useId, type CSSProperties } from 'react';
import { Reindeer } from '@/components/public/sleigh/SleighArt';

type ArtProps = { className?: string; style?: CSSProperties };

/** useId() devuelve ":r0:"; los dos puntos rompen url(#...) en algunos navegadores. */
function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

export function SantaHat({ className, style, flip = false }: ArtProps & { flip?: boolean }) {
  const finalStyle: CSSProperties | undefined = flip
    ? { ...style, transform: `${style?.transform ?? ''} scaleX(-1)`.trim() }
    : style;
  return (
    <svg viewBox="0 0 30 26" className={className} style={finalStyle} aria-hidden="true">
      <path d="M3 21 C8 6 18 1 26 9 L23 12 C19 7 13 9 10 21 Z" fill="#DC2626" />
      <rect x="1" y="19" width="14" height="5" rx="2.5" fill="#FFFFFF" stroke="#E4E4E7" strokeWidth="0.5" />
      <circle cx="26" cy="10" r="3.2" fill="#FFFFFF" stroke="#E4E4E7" strokeWidth="0.5" />
    </svg>
  );
}

export function ElfPeek({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 92 58" className={className} style={style} aria-hidden="true">
      <polygon points="20,30 6,22 22,38" fill="#F2C9A0" />
      <polygon points="72,30 86,22 70,38" fill="#F2C9A0" />
      <circle cx="46" cy="36" r="22" fill="#F2C9A0" />
      <circle cx="36" cy="40" r="4.5" fill="#F4A7A7" />
      <circle cx="56" cy="40" r="4.5" fill="#F4A7A7" />
      <circle cx="39" cy="33" r="2.6" fill="#0D1B2A" />
      <circle cx="53" cy="33" r="2.6" fill="#0D1B2A" />
      <path d="M18 22 Q40 -10 84 2 L66 22 Z" fill="#16A34A" />
      <rect x="18" y="18" width="52" height="9" rx="4.5" fill="#FFFFFF" />
      <circle cx="85" cy="3" r="5" fill="#DC2626" />
      <circle cx="24" cy="56" r="7" fill="#F2C9A0" />
      <circle cx="68" cy="56" r="7" fill="#F2C9A0" />
    </svg>
  );
}

const ELF_COLORS = {
  red: { tunic: '#DC2626', zigzag: '#FACC15', legs: '#16A34A', hat: '#16A34A', pom: '#FACC15' },
  green: { tunic: '#16A34A', zigzag: '#FFFFFF', legs: '#B91C1C', hat: '#DC2626', pom: '#FFFFFF' },
} as const;

export function ElfSitting({ variant, className, style }: ArtProps & { variant: 'red' | 'green' }) {
  const { tunic, zigzag, legs, hat, pom } = ELF_COLORS[variant];
  return (
    <svg viewBox="0 -14 120 104" className={className} style={style} aria-hidden="true">
      <rect x="48" y="62" width="9" height="22" fill={legs} />
      <rect x="62" y="62" width="9" height="22" fill={legs} />
      <path d="M36 70 L60 22 L84 70 Z" fill={tunic} />
      <path d="M36 70 L44 62 L52 70 L60 62 L68 70 L76 62 L84 70 Z" fill={zigzag} />
      <polygon points="46,16 34,8 47,22" fill="#F2C9A0" />
      <polygon points="74,16 86,8 73,22" fill="#F2C9A0" />
      <circle cx="60" cy="18" r="14" fill="#F2C9A0" />
      <circle cx="55" cy="16" r="2" fill="#0D1B2A" />
      <circle cx="65" cy="16" r="2" fill="#0D1B2A" />
      <path d="M55 23 Q60 27 65 23" stroke="#0D1B2A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {variant === 'red' ? (
        <>
          <path d="M45 10 Q60 -12 88 -2 L76 10 Z" fill={hat} />
          <circle cx="89" cy="-2" r="4" fill={pom} />
        </>
      ) : (
        <>
          <path d="M45 10 Q32 -12 8 -2 L44 10 Z" fill={hat} />
          <circle cx="7" cy="-2" r="4" fill={pom} />
        </>
      )}
      <rect x="44" y="7" width="32" height="7" rx="3.5" fill="#FFFFFF" />
    </svg>
  );
}

export function StringLights() {
  const id = useSvgId('hefa-xmas-lights');
  return (
    <svg width="100%" height="30" className="block" aria-hidden="true">
      <defs>
        <pattern id={id} width="110" height="30" patternUnits="userSpaceOnUse">
          <path d="M0 2 Q55 26 110 2" fill="none" stroke="#0B1422" strokeWidth="2" />
          <rect x="17" y="9" width="4" height="4" fill="#0B1422" />
          <ellipse className="xmas-twinkle" cx="19" cy="18" rx="4.5" ry="7" fill="#EF4444" />
          <rect x="43" y="15" width="4" height="4" fill="#0B1422" />
          <ellipse className="xmas-twinkle xmas-d2" cx="45" cy="24" rx="4.5" ry="7" fill="#FACC15" />
          <rect x="69" y="15" width="4" height="4" fill="#0B1422" />
          <ellipse className="xmas-twinkle xmas-d3" cx="71" cy="24" rx="4.5" ry="7" fill="#22C55E" />
          <rect x="93" y="8" width="4" height="4" fill="#0B1422" />
          <ellipse className="xmas-twinkle xmas-d1" cx="95" cy="17" rx="4.5" ry="7" fill="#38BDF8" />
        </pattern>
      </defs>
      <rect width="100%" height="30" fill={`url(#${id})`} />
    </svg>
  );
}

export function HeaderSnow() {
  const id = useSvgId('hefa-xmas-snowdots');
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={id} width="120" height="70" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="12" r="1.4" fill="#fff" opacity="0.55" />
          <circle cx="64" cy="30" r="1" fill="#fff" opacity="0.45" />
          <circle cx="100" cy="8" r="1.8" fill="#fff" opacity="0.35" />
          <circle cx="38" cy="56" r="1.2" fill="#fff" opacity="0.5" />
          <circle cx="90" cy="60" r="0.9" fill="#fff" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

const FLAKES = [
  { left: '4%', size: 16, color: '#7DD3FC', delay: '0s' },
  { left: '15%', size: 11, color: '#93C5FD', delay: '5s' },
  { left: '29%', size: 14, color: '#7DD3FC', delay: '2s' },
  { left: '47%', size: 18, color: '#BAE6FD', delay: '8s' },
  { left: '62%', size: 12, color: '#7DD3FC', delay: '3.5s' },
  { left: '78%', size: 15, color: '#93C5FD', delay: '6.5s' },
  { left: '92%', size: 12, color: '#BAE6FD', delay: '1s' },
];

export function FallingSnow() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden="true">
      {FLAKES.map((f) => (
        <svg
          key={f.left}
          viewBox="0 0 24 24"
          fill="none"
          stroke={f.color}
          strokeWidth="2"
          strokeLinecap="round"
          className="xmas-flake absolute"
          style={{ left: f.left, width: f.size, height: f.size, animationDelay: f.delay }}
          aria-hidden="true"
        >
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
        </svg>
      ))}
    </div>
  );
}

export function ChristmasBannerScene() {
  const skyId = useSvgId('hefa-xmas-sky');
  return (
    <svg
      viewBox="0 0 520 240"
      preserveAspectRatio="xMidYMid slice"
      className="block h-full w-full"
      role="img"
      aria-label="Papá Noel en su trineo tirado por renos volando sobre casas del barrio"
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1A2E" />
          <stop offset="1" stopColor="#1E3A5F" />
        </linearGradient>
      </defs>
      <rect width="520" height="240" fill={`url(#${skyId})`} />
      <circle cx="450" cy="50" r="28" fill="#FEF9C3" />
      <circle cx="440" cy="44" r="5" fill="#FDE68A" />
      <circle cx="458" cy="60" r="4" fill="#FDE68A" />
      <g className="xmas-stars">
        <circle cx="40" cy="30" r="1.8" fill="#fff" />
        <circle cx="120" cy="18" r="1.4" fill="#fff" />
        <circle cx="210" cy="40" r="2" fill="#fff" />
        <circle cx="300" cy="16" r="1.5" fill="#fff" />
        <circle cx="380" cy="90" r="1.6" fill="#fff" />
        <circle cx="500" cy="120" r="1.4" fill="#fff" />
        <circle cx="80" cy="100" r="1.3" fill="#fff" />
      </g>
      <g className="xmas-bob">
        <path d="M96 140 C70 146 50 140 30 148" stroke="#FACC15" strokeWidth="2" fill="none" strokeDasharray="2 6" strokeLinecap="round" />
        <polyline points="170,128 250,104 334,84 418,62" fill="none" stroke="#FACC15" strokeWidth="1.6" />
        <g transform="translate(250 112) rotate(-12)"><Reindeer /></g>
        <g transform="translate(334 92) rotate(-12)"><Reindeer /></g>
        <g transform="translate(418 70) rotate(-12)"><Reindeer rednose /></g>
        <g transform="translate(128 132) rotate(-10)">
          <circle cx="-6" cy="-18" r="17" fill="#DC2626" />
          <circle cx="-6" cy="-42" r="10" fill="#F2C9A0" />
          <path d="M-17 -38 Q-6 -20 5 -38 Q4 -28 -6 -24 Q-16 -28 -17 -38 Z" fill="#fff" />
          <path d="M-16 -46 Q-8 -64 10 -60 L4 -46 Z" fill="#DC2626" />
          <rect x="-17" y="-49" width="22" height="6" rx="3" fill="#fff" />
          <circle cx="11" cy="-60" r="4" fill="#fff" />
          <path d="M-46 -8 H32 L42 -30 L52 -30 L42 6 Q38 14 28 14 H-40 Q-50 14 -46 -8 Z" fill="#B91C1C" />
          <path d="M-40 -2 H30" stroke="#FACC15" strokeWidth="2.5" />
          <path d="M-36 14 V24 M20 14 V24" stroke="#FACC15" strokeWidth="3" />
          <path d="M-52 24 H42 Q56 24 58 12" stroke="#FACC15" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
      <path d="M0 200 Q130 178 260 196 T520 190 V240 H0 Z" fill="#E2E8F0" />
      <rect x="40" y="180" width="44" height="34" fill="#334155" />
      <path d="M34 182 L62 160 L90 182 Z" fill="#F8FAFC" />
      <rect x="54" y="192" width="10" height="10" fill="#FDE047" />
      <rect x="70" y="196" width="8" height="18" fill="#7C2D12" />
      <rect x="150" y="186" width="36" height="28" fill="#475569" />
      <path d="M145 188 L168 170 L191 188 Z" fill="#F8FAFC" />
      <rect x="158" y="196" width="9" height="9" fill="#FDE047" />
      <rect x="172" y="196" width="9" height="9" fill="#FDE047" />
      <rect x="330" y="182" width="46" height="34" fill="#334155" />
      <path d="M324 184 L353 162 L382 184 Z" fill="#F8FAFC" />
      <rect x="342" y="194" width="10" height="10" fill="#FDE047" />
      <rect x="358" y="198" width="8" height="18" fill="#7C2D12" />
      <polygon points="250,150 268,190 232,190" fill="#166534" />
      <polygon points="250,166 274,206 226,206" fill="#15803D" />
      <circle cx="250" cy="148" r="3.5" fill="#FACC15" />
      <polygon points="450,160 466,196 434,196" fill="#166534" />
      <polygon points="450,174 470,212 430,212" fill="#15803D" />
      <circle cx="450" cy="158" r="3" fill="#FACC15" />
    </svg>
  );
}

export function XmasStar({ size, color, className }: { size: number; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill={color} />
    </svg>
  );
}
