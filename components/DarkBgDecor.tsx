'use client'
// Animated geometric background for dark mode.
// Recreates the reference image: filled dark circles, neon rings, glowing diagonal lines, dot grid, corner rectangle.
// All elements are SVG with CSS keyframe animations defined in globals.css (.bg-* classes).

export function DarkBgDecor() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glowBlue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowBlueStrong" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Filled dark circles ───────────────────────────────────── */}
        <circle cx="58"   cy="125"  r="168" fill="#0b1020" className="bg-cf1" />
        <circle cx="115"  cy="400"  r="122" fill="#0b1020" className="bg-cf2" />
        <circle cx="1405" cy="715"  r="215" fill="#0a0f1e" className="bg-cf3" />

        {/* ── Electric-blue diagonal lines ─────────────────────────── */}
        {/* Top centre pair (crossing) */}
        <line x1="492" y1="-8"  x2="640" y2="215" stroke="#3B82F6" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowBlue)"       className="bg-l1" />
        <line x1="375" y1="105" x2="290" y2="365" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" filter="url(#glowBlue)"       className="bg-l2" />
        {/* Bottom-left short line */}
        <line x1="52"  y1="635" x2="138" y2="725" stroke="#3B82F6" strokeWidth="2"   strokeLinecap="round" filter="url(#glowBlue)"       className="bg-l3" />
        {/* Right-side line */}
        <line x1="1145" y1="245" x2="1295" y2="540" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" filter="url(#glowBlue)"     className="bg-l4" />

        {/* ── Indigo/purple diagonal line ───────────────────────────── */}
        <line x1="148" y1="228" x2="335" y2="548" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" filter="url(#glowPurple)"     className="bg-l5" />

        {/* ── Neon ring circles (outline + glow) ───────────────────── */}
        <circle cx="90"   cy="278"  r="56"  fill="none" stroke="#7C3AED" strokeWidth="2"   filter="url(#glowPurple)"     className="bg-r1" />
        <circle cx="1238" cy="428"  r="140" fill="none" stroke="#7C3AED" strokeWidth="2"   filter="url(#glowBlueStrong)" className="bg-r2" />
        <circle cx="1198" cy="792"  r="43"  fill="none" stroke="#7C3AED" strokeWidth="1.5" filter="url(#glowPurple)"     className="bg-r3" />

        {/* ── Dot grid (top-right) ─────────────────────────────────── */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={1088 + i * 20}
            y={44}
            width={7}
            height={7}
            rx={1}
            fill="#2563EB"
            className="bg-dots"
          />
        ))}

        {/* ── Corner rectangle accent ──────────────────────────────── */}
        <rect x="1318" y="0" width="122" height="148" fill="#5B21B6" opacity={0.80} />
      </svg>
    </div>
  )
}
