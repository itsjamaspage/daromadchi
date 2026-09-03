'use client'

import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Boxes, Wifi, WifiOff, Store, Clock, Package } from 'lucide-react'
import { useTheme } from '@/app/providers'
import type { SystemHealth, ShopStatus } from '@/lib/db/system-health'

type Lang = 'uz' | 'ru' | 'en'

const STR: Record<Lang, {
  title: string; subtitle: string
  ok: string; warn: string; error: string
  syncTitle: string; apiTitle: string; driftTitle: string
  connected: string; disconnected: string; noKey: string; throttled: string
  lastSync: string; stockSync: string; neverSynced: string; agoMin: (m: number) => string
  products: string; mode: string; readOnly: string; stockSyncMode: string
  driftNone: string; driftRow: (sku: string, mp: string, a: number, b: number) => string
  driftNote: string; noShops: string; checkedAt: string
  staleWarning: string
}> = {
  ru: {
    title: 'Состояние системы',
    subtitle: 'Синхронизация и подключение маркетплейсов',
    ok: 'Всё работает', warn: 'Есть предупреждение', error: 'Обнаружена проблема',
    syncTitle: 'Синхронизация магазинов',
    apiTitle: 'Подключение API',
    driftTitle: 'Согласованность остатков',
    connected: 'Подключен', disconnected: 'Нет подключения', noKey: 'API-ключ не указан', throttled: 'Ограничение скорости',
    lastSync: 'Полная синхронизация', stockSync: 'Обновление остатков', neverSynced: 'Ещё не синхронизирован',
    agoMin: m => m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч ${m % 60} мин назад`,
    products: 'товаров', mode: 'Режим', readOnly: 'Только чтение', stockSyncMode: 'Синхронизация остатков',
    driftNone: 'Остатки на всех маркетплейсах согласованы',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} вместо ${b}`,
    driftNote: 'Показывает расхождения между маркетплейсами.',
    noShops: 'Нет активных магазинов',
    checkedAt: 'Проверено',
    staleWarning: 'Синхронизация устарела',
  },
  uz: {
    title: 'Tizim holati',
    subtitle: 'Sinxronizatsiya va marketpleys ulanishlari',
    ok: 'Hammasi ishlayapti', warn: 'Ogohlantirish bor', error: 'Muammo aniqlandi',
    syncTitle: "Do'konlar sinxronizatsiyasi",
    apiTitle: 'API ulanishi',
    driftTitle: 'Qoldiqlar mosligi',
    connected: 'Ulangan', disconnected: 'Ulanmagan', noKey: 'API-kalit kiritilmagan', throttled: 'Tezlik cheklangan',
    lastSync: "To'liq sinxronizatsiya", stockSync: 'Qoldiqlar yangilanishi', neverSynced: 'Hali sinxronlanmagan',
    agoMin: m => m < 60 ? `${m} daqiqa oldin` : `${Math.floor(m / 60)} soat ${m % 60} daqiqa oldin`,
    products: 'mahsulot', mode: 'Rejim', readOnly: "Faqat o'qish", stockSyncMode: 'Qoldiq sinxronizatsiya',
    driftNone: 'Barcha marketpleyslarda qoldiqlar mos',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${b} oʻrniga ${a}`,
    driftNote: 'Marketpleyslar orasidagi farqni koʻrsatadi.',
    noShops: "Faol do'kon yo'q",
    checkedAt: 'Tekshirildi',
    staleWarning: 'Sinxronizatsiya eskirgan',
  },
  en: {
    title: 'System status',
    subtitle: 'Sync status and marketplace API connections',
    ok: 'Everything is working', warn: 'Warning', error: 'Problem detected',
    syncTitle: 'Shop sync',
    apiTitle: 'API connection',
    driftTitle: 'Stock consistency',
    connected: 'Connected', disconnected: 'Disconnected', noKey: 'No API key', throttled: 'Rate-limited',
    lastSync: 'Full sync', stockSync: 'Stock refresh', neverSynced: 'Never synced',
    agoMin: m => m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`,
    products: 'products', mode: 'Mode', readOnly: 'Read-only', stockSyncMode: 'Stock sync',
    driftNone: 'Stock agrees across all marketplaces',
    driftRow: (sku, mp, a, b) => `${sku} · ${mp}: ${a} instead of ${b}`,
    driftNote: 'Shows disagreement between marketplaces.',
    noShops: 'No active shops',
    checkedAt: 'Checked',
    staleWarning: 'Sync is stale',
  },
}

const MP_LABEL: Record<string, string> = { uzum: 'Uzum Market', yandex_market: 'Yandex Market' }
const MP_SHORT: Record<string, string> = { uzum: 'UZ', yandex_market: 'YM' }

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
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Tashkent', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString()
  }
}

const CARD: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

function ShopCard({ shop, lang, isDark }: { shop: ShopStatus; lang: Lang; isDark: boolean }) {
  const t = STR[lang] ?? STR.en
  const tones = toneFor(isDark)

  const apiStatus: 'ok' | 'warn' | 'error' =
    !shop.hasApiKey ? 'error'
    : !shop.isActive ? 'warn'
    : shop.syncStale ? 'error'
    : 'ok'

  const apiTone = tones[apiStatus]
  const apiLabel = !shop.hasApiKey ? t.noKey
    : !shop.isActive ? t.disconnected
    : shop.throttledUntil && new Date(shop.throttledUntil) > new Date() ? t.throttled
    : shop.syncStale ? t.staleWarning
    : t.connected

  const ConnIcon = apiStatus === 'ok' ? Wifi : WifiOff

  return (
    <div className="rounded-xl p-4" style={CARD}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: apiTone.tint }}>
            <Store className="w-4 h-4" style={{ color: apiTone.accent }} />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{shop.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{MP_LABEL[shop.marketplace] ?? shop.marketplace}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: apiTone.tint, color: apiTone.accent }}>
          <ConnIcon className="w-3 h-3" />
          {apiLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
          <RefreshCw className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t.lastSync}</p>
            <p className="text-xs font-medium" style={{ color: shop.syncAgeMinutes != null ? 'var(--text-dim)' : 'var(--text-muted)' }}>
              {shop.syncAgeMinutes != null ? t.agoMin(shop.syncAgeMinutes) : t.neverSynced}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t.stockSync}</p>
            <p className="text-xs font-medium" style={{
              color: shop.stockSyncAgeMinutes == null ? 'var(--text-muted)'
                : shop.syncStale ? tones.error.accent
                : 'var(--text-dim)'
            }}>
              {shop.stockSyncAgeMinutes != null ? t.agoMin(shop.stockSyncAgeMinutes) : t.neverSynced}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
          <Package className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t.products}</p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{shop.productCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
          <ConnIcon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t.mode}</p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
              {shop.apiMode === 'stock_sync' ? t.stockSyncMode : t.readOnly}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
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
          <section>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t.syncTitle}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {health.shops.map(shop => (
                <ShopCard key={shop.id} shop={shop} lang={lang} isDark={isDark} />
              ))}
            </div>
          </section>

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
                    {t.driftRow(d.sku ?? '—', MP_SHORT[d.marketplace] ?? d.marketplace, d.physicalStock, d.groupMax)}
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
