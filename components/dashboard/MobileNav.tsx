'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import Sidebar from './Sidebar'
import { useTheme, useLang } from '@/app/providers'
import type { Lang } from '@/lib/i18n'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'UZ' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
]

export default function MobileNav() {
  const [open, setOpen]       = useState(false)
  const pathname              = usePathname()
  const { theme, toggle }     = useTheme()
  const { lang, setLang }     = useLang()

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[var(--bg-card)] border-b border-[var(--border)] flex items-center px-4 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Menyuni ochish"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="font-bold text-sm tracking-tight flex-1 transition-colors"
          style={{ color: 'var(--text-base)' }}>
          Daromadchi
        </Link>

        {/* Language pills */}
        <div className="flex items-center gap-0.5">
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLang(value)}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
              style={{
                background: lang === value ? 'rgba(var(--c1-rgb, 124,58,237), 0.12)' : 'transparent',
                color: lang === value ? 'var(--c1)' : 'var(--text-muted)',
                border: lang === value ? '1px solid var(--border2)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
