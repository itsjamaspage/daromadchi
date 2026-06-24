'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const MetaBalls = dynamic(() => import('./MetaBalls'), { ssr: false })

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
        backgroundColor: 'var(--bg-base, #0a0a0f)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'all' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MetaBalls
        color="#00d4ff"
        speed={0.4}
        enableMouseInteraction={false}
        padding={4}
        maxRadius={35}
      />
    </div>
  )
}
