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
