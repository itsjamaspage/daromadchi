'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, Pencil, Link2, Unlink } from 'lucide-react'
import FulfillmentBadge from './FulfillmentBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { StockGroup } from '@/lib/db/stock-groups'
import type { MarketplaceType } from '@/lib/types'

const MP_META: Record<MarketplaceType, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',        short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'  },
  yandex_market: { label: 'Yandex',      short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
  wildberries:   { label: 'Wildberries', short: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.12)' },
}
const MP_ORDER: MarketplaceType[] = ['uzum', 'wildberries', 'yandex_market']

function MpCount({ mp, value }: { mp: MarketplaceType; value: number }) {
  const m = MP_META[mp]
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.label} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </span>
  )
}

function leftoverBadge(leftover: number, threshold: number | null) {
  const limit = threshold ?? 15
  if (leftover <= limit)     return { bg: 'rgba(239, 68, 68, 0.1)',  color: '#ef4444' }
  if (leftover <= limit * 2) return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
  return                            { bg: 'rgba(52, 211, 153, 0.1)', color: '#10b981' }
}

function GroupEditor({ group, onDone }: { group: StockGroup; onDone: () => void }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard.stocksPage
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [stockVal, setStockVal] = useState(group.total_physical_stock?.toString() ?? '')
  const [thresholdVal, setThresholdVal] = useState(group.stock_threshold?.toString() ?? '')

  const save = (clearStock = false) => {
    const body: Record<string, unknown> = { match_key: group.match_key }
    body.total_physical_stock = clearStock || stockVal === '' ? null : parseInt(stockVal, 10)
    body.stock_threshold = thresholdVal === '' ? null : parseInt(thresholdVal, 10)
    startTransition(async () => {
      await fetch('/api/stock-groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      router.refresh()
      onDone()
    })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-card2)',
    border: '1px solid var(--border)',
    color: 'var(--text-base)',
  }

  return (
    <div className="flex flex-wrap items-end gap-4 py-3">
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
          {d.physicalStock}
        </label>
        <input type="number" min={0} value={stockVal}
          onChange={e => setStockVal(e.target.value)}
          className="w-32 rounded-lg px-3 py-1.5 text-sm" style={inputStyle} />
        <p className="text-[10px] mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>{d.physicalStockHint}</p>
      </div>
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
          {d.threshold}
        </label>
        <input type="number" min={0} value={thresholdVal}
          onChange={e => setThresholdVal(e.target.value)}
          className="w-32 rounded-lg px-3 py-1.5 text-sm" style={inputStyle} />
        <p className="text-[10px] mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>{d.thresholdHint}</p>
      </div>
      <div className="flex gap-2 pb-5">
        <button onClick={() => save()} disabled={isPending}
          className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'var(--c1)', color: 'white' }}>
          {d.save}
        </button>
        {group.total_physical_stock != null && (
          <button onClick={() => save(true)} disabled={isPending}
            className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {d.clear}
          </button>
        )}
        <button onClick={onDone} disabled={isPending}
          className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-card2)', color: 'var(--text-muted)' }}>
          {d.cancel}
        </button>
      </div>
    </div>
  )
}

function LinkModal({ group, allGroups, onClose, d }: {
  group: StockGroup
  allGroups: StockGroup[]
  onClose: () => void
  d: Record<string, string>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allGroups
      .filter(g => g.match_key !== group.match_key)
      .filter(g => !q ||
        g.title.toLowerCase().includes(q) ||
        g.members.some(m => m.sku?.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)))
  }, [allGroups, group.match_key, search])

  const merge = (targetKey: string) => {
    startTransition(async () => {
      await fetch('/api/stock-groups/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_key: group.match_key, target_key: targetKey }),
      })
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-base" style={{ color: 'var(--text-base)' }}>{d.linkTitle}</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {group.title} → {d.linkHint}
        </p>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={d.searchPlaceholder}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
          autoFocus />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {candidates.map(g => {
            const mps = MP_ORDER.filter(mp => mp in g.stock_by_marketplace)
            return (
              <button key={g.match_key} onClick={() => merge(g.match_key)} disabled={isPending}
                className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--bg-card2)' }}>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{g.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {g.members[0]?.sku ?? '—'}
                  </span>
                  {mps.map(mp => {
                    const m = MP_META[mp]
                    return (
                      <span key={mp} className="text-[9px] font-bold px-1 py-0.5 rounded"
                        style={{ background: m.bg, color: m.color }}>{m.short}</span>
                    )
                  })}
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {g.leftover} {d.units}
                  </span>
                </div>
              </button>
            )
          })}
          {candidates.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>{d.noData}</p>
          )}
        </div>
        <button onClick={onClose}
          className="w-full text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-card2)', color: 'var(--text-muted)' }}>
          {d.cancel}
        </button>
      </div>
    </div>
  )
}

export default function StocksTable({ groups }: { groups: StockGroup[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard.stocksPage
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [linkingKey, setLinkingKey] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.members.some(m => m.sku?.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)))
  }, [groups, query])

  const linkingGroup = linkingKey ? groups.find(g => g.match_key === linkingKey) : null

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={d.searchPlaceholder}
          className="w-full rounded-xl pl-9 pr-3 py-2 text-sm"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-base)' }} />
      </div>

      <div className="rounded-2xl border overflow-x-auto"
        style={{ background: 'var(--bg-card)',  borderColor: 'var(--border)' }}>
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-5 py-3 font-semibold">{d.colProduct}</th>
              <th className="px-5 py-3 font-semibold">{d.colStock}</th>
              <th className="px-5 py-3 font-semibold">{d.colSold}</th>
              <th className="px-5 py-3 font-semibold">{d.colLeftover}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => {
              const badge = leftoverBadge(g.leftover, g.stock_threshold)
              const isOpen = openKey === g.match_key
              return (
                <FragmentRow key={g.match_key} group={g} badge={badge} isOpen={isOpen}
                  onToggle={() => setOpenKey(isOpen ? null : g.match_key)}
                  onLink={() => setLinkingKey(g.match_key)} d={d} />
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{d.noData}</p>
        )}
      </div>

      {linkingGroup && (
        <LinkModal group={linkingGroup} allGroups={groups}
          onClose={() => setLinkingKey(null)} d={d} />
      )}
    </div>
  )
}

function UnlinkButton({ sourceKey, d }: { sourceKey: string; d: Record<string, string> }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <button disabled={isPending} title={d.unlinkBtn}
      onClick={() => {
        startTransition(async () => {
          await fetch('/api/stock-groups/merge', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_key: sourceKey }),
          })
          router.refresh()
        })
      }}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
      style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
      <Unlink className="w-3 h-3" /> {d.unlinkBtn}
    </button>
  )
}

function FragmentRow({ group: g, badge, isOpen, onToggle, onLink, d }: {
  group: StockGroup
  badge: { bg: string; color: string }
  isOpen: boolean
  onToggle: () => void
  onLink: () => void
  d: Record<string, string>
}) {
  const mps = MP_ORDER.filter(mp => mp in g.stock_by_marketplace || mp in g.sold_by_marketplace)
  return (
    <>
      <tr className="border-t" style={{  borderColor: 'var(--border)' }}>
        <td className="px-5 py-3.5">
          <p className="font-semibold leading-tight" style={{ color: 'var(--text-base)' }}>{g.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{g.members[0]?.sku ?? '—'}</span>
            {mps.map(mp => {
              const m = MP_META[mp]
              // Show FBS/FBO/FBY next to the marketplace badge so the user
              // can see how each listing is fulfilled — this drives whether
              // stocks are summed (FBO/FBY) or shared (FBS) in the group.
              const member = g.members.find(mem => mem.marketplace === mp)
              return (
                <span key={mp} className="inline-flex items-center gap-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: m.bg, color: m.color }}>
                    {m.label}
                  </span>
                  <FulfillmentBadge type={member?.fulfillment_type} />
                </span>
              )
            })}
            {g.merged_from.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                {d.linkedLabel}
              </span>
            )}
          </div>
          {g.merged_from.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {g.merged_from.map(key => (
                <UnlinkButton key={key} sourceKey={key} d={d} />
              ))}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {mps.map(mp => <MpCount key={mp} mp={mp} value={g.stock_by_marketplace[mp] ?? 0} />)}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            {mps.map(mp => <MpCount key={mp} mp={mp} value={g.sold_by_marketplace[mp] ?? 0} />)}
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              = {g.total_sold}
            </span>
            {g.total_in_process > 0 && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                {d.inProcessLabel}: {g.total_in_process}
              </span>
            )}
            {g.total_cancelled > 0 && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {d.cancelledLabel}: {g.total_cancelled}
              </span>
            )}
          </div>
          {g.mode === 'baseline' && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {g.sold_since_baseline} {d.sinceBaseline}
            </p>
          )}
        </td>
        <td className="px-5 py-3.5">
          <span className="inline-block text-sm font-bold px-2.5 py-1 rounded-lg"
            style={{ background: badge.bg, color: badge.color, fontVariantNumeric: 'tabular-nums' }}>
            {g.leftover} {d.units}
          </span>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {g.mode === 'baseline' ? `${d.baselineModeBadge}: ${g.total_physical_stock}` : d.apiModeBadge}
          </p>
        </td>
        <td className="px-2 py-3.5">
          <div className="flex flex-col gap-1">
            <button onClick={onToggle} title={d.edit}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
            <button onClick={onLink} title={d.linkBtn}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t" style={{  borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
          <td colSpan={6} className="px-5">
            <GroupEditor group={g} onDone={onToggle} />
          </td>
        </tr>
      )}
    </>
  )
}
