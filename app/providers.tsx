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

interface Props {
  children: React.ReactNode
  initialLang?: Lang
}

export default function Providers({ children, initialLang = 'uz' }: Props) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [lang,  setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    // Always force dark — reset any accidentally stored 'light' preference
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')

    // Sync language: if localStorage has a different (newer) preference, use it
    const savedLang = localStorage.getItem('lang') as Lang | null
    if (savedLang && savedLang !== lang) {
      setLangState(savedLang)
      document.cookie = `lang=${savedLang};path=/;max-age=31536000`
    } else if (!savedLang) {
      // Write current lang to localStorage for backwards compat
      localStorage.setItem('lang', lang)
    }
  }, [])

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
