'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Zap } from 'lucide-react'
import { useLang } from '@/app/providers'

const STORAGE_KEY = 'daromadchi-welcome-dismissed'

const LABELS = {
  uz: {
    title:    "Daromadchi'ga xush kelibsiz! 👋",
    subtitle: "Do'kon tahlilini boshlash uchun kamida bitta marketpleysingizni ulang.",
    uzum:     "Uzum Market ulash",
    yandex:   "Yandex Market ulash",
    wb:       "Wildberries ulash",
    later:    "Keyinroq",
    settings: "Sozlamalarga o'tish",
  },
  ru: {
    title:    "Добро пожаловать в Daromadchi! 👋",
    subtitle: "Подключите хотя бы один маркетплейс, чтобы начать аналитику магазина.",
    uzum:     "Подключить Uzum Market",
    yandex:   "Подключить Yandex Market",
    wb:       "Подключить Wildberries",
    later:    "Позже",
    settings: "Перейти в настройки",
  },
  en: {
    title:    "Welcome to Daromadchi! 👋",
    subtitle: "Connect at least one marketplace to start your store analytics.",
    uzum:     "Connect Uzum Market",
    yandex:   "Connect Yandex Market",
    wb:       "Connect Wildberries",
    later:    "Later",
    settings: "Go to Settings",
  },
}

const MARKETPLACES = [
  { key: 'uzum',   label: (l: typeof LABELS.uz) => l.uzum,   accent: 'var(--c1)',  letter: 'U' },
  { key: 'yandex', label: (l: typeof LABELS.uz) => l.yandex, accent: '#f59e0b',    letter: 'Y' },
  { key: 'wb',     label: (l: typeof LABELS.uz) => l.wb,     accent: '#83c0f9',    letter: 'W' },
]

interface Props {
  hasShops: boolean
}

export default function WelcomePopup({ hasShops }: Props) {
  const { lang } = useLang()
  const l = LABELS[lang] ?? LABELS.uz
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasShops) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch { /* ignore */ }
  }, [hasShops])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Close */}
        <button onClick={dismiss} className="absolute top-4 right-4 p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(131,192,249,0.12)', border: '1px solid rgba(131,192,249,0.20)' }}>
          <Zap className="w-8 h-8" style={{ color: 'var(--c1)' }} />
        </div>

        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-base)' }}>{l.title}</h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{l.subtitle}</p>

        {/* Marketplace buttons */}
        <div className="space-y-2.5 mb-5">
          {MARKETPLACES.map(({ key, label, accent, letter }) => (
            <Link
              key={key}
              href="/dashboard/settings"
              onClick={dismiss}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                color: accent,
              }}
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}>
                {letter}
              </span>
              {label(l)}
            </Link>
          ))}
        </div>

        {/* Later */}
        <button onClick={dismiss} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {l.later}
        </button>
      </div>
    </div>
  )
}
