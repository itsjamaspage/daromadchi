'use client'

import { useState, useMemo, useCallback, Fragment } from 'react'
import { Check, X, Pencil, ChevronRight, ChevronDown } from 'lucide-react'
import ExportButton from './ExportButton'
import FilterBar from './FilterBar'
import FulfillmentBadge from './FulfillmentBadge'
import MpBadge, { MP_META } from './MpBadge'
import { ColorBadge } from '@/components/ColorBadge'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { ALL_CAT, catKey, catDisplay, buildCategoryList } from '@/lib/filters/category-helpers'
import { cyrillicToLatin, normalizeText } from '@/lib/shared/text-similarity'
import type { Product, MarketplaceType } from '@/lib/types'
import { useRouter } from 'next/navigation'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

// Localised "N вариантов".
function variantCountLabel(n: number, lang: 'uz' | 'ru' | 'en'): string {
  if (lang === 'en') return `${n} colours`
  if (lang === 'uz') return `${n} ta rang`
  const mod10 = n % 10, mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'цвет'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'цвета'
    : 'цветов'
  return `${n} ${word}`
}

// Colour swatch + name, from the stored variant_color key.
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
      <td colSpan={10} className="px-5 py-4" style={{ background: 'var(--bg-input)' }}>
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

  // «Остатки FBS» for one listing. FBS (and unknown, which the whole app treats
  // as FBS) shows its free-to-sell figure — the SAME available_stock the low-
  // stock tab, export and the deleted Остатки page all read, so no number moves.
  // FBO/FBY listings show «—», not a wrong FBS number: their warehouse stock is
  // not synced (see reconstruction-plan Task 14), and a blank is honest where a
  // 0 would read as "sold out".
  const fbsUnits = (p: Product): number | null =>
    (p.fulfillment_type === 'fbs' || p.fulfillment_type == null) ? p.available_stock : null

  const FbsCell = ({ value }: { value: number | null }) => (
    <td className="px-5 py-4 text-right tabular-nums"
      style={{ color: value == null ? 'var(--text-muted)' : value > 0 ? 'var(--text-base)' : '#ef4444' }}>
      {value == null ? '—' : value}
    </td>
  )

  const [query,          setQuery]          = useState('')
  const [sortBy,         setSortBy]         = useState<SortKey>('profit')
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc')
  const [tab,            setTab]            = useState<TabKey>('all')
  const [stockThreshold, setStockThreshold] = useState(10)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, number | null>>(new Map())
  // Which store-variant groups are open. Collapsed by default: the point of the
  // grouping is a shorter list, so opening one is a deliberate act.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggleGroup = useCallback((key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const categories = useMemo(() => buildCategoryList(products), [products])
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
        catDisplay(p.category, lang, p.title).toLowerCase().includes(q)
      )
    }
    if (category !== ALL_CAT) rows = rows.filter(p => catKey(p.category, p.title) === category)

    if (tab === 'low_stock') rows = rows.filter(p => p.available_stock < stockThreshold)

    rows.sort((a, b) => {
      let av: number | null, bv: number | null
      if (sortBy === 'margin') {
        av = a.profit != null ? a.profit / (Number(a.selling_price) || 1) : null
        bv = b.profit != null ? b.profit / (Number(b.selling_price) || 1) : null
      } else if (sortBy === 'title') {
        return sortDir === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title)
      } else if (sortBy === 'profit') {
        av = a.profit; bv = b.profit
      } else {
        av = a.available_stock; bv = b.available_stock
      }
      // Uncosted products sink to the bottom in BOTH directions. They have no
      // profit to rank, and parking them at one end (rather than scoring them
      // zero) keeps "worst margin first" a list of real bad margins instead of
      // a list of products nobody has costed yet.
      if (av == null || bv == null) {
        if (av == null && bv == null) return 0
        return av == null ? 1 : -1
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [enriched, query, category, tab, sortBy, sortDir, stockThreshold, lang])

  const displayItems = useMemo(() => {
    // Phase 1: group by match_key (same SKU = same colour across marketplaces)
    const colorGroups = new Map<string, Product[]>()
    for (const p of filtered) {
      const k = p.match_key ?? p.id
      const list = colorGroups.get(k)
      if (list) list.push(p); else colorGroups.set(k, [p])
    }

    // Phase 2: union colour groups that share a variant_group_key
    // (all colours of the same product card merge under one parent)
    const keys = [...colorGroups.keys()]
    const idx = new Map(keys.map((k, i) => [k, i]))
    const uf = keys.map((_, i) => i)
    const find = (x: number): number => { let r = x; while (uf[r] !== r) r = uf[r]; return r }
    const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) uf[ra] = rb }

    // 2a: variant_group_key bridge (within-marketplace colour grouping)
    const vgkMap = new Map<string, number[]>()
    for (const [mk, members] of colorGroups) {
      const mi = idx.get(mk)!
      for (const p of members) {
        if (!p.variant_group_key) continue
        const list = vgkMap.get(p.variant_group_key)
        if (list) list.push(mi); else vgkMap.set(p.variant_group_key, [mi])
      }
    }
    for (const idxs of vgkMap.values()) {
      for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j])
    }

    // 2b: cross-marketplace bridge via shared product-identifying tokens.
    // Titles are in different languages (Uzum=Uzbek, Yandex=Russian) so
    // exact matching fails. After Cyrillic→Latin transliteration, model
    // codes like "m9", "j16", "gtx350" survive in both and are the
    // reliable bridge. Score: alphanumeric tokens (letter+digit) = 3,
    // long words (>= 6 chars, e.g. "magsafe") = 2, others = 1.
    // Threshold 3 prevents false merges from single shared generic words.
    const distinctiveFor = new Map<string, Set<string>>()
    for (const [mk, members] of colorGroups) {
      const tokens = new Set<string>()
      for (const p of members) {
        const catToks = p.category
          ? new Set(normalizeText(cyrillicToLatin(p.category)).split(' ').filter(Boolean))
          : new Set<string>()
        for (const tok of normalizeText(cyrillicToLatin(p.title)).split(' ').filter(Boolean)) {
          if (tok.length >= 2 && !catToks.has(tok)) tokens.add(tok)
        }
      }
      distinctiveFor.set(mk, tokens)
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (find(i) === find(j)) continue
        const gi = colorGroups.get(keys[i])!
        const gj = colorGroups.get(keys[j])!
        if (gi[0].marketplace === gj[0].marketplace) continue
        const ti = distinctiveFor.get(keys[i])!
        const tj = distinctiveFor.get(keys[j])!
        let score = 0
        for (const tok of ti) {
          if (!tj.has(tok)) continue
          score += /[a-z]/.test(tok) && /\d/.test(tok) ? 3 : tok.length >= 6 ? 2 : 1
        }
        if (score >= 3) union(i, j)
      }
    }

    // Phase 3: collect product groups (each = set of colour groups)
    const productGroups = new Map<number, string[]>()
    for (let i = 0; i < keys.length; i++) {
      const root = find(i)
      const list = productGroups.get(root)
      if (list) list.push(keys[i]); else productGroups.set(root, [keys[i]])
    }

    // Phase 4: build display items
    const items: ({ type: 'flat'; row: Product } | { type: 'parent'; key: string; representative: Product; children: Product[] })[] = []
    for (const matchKeys of productGroups.values()) {
      const allProducts = matchKeys.flatMap(mk => colorGroups.get(mk)!)
      if (allProducts.length === 1) {
        items.push({ type: 'flat', row: allProducts[0] })
      } else {
        const children: Product[] = matchKeys.map(mk => {
          const members = colorGroups.get(mk)!
          if (members.length === 1) return members[0]
          const rep = members[0]
          const totalStock = members.reduce((s, m) => s + m.available_stock, 0)
          const stockLabel = members
            .map(m => `${(m.marketplace === 'uzum' ? 'UZ' : 'YM')} ${fbsUnits(m) ?? '—'}`)
            .join(' · ')
          return {
            ...rep,
            available_stock: totalStock,
            _mpStockLabel: stockLabel,
            _members: members,
          } as Product & { _mpStockLabel?: string; _members?: Product[] }
        })
        items.push({
          type: 'parent',
          key: matchKeys.sort()[0],
          representative: allProducts[0],
          children,
        })
      }
    }
    return items
  }, [filtered])

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
    [d.category]:         catDisplay(p.category, lang, p.title),
    [d.price]:            p.selling_price ?? 0,
    // Blank when the seller has not entered a cost — exporting 0 would make the
    // margin column beside it read 100%.
    [d.costPriceLabel]:   p.cost_price ?? '',
    // Both blank rather than 0 / 100.0 when there is no cost to compute from.
    [d.profit]:           p.profit ?? '',
    [`${d.margin} (%)`]:  p.profit != null
      ? (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1)
      : '',
    [d.stockQty]:         p.available_stock,
  }))

  const tabCounts = {
    all:       enriched.length,
    low_stock: enriched.reduce((s, p) => s + p.available_stock, 0),
  }

  // One product row. As a group child it carries only what DIFFERS from its
  // siblings — the colour and the SKU. Store and fulfillment badges live on the
  // parent, where they describe the whole group instead of repeating down the
  // column.
  const renderRow = (p: Product & { _mpStockLabel?: string; _members?: Product[] }, isChild = false, groupTitle?: string) => {
    const isMergedColor = !!(p as { _members?: Product[] })._members
    const price  = Number(p.selling_price ?? 0)
    const margin = p.profit != null && price > 0
      ? Number(((p.profit / price) * 100).toFixed(1)) : null
    const marginColor  = margin == null ? 'var(--text-muted)'
      : margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'
    const isEditing = editingId === p.id
    return (
      <Fragment key={p.id}>
        <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: p.is_archived ? 0.55 : undefined }}
          onClick={() => setEditingId(isEditing ? null : p.id)}>
          <td className="px-5 py-4" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
            <div className="flex items-center gap-2">
              {(() => {
                const imgUrl = (p as Product & { _members?: Product[] })._members?.[0]?.image_url ?? p.image_url
                return imgUrl ? (
                  <img src={imgUrl} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-cover shrink-0" style={{ background: 'var(--bg-input)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xs"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>—</div>
                )
              })()}
              <div>
                {(!isChild || (groupTitle !== undefined && p.title !== groupTitle)) && (
                  <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={p.title}>{p.title}</p>
                )}
                <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                  {isChild && <VariantColorChip colorKey={p.variant_color} lang={lang} />}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                  {isMergedColor
                    ? p._members!.map(m => m.marketplace && <MpBadge key={m.id} mp={m.marketplace} />)
                    : p.marketplace && <MpBadge mp={p.marketplace} />}
                  {!isChild && <FulfillmentBadge type={p.fulfillment_type} />}
                  {p.is_shared && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
                      title={lang === 'ru' ? 'Этот SKU распределён между несколькими магазинами' : lang === 'en' ? 'This SKU is shared across several stores' : "Bu SKU bir nechta do'kon o'rtasida bo'linadi"}
                    >
                      {lang === 'ru' ? 'Общий' : lang === 'en' ? 'Shared' : 'Umumiy'}
                    </span>
                  )}
                  {!isChild && <ColorBadge title={p.title} />}
                </div>
              </div>
            </div>
          </td>
          {isMergedColor ? (
            <td className="px-5 py-4 text-right tabular-nums text-xs" style={{ color: 'var(--text-base)' }}>
              {p._members!.map((m, i) => {
                const v = fbsUnits(m)
                const label = MP_META[m.marketplace!]?.short ?? m.marketplace
                return <span key={m.id}>{i > 0 && ' · '}<span style={{ color: v != null && v > 0 ? 'var(--text-base)' : v === 0 ? '#ef4444' : 'var(--text-muted)' }}>{label} {v ?? '—'}</span></span>
              })}
            </td>
          ) : <FbsCell value={fbsUnits(p)} />}
          <td className="px-5 py-4">
            <span className="text-xs px-2.5 py-1 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>{catDisplay(p.category, lang, p.title)}</span>
          </td>
          <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)}</td>
          <td className="px-5 py-4 text-right" style={{ color: p.cost_price ? 'var(--text-dim)' : 'var(--text-muted)' }}>
            {p.cost_price ? fmt(p.cost_price) : '—'}
          </td>
          <td className="px-5 py-4 text-right">
            {/* The cost cell to the left already reads "—" here; this is the
                same absence, not a profit of zero. */}
            {p.profit == null
              ? <span style={{ color: 'var(--text-muted)' }}>—</span>
              : <span className="font-semibold" style={{ color: '#10b981' }}>{fmt(p.profit)}</span>}
          </td>
          <td className="px-5 py-4">
            {/* The pencil sits on the margin because that is the number the
                seller is trying to move. It opens the same editor it always
                did — the field is the COST price, and the margin follows from
                it — so the tooltip says which one they are typing. */}
            <div className="flex items-center justify-end gap-2">
              <span className="flex-shrink-0" title={lang === 'ru' ? 'Введите себестоимость — маржа считается из неё'
                : lang === 'en' ? 'Enter the cost price — margin follows from it'
                : 'Tannarxni kiriting — marja shundan hisoblanadi'}>
                <Pencil className="w-3.5 h-3.5 opacity-30" style={{ color: 'var(--text-muted)' }} />
              </span>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-medium tabular-nums" style={{ color: marginColor }}>
                  {margin == null ? '—' : `${margin}%`}
                </span>
                {/* No bar at all when there is no margin — an empty track would
                    read as 0%, which is a claim, and the pencil beside it is
                    already the invitation to enter a cost. */}
                {margin != null && <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(margin, 100)}%`, background: 'linear-gradient(to right, var(--c1), #428619)' }} />
                </div>}
              </div>
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

  // Group header. Per-unit figures (price, cost, profit, margin) are NOT summed
  // — a group of colours has one price, not the sum of its colours' prices. Show
  // the shared figure when every colour agrees, which is the normal case for one
  // product in one store, and «—» when they diverge so the reader opens the
  // group rather than trusting a number that isn't true of any single listing.
  const renderGroup = (item: { key: string; representative: Product; children: Product[] }, isOpen: boolean) => {
    const kids = item.children
    const head = item.representative
    const shared = <T,>(f: (p: Product) => T): T | null => {
      const first = f(head)
      return kids.every(k => f(k) === first) ? first : null
    }
    const price    = shared(k => Number(k.selling_price ?? 0))
    const cost     = shared(k => k.cost_price ?? null)
    const profit   = shared(k => k.profit)
    const category = shared(k => k.category ?? null)
    const margin   = price && price > 0 && profit != null
      ? Number(((profit / price) * 100).toFixed(1)) : null
    const marginColor = margin == null ? 'var(--text-muted)'
      : margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'

    // Flatten children's _members to get all real listings
    const allListings = kids.flatMap(k =>
      (k as Product & { _members?: Product[] })._members ?? [k]
    )
    const marketplaces = [...new Set(allListings.map(k => k.marketplace).filter(Boolean))] as MarketplaceType[]
    const isCrossMarketplace = marketplaces.length > 1

    const fbsByMp = (mp: string) => {
      const vals = allListings.filter(k => k.marketplace === mp).map(fbsUnits).filter((v): v is number => v != null)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null
    }
    const totalFbs = allListings.map(fbsUnits).filter((v): v is number => v != null)
    const groupFbs = totalFbs.length > 0 ? totalFbs.reduce((s, v) => s + v, 0) : null

    return (
      <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card2)' }}
        onClick={() => toggleGroup(item.key)}>
        <td className="px-5 py-4">
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            {head.image_url ? (
              <img src={head.image_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-cover shrink-0" style={{ background: 'var(--bg-input)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>—</div>
            )}
            <div>
              <p className="font-semibold line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={head.title}>{head.title}</p>
              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                {marketplaces.map(mp => <MpBadge key={mp} mp={mp} />)}
                <FulfillmentBadge type={shared(k => k.fulfillment_type)} />
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  {variantCountLabel(kids.length, lang)}
                </span>
              </div>
            </div>
          </div>
        </td>
        {isCrossMarketplace ? (
          <td className="px-5 py-4 text-right tabular-nums text-xs" style={{ color: 'var(--text-base)' }}>
            {marketplaces.map((mp, i) => {
              const v = fbsByMp(mp)
              const label = MP_META[mp]?.short ?? mp
              return <span key={mp}>{i > 0 && ' · '}<span style={{ color: v != null && v > 0 ? 'var(--text-base)' : v === 0 ? '#ef4444' : 'var(--text-muted)' }}>{label} {v ?? '—'}</span></span>
            })}
          </td>
        ) : <FbsCell value={groupFbs} />}
        <td className="px-5 py-4">
          <span className="text-xs px-2.5 py-1 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>{catDisplay(category, lang, head.title)}</span>
        </td>
        <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{price != null ? fmt(price) : '—'}</td>
        <td className="px-5 py-4 text-right" style={{ color: cost ? 'var(--text-dim)' : 'var(--text-muted)' }}>{cost ? fmt(cost) : '—'}</td>
        <td className="px-5 py-4 text-right">
          {profit != null
            ? <span className="font-semibold" style={{ color: '#10b981' }}>{fmt(profit)}</span>
            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </td>
        <td className="px-5 py-4">
          {margin != null ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-medium tabular-nums" style={{ color: marginColor }}>{margin}%</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(margin, 100)}%`, background: 'linear-gradient(to right, var(--c1), #428619)' }} />
              </div>
            </div>
          ) : <div className="text-right" style={{ color: 'var(--text-muted)' }}>—</div>}
        </td>
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

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={`${d.product}, SKU, ${d.category}...`}
        categories={categories}
        selectedCategory={category}
        onCategoryChange={setCategory}
        allCategoryLabel={d.status.all}
        lang={lang}
        actions={<ExportButton data={exportData} filename="mahsulotlar" />}
        resultCount={filtered.length}
        countLabel={d.productCount}
      />

      <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('title')}>
                  {d.product} <SortIcon col="title" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none whitespace-nowrap" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('stock_quantity')}>
                  {d.fbsStockCol} <SortIcon col="stock_quantity" sortBy={sortBy} sortDir={sortDir} />
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
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{d.noProductsTitle}</td></tr>
              ) : displayItems.map(item => {
                if (item.type === 'flat') return renderRow(item.row)
                const isOpen = openGroups.has(item.key)
                return (
                  <Fragment key={item.key}>
                    {renderGroup(item, isOpen)}
                    {isOpen && item.children.map(c => renderRow(c, true, item.representative.title))}
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
