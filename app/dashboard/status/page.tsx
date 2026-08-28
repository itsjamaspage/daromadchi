import { getSystemHealth } from '@/lib/db/system-health'
import { getLang } from '@/lib/server-i18n'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Boxes } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

const TONE = {
  ok:    { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  Icon: CheckCircle2 },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', Icon: AlertTriangle },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  Icon: XCircle },
} as const

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex' }

export default async function StatusPage() {
  const [lang, health] = await Promise.all([getLang() as Promise<Lang>, getSystemHealth()])
  const t = STR[lang] ?? STR.en
  const tone = TONE[health.status]
  const headline = health.status === 'ok' ? t.ok : health.status === 'warn' ? t.warn : t.error

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      {/* Headline status */}
      <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
        style={{ background: tone.bg, border: `1px solid ${tone.color}33` }}>
        <tone.Icon className="w-6 h-6 flex-shrink-0" style={{ color: tone.color }} />
        <span className="text-base font-semibold" style={{ color: tone.color }}>{headline}</span>
      </div>

      {health.noShops ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.noShops}</p>
      ) : (
        <>
          {/* Sync freshness */}
          <section className="rounded-2xl p-5" style={{ border: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-bold">{t.syncTitle}</h2>
            </div>
            <p className="text-sm" style={{ color: health.syncStale ? '#ef4444' : 'var(--text-muted)' }}>
              {health.freshestSyncMinutes == null
                ? t.syncStaleNever
                : health.syncStale
                  ? t.syncStale(health.freshestSyncMinutes)
                  : t.syncOk(health.freshestSyncMinutes)}
            </p>
          </section>

          {/* Stock drift */}
          <section className="rounded-2xl p-5" style={{ border: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-bold">{t.driftTitle}</h2>
            </div>
            {health.drift.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.driftNone}</p>
            ) : (
              <ul className="space-y-1.5">
                {health.drift.map((d, i) => (
                  <li key={i} className="text-sm font-medium px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
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
        {t.checkedAt}: {new Date(health.checkedAt).toLocaleString()}
      </p>
    </div>
  )
}
