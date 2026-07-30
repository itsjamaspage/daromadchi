'use client'

import { Wrench, Users, CalendarDays, Megaphone } from 'lucide-react'
import { useLang } from '@/app/providers'

const LABELS = {
  uz: {
    badge:       'Yaqin orada',
    subheading:  "Ustida ishlanmoqda. Tayyor bo'lganda sizga bildiramiz.",
  },
  ru: {
    badge:       'Скоро',
    subheading:  'В разработке. Мы сообщим, когда раздел будет готов.',
  },
  en: {
    badge:       'Coming soon',
    subheading:  "We're working on it. You'll see this section once it ships.",
  },
} as const

const ICONS = {
  wrench: Wrench,
  team: Users,
  seasonality: CalendarDays,
  advertising: Megaphone,
} as const

export type ComingSoonIcon = keyof typeof ICONS

interface Props {
  title: string
  icon?: ComingSoonIcon
}

export default function ComingSoon({ title, icon = 'wrench' }: Props) {
  const Icon = ICONS[icon] ?? Wrench
  const { lang } = useLang()
  const l = LABELS[lang] ?? LABELS.uz

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-base)' }}>
            <Icon className="w-6 h-6" />
            {title}
          </h1>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid rgba(245,158,11,0.35)' }}
          >
            {l.badge}
          </span>
        </div>
      </div>

      <div
        className="border border-dashed rounded-2xl p-10 text-center"
        style={{ background: 'var(--bg-card2)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#b45309' }}
        >
          <Icon className="w-7 h-7" />
        </div>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>{l.subheading}</p>
      </div>
    </div>
  )
}
