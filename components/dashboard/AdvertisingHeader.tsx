'use client'

import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

export default function AdvertisingHeader() {
  const { lang } = useLang()
  const t = dashT[lang].advertising
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.pageTitle}</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm">{t.pageSubtitle}</p>
    </div>
  )
}
