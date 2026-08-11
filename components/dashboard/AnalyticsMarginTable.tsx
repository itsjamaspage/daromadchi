'use client'

import { Fragment, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import EditableCostCell from '@/components/dashboard/EditableCostCell'
import FulfillmentBadge from '@/components/dashboard/FulfillmentBadge'
import { groupByVariant } from '@/lib/variant-grouping'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import type { Product } from '@/lib/types'

const MP_META: Record<string, { short: string; color: string; bg: string }> = {
  uzum:          { short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// Localised "N вариантов". Computed in the client component (it has lang) — a
// function prop can't cross the Server→Client boundary, which is what crashed
// the page. Mirrors the StocksTable/ProductsTable helper.
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

interface Props {
  products: Product[]
  totalStockValue: number
  labels: {
    product: string
    price: string
    costPrice: string
    profit: string
    margin: string
    stockQty: string
    stockValue: string
    warehouseValueTotal: string
  }
}

export default function AnalyticsMarginTable({ products, totalStockValue, labels }: Props) {
  const { lang } = useLang()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setExpanded(prev => {
    const n = new Set(prev)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

  const sorted = [...products].sort((a, b) => {
    const ma = Number(a.selling_price ?? 0) > 0 ? a.profit / Number(a.selling_price) : 0
    const mb = Number(b.selling_price ?? 0) > 0 ? b.profit / Number(b.selling_price) : 0
    return mb - ma
  })

  const grouped = groupByVariant(sorted.map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    variant_group_key: p.variant_group_key ?? null,
    row: p,
  })))

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
            {p.marketplace && (() => { const m = MP_META[p.marketplace]; return m ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.short}</span> : null })()}
            <FulfillmentBadge type={p.fulfillment_type} />
          </div>
        </td>
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

  // Parent row for a variant group. Per-unit fields (Цена / Себестоимость /
  // Прибыль / Маржа) are blank on the parent — they don't aggregate
  // meaningfully across colours because price and cost can differ. Stock
  // is blank too because FBS-shared pools would otherwise double-count.
  // Real values stay on the child rows. Same rule Products table uses.
  const renderParent = (
    item: { key: string; representative: { row: Product }; children: Array<{ row: Product }> },
    isExpanded: boolean,
  ) => {
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
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
        <td className="px-4 py-3.5" />
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <th className="text-left font-medium px-5 py-3">{labels.product}</th>
            <th className="text-right font-medium px-4 py-3">{labels.price}</th>
            <th className="text-right font-medium px-4 py-3">{labels.costPrice}</th>
            <th className="text-right font-medium px-4 py-3">{labels.profit}</th>
            <th className="text-right font-medium px-4 py-3">{labels.margin}</th>
            <th className="text-right font-medium px-4 py-3">{labels.stockQty}</th>
            <th className="text-right font-medium px-4 py-3">{labels.stockValue}</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(item => (
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
        </tbody>
        <tfoot>
          <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid var(--border)' }}>
            <td colSpan={6} className="px-5 py-4 font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--text-base)' }}>
              {labels.warehouseValueTotal}
            </td>
            <td className="px-4 py-4 text-right font-bold" style={{ color: 'var(--c1)' }}>{fmt(totalStockValue)} so&apos;m</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
