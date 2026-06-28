'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '../providers'

const LiquidEther = dynamic(() => import('./LiquidEther'), { ssr: false })

// zIndex: 2 puts this above the layout's zIndex: 1 stacking context,
// so it appears in front of section backgrounds. pointerEvents: none
// keeps all clicks/scrolls working. opacity keeps it subtle enough
// not to obscure text.
const WRAPPER = (extra: React.CSSProperties): React.CSSProperties => ({
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  pointerEvents: 'none',
  touchAction: 'pan-y',
  ...extra,
})

export default function GlobalBackground() {
  const { theme } = useTheme()

  if (theme === 'dark') {
    return (
      <div style={WRAPPER({ opacity: 0.35 })}>
        <LiquidEther
          colors={['#0c4a6e', '#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc']}
          autoDemo={true}
          autoSpeed={0.4}
          autoIntensity={2.5}
          mouseForce={25}
          cursorSize={120}
          resolution={0.5}
          iterationsPoisson={32}
          iterationsViscous={32}
          isViscous={false}
          isBounce={false}
          BFECC={true}
          autoResumeDelay={2000}
          autoRampDuration={0.8}
          takeoverDuration={0.3}
        />
      </div>
    )
  }

  // Light theme: white/icy colours at low opacity so the fluid shimmer
  // is visible over blue sections without obscuring text on white sections.
  return (
    <div style={WRAPPER({ opacity: 0.45, mixBlendMode: 'screen' })}>
      <LiquidEther
        colors={['#ffffff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8']}
        autoDemo={true}
        autoSpeed={0.45}
        autoIntensity={3.0}
        mouseForce={20}
        cursorSize={100}
        resolution={0.5}
        iterationsPoisson={32}
        iterationsViscous={32}
        isViscous={false}
        isBounce={false}
        BFECC={true}
        autoResumeDelay={2000}
        autoRampDuration={0.8}
        takeoverDuration={0.3}
      />
    </div>
  )
}
