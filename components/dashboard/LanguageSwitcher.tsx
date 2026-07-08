'use client'

import { useLang } from '@/app/providers'
import type { Lang } from '@/lib/i18n'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'Ўзбек' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg p-1">
      {LANGS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLang(value)}
          className="px-2.5 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap"
          style={lang === value ? {
            background: 'var(--c1)',
            color: '#fff',
          } : {
            color: 'var(--text-muted)',
          }}
          title={`Switch to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
