'use client'

import { CheckCircle2, AlertTriangle, XCircle, Boxes } from 'lucide-react'
import { useTheme } from '@/app/providers'
import type { SystemHealth, ServiceRow, ServiceStatus } from '@/lib/db/system-health'

type Lang = 'uz' | 'ru' | 'en'

const STR: Record<Lang, {
  title: string; subtitle: string
  operational: string; degraded: string; down: string
  allOk: string; someDown: string; someDegraded: string
  syncLabel: string; apiLabel: string; telegramLabel: string
  agoMin: (m: number) => string
  driftTitle: string; driftNone: string
  driftRow: (sku: string, mp: string, a: number, b: number) => string
  driftNote: string; checkedAt: string; notConnected: string
}> = {
  ru: {
    title: 'Состояние Daromadchi',
    subtitle: 'Текущее состояние всех систем',
    operational: 'Работает', degraded: 'Замедлен', down: 'Не работает',
    allOk: 'Все системы работают',
    someDown: 'Обнаружены проблемы',
    someDegraded: 'Частичные неполадки',
    syncLabel: 'Синхронизация', apiLabel: 'API', telegramLabel: 'Telegram бот',
    agoMin: m => m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч ${m % 60} мин назад`,
    driftTitle: 'Согласованность остатков',
    driftNone: 'Остатки на всех маркетплейсах согласованы',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} вместо ${b}`,
    driftNote: 'Показывает расхождения между маркетплейсами.',
    checkedAt: 'Проверено',
    notConnected: 'Не подключен',
  },
  uz: {
    title: 'Daromadchi holati',
    subtitle: 'Barcha tizimlarning joriy holati',
    operational: 'Ishlayapti', degraded: 'Sekinlashgan', down: 'Ishlamayapti',
    allOk: 'Barcha tizimlar ishlayapti',
    someDown: 'Muammolar aniqlandi',
    someDegraded: 'Qisman nosozliklar',
    syncLabel: 'Sinxronizatsiya', apiLabel: 'API', telegramLabel: 'Telegram bot',
    agoMin: m => m < 60 ? `${m} daqiqa oldin` : `${Math.floor(m / 60)} soat ${m % 60} daqiqa oldin`,
    driftTitle: 'Qoldiqlar mosligi',
    driftNone: 'Barcha marketpleyslarda qoldiqlar mos',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${b} oʻrniga ${a}`,
    driftNote: 'Marketpleyslar orasidagi farqni koʻrsatadi.',
    checkedAt: 'Tekshirildi',
    notConnected: 'Ulanmagan',
  },
  en: {
    title: 'Daromadchi Status',
    subtitle: 'Current status of all systems',
    operational: 'Operational', degraded: 'Degraded', down: 'Down',
    allOk: 'All systems operational',
    someDown: 'Issues detected',
    someDegraded: 'Partial outage',
    syncLabel: 'Sync', apiLabel: 'API', telegramLabel: 'Telegram bot',
    agoMin: m => m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`,
    driftTitle: 'Stock consistency',
    driftNone: 'Stock agrees across all marketplaces',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} instead of ${b}`,
    driftNote: 'Shows disagreement between marketplaces.',
    checkedAt: 'Checked',
    notConnected: 'Not connected',
  },
}

const MP_SHORT: Record<string, string> = { uzum: 'UZ', yandex_market: 'YM' }

function toneFor(isDark: boolean) {
  return {
    operational: { accent: isDark ? '#34d399' : '#15803d', tint: isDark ? 'rgba(52,211,153,0.14)' : 'rgba(21,128,61,0.10)', dot: isDark ? '#34d399' : '#22c55e' },
    degraded:    { accent: isDark ? '#f59e0b' : '#b45309', tint: isDark ? 'rgba(245,158,11,0.14)' : 'rgba(180,83,9,0.10)', dot: isDark ? '#f59e0b' : '#eab308' },
    down:        { accent: isDark ? '#f87171' : '#b91c1c', tint: isDark ? 'rgba(248,113,113,0.14)' : 'rgba(185,28,28,0.10)', dot: isDark ? '#f87171' : '#ef4444' },
  } as const
}

function formatChecked(iso: string, lang: Lang): string {
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Tashkent', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString()
  }
}

function StatusDot({ status, isDark }: { status: ServiceStatus; isDark: boolean }) {
  const tones = toneFor(isDark)
  const tone = tones[status]
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {status === 'operational' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
          style={{ backgroundColor: tone.dot }} />
      )}
      <span className="relative inline-flex rounded-full h-3 w-3"
        style={{ backgroundColor: tone.dot }} />
    </span>
  )
}

function ServiceRowComponent({ service, lang, isDark }: { service: ServiceRow; lang: Lang; isDark: boolean }) {
  const t = STR[lang] ?? STR.en
  const tones = toneFor(isDark)
  const tone = tones[service.status]
  const statusLabel = service.status === 'operational' ? t.operational
    : service.status === 'degraded' ? t.degraded : t.down

  const detail = service.detail != null
    ? t.agoMin(Number(service.detail))
    : service.status === 'down' ? t.notConnected : null

  return (
    <div className="flex items-center justify-between py-3.5 px-4"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <StatusDot status={service.status} isDark={isDark} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{service.name}</span>
      </div>
      <div className="flex items-center gap-3">
        {detail && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</span>
        )}
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
          style={{ background: tone.tint, color: tone.accent }}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

export default function StatusView({ health, lang }: { health: SystemHealth; lang: Lang }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = STR[lang] ?? STR.en
  const tones = toneFor(isDark)

  const overall = health.overall ?? (health.status === 'error' ? 'down' : health.status === 'warn' ? 'degraded' : 'operational')
  const overallTone = tones[overall]
  const OverallIcon = overall === 'operational' ? CheckCircle2 : overall === 'degraded' ? AlertTriangle : XCircle
  const overallLabel = overall === 'operational' ? t.allOk : overall === 'degraded' ? t.someDegraded : t.someDown

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>{t.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      <div className="rounded-2xl px-5 py-5" style={{ background: overallTone.tint, border: `1px solid ${overallTone.accent}22` }}>
        <div className="flex items-center gap-3">
          <OverallIcon className="w-6 h-6" style={{ color: overallTone.accent }} />
          <span className="text-lg font-bold" style={{ color: overallTone.accent }}>{overallLabel}</span>
        </div>
      </div>

      {health.noShops ? (
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет активных магазинов' : lang === 'uz' ? "Faol do'kon yo'q" : 'No active shops'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {(health.services ?? []).map((service) => (
              <ServiceRowComponent key={service.key} service={service} lang={lang} isDark={isDark} />
            ))}
          </div>

          {health.drift.length > 0 && (
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Boxes className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t.driftTitle}</h2>
              </div>
              <ul className="space-y-1.5">
                {health.drift.map((d, i) => (
                  <li key={i} className="text-sm font-medium px-3 py-2 rounded-lg"
                    style={{ background: tones.degraded.tint, color: tones.degraded.accent }}>
                    {t.driftRow(d.sku ?? '—', MP_SHORT[d.marketplace] ?? d.marketplace, d.physicalStock, d.groupMax)}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>{t.driftNote}</p>
            </section>
          )}
        </>
      )}

      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t.checkedAt}: {formatChecked(health.checkedAt, lang)}
      </p>
    </div>
  )
}
