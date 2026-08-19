'use client'

import { useState } from 'react'
import { Snowflake } from 'lucide-react'
import { useLang } from '@/app/providers'
import { DELETE_AFTER_FREEZE_DAYS } from '@/lib/billing/lifecycle-constants'

const T = {
  ru: {
    title: 'Аккаунт заморожен',
    body: 'Мы не видели входов больше года, поэтому аккаунт временно заморожен. Ничего не удалено — ваши данные на месте.',
    warn: (d: number) => `Если не восстановить в течение ${d} дней, аккаунт и связанные персональные данные будут удалены.`,
    cta: 'Восстановить аккаунт',
    busy: 'Восстанавливаем…',
  },
  uz: {
    title: 'Hisob muzlatildi',
    body: "Bir yildan ortiq kirish bo'lmagani uchun hisob vaqtincha muzlatildi. Hech narsa o'chirilmagan — ma'lumotlaringiz joyida.",
    warn: (d: number) => `Agar ${d} kun ichida tiklamasangiz, hisob va unga bog'liq shaxsiy ma'lumotlar o'chiriladi.`,
    cta: 'Hisobni tiklash',
    busy: 'Tiklanmoqda…',
  },
  en: {
    title: 'Account frozen',
    body: 'We have not seen a sign-in for over a year, so the account is temporarily frozen. Nothing has been deleted — your data is intact.',
    warn: (d: number) => `If it is not restored within ${d} days, the account and its personal data will be deleted.`,
    cta: 'Restore my account',
    busy: 'Restoring…',
  },
}

/**
 * What a frozen seller sees instead of the dashboard.
 *
 * It leads with what has NOT happened. A seller returning after a year to the
 * word "frozen" will assume the worst, and the first thing they need to know is
 * that their data is still there and one button brings it back.
 */
export default function FrozenGate() {
  const { lang } = useLang()
  const t = T[lang as keyof typeof T] ?? T.uz
  const [busy, setBusy] = useState(false)

  async function restore() {
    setBusy(true)
    try {
      await fetch('/api/account/reactivate', { method: 'POST' })
      window.location.reload()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border p-8 text-center"
      style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--c1)' }}>
        <Snowflake className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-base)' }}>{t.title}</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.body}</p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t.warn(DELETE_AFTER_FREEZE_DAYS)}
      </p>
      <button type="button" onClick={restore} disabled={busy}
        className="btn-primary mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60">
        {busy ? t.busy : t.cta}
      </button>
    </div>
  )
}
