'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Lang } from '@/lib/i18n'

/* ── Theme ─────────────────────────────────────────────────────────────────── */
type Theme = 'dark' | 'light'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

/* ── Language ───────────────────────────────────────────────────────────────── */
const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'uz', setLang: () => {} })
export const useLang = () => useContext(LangCtx)

export default function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [lang,  setLangState] = useState<Lang>('uz')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const savedLang  = localStorage.getItem('lang')  as Lang  | null
    if (savedTheme) setTheme(savedTheme)
    if (savedLang) {
      setLangState(savedLang)
      // Sync cookie so server components (getT) match the client-side language
      document.cookie = `lang=${savedLang};path=/;max-age=31536000`
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggle() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('lang', l)
    document.cookie = `lang=${l};path=/;max-age=31536000`
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <LangCtx.Provider value={{ lang, setLang }}>
        {children}
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  )
}
