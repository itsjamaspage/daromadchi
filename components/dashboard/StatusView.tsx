'use client'

import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Boxes } from 'lucide-react'
import { useTheme } from '@/app/providers'
import type { SystemHealth } from '@/lib/db/system-health'

type Lang = 'uz' | 'ru' | 'en'

const STR: Record<Lang, {
  title: string; subtitle: string
  ok: string; warn: string; error: string
  syncTitle: string; syncOk: (m: number) => string; syncStaleNever: string; syncStale: (m: number) => string
  driftTitle: string; driftNone: string; driftRow: (sku: string, mp: string, a: number, b: number) => string
  driftNote: string; noShops: string; checkedAt: string
}> = {
  ru: {
    title: 'Состояние системы',
    subtitle: 'Показывает, всё ли в порядке с вашими данными',
    ok: 'Всё работает', warn: 'Есть предупреждение', error: 'Обнаружена проблема',
    syncTitle: 'Синхронизация',
    syncOk: m => `Данные обновлялись ${m} мин назад`,
    syncStaleNever: 'Синхронизация ещё ни разу не выполнялась',
    syncStale: m => `Данные не обновлялись ${m} мин — возможен сбой синхронизации`,
    driftTitle: 'Согласованность остатков',
    driftNone: 'Остатки на всех маркетплейсах согласованы',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} вместо ${b} — возможно, потеряна единица`,
    driftNote: 'Показывает расхождения между маркетплейсами. Если остаток занижен на всех сразу, здесь это не видно.',
    noShops: 'Нет активных магазинов для проверки',
    checkedAt: 'Проверено',
  },
  uz: {
    title: 'Tizim holati',
    subtitle: 'Maʼlumotlaringiz bilan hammasi joyidami — shu yerda koʻrinadi',
    ok: 'Hammasi ishlayapti', warn: 'Ogohlantirish bor', error: 'Muammo aniqlandi',
    syncTitle: 'Sinxronizatsiya',
    syncOk: m => `Maʼlumotlar ${m} daqiqa oldin yangilangan`,
    syncStaleNever: 'Sinxronizatsiya hali bir marta ham ishlamagan',
    syncStale: m => `Maʼlumotlar ${m} daqiqa yangilanmadi — sinxronizatsiyada nosozlik boʻlishi mumkin`,
    driftTitle: 'Qoldiqlar mosligi',
    driftNone: 'Barcha marketpleyslarda qoldiqlar mos',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${b} oʻrniga ${a} — bir dona yoʻqolgan boʻlishi mumkin`,
    driftNote: 'Marketpleyslar orasidagi farqni koʻrsatadi. Agar qoldiq hammasida birdek kamaysa, bu yerda koʻrinmaydi.',
    noShops: 'Tekshirish uchun faol doʻkon yoʻq',
    checkedAt: 'Tekshirildi',
  },
  en: {
    title: 'System status',
    subtitle: 'Shows whether anything is wrong with your data',
    ok: 'Everything is working', warn: 'Warning', error: 'Problem detected',
    syncTitle: 'Sync',
    syncOk: m => `Data updated ${m} min ago`,
    syncStaleNever: 'Sync has never run yet',
    syncStale: m => `Data hasn't updated in ${m} min — sync may have stopped`,
    driftTitle: 'Stock consistency',
    driftNone: 'Stock agrees across all marketplaces',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} instead of ${b} — a unit may be lost`,
    driftNote: 'Shows disagreement between marketplaces. If stock is low on all of them together, it is not visible here.',
    noShops: 'No active shops to check',
    checkedAt: 'Checked',
  },
}

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex' }

// Status accents drawn from the app's existing convention (StockAlerts,
// DataErrorBanner, DataStateView): bright shades on the dark surface, darker
// shades in light mode so the text clears WCAG contrast on the soft canvas.
// No new palette — the same amber #b45309 / red #b91c1c / emerald the rest of
// the dashboard already uses for warn/error/ok.
function toneFor(isDark: boolean) {
  return {
    ok:    { accent: isDark ? '#34d399' : '#15803d', tint: isDark ? 'rgba(52,211,153,0.14)' : 'rgba(21,128,61,0.10)',  Icon: CheckCircle2  },
    warn:  { accent: isDark ? '#f59e0b' : '#b45309', tint: isDark ? 'rgba(245,158,11,0.14)' : 'rgba(180,83,9,0.10)',   Icon: AlertTriangle },
    error: { accent: isDark ? '#f87171' : '#b91c1c', tint: isDark ? 'rgba(248,113,113,0.14)' : 'rgba(185,28,28,0.10)', Icon: XCircle       },
  } as const
}

function formatChecked(iso: string, lang: Lang): string {
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  try {
    // Render in the seller's timezone (Uzbekistan, UTC+5), not the server's UTC
    // — a raw toLocaleString() on the server printed US format at the wrong hour.
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Tashkent', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString()
  }
}

// Solid card surface matching every other dashboard page (stocks, alerts):
// var(--bg-card) fill over var(--border), so the card sits ON the canvas
// instead of letting the blue --bg-base show through a transparent box.
const CARD: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

export default function StatusView({ health, lang }: { health: SystemHealth; lang: Lang }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = STR[lang] ?? STR.en
  const tones = toneFor(isDark)
  const tone = tones[health.status]
  const headline = health.status === 'ok' ? t.ok : health.status === 'warn' ? t.warn : t.error

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>{t.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      {/* Headline status — solid card, tinted icon chip, accent heading */}
      <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={CARD}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: tone.tint }}>
          <tone.Icon className="w-5 h-5" style={{ color: tone.accent }} />
        </span>
        <span className="text-base font-semibold" style={{ color: tone.accent }}>{headline}</span>
      </div>

      {health.noShops ? (
        <div className="rounded-2xl p-5" style={CARD}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.noShops}</p>
        </div>
      ) : (
        <>
          {/* Sync freshness */}
          <section className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t.syncTitle}</h2>
            </div>
            <p className="text-sm" style={{ color: health.syncStale ? tones.error.accent : 'var(--text-muted)' }}>
              {health.syncAgeMinutes == null
                ? t.syncStaleNever
                : health.syncStale
                  ? t.syncStale(health.syncAgeMinutes)
                  : t.syncOk(health.syncAgeMinutes)}
            </p>
          </section>

          {/* Stock drift */}
          <section className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t.driftTitle}</h2>
            </div>
            {health.drift.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.driftNone}</p>
            ) : (
              <ul className="space-y-1.5">
                {health.drift.map((d, i) => (
                  <li key={i} className="text-sm font-medium px-3 py-2 rounded-lg"
                    style={{ background: tones.warn.tint, color: tones.warn.accent }}>
                    {t.driftRow(d.sku ?? '—', MP_LABEL[d.marketplace] ?? d.marketplace, d.physicalStock, d.groupMax)}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>{t.driftNote}</p>
          </section>
        </>
      )}

      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t.checkedAt}: {formatChecked(health.checkedAt, lang)}
      </p>
    </div>
  )
}
