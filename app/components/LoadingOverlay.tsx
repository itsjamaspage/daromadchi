'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const MetallicPaint = dynamic(() => import('./MetallicPaint'), { ssr: false })

// Only show overlay if loading takes longer than this threshold
const SHOW_THRESHOLD_MS = 350

export default function LoadingOverlay() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleStart = () => {
      if (showTimer.current) clearTimeout(showTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      // Only show if loading takes longer than the threshold
      showTimer.current = setTimeout(() => {
        setMounted(true)
        requestAnimationFrame(() => setVisible(true))
      }, SHOW_THRESHOLD_MS)
    }

    const handleEnd = () => {
      // Cancel pending show if loading finished quickly
      if (showTimer.current) {
        clearTimeout(showTimer.current)
        showTimer.current = null
      }
      // Hide overlay if it was shown
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), 150)
    }

    window.addEventListener('__loading_start__', handleStart)
    window.addEventListener('__loading_end__', handleEnd)
    return () => {
      window.removeEventListener('__loading_start__', handleStart)
      window.removeEventListener('__loading_end__', handleEnd)
      if (showTimer.current) clearTimeout(showTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#020d1f',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'all' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <div style={{ width: 180, height: 180 }}>
        <MetallicPaint
          imageSrc="/letter-d.svg"
          seed={42}
          scale={4}
          patternSharpness={1}
          noiseScale={0.5}
          speed={0.35}
          liquid={0.8}
          mouseAnimation={false}
          brightness={2.4}
          contrast={0.5}
          refraction={0.014}
          blur={0.01}
          chromaticSpread={2.8}
          fresnel={1.3}
          angle={0}
          waveAmplitude={1.2}
          distortion={0.8}
          contour={0.25}
          lightColor="#7dd3fc"
          darkColor="#020d1f"
          tintColor="#0ea5e9"
        />
      </div>
      <p style={{
        color: 'rgba(125,211,252,0.7)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.18em',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        textTransform: 'uppercase',
      }}>
        Daromadchi
      </p>
    </div>
  )
}
