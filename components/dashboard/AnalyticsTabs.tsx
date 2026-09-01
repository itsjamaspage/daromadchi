'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/app/providers'

const TABS = [
  {
    href: '/dashboard/analytics',
    exact: true,
    label: { uz: 'Mahsulot tahlili', en: 'Product analytics', ru: 'Аналитика товаров' },
  },
  {
    href: '/dashboard/analytics/pnl',
    exact: false,
    label: { uz: 'Foyda va zarar', en: 'Profit & Loss', ru: 'Прибыль и убытки' },
  },
  {
    href: '/dashboard/analytics/payouts',
    exact: false,
    label: { uz: "To'lovlar", en: 'Payouts', ru: 'Вывод денег' },
  },
] as const

export default function AnalyticsTabs() {
  const pathname = usePathname()
  const { lang } = useLang()

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl p-1"
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
    >
      {TABS.map(({ href, exact, label }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={active
              ? { background: 'var(--c1)', color: 'var(--on-c1)' }
              : { color: 'var(--text-muted)' }}
          >
            {label[lang as 'uz' | 'en' | 'ru']}
          </Link>
        )
      })}
    </div>
  )
}
