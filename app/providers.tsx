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
    // Restore saved theme
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) setTheme(savedTheme)

    // Sync language: if localStorage differs from cookie/initialLang, update cookie
    const savedLang = localStorage.getItem('lang') as Lang | null
    if (savedLang && savedLang !== initialLang) {
      setLangState(savedLang)
      document.cookie = `lang=${savedLang};path=/;max-age=31536000`
    } else if (!savedLang) {
      localStorage.setItem('lang', initialLang)
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
    localStorage.setItem('lang', l)
    document.cookie = `lang=${l};path=/;max-age=31536000`
    // Full page reload ensures server reads new cookie immediately
    window.location.reload()
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <LangCtx.Provider value={{ lang, setLang }}>
        {children}
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  )
}
