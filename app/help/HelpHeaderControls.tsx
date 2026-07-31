'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sun, Moon, Globe } from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import type { Lang } from '@/lib/i18n'

const T = {
  uz: { helpCenter: 'Yordam markazi', dashboard: 'Dashboard' },
  ru: { helpCenter: 'Справочный центр', dashboard: 'Панель управления' },
  en: { helpCenter: 'Help Center', dashboard: 'Dashboard' },
}

export default function HelpHeaderControls() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const langs: Lang[] = ['uz', 'ru', 'en']
  const t = T[lang]

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="flex items-center gap-2">
      {/* Lang toggle */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}
        >
          <Globe className="w-3 h-3" /> {lang.toUpperCase()}
        </button>
        {open && (
          <div
            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden border shadow-lg z-50"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', minWidth: '4rem' }}
          >
            {langs.map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); setOpen(false) }}
                className="w-full px-3 py-1.5 text-xs font-medium uppercase text-left transition-all"
                style={{
                  background: lang === l ? 'rgba(0,212,255,0.08)' : 'transparent',
                  color: lang === l ? 'var(--c1)' : 'var(--text-muted)',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}
      >
        {theme === 'dark'
          ? <Sun className="w-3.5 h-3.5 text-amber-400" />
          : <Moon className="w-3.5 h-3.5 text-blue-500" />}
      </button>

      <Link href="/help" className="text-xs text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors hidden sm:block">
        {t.helpCenter}
      </Link>
      <Link
        href="/dashboard"
        className="px-3 py-1.5 rounded-lg bg-[var(--c1)] text-[#020c1a] font-semibold text-xs hover:opacity-90 transition-opacity"
      >
        {t.dashboard}
      </Link>
    </div>
  )
}
