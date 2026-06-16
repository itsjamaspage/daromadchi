'use client'
// Fixed full-page background layer — z-index: -1, behind all content.
// LEFT ZONE  (x < 540): 4 diagonal lines, 2 travel top→bottom, 2 bottom→top.
// RIGHT ZONE (x 750–1410, cx=1080): 3 circle pairs that bounce off the viewport
//   edges and collide at the midpoint (cx=1080) — alternate-reverse makes both
//   circles start at their respective extremes and converge simultaneously.

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
          <filter id="gCyan"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gMag"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gBlue"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gPurp"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gTeal"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gLine"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gLineP" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          {/* Light glow filters */}
          <filter id="lgP"    x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="lgB"    x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {isDark ? (
          <>
            {/* ── Static blobs ────────────────────────────────────────── */}
            <circle cx="58"   cy="125" r="168" fill="#0b1020" className="bg-cf1" />
            <circle cx="115"  cy="400" r="122" fill="#0b1020" className="bg-cf2" />
            <circle cx="1405" cy="715" r="215" fill="#0a0f1e" className="bg-cf3" />

            {/* ── Lines: LEFT ZONE (all x1,x2 < 540) ─────────────────
                pbl-a, pbl-b → travel DOWN
                pbl-c, pbl-d → travel UP                              */}
            <line x1="140" y1="-10" x2="260" y2="300" stroke="#3B82F6" strokeWidth="3"   strokeLinecap="round" filter="url(#gLine)"  className="pbl-a" />
            <line x1="390" y1="-10" x2="280" y2="300" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" filter="url(#gLine)"  className="pbl-b" />
            <line x1="75"  y1="-10" x2="95"  y2="300" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" filter="url(#gLineP)" className="pbl-c" />
            <line x1="490" y1="-10" x2="510" y2="300" stroke="#4F46E5" strokeWidth="2"   strokeLinecap="round" filter="url(#gLineP)" className="pbl-d" />

            {/* ── Circle pairs: RIGHT ZONE (cx=1080, bounce x:750–1410)
                alternate-reverse: each circle starts at its extreme
                (1a at x=750, 1b at x=1410), converges to cx=1080,
                bounces back — clean elastic-collision visual.        */}

            {/* Pair 1 — Y=200
                1a: cx=775 (left wall, r=55 left-edge at x=720) travels +250px → right-edge touches x=1080
                1b: cx=1405 (right wall, r=35 right-edge at x=1440) travels -290px → left-edge touches x=1080 */}
            <circle cx="775"  cy="200" r="55" fill="none" stroke="#00D4FF" strokeWidth="2"   filter="url(#gCyan)" className="pbc-1a" />
            <circle cx="1405" cy="200" r="35" fill="none" stroke="#FF2D9B" strokeWidth="2"   filter="url(#gMag)"  className="pbc-1b" />

            {/* Pair 2 — Y=460
                1a: cx=790 (r=70 left-edge at x=720) travels +220px → right-edge at x=1080
                1b: cx=1398 (r=42 right-edge at x=1440) travels -276px → left-edge at x=1080 */}
            <circle cx="790"  cy="460" r="70" fill="none" stroke="#3B82F6" strokeWidth="2"   filter="url(#gBlue)" className="pbc-2a" />
            <circle cx="1398" cy="460" r="42" fill="none" stroke="#A855F7" strokeWidth="1.5" filter="url(#gPurp)" className="pbc-2b" />

            {/* Pair 3 — Y=720
                3a: cx=766 (r=46 left-edge at x=720) travels +268px → right-edge at x=1080
                3b: cx=1378 (r=62 right-edge at x=1440) travels -236px → left-edge at x=1080 */}
            <circle cx="766"  cy="720" r="46" fill="none" stroke="#00FFB3" strokeWidth="1.5" filter="url(#gTeal)" className="pbc-3a" />
            <circle cx="1378" cy="720" r="62" fill="none" stroke="#FF2D9B" strokeWidth="2"   filter="url(#gMag)"  className="pbc-3b" />

            {/* Corner accent + dot grid (top-right) */}
            <rect x="1318" y="0" width="122" height="148" fill="#5B21B6" opacity={0.80} />
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={1088 + i * 20} y={44} width={7} height={7} rx={1} fill="#2563EB" className="bg-dots" />
            ))}
          </>
        ) : (
          <>
            {/* ── Static blobs (light) ─────────────────────────────── */}
            <circle cx="58"   cy="125" r="168" fill="rgba(124,58,237,0.045)" className="bg-cf1" />
            <circle cx="115"  cy="400" r="122" fill="rgba(124,58,237,0.035)" className="bg-cf2" />
            <circle cx="1405" cy="715" r="215" fill="rgba(99,102,241,0.04)"  className="bg-cf3" />

            {/* ── Lines: LEFT ZONE, soft purple ───────────────────── */}
            <line x1="140" y1="-10" x2="260" y2="300" stroke="#7C3AED" strokeWidth="2"   opacity={0.22} strokeLinecap="round" filter="url(#lgP)" className="pbl-a" />
            <line x1="390" y1="-10" x2="280" y2="300" stroke="#6D28D9" strokeWidth="1.5" opacity={0.18} strokeLinecap="round" filter="url(#lgP)" className="pbl-b" />
            <line x1="75"  y1="-10" x2="95"  y2="300" stroke="#8B5CF6" strokeWidth="1.5" opacity={0.18} strokeLinecap="round" filter="url(#lgB)" className="pbl-c" />
            <line x1="490" y1="-10" x2="510" y2="300" stroke="#6366F1" strokeWidth="1.5" opacity={0.16} strokeLinecap="round" filter="url(#lgP)" className="pbl-d" />

            {/* ── Circle pairs: RIGHT ZONE, soft palette ──────────── */}
            <circle cx="775"  cy="200" r="55" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity={0.28} filter="url(#lgP)" className="pbc-1a" />
            <circle cx="1405" cy="200" r="35" fill="none" stroke="#DB2777" strokeWidth="1.5" opacity={0.24} filter="url(#lgP)" className="pbc-1b" />

            <circle cx="790"  cy="460" r="70" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity={0.22} filter="url(#lgB)" className="pbc-2a" />
            <circle cx="1398" cy="460" r="42" fill="none" stroke="#8B5CF6" strokeWidth="1.5" opacity={0.26} filter="url(#lgP)" className="pbc-2b" />

            <circle cx="766"  cy="720" r="46" fill="none" stroke="#0D9488" strokeWidth="1.5" opacity={0.22} filter="url(#lgB)" className="pbc-3a" />
            <circle cx="1378" cy="720" r="62" fill="none" stroke="#DB2777" strokeWidth="1.5" opacity={0.20} filter="url(#lgP)" className="pbc-3b" />

            {/* Corner accent + dot grid */}
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
