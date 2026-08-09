'use client'

import Link from 'next/link'
import { useLang } from '@/app/providers'
import { useConsentBanner, acceptCookies, declineCookies } from '@/lib/cookie-consent'

const T = {
  uz: {
    text: 'Biz zarur cookie-lardan foydalanamiz va, roziligingiz bilan, saytni yaxshilash uchun anonim analitikadan (Google Analytics).',
    more: 'Batafsil',
    accept: 'Qabul qilish',
    decline: 'Rad etish',
  },
  ru: {
    text: 'Мы используем необходимые cookie и, с вашего согласия, анонимную аналитику (Google Analytics) для улучшения сайта.',
    more: 'Подробнее',
    accept: 'Принять',
    decline: 'Отклонить',
  },
  en: {
    text: 'We use essential cookies and, with your consent, anonymous analytics (Google Analytics) to improve the site.',
    more: 'Learn more',
    accept: 'Accept',
    decline: 'Decline',
  },
}

// Consent is read through a shared external store (lib/cookie-consent) so React
// handles SSR/hydration cleanly: the server treats consent as decided → renders
// nothing (no banner flash), then the client re-reads localStorage after mount
// and shows the banner only when no choice has been made yet.
export default function CookieConsent() {
  const { lang } = useLang()
  const consent = useConsentBanner()

  // Only show while the visitor has not yet accepted or declined.
  if (consent !== '') return null
  const t = T[lang] ?? T.uz

  return (
    <div
      className="fixed z-[100] bottom-4 left-4 right-4 sm:right-auto sm:max-w-md flex flex-col gap-3 px-4 py-3 rounded-xl border shadow-2xl"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <p className="text-sm" style={{ color: 'var(--text-base)' }}>
        {t.text}{' '}
        <Link
          href="/cookies"
          className="font-semibold underline"
          style={{ color: 'var(--c1)' }}
        >
          {t.more}
        </Link>
      </p>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={declineCookies}
          className="flex-shrink-0 rounded-lg border font-semibold transition-colors"
          style={{
            height: '2.25rem',
            padding: '0 1rem',
            fontSize: '0.875rem',
            color: 'var(--text-base)',
            borderColor: 'var(--border2)',
            background: 'transparent',
          }}
        >
          {t.decline}
        </button>
        <button
          onClick={acceptCookies}
          className="btn-primary flex-shrink-0"
          style={{ height: '2.25rem', padding: '0 1.25rem', fontSize: '0.875rem' }}
        >
          {t.accept}
        </button>
      </div>
    </div>
  )
}
