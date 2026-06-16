'use client'
// Fixed full-page background layer — z-index: -1, behind all content.
// Dark: neon lines travel top→bottom; neon circle pairs bounce left↔right and
//   collide in the centre (alternate-reverse makes both arrive at centre simultaneously).
// Light: same geometry, soft purple/blue palette at low opacity.

interface Props { isDark: boolean }

export function PageBgDecor({ isDark }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: -1,
        pointerEvents: 'none', overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Dark glow filters */}
          <filter id="gCyan"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gMag"    x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gBlue"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gPurp"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gTeal"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gLine"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gLineP"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          {/* Light glow filters */}
          <filter id="lgP"     x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="lgB"     x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {isDark ? (
          <>
            {/* ── Static filled dark circles (reference image decorative blobs) ── */}
            <circle cx="58"   cy="125"  r="168" fill="#0b1020" className="bg-cf1" />
            <circle cx="115"  cy="400"  r="122" fill="#0b1020" className="bg-cf2" />
            <circle cx="1405" cy="715"  r="215" fill="#0a0f1e" className="bg-cf3" />

            {/* ── Lines: travel TOP → BOTTOM (5 diagonals at different X) ───── */}
            {/* Each line starts above viewport, exits below */}
            <line x1="245" y1="-10" x2="375" y2="280" stroke="#3B82F6" strokeWidth="3"   strokeLinecap="round" filter="url(#gLine)"  className="pbl-a" />
            <line x1="620" y1="-10" x2="760" y2="280" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" filter="url(#gLine)"  className="pbl-b" />
            <line x1="1060" y1="-10" x2="910" y2="280" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" filter="url(#gLine)"  className="pbl-c" />
            <line x1="160"  y1="-10" x2="60"  y2="280" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" filter="url(#gLineP)" className="pbl-d" />
            <line x1="1220" y1="-10" x2="1340" y2="280" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" filter="url(#gLineP)" className="pbl-e" />

            {/* ── Circle pairs: bounce LEFT ↔ RIGHT, collide at centre ────────
                  alternate-reverse → both start at their extremes and arrive
                  at cx=720 simultaneously, "bouncing" off each other.         */}

            {/* Pair 1 — upper (Y≈175), cyan + magenta */}
            <circle cx="720" cy="175" r="55" fill="none" stroke="#00D4FF" strokeWidth="2"   filter="url(#gCyan)"  className="pbc-1a" />
            <circle cx="720" cy="175" r="38" fill="none" stroke="#FF2D9B" strokeWidth="2"   filter="url(#gMag)"   className="pbc-1b" />

            {/* Pair 2 — mid-upper (Y≈345), blue + purple */}
            <circle cx="720" cy="345" r="68" fill="none" stroke="#3B82F6" strokeWidth="2"   filter="url(#gBlue)"  className="pbc-2a" />
            <circle cx="720" cy="345" r="30" fill="none" stroke="#A855F7" strokeWidth="1.5" filter="url(#gPurp)"  className="pbc-2b" />

            {/* Pair 3 — mid-lower (Y≈555), teal + magenta */}
            <circle cx="720" cy="555" r="44" fill="none" stroke="#00FFB3" strokeWidth="1.5" filter="url(#gTeal)"  className="pbc-3a" />
            <circle cx="720" cy="555" r="62" fill="none" stroke="#FF2D9B" strokeWidth="2"   filter="url(#gMag)"   className="pbc-3b" />

            {/* Pair 4 — lower (Y≈745), cyan + indigo */}
            <circle cx="720" cy="745" r="34" fill="none" stroke="#00D4FF" strokeWidth="1.5" filter="url(#gCyan)"  className="pbc-4a" />
            <circle cx="720" cy="745" r="52" fill="none" stroke="#6366F1" strokeWidth="2"   filter="url(#gPurp)"  className="pbc-4b" />

            {/* Corner rectangle + dot grid from reference image */}
            <rect x="1318" y="0" width="122" height="148" fill="#5B21B6" opacity={0.80} />
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={1088 + i * 20} y={44} width={7} height={7} rx={1} fill="#2563EB" className="bg-dots" />
            ))}
          </>
        ) : (
          <>
            {/* ── Light theme: same geometry, soft purple palette ─────────── */}
            <circle cx="58"   cy="125"  r="168" fill="rgba(124,58,237,0.045)" className="bg-cf1" />
            <circle cx="115"  cy="400"  r="122" fill="rgba(124,58,237,0.035)" className="bg-cf2" />
            <circle cx="1405" cy="715"  r="215" fill="rgba(99,102,241,0.04)"  className="bg-cf3" />

            {/* Lines: soft purple, travel top → bottom */}
            <line x1="245"  y1="-10" x2="375"  y2="280" stroke="#7C3AED" strokeWidth="2"   opacity={0.22} strokeLinecap="round" filter="url(#lgP)" className="pbl-a" />
            <line x1="620"  y1="-10" x2="760"  y2="280" stroke="#6D28D9" strokeWidth="1.5" opacity={0.18} strokeLinecap="round" filter="url(#lgP)" className="pbl-b" />
            <line x1="1060" y1="-10" x2="910"  y2="280" stroke="#7C3AED" strokeWidth="1.5" opacity={0.20} strokeLinecap="round" filter="url(#lgP)" className="pbl-c" />
            <line x1="160"  y1="-10" x2="60"   y2="280" stroke="#8B5CF6" strokeWidth="1.5" opacity={0.18} strokeLinecap="round" filter="url(#lgB)" className="pbl-d" />
            <line x1="1220" y1="-10" x2="1340" y2="280" stroke="#6366F1" strokeWidth="1.5" opacity={0.16} strokeLinecap="round" filter="url(#lgP)" className="pbl-e" />

            {/* Circle pairs: soft purple + blue + pink */}
            <circle cx="720" cy="175" r="55" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.28} filter="url(#lgP)" className="pbc-1a" />
            <circle cx="720" cy="175" r="38" fill="none" stroke="#DB2777" strokeWidth="1.5" opacity={0.24} filter="url(#lgP)" className="pbc-1b" />

            <circle cx="720" cy="345" r="68" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity={0.22} filter="url(#lgB)" className="pbc-2a" />
            <circle cx="720" cy="345" r="30" fill="none" stroke="#8B5CF6" strokeWidth="1.5" opacity={0.28} filter="url(#lgP)" className="pbc-2b" />

            <circle cx="720" cy="555" r="44" fill="none" stroke="#0D9488" strokeWidth="1.5" opacity={0.22} filter="url(#lgB)" className="pbc-3a" />
            <circle cx="720" cy="555" r="62" fill="none" stroke="#DB2777" strokeWidth="1.5" opacity={0.20} filter="url(#lgP)" className="pbc-3b" />

            <circle cx="720" cy="745" r="34" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.26} filter="url(#lgP)" className="pbc-4a" />
            <circle cx="720" cy="745" r="52" fill="none" stroke="#6366F1" strokeWidth="1.5" opacity={0.22} filter="url(#lgB)" className="pbc-4b" />

            {/* Corner rect + dot grid */}
            <rect x="1318" y="0" width="122" height="148" fill="#7C3AED" opacity={0.10} />
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={1088 + i * 20} y={44} width={6} height={6} rx={1} fill="#7C3AED" opacity={0.20} className="lt-dots" />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}
