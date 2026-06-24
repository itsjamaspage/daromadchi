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
      }}
    >
      <FloatingLines
        enabledWaves={['bottom', 'middle', 'top']}
        lineCount={8}
        lineDistance={60}
        bendRadius={10}
        bendStrength={-0.4}
        interactive={true}
        parallax={true}
        animationSpeed={0.8}
        linesGradient={['#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']}
        mixBlendMode="screen"
      />
    </div>
  )
}
