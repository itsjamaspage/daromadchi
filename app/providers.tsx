'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Lang } from '@/lib/i18n'

type Theme = 'dark' | 'light'
const LANGS: Lang[] = ['uz', 'en', 'ru']

function isLang(v: string | null): v is Lang { return LANGS.includes(v as Lang) }

function setCookie(k: string, v: string) {
  document.cookie = `${k}=${v};path=/;max-age=31536000;SameSite=Lax`
}

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'uz', setLang: () => {} })
export const useLang = () => useContext(LangCtx)

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const st = localStorage.getItem('theme')
  return st === 'dark' || st === 'light' ? st : 'light'
}

function getStoredLang(fallback: Lang): Lang {
  if (typeof window === 'undefined') return fallback
  const sl = localStorage.getItem('lang')
  if (isLang(sl)) {
    if (sl !== fallback) setCookie('lang', sl)
    return sl
  }
  localStorage.setItem('lang', fallback)
  return fallback
}

export default function Providers({ children, initialLang = 'uz' }: { children: React.ReactNode; initialLang?: Lang }) {
  const router = useRouter()
  const didMount = useRef(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [lang, setLangRaw] = useState<Lang>(() => getStoredLang(initialLang))

  useEffect(() => {
    didMount.current = true
    // Sync the already-chosen language to the account once on load so users who
    // picked their language before it was persisted still get notifications in
    // it. No-op (401) for anonymous visitors.
    fetch('/api/settings/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#161616' : '#83c0f7'
    if (didMount.current) localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = useCallback(() => setTheme(p => p === 'dark' ? 'light' : 'dark'), [])

  const setLang = useCallback((l: Lang) => {
    setLangRaw(l)
    localStorage.setItem('lang', l)
    setCookie('lang', l)
    // Persist to the account so scheduled Telegram notifications (sent by a cron
    // job that can't read this cookie) use the same language. Fire-and-forget;
    // silently ignored when the visitor isn't logged in.
    fetch('/api/settings/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: l }),
    }).catch(() => {})
    router.refresh()
  }, [router])

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <LangCtx.Provider value={{ lang, setLang }}>
        {children}
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  )
}
