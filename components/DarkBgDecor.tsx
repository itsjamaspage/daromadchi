'use client'
// Dark-mode animated geometric background.
// Lines travel across the full screen; circles drift slowly.
// Keyframes live in globals.css (.bg-* classes).

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
          <filter id="glowBlue" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowPurple" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowStrong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Filled dark circles — slow vertical drift */}
        <circle cx="58"   cy="125"  r="168" fill="#0b1020" className="bg-cf1" />
        <circle cx="115"  cy="400"  r="122" fill="#0b1020" className="bg-cf2" />
        <circle cx="1405" cy="715"  r="215" fill="#0a0f1e" className="bg-cf3" />

        {/* Neon rings — float + pulse */}
        <circle cx="90"   cy="278"  r="56"  fill="none" stroke="#7C3AED" strokeWidth="2"   filter="url(#glowPurple)" className="bg-r1" />
        <circle cx="1238" cy="428"  r="140" fill="none" stroke="#7C3AED" strokeWidth="2"   filter="url(#glowStrong)" className="bg-r2" />
        <circle cx="1198" cy="792"  r="43"  fill="none" stroke="#7C3AED" strokeWidth="1.5" filter="url(#glowPurple)" className="bg-r3" />

        {/* Travelling lines — each moves across the full viewport */}
        {/* Line A: upper area, down-right sweep */}
        <line x1="350" y1="-60" x2="580" y2="260"
          stroke="#3B82F6" strokeWidth="3.5" strokeLinecap="round"
          filter="url(#glowBlue)" className="bg-lt-a" />

        {/* Line B: left cluster, vertical sweep */}
        <line x1="310" y1="80" x2="230" y2="400"
          stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"
          filter="url(#glowBlue)" className="bg-lt-b" />

        {/* Line C: bottom-left, short diagonal sweep */}
        <line x1="40"  y1="620" x2="130" y2="720"
          stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"
          filter="url(#glowBlue)" className="bg-lt-c" />

        {/* Line D: right side, longer travel */}
        <line x1="1110" y1="210" x2="1270" y2="520"
          stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"
          filter="url(#glowBlue)" className="bg-lt-d" />

        {/* Line E: left, purple/indigo sweep */}
        <line x1="120" y1="200" x2="310" y2="540"
          stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"
          filter="url(#glowPurple)" className="bg-lt-e" />

        {/* Dot grid (top-right) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={1088 + i * 20} y={44} width={7} height={7} rx={1}
            fill="#2563EB" className="bg-dots" />
        ))}

        {/* Corner rectangle accent */}
        <rect x="1318" y="0" width="122" height="148" fill="#5B21B6" opacity={0.80} />
      </svg>
    </div>
  )
}
