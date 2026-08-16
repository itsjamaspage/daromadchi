'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, HelpCircle, RefreshCw, MoreVertical, CreditCard } from 'lucide-react'
import type { PayoutEntry, PayoutOrderItem, PayoutOrderLine, MarketplaceType } from '@/lib/types'
import { isPaidStatus, isAvailableStatus, isPendingStatus } from '@/lib/db/payout-status'
import ExportButton from '@/components/dashboard/ExportButton'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import MpBadge from '@/components/dashboard/MpBadge'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

// Format a "2026-07" bucket key into a locale-aware month/year label
// ("Июль 2026" / "July 2026" / "Iyul 2026") plus a "when did the
// orders actually happen" range built from real order timestamps
// (firstOrderDate / lastOrderDate). Whole-month boundary text
// ("1–31 июл. 2026") was misleading because it always spanned the
// full month regardless of whether orders were bunched on one day.
function formatPeriod(
  period: string,
  locale: string,
  firstOrderDate: string | null,
  lastOrderDate: string | null,
): { label: string; range: string } {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return { label: period, range: '' }
  const first = new Date(Date.UTC(y, m - 1, 1))
  const monthName = first.toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
  const label = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`

  if (!firstOrderDate || !lastOrderDate) return { label, range: '' }

  const fmtDay = (iso: string) => {
    const dt = new Date(iso + 'T00:00:00Z')
    return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  if (firstOrderDate === lastOrderDate) {
    return { label, range: fmtDay(firstOrderDate) }
  }
  return { label, range: `${fmtDay(firstOrderDate)} – ${fmtDay(lastOrderDate)}` }
}

interface Props {
  entries: PayoutEntry[]
  // Date-range state (URL-driven, same as the dashboard). Drives DateRangePicker.
  period?: string
  from?: string
  to?: string
}

// Currency suffix per app language. The UZ shop currency is always
// so'm/сум/UZS but the LABEL follows the seller's chosen UI language
// so "76 000 сум" reads naturally to a Russian user instead of the
// Uzbek "so'm".
function currencySuffix(lang: string): string {
  return lang === 'ru' ? 'сум' : lang === 'en' ? 'UZS' : "so'm"
}

function fmt(n: number, lang: string) {
  return new Intl.NumberFormat('uz-UZ').format(n) + ' ' + currencySuffix(lang)
}

function fmtShort(n: number, lang: string) {
  // Precise thousands-separated + localized currency suffix. Only
  // condense at 1M+ where a full digit run would overflow narrow columns.
  const suf = currencySuffix(lang)
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln ' + suf
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' ' + suf
}

function StatusBadge({ status }: { status: PayoutEntry['status'] }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  if (status === 'paid') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        {t.statusPaid}
      </span>
    )
  }
  if (status === 'estimated_paid') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10">
        ≈ {t.statusPaid}
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        {t.statusProcessing}
      </span>
    )
  }
  if (status === 'estimated_pending') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card2)] text-[var(--text-muted)] border border-dashed border-[var(--border)]">
        ≈ {t.statusPending}
      </span>
    )
  }
  // Earned & withdrawable, not yet withdrawn (Uzum TO_WITHDRAW). Calm/neutral —
  // this is money the seller HAS, awaiting withdrawal; never render it alarming.
  if (status === 'available_to_withdraw') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/20">
        {t.statusAvailable}
      </span>
    )
  }
  // Yandex settled but fee debits not posted yet — net isn't final.
  if (status === 'fees_pending') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400/80 border border-dashed border-amber-500/25">
        {t.statusFeesPending}
      </span>
    )
  }
  return (
    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card2)] text-[var(--text-muted)] border border-[var(--border)]">
      {t.statusPending}
    </span>
  )
}

function ItemBreakdown({ items }: { items: PayoutOrderItem[] }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-[var(--text-muted)] text-xs">{t.itemsEmpty}</p>
      </div>
    )
  }

  const INITIAL = 5
  const visible = expanded ? items : items.slice(0, INITIAL)
  const hidden = items.length - INITIAL

  return (
    <div className="px-5 py-4 border-t border-[var(--border)] space-y-2">
      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
        {t.itemsTitle} · {items.length}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border)]">
            <th className="text-left font-medium py-2">{t.itemProduct}</th>
            <th className="text-right font-medium py-2">{t.itemQty}</th>
            <th className="text-right font-medium py-2">{t.itemRevenue}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, i) => (
            <tr key={`${item.sku ?? item.productTitle}-${i}`} className="border-b border-[var(--border)] last:border-b-0">
              <td className="py-2 pr-3">
                <div className="text-[var(--text-base)] font-medium leading-tight">{item.productTitle}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.sku && <span className="text-[var(--text-muted)] text-xs font-mono">{item.sku}</span>}
                  <span className="text-[var(--text-muted)] text-xs">· {item.orderCount} {t.itemOrders}</span>
                </div>
              </td>
              <td className="py-2 text-right text-[var(--text-base)] font-bold tabular-nums">×{item.qty}</td>
              <td className="py-2 text-right text-[var(--text-base)] font-bold tabular-nums">{fmt(item.revenue, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--c1)' }}
        >
          {expanded ? t.itemsShowLess : `${t.itemsShowMore} (+${hidden})`}
        </button>
      )}
    </div>
  )
}

// Per-order named breakdown, sourced from the marketplace's Finance/settlement
// data (Yandex netting / Uzum finance-orders). Each row is one order number —
// exactly what the seller sees in финансы — with its product name and net.
// Distinct from ItemBreakdown, which groups by product across the whole month;
// this lists individual orders so a number can be matched line-for-line.
function OrderBreakdown({ orders }: { orders: PayoutOrderLine[] }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const [expanded, setExpanded] = useState(false)

  if (orders.length === 0) return null

  const INITIAL = 8
  const visible = expanded ? orders : orders.slice(0, INITIAL)
  const hidden = orders.length - INITIAL

  return (
    <div className="px-5 py-4 border-t border-[var(--border)] space-y-2">
      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
        {t.ordersLineTitle} · {orders.length}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border)]">
            <th className="text-left font-medium py-2">{t.orderNumbersLabel}</th>
            <th className="text-left font-medium py-2">{t.itemProduct}</th>
            <th className="text-right font-medium py-2">{t.ordersLineNet}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((o, i) => (
            <tr key={`${o.number}-${i}`} className="border-b border-[var(--border)] last:border-b-0">
              <td className="py-2 pr-3 align-top">
                <span className="text-[var(--text-base)] font-mono text-xs">№ {o.number}</span>
              </td>
              <td className="py-2 pr-3">
                {o.name
                  ? <span className="text-[var(--text-base)] leading-tight">{o.name}</span>
                  : <span className="text-[var(--text-muted)] italic text-xs">{t.ordersLineNoName}</span>}
              </td>
              <td className="py-2 text-right text-[var(--text-base)] font-bold tabular-nums whitespace-nowrap">{fmtShort(o.net, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--c1)' }}
        >
          {expanded ? t.itemsShowLess : `${t.itemsShowMore} (+${hidden})`}
        </button>
      )}
    </div>
  )
}

function DeductionBar({ entry }: { entry: PayoutEntry }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const total = entry.commission + entry.delivery + entry.returns + entry.adSpend + entry.acquiring + entry.tax + entry.penalty + entry.storageFee + entry.additionalPayment + entry.otherDeductions
  if (total === 0) return null

  const segments = [
    { label: t.segCommission, value: entry.commission,        color: 'bg-violet-500' },
    { label: t.segDelivery,   value: entry.delivery,          color: 'bg-blue-500'   },
    { label: t.segReturns,    value: entry.returns,           color: 'bg-red-500'    },
    { label: t.segAd,         value: entry.adSpend,           color: 'bg-amber-500'  },
    { label: t.segAcquiring,  value: entry.acquiring,         color: 'bg-cyan-500'   },
    { label: t.segTax,        value: entry.tax,               color: 'bg-pink-500'   },
    { label: 'Penalty',       value: entry.penalty,           color: 'bg-orange-500' },
    { label: 'Storage',       value: entry.storageFee,        color: 'bg-teal-500'   },
    { label: t.segOther,      value: entry.otherDeductions + entry.additionalPayment, color: 'bg-slate-500' },
  ].filter(s => s.value > 0)

  return (
    <div className="px-5 py-4 bg-[var(--bg-card2)] border-t border-[var(--border)] space-y-3">
      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">{t.deductionsTitle}</p>

      {/* Proportional bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {segments.map(seg => (
          <div
            key={seg.label}
            className={`${seg.color} opacity-80`}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${fmtShort(seg.value, lang)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${seg.color} opacity-80`} />
            <span className="text-[var(--text-muted)] text-xs truncate">{seg.label}</span>
            <span className="text-[var(--text-base)] text-xs font-bold ml-auto">{fmtShort(seg.value, lang)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
        <span className="text-[var(--text-muted)] text-xs">{t.totalDeductions}</span>
        <span className="text-[var(--text-base)] text-sm font-bold">{fmt(total, lang)}</span>
      </div>
    </div>
  )
}

const MP_TAB_VALUES = ['all', 'uzum', 'yandex_market'] as const
type MpFilter = typeof MP_TAB_VALUES[number]

export default function PayoutsView({ entries, period = '365', from, to }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mpFilter, setMpFilter] = useState<MpFilter>('all')
  const [refreshingYm, setRefreshingYm] = useState<false | 'loading'>(false)
  const [refreshingUz, setRefreshingUz] = useState<false | 'loading'>(false)
  // Chip shows `short` (a compact one-liner). Hovering surfaces `full`,
  // which is the same summary plus any debug JSON returned by the sync
  // (report id, XLSX shape, etc.). Keeping the two separate stops the
  // JSON from overflowing into the truncated chip text.
  const [refreshMsg, setRefreshMsg] = useState<{ tone: 'ok' | 'err'; short: string; full: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Close the kebab menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  async function refreshYandex() {
    setMenuOpen(false)
    setRefreshingYm('loading')
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/yandex/refresh-settlements', { method: 'POST' })
      // Interpret the endpoint's `results[]` — even when HTTP is 200,
      // individual shops can report ok:false. Surface the actual sync
      // outcome so the seller sees "3 транзакций синхронизировано" or
      // the concrete error instead of a green "OK" that lied.
      let payload: { ok?: boolean; results?: Array<{ ok: boolean; inserted?: number; error?: string; skipped?: string; debug?: unknown }> } = {}
      try { payload = await res.json() } catch { /* non-json */ }
      const results = payload.results ?? []
      const totalInserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0)
      const firstErrorRow = results.find(r => !r.ok)
      const firstSkipRow  = results.find(r => r.skipped)
      // The chip needs a short, human-friendly one-liner; the hover panel
      // shows the same summary plus the full debug JSON (report id, XLSX
      // shape, whatever the sync produced).
      const buildFull = (summary: string, dbg: unknown) =>
        dbg ? `${summary}\n\n${JSON.stringify(dbg, null, 2)}` : summary
      // Yandex uses HTTP 420 for "you're generating reports too fast".
      // Translate it into a friendly hint so the seller knows to wait,
      // not to keep spamming refresh.
      const friendly = (raw: string) =>
        /Yandex API 420/.test(raw)
          ? 'Yandex ограничил частые запросы отчётов. Подождите 10–15 мин и попробуйте снова.'
          : raw
      if (!res.ok) {
        setRefreshMsg({ tone: 'err', short: `HTTP ${res.status}`, full: `HTTP ${res.status}` })
      } else if (firstErrorRow) {
        const raw = firstErrorRow.error ?? 'error'
        const short = friendly(raw).slice(0, 160)
        setRefreshMsg({ tone: 'err', short, full: buildFull(friendly(raw), firstErrorRow.debug) })
      } else if (totalInserted > 0) {
        setRefreshMsg({ tone: 'ok', short: `${totalInserted} tx`, full: `${totalInserted} tx` })
        setTimeout(() => router.refresh(), 500)
      } else {
        const raw = firstSkipRow?.skipped ?? 'Yandex вернул 0 транзакций'
        setRefreshMsg({ tone: 'ok', short: raw.slice(0, 160), full: buildFull(raw, firstSkipRow?.debug) })
      }
    } catch (e) {
      const s = String(e).slice(0, 200)
      setRefreshMsg({ tone: 'err', short: s, full: s })
    } finally {
      setRefreshingYm(false)
      // Auto-dismiss the toast-like message after 30s — long enough for
      // a screenshot of the hover panel when the debug JSON matters.
      setTimeout(() => setRefreshMsg(null), 30_000)
    }
  }

  async function refreshUzum() {
    setMenuOpen(false)
    setRefreshingUz('loading')
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/uzum/refresh-settlements', { method: 'POST' })
      let payload: { ok?: boolean; results?: Array<{ ok: boolean; inserted?: number; error?: string; skipped?: string; debug?: unknown }> } = {}
      try { payload = await res.json() } catch { /* non-json */ }
      const results = payload.results ?? []
      const totalInserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0)
      const firstErrorRow = results.find(r => !r.ok)
      const firstSkipRow  = results.find(r => r.skipped)
      const buildFull = (summary: string, dbg: unknown) =>
        dbg ? `${summary}\n\n${JSON.stringify(dbg, null, 2)}` : summary
      if (!res.ok) {
        setRefreshMsg({ tone: 'err', short: `HTTP ${res.status}`, full: `HTTP ${res.status}` })
      } else if (firstErrorRow) {
        const raw = firstErrorRow.error ?? 'error'
        setRefreshMsg({ tone: 'err', short: raw.slice(0, 160), full: buildFull(raw, firstErrorRow.debug) })
      } else if (totalInserted > 0) {
        setRefreshMsg({ tone: 'ok', short: `${totalInserted} Uzum items`, full: `${totalInserted} items` })
        setTimeout(() => router.refresh(), 500)
      } else {
        const raw = firstSkipRow?.skipped ?? 'Uzum вернул 0 записей'
        setRefreshMsg({ tone: 'ok', short: raw.slice(0, 160), full: buildFull(raw, firstSkipRow?.debug) })
      }
    } catch (e) {
      const s = String(e).slice(0, 200)
      setRefreshMsg({ tone: 'err', short: s, full: s })
    } finally {
      setRefreshingUz(false)
      setTimeout(() => setRefreshMsg(null), 30_000)
    }
  }

  const mpTabs = [
    { value: 'all' as const,           label: t.tabAll },
    { value: 'uzum' as const,          label: t.tabUzum },
    { value: 'yandex_market' as const, label: t.tabYandex },
  ]

  const filteredEntries = mpFilter === 'all' ? entries : entries.filter(e => e.marketplace === mpFilter)

  // Exclude awaitingSettlement rows from KPI totals — those have
  // netPayout=0 as a placeholder and would drag averages/totals down
  // if summed.
  const withKnownNet = filteredEntries.filter(e => !e.awaitingSettlement)
  // Three mutually-exclusive buckets (see lib/db/payout-status.ts):
  //  • available  — Uzum TO_WITHDRAW: earned, withdrawable, not withdrawn (headline).
  //  • pending    — in progress, incl. fees_pending (Yandex net not final).
  //  • paid       — money proven to have left the marketplace. Not emitted today
  //                 (no accessible Uzum payout feed / no Yandex withdrawal feed),
  //                 so the tile is an honest "pending API access" placeholder.
  const availableEntries = withKnownNet.filter(e => isAvailableStatus(e.status))
  const totalAvailable   = availableEntries.reduce((s, e) => s + e.netPayout, 0)
  const pendingEntries   = withKnownNet.filter(e => isPendingStatus(e.status))
  const pending          = pendingEntries.reduce((s, e) => s + e.netPayout, 0)
  const paidEntries      = withKnownNet.filter(e => isPaidStatus(e.status))
  const totalPaid        = paidEntries.reduce((s, e) => s + e.netPayout, 0)

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const exportData = filteredEntries.map(e => ({
    [t.colPeriod]:              e.period,
    [t.colOrders]:              e.ordersCount,
    [t.orderNumbersLabel]:      (e.orderNumbers ?? []).join(', '),
    [t.paymentRefTitle]:        (e.paymentReferences ?? []).join(', '),
    [`${t.colGross} (so'm)`]:   e.grossRevenue,
    [`${t.colCommission} (so'm)`]: e.commission,
    [`${t.colDelivery} (so'm)`]: e.delivery,
    [`${t.colReturns} (so'm)`]: e.returns,
    [`${t.colAd} (so'm)`]:      e.adSpend,
    [`${t.colTax} (so'm)`]:     e.tax,
    [`${t.colNet} (so'm)`]:     e.netPayout,
    [t.colStatus]: e.status === 'available_to_withdraw' ? t.statusAvailable
      : e.status === 'fees_pending' ? t.statusFeesPending
      : isPaidStatus(e.status) ? `${e.payoutEstimated ? '≈ ' : ''}${t.statusPaid}`
      : e.status === 'processing' ? t.statusProcessing
      : `${e.payoutEstimated ? '≈ ' : ''}${t.statusPending}`,
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Marketplace tabs + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
            {mpTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setMpFilter(tab.value); setExpandedId(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mpFilter === tab.value
                    ? 'text-[var(--c1)]'
                    : 'text-[var(--text-base)] hover:text-[var(--c1)]'
                }`}
                style={mpFilter === tab.value ? { background: 'var(--bg-base)', border: '1px solid var(--border)' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        <div className="flex items-center gap-2 ml-auto">
          {refreshMsg && (
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(refreshMsg.full).catch(() => {})
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer max-w-[480px] block truncate text-left"
                style={{
                  background: refreshMsg.tone === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: refreshMsg.tone === 'ok' ? '#10b981' : '#ef4444',
                }}
                title="Click to copy full error"
              >
                {refreshMsg.short}
              </button>
              {/* Real hover tooltip — a full-width, wrapping panel that
                  stays open long enough to read even if the message is
                  huge. Positioned below the chip so it doesn't get cut
                  off by the header bar. */}
              <div
                className="hidden group-hover:block absolute right-0 top-full mt-1 z-50 p-3 rounded-lg shadow-xl text-xs whitespace-pre-wrap break-all font-mono"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-base)',
                  minWidth: 480,
                  maxWidth: 900,
                  maxHeight: 500,
                  overflow: 'auto',
                }}
              >
                {refreshMsg.full}
              </div>
            </div>
          )}
          <DateRangePicker period={period} from={from} to={to} />
          <ExportButton data={exportData} filename="tolovu-hisoboti" targetRef={printRef} />
          {/* Kebab (⋮) menu: single icon that expands into a dropdown.
              Currently one action — "Обновить данные Yandex" — but the
              menu is designed to hold future actions (e.g. re-sync WB
              settlements) without cluttering the toolbar. */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-xl border transition-colors"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
              aria-label="More actions"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 rounded-xl border shadow-lg py-1 min-w-[220px]"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  onClick={refreshYandex}
                  disabled={refreshingYm === 'loading'}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  style={{ color: 'var(--text-base)' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${refreshingYm === 'loading' ? 'animate-spin' : ''}`} />
                  {refreshingYm === 'loading' ? t.refreshingYandex : t.refreshYandex}
                </button>
                <button
                  type="button"
                  onClick={refreshUzum}
                  disabled={refreshingUz === 'loading'}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  style={{ color: 'var(--text-base)' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${refreshingUz === 'loading' ? 'animate-spin' : ''}`} />
                  {refreshingUz === 'loading' ? 'Обновление Uzum…' : 'Обновить данные Uzum'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards. Headline is "available to withdraw" (real, provable
          from Uzum TO_WITHDRAW). "Paid" is a muted placeholder because no
          accessible marketplace feed proves a completed withdrawal yet —
          honest "unmeasured", not a false zero. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bg-card2)] border border-sky-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiAvailable}</p>
          <p className="text-[var(--text-base)] text-xl font-bold">{fmtShort(totalAvailable, lang)}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{availableEntries.length} {t.periods}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiPending}</p>
          <p className="text-[var(--text-base)] text-xl font-bold">{fmtShort(pending, lang)}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{pendingEntries.length} {t.periods}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-dashed border-[var(--border)] rounded-2xl px-4 py-3 opacity-70">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiTotalPaid}</p>
          <p className="text-[var(--text-base)] text-xl font-bold">{paidEntries.length > 0 ? fmtShort(totalPaid, lang) : '—'}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{paidEntries.length > 0 ? `${paidEntries.length} ${t.periods}` : t.paidPendingApi}</p>
        </div>
      </div>

      {/* Empty state — no real settlement data for this filter yet. We show
          confirmed payouts only, so until a period settles there is nothing
          to render here (no estimates, no zero rows). */}
      {filteredEntries.length === 0 ? (
        <div className="bg-[var(--bg-card2)] border border-dashed border-[var(--border)] rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <CreditCard className="w-7 h-7" style={{ color: 'var(--c1)' }} />
          </div>
          <h3 className="text-[var(--text-base)] font-bold text-lg mb-2">{t.emptyNoSettlementTitle}</h3>
          <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto">{t.emptyNoSettlementDesc}</p>
        </div>
      ) : (
      /* Table */
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colPeriod}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colOrders}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colGross}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colCommission}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colDelivery}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colReturns}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colAd}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colTax}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    {t.colNet}
                    <span title={t.colNet}>
                      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] cursor-help" />
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colStatus}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const period = formatPeriod(entry.period, locale, entry.firstOrderDate, entry.lastOrderDate)
                const topItem = entry.items[0]
                return (
                <Fragment key={entry.id}>
                  <tr
                    onClick={() => toggle(entry.id)}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-card2)] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      {/* MAIN (headline): the marketplace order number(s) + — for a
                          paid Yandex period — the payment-order № (bank reference).
                          Month + date are demoted below. Falls back to the period
                          label when a row has no order numbers. */}
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        {((entry.orderNumbers?.length ?? 0) > 0 || (entry.paymentReferences?.length ?? 0) > 0) ? (
                          <p className="text-sm font-semibold font-mono flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            {entry.orderNumbers && entry.orderNumbers.length > 0 && (
                              <span className="text-[var(--text-base)]">
                                № {entry.orderNumbers.slice(0, 3).join(', ')}
                                {entry.orderNumbers.length > 3 ? ` +${entry.orderNumbers.length - 3}` : ''}
                              </span>
                            )}
                            {entry.paymentReferences && entry.paymentReferences.length > 0 && (
                              <span className="text-emerald-500" title={t.paymentRefTitle}>
                                {t.paymentRefLabel} {entry.paymentReferences.join(', ')}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-[var(--text-base)] text-sm font-semibold">{period.label}</p>
                        )}
                        {entry.marketplace && <MpBadge mp={entry.marketplace as MarketplaceType} />}
                      </div>
                      {topItem && (
                        <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate max-w-[280px]" title={`${topItem.productTitle}${topItem.sku ? ' · ' + topItem.sku : ''}`}>
                          {topItem.productTitle}
                          {topItem.sku && (
                            <span className="font-mono ml-1" style={{ color: 'var(--text-dim)' }}>· {topItem.sku}</span>
                          )}
                          {entry.items.length > 1 && ` +${entry.items.length - 1}`}
                        </p>
                      )}
                      {/* Demoted: month + date, below the identifiers. */}
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">
                        {((entry.orderNumbers?.length ?? 0) > 0 || (entry.paymentReferences?.length ?? 0) > 0) ? `${period.label} · ` : ''}
                        {period.range}
                        {entry.payoutDate && ` · ${entry.payoutDate}`}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.ordersCount}</td>
                    <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{fmtShort(entry.grossRevenue, lang)}</td>
                    {entry.awaitingSettlement ? (
                      <>
                        {/* Yandex row before Yandex publishes real
                            settlement data — we refuse to estimate.
                            One long "awaiting" cell spans the deduction
                            columns instead of six fake numbers. */}
                        <td colSpan={5} className="px-4 py-3.5 text-center text-[var(--text-muted)] text-xs italic" title={t.awaitingSettlementHint}>
                          {t.awaitingSettlement}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[var(--text-muted)] text-sm">—</td>
                      </>
                    ) : (
                      <>
                        {/* Bold, full-contrast digits with a leading "-" for
                            deductions. Red-tinted digits made the numbers
                            themselves hard to read; a plain minus sign +
                            the "Комиссия / Доставка / …" column header is
                            enough to signal that these are subtractions. */}
                        <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.commission > 0 ? '-' : ''}{fmtShort(entry.commission, lang)}</td>
                        <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.delivery > 0 ? '-' : ''}{fmtShort(entry.delivery, lang)}</td>
                        <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.returns > 0 ? '-' : ''}{fmtShort(entry.returns, lang)}</td>
                        <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.adSpend > 0 ? '-' : ''}{fmtShort(entry.adSpend, lang)}</td>
                        <td className="px-4 py-3.5 text-right text-[var(--text-base)] font-bold text-sm">{entry.tax > 0 ? '-' : ''}{fmtShort(entry.tax, lang)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {/* fees_pending: net excludes not-yet-posted fees → mark it non-final with a ≈ */}
                          <span className="text-[var(--text-base)] font-bold text-sm" title={entry.status === 'fees_pending' ? t.statusFeesPending : undefined}>{entry.status === 'fees_pending' ? '≈ ' : ''}{fmtShort(entry.netPayout, lang)}</span>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3.5"><StatusBadge status={entry.status} /></td>
                    <td className="px-3 py-3.5 text-[var(--text-muted)]">
                      {expandedId === entry.id
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="border-b border-[var(--border)]">
                      <td colSpan={11} className="p-0">
                        {entry.orders && entry.orders.length > 0 && <OrderBreakdown orders={entry.orders} />}
                        <ItemBreakdown items={entry.items} />
                        <DeductionBar entry={entry} />
                      </td>
                    </tr>
                  )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
