'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface Props {
  text: string
}

export default function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors"
        aria-label="Info"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 px-3 py-2 rounded-lg border text-xs leading-relaxed shadow-lg"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-dim)',
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
