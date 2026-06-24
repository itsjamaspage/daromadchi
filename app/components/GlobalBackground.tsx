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

  // Light theme: two blended layers give adaptive color.
  // multiply layer: blue fluid × page-bg → visible blue on white/light sections, dark-blended on blue sections.
  // screen layer: white fluid + screen → visible white on blue sections, invisible on white/light sections.
  return (
    <>
      <div style={{ ...WRAPPER, mixBlendMode: 'multiply' }}>
        <LiquidEther
          colors={['#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']}
          autoDemo={true}
          autoSpeed={0.3}
          autoIntensity={2.0}
          mouseForce={0}
          cursorSize={0}
          resolution={0.3}
          iterationsPoisson={16}
          iterationsViscous={8}
          isViscous={false}
          isBounce={false}
          BFECC={false}
          autoResumeDelay={0}
          autoRampDuration={1.2}
          takeoverDuration={0.5}
        />
      </div>
      <div style={{ ...WRAPPER, mixBlendMode: 'screen' }}>
        <LiquidEther
          colors={['#ffffff', '#f0f9ff', '#e0f2fe', '#bae6fd', '#93c5fd']}
          autoDemo={true}
          autoSpeed={0.35}
          autoIntensity={1.8}
          mouseForce={0}
          cursorSize={0}
          resolution={0.3}
          iterationsPoisson={16}
          iterationsViscous={8}
          isViscous={false}
          isBounce={false}
          BFECC={false}
          autoResumeDelay={0}
          autoRampDuration={1.5}
          takeoverDuration={0.5}
        />
      </div>
    </>
  )
}
