'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const LiquidEther = dynamic(() => import('./LiquidEther'), { ssr: false })

interface Props {
  colors: string[]
  opacity?: number
}

// Attaches mouseenter/mouseleave to the parent section element so the animation
// appears on hover without blocking clicks (pointerEvents: none on the overlay).
// Lazy-mounts LiquidEther on first hover and unmounts after the fade-out completes,
// so no WebGL context is active while the user is not hovering.
export default function SectionHoverAnim({ colors, opacity = 0.45 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return

    const show = () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    }
    const hide = () => {
      setVisible(false)
      timer.current = setTimeout(() => setMounted(false), 500)
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', touchAction: 'pan-y' }}>
      {mounted && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: visible ? opacity : 0,
          transition: 'opacity 0.5s ease',
        }}>
          <LiquidEther
            colors={colors}
            autoDemo
            autoSpeed={0.5}
            autoIntensity={3.0}
            mouseForce={20}
            cursorSize={100}
            resolution={0.4}
            iterationsPoisson={24}
            iterationsViscous={12}
            isViscous={false}
            isBounce={false}
            BFECC
            autoResumeDelay={2000}
            autoRampDuration={0.8}
            takeoverDuration={0.3}
          />
        </div>
      )}
    </div>
  )
}
