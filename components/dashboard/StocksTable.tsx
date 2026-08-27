'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, ChevronDown, ChevronRight, Pencil, Link2, Unlink } from 'lucide-react'
import FulfillmentBadge from './FulfillmentBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import type { StockGroup } from '@/lib/db/stock-groups'
import type { MarketplaceType } from '@/lib/types'

// Localised "N вариантов" style count. Kept tiny + inline like the ColorBadge.
function variantCountLabel(n: number, lang: 'uz' | 'ru' | 'en'): string {
  if (lang === 'en') return `${n} variants`
  if (lang === 'uz') return `${n} ta variant`
  // ru plural: 2 варианта / 5 вариантов
  const mod10 = n % 10, mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'вариант'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'варианта'
    : 'вариантов'
  return `${n} ${word}`
}

// Small colour chip for a variant child row: swatch + localised label, built
// from the stored colour KEY (products.variant_color) via the shared palette.
// Renders nothing when the key is null/unknown — child then shows by SKU only.
function VariantColorChip({ colorKey, lang }: { colorKey: string | null; lang: 'uz' | 'ru' | 'en' }) {
  const meta = colorMetaFor(colorKey)
  if (!meta || !colorKey) return null
  const name = COLOR_LABELS[colorKey as ColorKey]?.[lang] ?? colorKey
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <span className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: meta.hex, boxShadow: meta.ring ? 'inset 0 0 0 1px var(--border)' : undefined }} />
      {name}
    </span>
  )
}

const MP_META: Record<MarketplaceType, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',        short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'  },
  yandex_market: { label: 'Yandex',      short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
}
const MP_ORDER: MarketplaceType[] = ['uzum', 'yandex_market']

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
          style={{ background: 'var(--c1)', color: 'var(--on-c1)' }}>
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
  // Mobile-only: which row's info drawer is expanded. Separate from openKey
  // (which is the desktop editor). On mobile we hide the Stock and Sold
  // columns and let tapping reveal them below as label/value pairs.
  const [mobileInfoKey, setMobileInfoKey] = useState<string | null>(null)
  const [linkingKey, setLinkingKey] = useState<string | null>(null)
  // Which variant parents are expanded (collapsed by default). Keyed by variant_group_key.
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.members.some(m => m.sku?.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)))
  }, [groups, query])

  // Nest StockGroups under a collapsible variant parent when 2+ of them share one
  // variant_group_key (the safe-degradation key resolved in computeStockGroups).
  // A single-variant or null-key group renders as a normal flat row, in place.
  const displayItems = useMemo(() => {
    const countByKey = new Map<string, number>()
    for (const g of filtered) {
      if (g.variant_group_key) countByKey.set(g.variant_group_key, (countByKey.get(g.variant_group_key) ?? 0) + 1)
    }
    const emitted = new Set<string>()
    const items: ({ type: 'flat'; group: StockGroup } | { type: 'parent'; key: string; title: string; children: StockGroup[] })[] = []
    for (const g of filtered) {
      const vk = g.variant_group_key
      if (vk && (countByKey.get(vk) ?? 0) >= 2) {
        if (emitted.has(vk)) continue
        emitted.add(vk)
        items.push({ type: 'parent', key: vk, title: g.title, children: filtered.filter(x => x.variant_group_key === vk) })
      } else {
        items.push({ type: 'flat', group: g })
      }
    }
    return items
  }, [filtered])

  const linkingGroup = linkingKey ? groups.find(g => g.match_key === linkingKey) : null

  function toggleVariant(key: string) {
    setExpandedVariants(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={d.searchPlaceholder}
          className="w-full rounded-xl pl-9 pr-3 py-2 text-sm"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-base)' }} />
      </div>

      <div className="rounded-2xl border sm:overflow-x-auto"
        style={{ background: 'var(--bg-card)',  borderColor: 'var(--border)' }}>
        <table className="w-full text-sm sm:min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-5 py-3 font-semibold">{d.colProduct}</th>
              <th className="hidden sm:table-cell px-5 py-3 font-semibold">{d.colStock}</th>
              <th className="hidden sm:table-cell px-5 py-3 font-semibold">{d.colSold}</th>
              <th className="px-5 py-3 font-semibold">{d.colLeftover}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {displayItems.map(item => {
              if (item.type === 'flat') {
                const g = item.group
                const isOpen = openKey === g.match_key
                const isMobileOpen = mobileInfoKey === g.match_key
                return (
                  <FragmentRow key={g.match_key} group={g}
                    badge={leftoverBadge(g.leftover, g.stock_threshold)} isOpen={isOpen}
                    isMobileOpen={isMobileOpen}
                    onToggle={() => setOpenKey(isOpen ? null : g.match_key)}
                    onMobileToggle={() => setMobileInfoKey(isMobileOpen ? null : g.match_key)}
                    onLink={() => setLinkingKey(g.match_key)} d={d} />
                )
              }
              // Variant parent: collapsible header row, then its child StockGroups.
              const expanded = expandedVariants.has(item.key)
              return (
                <Fragment key={item.key}>
                  <VariantParentRow item={item} expanded={expanded} lang={lang}
                    onToggle={() => toggleVariant(item.key)} />
                  {expanded && item.children.map(cg => {
                    const isOpen = openKey === cg.match_key
                    const isMobileOpen = mobileInfoKey === cg.match_key
                    return (
                      <FragmentRow key={cg.match_key} group={cg} isChild lang={lang}
                        badge={leftoverBadge(cg.leftover, cg.stock_threshold)} isOpen={isOpen}
                        isMobileOpen={isMobileOpen}
                        onToggle={() => setOpenKey(isOpen ? null : cg.match_key)}
                        onMobileToggle={() => setMobileInfoKey(isMobileOpen ? null : cg.match_key)}
                        onLink={() => setLinkingKey(cg.match_key)} d={d} />
                    )
                  })}
                </Fragment>
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

// Collapsible header for a variant group (2+ colour variants of one parent).
// Its own stock cells stay empty — the per-colour numbers live on the children
// (matches Uzum's seller catalogue). The Leftover cell shows a muted Σ total.
function VariantParentRow({ item, expanded, onToggle, lang }: {
  item: { key: string; title: string; children: StockGroup[] }
  expanded: boolean
  onToggle: () => void
  lang: 'uz' | 'ru' | 'en'
}) {
  const totalLeftover = item.children.reduce((s, c) => s + c.leftover, 0)
  return (
    <tr className="border-t cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}
      onClick={onToggle}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <p className="font-semibold leading-tight line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={item.title}>{item.title}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            {variantCountLabel(item.children.length, lang)}
          </span>
        </div>
      </td>
      <td className="hidden sm:table-cell px-5 py-3" />
      <td className="hidden sm:table-cell px-5 py-3" />
      <td className="px-5 py-3">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Σ {totalLeftover}</span>
      </td>
      <td className="px-2 py-3" />
    </tr>
  )
}

function FragmentRow({ group: g, badge, isOpen, isMobileOpen, onToggle, onMobileToggle, onLink, d, isChild, lang }: {
  group: StockGroup
  badge: { bg: string; color: string }
  isOpen: boolean
  isMobileOpen: boolean
  onToggle: () => void
  onMobileToggle: () => void
  onLink: () => void
  d: Record<string, string>
  isChild?: boolean
  lang?: 'uz' | 'ru' | 'en'
}) {
  const mps = MP_ORDER.filter(mp => mp in g.stock_by_marketplace || mp in g.sold_by_marketplace)
  return (
    <>
      <tr className="border-t sm:cursor-default cursor-pointer" style={{  borderColor: 'var(--border)' }}
        onClick={(e) => {
          // Row-level tap toggles the mobile info drawer. Ignored on ≥sm so
          // desktop keeps its non-tappable rows and the pencil button stays
          // the only way to open the editor.
          if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) return
          const target = e.target as HTMLElement
          if (target.closest('button, a')) return
          onMobileToggle()
        }}>
        {/* Variant children are indented and marked with a left accent so the
            parent→child hierarchy reads at a glance. */}
        <td className="px-5 py-3.5" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
          <div className="flex items-start justify-between gap-2">
            <p className={`leading-tight line-clamp-2 sm:line-clamp-none flex-1 ${isChild ? 'text-xs font-normal' : 'font-semibold'}`}
              style={{ color: isChild ? 'var(--text-muted)' : 'var(--text-base)' }} title={g.title}>{g.title}</p>
            <span className="sm:hidden mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
              {isMobileOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {isChild && <VariantColorChip colorKey={g.variant_color} lang={lang ?? 'uz'} />}
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
        <td className="hidden sm:table-cell px-5 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {mps.map(mp => <MpCount key={mp} mp={mp} value={g.stock_by_marketplace[mp] ?? 0} />)}
          </div>
        </td>
        <td className="hidden sm:table-cell px-5 py-3.5">
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
          {/* Free-to-sell is the headline; on-hand and reserved sit under it so the
              three never collapse into one figure that can hide a reserved unit. */}
          <span className="inline-block text-sm font-bold px-2.5 py-1 rounded-lg"
            style={{ background: badge.bg, color: badge.color, fontVariantNumeric: 'tabular-nums' }}>
            {g.available} {d.units}
          </span>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {g.on_hand} {d.onHandLabel}
            {g.reserved > 0 && <> · {g.reserved} {d.reservedLabel}</>}
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
      {isMobileOpen && (
        <tr className="sm:hidden border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
          <td colSpan={5} className="px-5 py-3">
            <dl className="text-xs space-y-2">
              <div>
                <dt className="uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{d.colStock}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {mps.map(mp => <MpCount key={mp} mp={mp} value={g.stock_by_marketplace[mp] ?? 0} />)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{d.colSold}</dt>
                <dd className="flex flex-wrap gap-1.5 items-center">
                  {mps.map(mp => <MpCount key={mp} mp={mp} value={g.sold_by_marketplace[mp] ?? 0} />)}
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>= {g.total_sold}</span>
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
                </dd>
                {g.mode === 'baseline' && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    {g.sold_since_baseline} {d.sinceBaseline}
                  </p>
                )}
              </div>
            </dl>
          </td>
        </tr>
      )}
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
