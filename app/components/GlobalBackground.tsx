'use client'

import dynamic from 'next/dynamic'

const FloatingLines = dynamic(() => import('./FloatingLines'), { ssr: false })

export default function GlobalBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        touchAction: 'pan-y',
      }}
    >
      <FloatingLines
        enabledWaves={['bottom', 'middle', 'top']}
        lineCount={8}
        lineDistance={65}
        bendRadius={12}
        bendStrength={-0.5}
        interactive={false}
        parallax={false}
        animationSpeed={0.9}
        linesGradient={['#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']}
        mixBlendMode="screen"
      />
    </div>
  )
}
