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

import { Fragment, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import EditableCostCell from '@/components/dashboard/EditableCostCell'
import FulfillmentBadge from '@/components/dashboard/FulfillmentBadge'
import { groupByVariant } from '@/lib/variant-grouping'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import type { Product } from '@/lib/types'
import type { ProductSalesRow } from '@/lib/db/products'

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
interface Sales { qty_sold: number; qty_in_transit: number; qty_cancelled: number; revenue: number }
const NO_SALES: Sales = { qty_sold: 0, qty_in_transit: 0, qty_cancelled: 0, revenue: 0 }

interface Props {
  products: Product[]
  sales: ProductSalesRow[]
  totalStockValue: number
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
    stockQty: string
    stockValue: string
    warehouseValueTotal: string
    noSales: string
  }
}

const COL_COUNT = 11

export default function AnalyticsProductTable({ products, sales, totalStockValue, labels }: Props) {
  const { lang } = useLang()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setExpanded(prev => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  // Sales by listing. A product can appear once per marketplace in the sales
  // query, so accumulate rather than overwrite — otherwise the second row
  // silently replaces the first and half the revenue disappears.
  const salesByProduct = new Map<string, Sales>()
  const orphanSales: ProductSalesRow[] = []
  for (const r of sales) {
    if (!r.product_id) { orphanSales.push(r); continue }
    const prev = salesByProduct.get(r.product_id) ?? NO_SALES
    salesByProduct.set(r.product_id, {
      qty_sold:       prev.qty_sold       + r.qty_sold,
      qty_in_transit: prev.qty_in_transit + r.qty_in_transit,
      // Cancelled and returned are one "didn't stick" column, as before.
      qty_cancelled:  prev.qty_cancelled  + r.qty_cancelled + r.qty_returned,
      revenue:        prev.revenue        + r.revenue,
    })
  }
  const salesFor = (id: string): Sales => salesByProduct.get(id) ?? NO_SALES

  // Revenue first — this is a performance table. Products that sold nothing
  // fall to the bottom and are ordered by margin among themselves, so the
  // tail is still ranked by something useful rather than arbitrary.
  const groupRevenue = (rows: Product[]) => rows.reduce((s, p) => s + salesFor(p.id).revenue, 0)
  const groupMargin = (rows: Product[]) => Math.max(0, ...rows.map(p => {
    const price = Number(p.selling_price ?? 0)
    return price > 0 ? (p.profit / price) : 0
  }))

  const grouped = groupByVariant(products.map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    variant_group_key: p.variant_group_key ?? null,
    row: p,
  })))

  const sortedGroups = [...grouped].sort((a, b) => {
    const rowsA = a.type === 'parent' ? a.children.map(c => c.row) : [a.row.row]
    const rowsB = b.type === 'parent' ? b.children.map(c => c.row) : [b.row.row]
    const revDiff = groupRevenue(rowsB) - groupRevenue(rowsA)
    if (revDiff !== 0) return revDiff
    return groupMargin(rowsB) - groupMargin(rowsA)
  })

  const badges = (p: Product) => (
    <>
      {p.marketplace && (() => {
        const m = MP_META[p.marketplace]
        return m ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.short}</span> : null
      })()}
      <FulfillmentBadge type={p.fulfillment_type} />
    </>
  )

  const salesCells = (s: Sales) => (
    <>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_sold > 0 ? 'var(--c1)' : 'var(--text-muted)' }}>{s.qty_sold}</td>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_in_transit > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{s.qty_in_transit}</td>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: s.qty_cancelled > 0 ? '#ef4444' : 'var(--text-muted)' }}>{s.qty_cancelled}</td>
      <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(s.revenue)} so&apos;m</td>
    </>
  )

  const renderRow = (p: Product, isChild = false) => {
    const price    = Number(p.selling_price ?? 0)
    const cost     = Number(p.cost_price ?? 0)
    const margin   = price > 0 ? (p.profit / price) * 100 : 0
    const stockQty = p.available_stock
    const stockVal = cost * stockQty
    const profitColor = p.profit > 0 ? '#10b981' : '#ef4444'
    const marginColor = margin >= 35 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444'
    return (
      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <td className="px-5 py-3.5" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
          <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={p.title}>{p.title}</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
            {isChild && <VariantColorChip colorKey={p.variant_color} lang={lang} />}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
            {badges(p)}
          </div>
        </td>
        {salesCells(salesFor(p.id))}
        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)} so&apos;m</td>
        <td className="px-4 py-3.5 text-right">
          <EditableCostCell productId={p.id} initialCost={cost > 0 ? cost : null} />
        </td>
        <td className="px-4 py-3.5 text-right">
          <span className="font-semibold" style={{ color: profitColor }}>{fmt(p.profit)} so&apos;m</span>
        </td>
        <td className="px-4 py-3.5 text-right">
          <span className="font-semibold" style={{ color: marginColor }}>{margin.toFixed(1)}%</span>
        </td>
        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{stockQty}</td>
        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>
          {stockVal > 0 ? `${fmt(stockVal)} so'm` : '—'}
        </td>
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
  const renderParent = (
    item: { key: string; representative: { row: Product }; children: Array<{ row: Product }> },
    isExpanded: boolean,
  ) => {
    const rows = item.children.map(c => c.row)
    const total: Sales = rows.reduce((acc, p) => {
      const s = salesFor(p.id)
      return {
        qty_sold:       acc.qty_sold       + s.qty_sold,
        qty_in_transit: acc.qty_in_transit + s.qty_in_transit,
        qty_cancelled:  acc.qty_cancelled  + s.qty_cancelled,
        revenue:        acc.revenue        + s.revenue,
      }
    }, NO_SALES)
    return (
      <tr key={item.key} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card2)' }}
        onClick={() => toggle(item.key)}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <p className="font-semibold line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={item.representative.row.title}>{item.representative.row.title}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {variantCountLabel(item.children.length, lang)}
            </span>
          </div>
        </td>
        {salesCells(total)}
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
      </tr>
    )
  }

  /** A sale whose order item never matched a listing. Real revenue, no
   *  catalogue row to hang margin off — so those cells are dashes, not zeros:
   *  we do not know the margin, which is different from it being nil. */
  const renderOrphan = (r: ProductSalesRow) => (
    <tr key={`orphan:${r.title}:${r.sku ?? ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-5 py-3.5">
        <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={r.title}>{r.title}</p>
        {r.sku && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.sku}</span>}
      </td>
      {salesCells({
        qty_sold: r.qty_sold, qty_in_transit: r.qty_in_transit,
        qty_cancelled: r.qty_cancelled + r.qty_returned, revenue: r.revenue,
      })}
      {Array.from({ length: 6 }, (_, i) => (
        <td key={i} className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>—</td>
      ))}
    </tr>
  )

  if (products.length === 0 && orphanSales.length === 0) {
    return <p className="px-5 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>{labels.noSales}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            <th className="text-left font-medium px-5 py-3">{labels.product}</th>
            <th className="text-right font-medium px-4 py-3">{labels.qty}</th>
            <th className="text-right font-medium px-4 py-3">{labels.inTransit}</th>
            <th className="text-right font-medium px-4 py-3">{labels.cancelled}</th>
            <th className="text-right font-medium px-4 py-3">{labels.revenue}</th>
            <th className="text-right font-medium px-4 py-3">{labels.price}</th>
            <th className="text-right font-medium px-4 py-3">{labels.costPrice}</th>
            <th className="text-right font-medium px-4 py-3">{labels.profit}</th>
            <th className="text-right font-medium px-4 py-3">{labels.margin}</th>
            <th className="text-right font-medium px-4 py-3">{labels.stockQty}</th>
            <th className="text-right font-medium px-4 py-3">{labels.stockValue}</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map(item => (
            <Fragment key={item.type === 'parent' ? `p:${item.key}` : `f:${item.row.row.id}`}>
              {item.type === 'flat'
                ? renderRow(item.row.row)
                : (
                  <>
                    {renderParent(item, expanded.has(item.key))}
                    {expanded.has(item.key) && item.children.map(c => renderRow(c.row, true))}
                  </>
                )
              }
            </Fragment>
          ))}
          {orphanSales.map(renderOrphan)}
        </tbody>
        <tfoot>
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid var(--border)' }}>
            <td colSpan={COL_COUNT - 1} className="px-5 py-4 font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--text-base)' }}>
              {labels.warehouseValueTotal}
            </td>
            <td className="px-4 py-4 text-right font-bold" style={{ color: 'var(--c1)' }}>{fmt(totalStockValue)} so&apos;m</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
