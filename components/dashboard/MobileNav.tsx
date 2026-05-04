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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#0d0d1a] border-b border-white/[0.05] flex items-center px-4 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Menyuni ochish"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="font-bold text-white text-sm tracking-tight flex-1 hover:text-violet-300 transition-colors">
          Daromadchi
        </Link>

        {/* Language pills */}
        <div className="flex items-center gap-0.5">
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLang(value)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
                lang === value
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
