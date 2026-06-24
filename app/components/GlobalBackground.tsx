'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '../providers'

const LiquidEther = dynamic(() => import('./LiquidEther'), { ssr: false })

const WRAPPER: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  touchAction: 'pan-y',
}

export default function GlobalBackground() {
  const { theme } = useTheme()

  if (theme === 'dark') {
    return (
      <div style={WRAPPER}>
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

  // Light theme: single layer, white/icy colors + screen blend.
  // Visible as bright white shimmer on the blue hero/section backgrounds,
  // naturally invisible on white/pale sections. Single WebGL context = no lag.
  return (
    <div style={{ ...WRAPPER, mixBlendMode: 'screen', opacity: 0.65 }}>
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
