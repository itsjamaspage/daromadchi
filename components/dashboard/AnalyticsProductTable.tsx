'use client'

/**
 * One table for "what sold" and "what earns".
 *
 * It replaces two tables that answered half the question each. "Top sold" held
 * only products with sales in the period; "Margin analysis by product" held the
 * whole catalogue. Reading them together meant matching titles by eye across
 * two row sets that did not line up — and the same product carried a different
 * variant count in each ("2 variants" vs "4 variants"), because the sold table
 * could only group the colours that happened to sell.
 *
 * ── Rows are the CATALOGUE, not the sales ───────────────────────────────────
 * Every product appears, sold or not. A product with no sales this period
 * shows zeros in the sales columns and keeps its margin, stock and value —
 * which is the whole point: "high margin, sitting still" is a finding, and
 * driving the row set off sales would hide exactly that case. It also means
 * the row count stops changing every time the date filter moves.
 *
 * Variant counts are therefore the catalogue's too: one number per product,
 * the same one the Products page shows.
 *
 * ── Sales that never linked to a product ────────────────────────────────────
 * A sales row can carry product_id = null (the order item never matched a
 * listing — see docs/investigations/yandex-order-items-findings.md). Those
 * rows have real revenue, and a catalogue-driven table would silently drop
 * them. They are appended as flat rows with the margin columns blank, so the
 * revenue in this table still reconciles with the KPI cards above it.
 */

import { Fragment, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import ExportButton from '@/components/dashboard/ExportButton'
import FilterBar from '@/components/dashboard/FilterBar'
import EditableValueCell from '@/components/dashboard/EditableValueCell'
import FulfillmentBadge from '@/components/dashboard/FulfillmentBadge'
import { groupByVariant } from '@/lib/variant-grouping'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import type { Product } from '@/lib/types'
import type { ProductSalesRow } from '@/lib/db/products'
import { effective, groupSharedValues } from '@/lib/products/effective-values'
import { deriveMetrics, abcClassify, type AbcClass } from '@/lib/products/product-analytics'
import { ALL_CAT, catKey, catDisplay, buildCategoryList } from '@/lib/filters/category-helpers'
import AnalyticsTableSettings from '@/components/dashboard/AnalyticsTableSettings'
import {
  isVisible, normalizeHidden, COLUMN_PREFS_STORAGE_KEY,
} from '@/lib/products/analytics-columns'

const MP_META: Record<string, { short: string; color: string; bg: string }> = {
  uzum:          { short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'  },
  yandex_market: { short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

/** Localised "N variants". Computed here because the component has `lang` —
 *  a function prop cannot cross the Server→Client boundary. */
function variantCountLabel(n: number, lang: 'uz' | 'ru' | 'en'): string {
  if (lang === 'en') return `${n} variants`
  if (lang === 'uz') return `${n} ta variant`
  const mod10 = n % 10, mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'вариант'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'варианта'
    : 'вариантов'
  return `${n} ${word}`
}

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

/** Sales figures for one listing. Zeroed rather than undefined so a product
 *  with no sales renders "0", not a gap the reader has to interpret. */
interface Sales {
  qty_sold: number; qty_in_transit: number
  qty_cancelled: number
  /** Split out from cancelled: a return is a completed sale that came back,
   *  which is a different problem from an order that never shipped, and the
   *  return RATE is only meaningful if the two are counted apart. */
  qty_returned: number
  revenue: number
}
const NO_SALES: Sales = { qty_sold: 0, qty_in_transit: 0, qty_cancelled: 0, qty_returned: 0, revenue: 0 }

interface Props {
  products: Product[]
  sales: ProductSalesRow[]
  labels: {
    product: string
    qty: string
    inTransit: string
    cancelled: string
    revenue: string
    price: string
    costPrice: string
    profit: string
    margin: string
    noSales: string
    setPrice: string
    setCost: string
    editPriceHint: string
    editCostHint: string
    mixedValues: string
    appliesToAll: string
    returned: string
    returnRate: string
    salesShare: string
    avgPrice: string
    abc: string
    searchPlaceholder: string
    allCategories: string
    productCount: string
    settings: {
      title: string
      button: string
      presetMinimal: string
      presetSales: string
      presetMoney: string
      presetAll: string
      columns: Record<string, string>
    }
  }
}

export default function AnalyticsProductTable({ products, sales, labels }: Props) {
  const { lang } = useLang()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const categories = useMemo(() => buildCategoryList(products), [products])
  const [category, setCategory] = useState(ALL_CAT)

  // Column visibility. Read on mount rather than during render so the server
  // and the first client render agree — reading localStorage inline would
  // hydrate a different table than the server sent.
  const [hidden, setHidden] = useState<string[]>([])
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY)
      // Reading storage AFTER mount is the point: doing it during render would
      // hydrate a different table than the server sent, which React treats as
      // a mismatch. Same pattern and reason as TelegramConnect.tsx. The
      // directive must be one line — a multi-line description makes
      // "next-line" point at the comment rather than the call.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHidden(normalizeHidden(JSON.parse(raw)))
    } catch {
      // A private window, cleared site data, or storage the browser refuses.
      // Showing every column is the right fallback — never a blank table.
    }
  }, [])
  const changeHidden = (next: string[]) => {
    setHidden(next)
    try {
      window.localStorage.setItem(COLUMN_PREFS_STORAGE_KEY, JSON.stringify(next))
    } catch { /* the choice still applies to this session */ }
  }
  /** Render a cell only when its column is on. One helper for the header and
   *  every row, so a column can never be dropped from one and kept in another
   *  — which would shift every cell after it. */
  const col = (key: string, cell: React.ReactNode) => isVisible(key, hidden) ? cell : null
  const toggle = (k: string) => setExpanded(prev => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  const { salesByProduct, orphanSales } = useMemo(() => {
    const byProduct = new Map<string, Sales>()
    const orphans: ProductSalesRow[] = []
    for (const r of sales) {
      if (!r.product_id) { orphans.push(r); continue }
      const prev = byProduct.get(r.product_id) ?? NO_SALES
      byProduct.set(r.product_id, {
        qty_sold:       prev.qty_sold       + r.qty_sold,
        qty_in_transit: prev.qty_in_transit + r.qty_in_transit,
        qty_cancelled:  prev.qty_cancelled  + r.qty_cancelled,
        qty_returned:   prev.qty_returned   + r.qty_returned,
        revenue:        prev.revenue        + r.revenue,
      })
    }
    return { salesByProduct: byProduct, orphanSales: orphans }
  }, [sales])
  const salesFor = (id: string): Sales => salesByProduct.get(id) ?? NO_SALES

  // Denominator for "share of sales". Every row on screen, including orphaned
  // sales — otherwise the shares would not add to 100%.
  const periodRevenue =
    [...salesByProduct.values()].reduce((t, s) => t + s.revenue, 0)
    + orphanSales.reduce((t, r) => t + r.revenue, 0)

  // Revenue first — this is a performance table. Products that sold nothing
  // fall to the bottom and are ordered by margin among themselves, so the
  // tail is still ranked by something useful rather than arbitrary.
  const groupRevenue = (rows: Product[]) => rows.reduce((s, p) => s + salesFor(p.id).revenue, 0)
  const groupMargin = (rows: Product[]) => Math.max(0, ...rows.map(p => {
    const price = Number(p.selling_price ?? 0)
    // An uncosted product contributes no margin to the ordering rather than a
    // fictitious 100% one, which would float the least-known rows to the top.
    return p.profit != null && price > 0 ? (p.profit / price) : 0
  }))

  const filteredProducts = useMemo(() => {
    let rows = products
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        catDisplay(p.category, lang, p.title).toLowerCase().includes(q)
      )
    }
    if (category !== ALL_CAT) rows = rows.filter(p => catKey(p.category, p.title) === category)
    return rows
  }, [products, query, category, lang])

  const filteredOrphans = useMemo(() => {
    if (!query.trim()) return orphanSales
    const q = query.toLowerCase()
    return orphanSales.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.sku ?? '').toLowerCase().includes(q)
    )
  }, [orphanSales, query])

  const grouped = groupByVariant(filteredProducts.map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    variant_group_key: p.variant_group_key ?? null,
    row: p,
  })))

  const groupRows = (item: typeof grouped[number]) =>
    item.type === 'parent' ? item.children.map(c => c.row) : [item.row.row]
  const groupKey = (item: typeof grouped[number]) =>
    item.type === 'parent' ? `p:${item.key}` : `f:${item.row.row.id}`

  // ABC over GROUPS, not listings. The same product sold on Uzum and Yandex is
  // one thing to stock; ranking its two halves separately would split its
  // revenue and demote a strong product twice.
  const abc: Map<string, AbcClass> = abcClassify(
    grouped.map(item => ({ id: groupKey(item), revenue: groupRevenue(groupRows(item)) })),
  )
  const abcFor = (item: typeof grouped[number]): AbcClass => abc.get(groupKey(item)) ?? 'C'

  const sortedGroups = [...grouped].sort((a, b) => {
    const rowsA = a.type === 'parent' ? a.children.map(c => c.row) : [a.row.row]
    const rowsB = b.type === 'parent' ? b.children.map(c => c.row) : [b.row.row]
    const revDiff = groupRevenue(rowsB) - groupRevenue(rowsA)
    if (revDiff !== 0) return revDiff
    return groupMargin(rowsB) - groupMargin(rowsA)
  })

  /** A / B / C by revenue. Colour-coded so the eye finds the A products
   *  without reading, the way the Yoolip screen does. */
  const AbcBadge = ({ cls }: { cls: AbcClass }) => (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded"
      style={cls === 'A' ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
        : cls === 'B' ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
        : { background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
      {cls}
    </span>
  )

  const badges = (p: Product) => (
    <>
      {p.marketplace && (() => {
        const m = MP_META[p.marketplace]
        return m ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.short}</span> : null
      })()}
      <FulfillmentBadge type={p.fulfillment_type} />
    </>
  )

  const salesCells = (s: Sales) => {
    const m = deriveMetrics(
      { delivered: s.qty_sold, returned: s.qty_returned, revenue: s.revenue },
      periodRevenue,
    )
    return (
      <>
        {col('delivered', <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_sold > 0 ? 'var(--c1)' : 'var(--text-muted)' }}>{s.qty_sold}</td>)}
        {col('inTransit', <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_in_transit > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{s.qty_in_transit}</td>)}
        {col('cancelled', <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_cancelled > 0 ? '#ef4444' : 'var(--text-muted)' }}>{s.qty_cancelled}</td>)}
        {col('returned', <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_returned > 0 ? '#ef4444' : 'var(--text-muted)' }}>{s.qty_returned}</td>)}
        {/* Amber past 10%: high enough to be a real signal on a small catalogue,
            low enough that a genuinely bad product still stands out in red. */}
        {col('returnRate', <td className="px-4 py-3.5 text-right" style={{ color: m.returnRate == null ? 'var(--text-muted)' : m.returnRate >= 20 ? '#ef4444' : m.returnRate >= 10 ? '#f59e0b' : 'var(--text-dim)' }}>
          {m.returnRate == null ? '—' : `${m.returnRate.toFixed(1)}%`}
        </td>)}
        {col('revenue', <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(s.revenue)} so&apos;m</td>)}
        {col('salesShare', <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>{m.salesShare.toFixed(1)}%</td>)}
        {/* The realised price. Its gap from the listed Price is the number
            worth looking at — it is what discounts and promotions actually
            cost. Null (not 0) when nothing was delivered. */}
        {col('avgPrice', <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>
          {m.avgPrice == null ? '—' : `${fmt(m.avgPrice)} so'm`}
        </td>)}
      </>
    )
  }

  const renderRow = (p: Product, isChild = false, abcCls?: AbcClass) => {
    const e = effective(p)
    const { price, cost } = e
    // Recomputed here, never read off p.profit: that field was calculated
    // server-side from selling_price, so an overridden price would leave the
    // profit and margin columns describing a price no longer on screen.
    // Null when the seller has not costed this product: profit off a cost of
    // zero is the selling price, and the margin beside it reads 100%.
    const profit   = cost != null ? price - cost : null
    const margin   = profit != null && price > 0 ? (profit / price) * 100 : null
    const profitColor = profit != null && profit > 0 ? '#10b981' : '#ef4444'
    const marginColor = margin == null ? 'var(--text-muted)'
      : margin >= 35 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444'
    return (
      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
        {col('product', <td className="px-5 py-3.5" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
          <div className="flex items-center gap-2">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" style={{ background: 'var(--bg-input)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-9 h-9 rounded shrink-0 flex items-center justify-center text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>—</div>
            )}
            <div>
              <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={p.title}>{p.title}</p>
              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                {isChild && <VariantColorChip colorKey={p.variant_color} lang={lang} />}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                {badges(p)}
              </div>
            </div>
          </div>
        </td>)}
        {salesCells(salesFor(p.id))}
        {col('price', <td className="px-4 py-3.5 text-right">
          <EditableValueCell productId={p.id} field="priceOverride"
            value={price > 0 ? price : null} overridden={e.priceOverridden}
            emptyLabel={labels.setPrice} title={labels.editPriceHint} />
        </td>)}
        {col('cost', <td className="px-4 py-3.5 text-right">
          <EditableValueCell productId={p.id} field="costPrice"
            value={cost != null && cost > 0 ? cost : null}
            emptyLabel={labels.setCost} title={labels.editCostHint} />
        </td>)}
        {/* Profit, margin and stock value are IDENTITIES of the three cells
            above (profit = price − cost, margin = profit ÷ price, stock value
            = cost × stock), so they are not separately editable — there would
            be no single right answer for which input an edit should move.
            They recompute the moment any input is saved. */}
        {col('profit', <td className="px-4 py-3.5 text-right">
          {/* An em dash, not a number: the cost cell to the left is empty, and
              these two are identities of it. Filling that cell fills these. */}
          {profit == null
            ? <span style={{ color: 'var(--text-muted)' }} title={labels.costPrice}>—</span>
            : <span className="font-semibold" style={{ color: profitColor }}>{fmt(profit)} so&apos;m</span>}
        </td>)}
        {col('margin', <td className="px-4 py-3.5 text-right">
          {margin == null
            ? <span style={{ color: 'var(--text-muted)' }} title={labels.costPrice}>—</span>
            : <span className="font-semibold" style={{ color: marginColor }}>{margin.toFixed(1)}%</span>}
        </td>)}
        {col('abc', <td className="px-4 py-3.5 text-center">
          {abcCls ? <AbcBadge cls={abcCls} /> : null}
        </td>)}
      </tr>
    )
  }

  /**
   * Parent row for a variant group.
   *
   * Sales aggregate and are shown: units and revenue add up across colours, and
   * a collapsed product is exactly where the seller wants the total.
   *
   * Per-unit fields stay BLANK — price, cost, profit and margin differ per
   * colour and do not average meaningfully, and stock would double-count an
   * FBS pool shared across listings. Same rule the Products and Stocks tables
   * follow; the real values live on the child rows.
   */
  /** The parent row is itself the expand/collapse toggle, so a click that lands
   *  on an editable cell has to stop there — otherwise opening the editor
   *  collapses the group out from under it. */
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const renderParent = (
    item: { key: string; representative: { row: Product }; children: Array<{ row: Product }> },
    isExpanded: boolean,
    abcCls: AbcClass,
  ) => {
    const rows = item.children.map(c => c.row)
    const ids = rows.map(p => p.id)
    const shared = groupSharedValues(rows)
    // Computable only when BOTH inputs are one number for the whole group.
    // A mixed cost has no single profit, and inventing one from the first
    // variant would be exactly the lie groupSharedValues() exists to avoid.
    const groupProfit = shared.price != null && shared.cost != null ? shared.price - shared.cost : null
    const groupMarginPct = groupProfit != null && shared.price != null && shared.price > 0
      ? (groupProfit / shared.price) * 100
      : null
    const groupUnknownLabel = shared.costMixed || shared.priceMixed ? labels.mixedValues : '—'
    const total: Sales = rows.reduce((acc, p) => {
      const s = salesFor(p.id)
      return {
        qty_sold:       acc.qty_sold       + s.qty_sold,
        qty_in_transit: acc.qty_in_transit + s.qty_in_transit,
        qty_cancelled:  acc.qty_cancelled  + s.qty_cancelled,
        qty_returned:   acc.qty_returned   + s.qty_returned,
        revenue:        acc.revenue        + s.revenue,
      }
    }, NO_SALES)
    return (
      <tr key={item.key} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card2)' }}
        onClick={() => toggle(item.key)}>
        {col('product', <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            {item.representative.row.image_url ? (
              <img src={item.representative.row.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" style={{ background: 'var(--bg-input)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-9 h-9 rounded shrink-0 flex items-center justify-center text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>—</div>
            )}
            <p className="font-semibold line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={item.representative.row.title}>{item.representative.row.title}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {variantCountLabel(item.children.length, lang)}
            </span>
          </div>
        </td>)}
        {salesCells(total)}
        {/* Price and cost are editable here, and the edit lands on every
            listing in the group. They are properties of the product, not of
            the colour, so typing one cost into four variant rows was busywork. */}
        {col('price', <td className="px-4 py-3.5 text-right" onClick={stop}>
          <EditableValueCell productId={ids} field="priceOverride"
            value={shared.price} overridden={shared.priceOverridden} mixed={shared.priceMixed}
            mixedLabel={labels.mixedValues} emptyLabel={labels.setPrice}
            title={`${labels.editPriceHint} · ${labels.appliesToAll}`} />
        </td>)}
        {col('cost', <td className="px-4 py-3.5 text-right" onClick={stop}>
          <EditableValueCell productId={ids} field="costPrice"
            value={shared.cost} mixed={shared.costMixed}
            mixedLabel={labels.mixedValues} emptyLabel={labels.setCost}
            title={`${labels.editCostHint} · ${labels.appliesToAll}`} />
        </td>)}
        {/* Profit and margin follow from the two cells to the left. Leaving
            them blank was a leftover from when the parent showed no price or
            cost either: a seller typed a cost into this very row and the two
            numbers they typed it FOR stayed empty, which reads as "the edit
            did nothing". They are shown whenever both inputs are known, and
            «mixed» when the group disagrees — because there is no single
            margin for a group whose variants cost different amounts. */}
        {col('profit', <td className="px-4 py-3.5 text-right">
          {groupProfit != null
            ? <span className="font-semibold" style={{ color: groupProfit > 0 ? '#10b981' : '#ef4444' }}>{fmt(groupProfit)} so&apos;m</span>
            : <span style={{ color: 'var(--text-muted)' }}>{groupUnknownLabel}</span>}
        </td>)}
        {col('margin', <td className="px-4 py-3.5 text-right">
          {groupMarginPct != null
            ? <span className="font-semibold" style={{ color: groupMarginPct >= 35 ? '#10b981' : groupMarginPct >= 15 ? '#f59e0b' : '#ef4444' }}>{groupMarginPct.toFixed(1)}%</span>
            : <span style={{ color: 'var(--text-muted)' }}>{groupUnknownLabel}</span>}
        </td>)}
        {col('abc', <td className="px-4 py-3.5 text-center"><AbcBadge cls={abcCls} /></td>)}
      </tr>
    )
  }

  /** A sale whose order item never matched a listing. Real revenue, no
   *  catalogue row to hang margin off — so those cells are dashes, not zeros:
   *  we do not know the margin, which is different from it being nil. */
  const renderOrphan = (r: ProductSalesRow) => (
    <tr key={`orphan:${r.title}:${r.sku ?? ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
      {col('product', (
        <td className="px-5 py-3.5">
          <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={r.title}>{r.title}</p>
          {r.sku && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.sku}</span>}
        </td>
      ))}
      {salesCells({
        qty_sold: r.qty_sold, qty_in_transit: r.qty_in_transit,
        qty_cancelled: r.qty_cancelled, qty_returned: r.qty_returned, revenue: r.revenue,
      })}
      {/* Explicit keys rather than a count: the money columns can each be
          switched off independently, so a fixed length would desynchronise
          from the header the moment one was hidden. */}
      {(['price', 'cost', 'profit', 'margin', 'abc'] as const).map(k =>
        col(k, <td key={k} className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>—</td>),
      )}
    </tr>
  )

  const exportData: Record<string, string | number>[] = []
  for (const item of sortedGroups) {
    const members = item.type === 'parent' ? item.children.map(c => c.row) : [item.row.row]
    const gk = item.type === 'parent' ? `p:${item.key}` : `f:${item.row.row.id}`
    const itemAbc = abc.get(gk) ?? 'C'
    for (const p of members) {
      const s = salesByProduct.get(p.id) ?? NO_SALES
      const m = deriveMetrics({ delivered: s.qty_sold, returned: s.qty_returned, revenue: s.revenue }, periodRevenue)
      const price = Number(p.selling_price ?? 0)
      const margin = p.profit != null && price > 0 ? (p.profit / price * 100).toFixed(1) : ''
      exportData.push({
        [labels.product]: p.title,
        'SKU': p.sku ?? '',
        [labels.qty]: s.qty_sold,
        [labels.cancelled]: s.qty_cancelled,
        [labels.returned ?? 'Returned']: s.qty_returned,
        [labels.returnRate ?? 'Return %']: m.returnRate != null ? `${m.returnRate.toFixed(1)}%` : '',
        [labels.revenue]: s.revenue,
        [`${labels.revenue} %`]: `${m.salesShare.toFixed(1)}%`,
        [labels.price]: price || '',
        [labels.costPrice]: p.cost_price ?? '',
        [labels.profit]: p.profit ?? '',
        [`${labels.margin} (%)`]: margin,
        [labels.abc]: itemAbc,
      })
    }
  }

  if (products.length === 0 && orphanSales.length === 0) {
    return <p className="px-5 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>{labels.noSales}</p>
  }

  return (
    <>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={labels.searchPlaceholder}
          categories={categories}
          selectedCategory={category}
          onCategoryChange={setCategory}
          allCategoryLabel={labels.allCategories}
          lang={lang}
          actions={<>
            <ExportButton data={exportData} filename="analitika" />
            <AnalyticsTableSettings hidden={hidden} onChange={changeHidden} labels={labels.settings} />
          </>}
          resultCount={filteredProducts.length}
          countLabel={labels.productCount}
        />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            {col('product', <th className="text-left font-medium px-5 py-3">{labels.product}</th>)}
            {col('delivered', <th className="text-right font-medium px-4 py-3">{labels.qty}</th>)}
            {col('inTransit', <th className="text-right font-medium px-4 py-3">{labels.inTransit}</th>)}
            {col('cancelled', <th className="text-right font-medium px-4 py-3">{labels.cancelled}</th>)}
            {col('returned', <th className="text-right font-medium px-4 py-3">{labels.returned}</th>)}
            {col('returnRate', <th className="text-right font-medium px-4 py-3">{labels.returnRate}</th>)}
            {col('revenue', <th className="text-right font-medium px-4 py-3">{labels.revenue}</th>)}
            {col('salesShare', <th className="text-right font-medium px-4 py-3">{labels.salesShare}</th>)}
            {col('avgPrice', <th className="text-right font-medium px-4 py-3">{labels.avgPrice}</th>)}
            {col('price', <th className="text-right font-medium px-4 py-3">{labels.price}</th>)}
            {col('cost', <th className="text-right font-medium px-4 py-3">{labels.costPrice}</th>)}
            {col('profit', <th className="text-right font-medium px-4 py-3">{labels.profit}</th>)}
            {col('margin', <th className="text-right font-medium px-4 py-3">{labels.margin}</th>)}
            {col('abc', <th className="text-center font-medium px-4 py-3">{labels.abc}</th>)}
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map(item => (
            <Fragment key={item.type === 'parent' ? `p:${item.key}` : `f:${item.row.row.id}`}>
              {item.type === 'flat'
                ? renderRow(item.row.row, false, abcFor(item))
                : (
                  <>
                    {renderParent(item, expanded.has(item.key), abcFor(item))}
                    {expanded.has(item.key) && item.children.map(c => renderRow(c.row, true))}
                  </>
                )
              }
            </Fragment>
          ))}
          {filteredOrphans.map(renderOrphan)}
        </tbody>
      </table>
      </div>
    </>
  )
}
