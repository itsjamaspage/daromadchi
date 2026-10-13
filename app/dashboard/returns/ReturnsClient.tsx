'use client'

import { useEffect, useState } from 'react'
import { Package, MapPin, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, Truck, RotateCcw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

interface ReturnItem {
  id: string
  sku_id_external: number
  sku_title: string | null
  product_title: string | null
  amount: number
  packed_amount: number
  purchase_price: string | null
}

interface ReturnInvoice {
  id: string
  shop_id: string
  return_id_external: number
  status: string
  warehouse_name: string | null
  warehouse_address: string | null
  pickup_start: string | null
  pickup_end: string | null
  pickup_status: string | null
  storage_daily_rate: string | null
  storage_start: string | null
  storage_end: string | null
  type: string | null
  date_created: string | null
  shop_name: string | null
  items: ReturnItem[]
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  CREATED:       { color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/30',   icon: Clock },
  IN_TRANSIT:    { color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/30', icon: Truck },
  READY_TO_PICK: { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', icon: AlertTriangle },
  PICKED:        { color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/30',  icon: CheckCircle },
  EXPIRED:       { color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950/30',      icon: XCircle },
  CANCELLED:     { color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900/30',    icon: XCircle },
}

type StatusKey = 'returnsStatusCreated' | 'returnsStatusInTransit' | 'returnsStatusReadyToPick' | 'returnsStatusPicked' | 'returnsStatusExpired' | 'returnsStatusCancelled'

const STATUS_I18N: Record<string, StatusKey> = {
  CREATED: 'returnsStatusCreated',
  IN_TRANSIT: 'returnsStatusInTransit',
  READY_TO_PICK: 'returnsStatusReadyToPick',
  PICKED: 'returnsStatusPicked',
  EXPIRED: 'returnsStatusExpired',
  CANCELLED: 'returnsStatusCancelled',
}

type TypeKey = 'returnsTypeDefected' | 'returnsTypeReturn' | 'returnsTypeFbs'

const TYPE_I18N: Record<string, TypeKey> = {
  DEFECTED: 'returnsTypeDefected',
  RETURN: 'returnsTypeReturn',
  FBS: 'returnsTypeFbs',
}

type TabFilter = 'all' | 'READY_TO_PICK' | 'IN_TRANSIT' | 'CREATED' | 'history'
const HISTORY_STATUSES = new Set(['PICKED', 'EXPIRED', 'CANCELLED'])

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function storageDaysLeft(endDate: string | null): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  if (isNaN(end.getTime())) return null
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
}

type DashT = typeof translations['en']['dashboard']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (d: DashT, key: string): string => (d as any)[key] ?? key

export default function ReturnsClient() {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [returns, setReturns] = useState<ReturnInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabFilter>('all')

  useEffect(() => {
    fetch('/api/returns')
      .then(r => r.json())
      .then(data => setReturns(data.returns ?? []))
      .catch(() => setReturns([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-[var(--bg-card2)] rounded-xl border border-[var(--border)]" />
        ))}
      </div>
    )
  }

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center mb-4">
          <RotateCcw className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <p className="text-lg font-medium text-[var(--text-base)]">{d.returnsEmpty}</p>
        <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">{d.returnsEmptyDesc}</p>
      </div>
    )
  }

  const readyCount = returns.filter(r => r.status === 'READY_TO_PICK').length
  const transitCount = returns.filter(r => r.status === 'IN_TRANSIT').length
  const createdCount = returns.filter(r => r.status === 'CREATED').length
  const historyCount = returns.filter(r => HISTORY_STATUSES.has(r.status)).length

  const filtered = returns.filter(r => {
    if (tab === 'all') return !HISTORY_STATUSES.has(r.status)
    if (tab === 'history') return HISTORY_STATUSES.has(r.status)
    return r.status === tab
  })

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: lang === 'ru' ? 'Активные' : lang === 'uz' ? 'Faol' : 'Active', count: readyCount + transitCount + createdCount },
    { key: 'READY_TO_PICK', label: d.returnsStatusReadyToPick, count: readyCount },
    { key: 'IN_TRANSIT', label: d.returnsStatusInTransit, count: transitCount },
    { key: 'CREATED', label: d.returnsStatusCreated, count: createdCount },
    { key: 'history', label: lang === 'ru' ? 'История' : lang === 'uz' ? 'Tarix' : 'History', count: historyCount },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              background: tab === t.key ? 'var(--c1)' : 'var(--bg-card2)',
              color: tab === t.key ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${tab === t.key ? 'var(--c1)' : 'var(--border)'}`,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{
                background: tab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <p className="text-center py-10 text-[var(--text-muted)] text-sm">
          {d.returnsEmpty}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered
            .sort((a, b) => {
              const order: Record<string, number> = { READY_TO_PICK: 0, IN_TRANSIT: 1, CREATED: 2, PICKED: 3, EXPIRED: 4, CANCELLED: 5 }
              return (order[a.status] ?? 9) - (order[b.status] ?? 9)
            })
            .map(inv => <ReturnCard key={inv.id} inv={inv} d={d} lang={lang} />)}
        </div>
      )}
    </div>
  )
}

function ReturnCard({ inv, d, lang }: { inv: ReturnInvoice; d: DashT; lang: string }) {
  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.CREATED
  const StatusIcon = cfg.icon
  const statusLabel = t(d, STATUS_I18N[inv.status] ?? 'returnsStatusCreated') || inv.status
  const typeLabel = inv.type ? (t(d, TYPE_I18N[inv.type] ?? '') || inv.type) : null
  const daysLeft = storageDaysLeft(inv.storage_end)
  const isUrgent = inv.status === 'READY_TO_PICK' && daysLeft != null && daysLeft <= 3
  const totalItems = inv.items.reduce((s, i) => s + i.amount, 0)

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${isUrgent ? 'border-orange-300 dark:border-orange-700' : 'border-[var(--border)]'}`}
      style={{ background: 'var(--bg-card)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.color} ${cfg.bg}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusLabel}
          </span>
          {typeLabel && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-card2)] text-[var(--text-muted)]">
              {typeLabel}
            </span>
          )}
          {inv.shop_name && (
            <span className="text-xs text-[var(--text-muted)] truncate">{inv.shop_name}</span>
          )}
        </div>
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
          #{inv.return_id_external} · {formatDate(inv.date_created)}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {/* Warehouse */}
        {(inv.warehouse_name || inv.warehouse_address) && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-muted)]">{t(d, 'returnsWarehouse')}</div>
              <div className="text-[var(--text-base)] font-medium truncate">{inv.warehouse_name ?? ''}</div>
              {inv.warehouse_address && (
                <div className="text-xs text-[var(--text-muted)] truncate">{inv.warehouse_address}</div>
              )}
            </div>
          </div>
        )}

        {/* Pickup window */}
        {(inv.pickup_start || inv.pickup_end) && (
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t(d, 'returnsPickupWindow')}</div>
              <div className="text-[var(--text-base)] font-medium">
                {formatDateTime(inv.pickup_start)} — {formatDateTime(inv.pickup_end)}
              </div>
            </div>
          </div>
        )}

        {/* Storage fee */}
        {inv.storage_daily_rate != null && Number(inv.storage_daily_rate) > 0 && (
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t(d, 'returnsStorageFee')}</div>
              <div className={`font-medium ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--text-base)]'}`}>
                {Number(inv.storage_daily_rate).toLocaleString('ru-RU')} {lang === 'en' ? 'UZS' : "so'm"}{t(d, 'returnsPerDay')}
                {daysLeft != null && (
                  <span className={`ml-1 text-xs ${daysLeft <= 3 ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--text-muted)]'}`}>
                    ({daysLeft > 0 ? `${daysLeft}d` : lang === 'ru' ? 'просрочено' : lang === 'uz' ? 'muddati tugagan' : 'overdue'})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      {inv.items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1 mb-2">
            <Package className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">{t(d, 'returnsItems')} ({totalItems})</span>
          </div>
          <div className="space-y-1">
            {inv.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-base)] truncate mr-2">
                  {item.product_title ?? item.sku_title ?? `SKU ${item.sku_id_external}`}
                  {item.sku_title && item.product_title && (
                    <span className="text-[var(--text-muted)] text-xs ml-1">({item.sku_title})</span>
                  )}
                </span>
                <span className="text-[var(--text-muted)] text-xs whitespace-nowrap">
                  ×{item.amount}
                  {item.purchase_price && (
                    <span className="ml-1">· {Number(item.purchase_price).toLocaleString('ru-RU')} {lang === 'en' ? 'UZS' : "so'm"}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
