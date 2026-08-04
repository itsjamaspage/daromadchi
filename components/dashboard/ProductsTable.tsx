'use client'

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react'
import { Search, Check, X, Pencil, ChevronRight, ChevronDown } from 'lucide-react'
import ExportButton from './ExportButton'
import FulfillmentBadge from './FulfillmentBadge'
import MpBadge, { MP_META } from './MpBadge'
import { ColorBadge } from '@/components/ColorBadge'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Product } from '@/lib/types'
import { useRouter } from 'next/navigation'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

// SKU-normaliser matching computeStockGroups' normalizeKey — used to bridge the
// same product across marketplaces (identical SKU code → one product parent).
function normSku(s: string | null): string | null {
  return s ? s.trim().toLowerCase().replace(/[\s\-_./]+/g, '') : null
}

// Localised "N вариантов". Mirrors the StocksTable helper.
function variantCountLabel(n: number, lang: 'uz' | 'ru' | 'en'): string {
  if (lang === 'en') return `${n} variants`
  if (lang === 'uz') return `${n} ta variant`
  const mod10 = n % 10, mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'вариант'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'варианта'
    : 'вариантов'
  return `${n} ${word}`
}

// Colour chip for a variant child, from the stored variant_color key (same
// swatch mechanism as Остатки / ColorBadge). Null key → renders nothing.
function VariantColorChip({ colorKey, lang }: { colorKey: string | null | undefined; lang: 'uz' | 'ru' | 'en' }) {
  const meta = colorMetaFor(colorKey)
  if (!meta || !colorKey) return null
  const name = COLOR_LABELS[colorKey as ColorKey]?.[lang] ?? colorKey
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: meta.hex, boxShadow: meta.ring ? 'inset 0 0 0 1px var(--border)' : undefined }} />
      {name}
    </span>
  )
}

// Groups filtered products into collapsible variant parents. A product parent is
// the transitive closure of products linked by a shared variant_group_key OR a
// shared normalised SKU (the SKU bridge is what unites the same product across
// marketplaces — uzum:… and yandex:… keys — exactly like Phase 3 on Остатки).
// A parent forms only when 2+ products land in one component; everything else is
// a flat row, emitted in the original sorted position.
function groupProducts(rows: Product[]): ({ type: 'flat'; product: Product } | { type: 'parent'; key: string; title: string; children: Product[] })[] {
  // union-find over variant_group_keys
  const uf = new Map<string, string>()
  const find = (x: string): string => { let r = x; while (uf.get(r)! !== r) r = uf.get(r)!; return r }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) uf.set(ra, rb) }
  for (const p of rows) if (p.variant_group_key && !uf.has(p.variant_group_key)) uf.set(p.variant_group_key, p.variant_group_key)
  // Bridge: keys co-occurring on one normalised SKU are the same product.
  const keysBySku = new Map<string, string[]>()
  for (const p of rows) {
    if (!p.variant_group_key) continue
    const nk = normSku(p.sku)
    if (!nk) continue
    const list = keysBySku.get(nk)
    if (list) { if (!list.includes(p.variant_group_key)) list.push(p.variant_group_key) }
    else keysBySku.set(nk, [p.variant_group_key])
  }
  for (const keys of keysBySku.values()) for (let j = 1; j < keys.length; j++) union(keys[0], keys[j])
  // parent key per product = canonical component key (or null when no key)
  const parentKeyOf = (p: Product): string | null => p.variant_group_key ? find(p.variant_group_key) : null
  const countByParent = new Map<string, number>()
  for (const p of rows) { const pk = parentKeyOf(p); if (pk) countByParent.set(pk, (countByParent.get(pk) ?? 0) + 1) }

  const emitted = new Set<string>()
  const items: ({ type: 'flat'; product: Product } | { type: 'parent'; key: string; title: string; children: Product[] })[] = []
  for (const p of rows) {
    const pk = parentKeyOf(p)
    if (pk && (countByParent.get(pk) ?? 0) >= 2) {
      if (emitted.has(pk)) continue
      emitted.add(pk)
      items.push({ type: 'parent', key: pk, title: p.title, children: rows.filter(x => parentKeyOf(x) === pk) })
    } else {
      items.push({ type: 'flat', product: p })
    }
  }
  return items
}

// Product-level filters only. Order-status chips (delivered / in-process /
// cancelled) used to live here too but those are ORDER-level counts and
// belonged on the Orders page — showing them on Products was redundant
// with the Orders page's own status filters and confused the seller.
type TabKey = 'all' | 'low_stock'
type SortKey = 'title' | 'profit' | 'margin' | 'stock_quantity'

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span className="ml-1" style={{ color: 'var(--text-muted)' }}>↕</span>
  return <span className="ml-1" style={{ color: 'var(--c1)' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
}


function stockBadge(qty: number) {
  if (qty >= 30) return { bgColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-dim)' }
  if (qty >= 10) return { bgColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
  return           { bgColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
}

// "?" hint next to Остаток. Opens on hover (desktop) and on tap (mobile).
// Explains the difference between per-listing stock (what this marketplace
// says) and total physical stock in the seller's warehouse across every
// SKU-shared listing. Click outside to close on mobile.
function StockHint({ product }: { product: Product }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const total = product.total_physical ?? product.available_stock
  const perListing = product.available_stock
  const differs = product.is_shared && total !== perListing

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help"
        style={{
          background: differs ? 'rgba(168,85,247,0.15)' : 'rgba(100,116,139,0.15)',
          color: differs ? '#a855f7' : 'var(--text-muted)',
          border: `1px solid ${differs ? 'rgba(168,85,247,0.35)' : 'rgba(100,116,139,0.3)'}`,
        }}
        aria-label={d.stockHintAria}
      >
        ?
      </button>
      {open && (
        <span
          className="absolute right-0 top-6 z-30 w-64 rounded-xl p-3 text-left text-xs leading-relaxed shadow-xl"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-base)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold mb-1.5" style={{ color: 'var(--text-base)' }}>
            {d.stockHintTitle}
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>{d.stockHintWarehouse}</span>
            <span className="font-bold tabular-nums" style={{ color: differs ? '#a855f7' : 'var(--text-base)' }}>{total}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>{d.stockHintMarketplace}</span>
            <span className="font-medium tabular-nums" style={{ color: 'var(--text-base)' }}>{perListing}</span>
          </div>
          <div className="mt-2 pt-2 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {product.is_shared ? d.stockHintShared : d.stockHintSingle}
          </div>
        </span>
      )}
    </span>
  )
}

function EditRow({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (productId: string, newCostPrice: number | null, fetchDone: Promise<void>) => void }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [costPrice, setCostPrice] = useState(product.cost_price != null ? String(product.cost_price) : '')

  const sellingPrice = Number(product.selling_price ?? 0)
  const cp = Number(costPrice) || 0
  const newProfit = sellingPrice - cp
  const newMargin = sellingPrice > 0 ? (newProfit / sellingPrice * 100) : 0

  function handleSave() {
    const newCost = costPrice === '' ? null : Number(costPrice)
    const fetchDone = fetch('/api/products/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, costPrice: newCost }),
    }).then(() => {}).catch(() => {})

    onSaved(product.id, newCost, fetchDone)
    onClose()
  }

  return (
    <tr>
      <td colSpan={9} className="px-5 py-4" style={{ background: 'var(--bg-input)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.price}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
              {fmt(sellingPrice)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.costPriceLabel}</label>
            <input
              type="number"
              min={0}
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              placeholder="0"
              className="px-3 py-2 rounded-lg text-sm border w-40 focus:outline-none"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.profit}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: newProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(newProfit)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.margin}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: newMargin > 35 ? '#10b981' : newMargin > 20 ? '#f59e0b' : '#ef4444' }}>
              {newMargin.toFixed(1)}%
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: 'rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const router = useRouter()

  const allLabel = d.status.all

  const [query,          setQuery]          = useState('')
  const [sortBy,         setSortBy]         = useState<SortKey>('profit')
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc')
  const [tab,            setTab]            = useState<TabKey>('all')
  const [stockThreshold, setStockThreshold] = useState(10)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, number | null>>(new Map())
  // Which variant parents are expanded (collapsed by default). Keyed by parent key.
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const toggleVariant = useCallback((key: string) => {
    setExpandedVariants(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // Language-independent sentinel for "all categories": the state must never
  // hold a LOCALIZED label — switching the UI language used to leave the old
  // language's "All" string in state, which then filtered every row out and
  // the page looked like the data had disappeared.
  const ALL_CAT = '__all__'
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return [ALL_CAT, ...cats]
  }, [products])
  const [category, setCategory] = useState(ALL_CAT)

  const productsWithOverrides = useMemo(() => products.map(p => {
    if (!optimisticUpdates.has(p.id)) return p
    const newCost = optimisticUpdates.get(p.id) ?? null
    const selling = Number(p.selling_price ?? 0)
    const profit = selling - (newCost ?? 0)
    return { ...p, cost_price: newCost, profit }
  }), [products, optimisticUpdates])

  // Marketplace filtering happens via the page-level tabs (?mp= URL param) —
  // the second in-table marketplace row was a duplicate and is gone.
  const enriched = productsWithOverrides

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',       label: d.status.all          },
    { key: 'low_stock', label: '📦 ' + d.stockQty    },
  ]

  const filtered = useMemo(() => {
    let rows = [...enriched]

    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      )
    }
    if (category !== ALL_CAT) rows = rows.filter(p => p.category === category)

    if (tab === 'low_stock') rows = rows.filter(p => p.available_stock < stockThreshold)

    rows.sort((a, b) => {
      let av: number, bv: number
      if (sortBy === 'margin') {
        av = a.profit / (Number(a.selling_price) || 1)
        bv = b.profit / (Number(b.selling_price) || 1)
      } else if (sortBy === 'title') {
        return sortDir === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title)
      } else if (sortBy === 'profit') {
        av = a.profit; bv = b.profit
      } else {
        av = a.available_stock; bv = b.available_stock
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [enriched, query, category, tab, sortBy, sortDir, stockThreshold])

  // Collapsible variant grouping, layered on the already-filtered/sorted rows.
  const displayItems = useMemo(() => groupProducts(filtered), [filtered])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const handleSaved = useCallback((productId: string, newCostPrice: number | null, fetchDone: Promise<void>) => {
    setOptimisticUpdates(prev => new Map(prev).set(productId, newCostPrice))
    fetchDone.then(() => router.refresh())
  }, [router])

  const exportData = filtered.map(p => ({
    [d.product]:          p.title,
    'SKU':                p.sku ?? '',
    'Marketplace':        p.marketplace ? MP_META[p.marketplace]?.label : '',
    [d.category]:         p.category ?? '',
    [d.price]:            p.selling_price ?? 0,
    [d.costPriceLabel]:   p.cost_price ?? 0,
    [d.profit]:           p.profit,
    [`${d.margin} (%)`]:  (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    [d.sold]:             p.delivered ?? 0,
    [d.orderedTab]:       p.in_transit ?? 0,
    [d.cancelledTab]:     p.cancelled ?? 0,
    [d.stockQty]:         p.available_stock,
  }))

  const tabCounts = {
    all:       enriched.length,
    low_stock: enriched.reduce((s, p) => s + p.available_stock, 0),
  }

  // One product row. Reused for flat rows and for variant children (isChild adds
  // an indent + a colour chip from variant_color). Body is unchanged from before
  // the grouping was added — all existing per-variant columns/edit are preserved.
  const renderRow = (p: Product, isChild = false) => {
    const price  = Number(p.selling_price ?? 0)
    const margin = price > 0 ? Number(((p.profit / price) * 100).toFixed(1)) : 0
    const stock = stockBadge(p.available_stock)
    const marginColor  = margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'
    const isEditing = editingId === p.id
    return (
      <Fragment key={p.id}>
        <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: p.is_archived ? 0.55 : undefined }}
          onClick={() => setEditingId(isEditing ? null : p.id)}>
          <td className="px-5 py-4" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
            <div className="flex items-center gap-2">
              <div>
                <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={p.title}>{p.title}</p>
                <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                  {isChild && <VariantColorChip colorKey={p.variant_color} lang={lang} />}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                  {p.marketplace && <MpBadge mp={p.marketplace} />}
                  <FulfillmentBadge type={p.fulfillment_type} />
                  {p.is_shared && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
                      title="Bu SKU bir nechta do'kon o'rtasida bo'linadi"
                    >
                      Umumiy
                    </span>
                  )}
                  <ColorBadge title={p.title} />
                </div>
              </div>
              <Pencil className="w-3.5 h-3.5 flex-shrink-0 opacity-30" style={{ color: 'var(--text-muted)' }} />
            </div>
          </td>
          <td className="px-5 py-4">
            <span className="text-xs px-2.5 py-1 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>{p.category ?? '—'}</span>
          </td>
          <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)}</td>
          <td className="px-5 py-4 text-right" style={{ color: p.cost_price ? 'var(--text-dim)' : 'var(--text-muted)' }}>
            {p.cost_price ? fmt(p.cost_price) : '—'}
          </td>
          <td className="px-5 py-4 text-right">
            <span className="font-semibold" style={{ color: '#10b981' }}>{fmt(p.profit)}</span>
          </td>
          <td className="px-5 py-4">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-medium tabular-nums" style={{ color: marginColor }}>{margin}%</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(margin, 100)}%`, background: 'linear-gradient(to right, var(--c1), #428619)' }} />
              </div>
            </div>
          </td>
          <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>
            {p.delivered ?? 0}
          </td>
          <td className="px-5 py-4 text-right font-medium tabular-nums" style={{ color: (p.in_transit ?? 0) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
            {p.in_transit ?? 0}
          </td>
          <td className="px-5 py-4 text-right font-medium tabular-nums" style={{ color: (p.cancelled ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            {p.cancelled ?? 0}
          </td>
          <td className="px-5 py-4 text-right">
            <div className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: stock.bgColor, color: stock.color }}>
                {p.available_stock}
              </span>
              <StockHint product={p} />
            </div>
          </td>
        </tr>
        {isEditing && (
          <EditRow
            product={p}
            onClose={() => setEditingId(null)}
            onSaved={handleSaved}
          />
        )}
      </Fragment>
    )
  }

  // Parent header row for a variant group. Per-unit economics (price/cost/profit/
  // margin) and stock are left blank — they don't aggregate meaningfully (and a
  // stock sum would double-count shared FBS pools). The additive unit columns
  // (delivered/ordered/cancelled) show a muted Σ. Real values stay on children.
  const renderVariantParent = (item: { key: string; title: string; children: Product[] }, expanded: boolean) => {
    const sum = (f: (p: Product) => number | null | undefined) => item.children.reduce((s, c) => s + (f(c) ?? 0), 0)
    return (
      <tr key={item.key} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card2)' }}
        onClick={() => toggleVariant(item.key)}>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <p className="font-semibold line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={item.title}>{item.title}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {variantCountLabel(item.children.length, lang)}
            </span>
          </div>
        </td>
        <td className="px-5 py-4" />
        <td className="px-5 py-4" />
        <td className="px-5 py-4" />
        <td className="px-5 py-4" />
        <td className="px-5 py-4 text-right" style={{ color: 'var(--text-muted)' }}>Σ {sum(c => c.delivered)}</td>
        <td className="px-5 py-4 text-right" style={{ color: 'var(--text-muted)' }}>Σ {sum(c => c.in_transit)}</td>
        <td className="px-5 py-4 text-right" style={{ color: 'var(--text-muted)' }}>Σ {sum(c => c.cancelled)}</td>
        <td className="px-5 py-4" />
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      {/* Outer wrapper gives us horizontal scroll on narrow viewports.
          `w-fit` on the inner tab bar previously clipped the last two
          status chips on iPhone-width screens with no way to reach
          them. Hide the scrollbar itself so it doesn't sit on top of
          the chips on macOS/iOS. */}
      <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap flex-shrink-0"
              style={tab === key ? {
                background: 'var(--bg-card2)',
                color: 'var(--c1)',
                 borderColor: 'var(--border)',
              } : {
                color: 'var(--text-muted)',
                borderColor: 'transparent',
              }}>
              {label}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={tab === key ? {
                background: 'var(--bg-card2)',
                color: 'var(--c1)',
              } : {
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-muted)',
              }}>{tabCounts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'low_stock' && (
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {tab === 'low_stock' && (
            <label className="flex items-center gap-2">
              Zaxira chegarasi:
              <input type="number" min={1} max={200} value={stockThreshold}
                onChange={e => setStockThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded-lg focus:outline-none transition-all" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)' }} />
              dona
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`${d.product}, SKU, ${d.category}...`}
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)', '--placeholder-color': 'var(--text-muted)' } as React.CSSProperties}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all border"
              style={category === c ? {
                background: 'var(--bg-card2)',
                color: 'var(--c1)',
                 borderColor: 'var(--border)',
              } : {
                color: 'var(--text-muted)',
                borderColor: 'var(--border)',
              }}>
              {c === ALL_CAT ? allLabel : c}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <ExportButton data={exportData} filename="mahsulotlar" />
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} {d.productCount} {query || category !== ALL_CAT ? '(filtr)' : ''}</p>

      <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('title')}>
                  {d.product} <SortIcon col="title" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-left font-medium px-5 py-3">{d.category}</th>
                <th className="text-right font-medium px-5 py-3">{d.price}</th>
                <th className="text-right font-medium px-5 py-3">{d.costPrice}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('profit')}>
                  {d.profit} <SortIcon col="profit" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('margin')}>
                  {d.margin} <SortIcon col="margin" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3">{d.sold}</th>
                <th className="text-right font-medium px-5 py-3">{d.orderedTab}</th>
                <th className="text-right font-medium px-5 py-3">{d.cancelledTab}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('stock_quantity')}>
                  <span className="inline-flex items-center gap-1">
                    {d.stockQty}
                    <SortIcon col="stock_quantity" sortBy={sortBy} sortDir={sortDir} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{d.noProductsTitle}</td></tr>
              ) : displayItems.map(item => {
                if (item.type === 'flat') return renderRow(item.product)
                const expanded = expandedVariants.has(item.key)
                return (
                  <Fragment key={item.key}>
                    {renderVariantParent(item, expanded)}
                    {expanded && item.children.map(c => renderRow(c, true))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
