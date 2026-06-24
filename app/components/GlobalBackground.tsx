'use client'

import dynamic from 'next/dynamic'

const LiquidEther = dynamic(() => import('./LiquidEther'), { ssr: false })

export default function GlobalBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        touchAction: 'pan-y',
      }}
    >
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
