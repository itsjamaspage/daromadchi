'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

// A "?" help icon with a real popover — shows INSTANTLY on hover (group-hover)
// AND on click/tap (state), because the native `title` attribute never appears
// on touch and is delayed on desktop. Click-outside closes it. Used on the
// P&L KPI cards to explain where each number comes from.
export default function InfoTooltip({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex group">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors flex-shrink-0"
        aria-label={text}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className={`${open ? 'block' : 'hidden'} group-hover:block absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 z-50 w-56 max-w-[70vw] p-2.5 rounded-lg text-xs font-normal normal-case leading-snug shadow-xl pointer-events-none`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-base)',
        }}
      >
        {text}
      </span>
    </span>
  )
}
