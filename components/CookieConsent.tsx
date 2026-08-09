'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useLang } from '@/app/providers'

const STORAGE_KEY = 'cookie-consent'

const T = {
  uz: { text: 'Biz cookie-fayllardan foydalanamiz.', more: 'Batafsil', ok: 'OK' },
  ru: { text: 'Мы используем cookie.',                more: 'Подробнее', ok: 'ОК' },
  en: { text: 'We use cookies.',                      more: 'Learn more', ok: 'OK' },
}

// Read the consent flag through an external store so React handles SSR/hydration
// cleanly (no setState-in-effect, no hydration flash): the server and the first
// client render both treat consent as given → render nothing, then the client
// re-reads localStorage after mount and shows the banner only if not accepted.
let listeners: Array<() => void> = []
function subscribe(cb: () => void) {
  listeners.push(cb)
  return () => { listeners = listeners.filter(l => l !== cb) }
}
function getSnapshot(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? '' } catch { return 'accepted' }
}
function getServerSnapshot(): string { return 'accepted' }
function acceptConsent() {
  try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch { /* ignore */ }
  listeners.forEach(l => l())
}

export default function CookieConsent() {
  const { lang } = useLang()
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (consent) return null
  const t = T[lang] ?? T.uz

  return (
    <div
      className="fixed z-[100] bottom-4 left-4 right-4 sm:right-auto sm:max-w-md flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }}
      role="dialog"
      aria-live="polite"
    >
      <p className="text-sm flex-1" style={{ color: 'var(--text-base)' }}>
        {t.text}{' '}
        <Link
          href="/cookies"
          className="font-semibold underline"
          style={{ color: '#16a34a' }}
        >
          {t.more}
        </Link>
      </p>
      <button
        onClick={acceptConsent}
        className="flex-shrink-0 px-5 py-1.5 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: '#16a34a' }}
      >
        {t.ok}
      </button>
    </div>
  )
}
