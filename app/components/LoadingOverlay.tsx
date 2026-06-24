'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const MetallicPaint = dynamic(() => import('./MetallicPaint'), { ssr: false })

export default function LoadingOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const prevPathname = useRef(pathname)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setVisible(false)
      setMounted(false)
    }
  }, [pathname])

  useEffect(() => {
    const handleStart = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    }
    const handleEnd = () => {
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        setTimeout(() => setMounted(false), 400)
      }, 200)
    }

    window.addEventListener('__loading_start__', handleStart)
    window.addEventListener('__loading_end__', handleEnd)
    return () => {
      window.removeEventListener('__loading_start__', handleStart)
      window.removeEventListener('__loading_end__', handleEnd)
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
        backgroundColor: '#05080f',
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
          brightness={2.2}
          contrast={0.45}
          refraction={0.012}
          blur={0.012}
          chromaticSpread={2.5}
          fresnel={1.2}
          angle={0}
          waveAmplitude={1.1}
          distortion={0.8}
          contour={0.25}
          lightColor="#a8d8ff"
          darkColor="#03060f"
          tintColor="#38bdf8"
        />
      </div>
      <p style={{
        color: 'rgba(168,216,255,0.55)',
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
