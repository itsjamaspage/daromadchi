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
        lineCount={5}
        lineDistance={80}
        bendRadius={8}
        bendStrength={-0.3}
        interactive={false}
        parallax={false}
        animationSpeed={0.6}
        linesGradient={['#0c2040', '#102a58', '#163470', '#1a3d88', '#20469e']}
        mixBlendMode="screen"
      />
    </div>
  )
}
