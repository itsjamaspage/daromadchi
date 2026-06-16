'use client'
// Light-mode animated geometric background.
// Soft purple/blue lines travel across the screen; gentle circle drifts.
// Keyframes live in globals.css (.lt-* classes).

export function LightBgDecor() {
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
          <filter id="ltGlowPurple" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="ltGlowBlue" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="ltGlowStrong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Soft filled circles */}
        <circle cx="58"   cy="125"  r="168" fill="rgba(124,58,237,0.045)" className="lt-cf1" />
        <circle cx="115"  cy="400"  r="122" fill="rgba(124,58,237,0.035)" className="lt-cf2" />
        <circle cx="1405" cy="715"  r="215" fill="rgba(99,102,241,0.04)"  className="lt-cf3" />

        {/* Soft ring circles */}
        <circle cx="90"   cy="278"  r="56"  fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.25} filter="url(#ltGlowPurple)" className="lt-r1" />
        <circle cx="1238" cy="428"  r="140" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.22} filter="url(#ltGlowStrong)" className="lt-r2" />
        <circle cx="1198" cy="792"  r="43"  fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.28} filter="url(#ltGlowPurple)" className="lt-r3" />

        {/* Travelling lines */}
        <line x1="350" y1="-60" x2="580" y2="260"
          stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" opacity={0.22}
          filter="url(#ltGlowPurple)" className="bg-lt-a" />

        <line x1="310" y1="80" x2="230" y2="400"
          stroke="#6D28D9" strokeWidth="1.5" strokeLinecap="round" opacity={0.18}
          filter="url(#ltGlowPurple)" className="bg-lt-b" />

        <line x1="40" y1="620" x2="130" y2="720"
          stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity={0.20}
          filter="url(#ltGlowBlue)" className="bg-lt-c" />

        <line x1="1110" y1="210" x2="1270" y2="520"
          stroke="#6366F1" strokeWidth="2" strokeLinecap="round" opacity={0.20}
          filter="url(#ltGlowPurple)" className="bg-lt-d" />

        <line x1="120" y1="200" x2="310" y2="540"
          stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" opacity={0.22}
          filter="url(#ltGlowPurple)" className="bg-lt-e" />

        {/* Dot grid (top-right) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={1088 + i * 20} y={44} width={6} height={6} rx={1}
            fill="#7C3AED" opacity={0.25} className="lt-dots" />
        ))}

        {/* Corner rectangle accent */}
        <rect x="1318" y="0" width="122" height="148" fill="#7C3AED" opacity={0.12} />
      </svg>
    </div>
  )
}
