'use client'

import { Fragment, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import FulfillmentBadge from '@/components/dashboard/FulfillmentBadge'
import { groupByVariant } from '@/lib/variant-grouping'
import { COLOR_LABELS, colorMetaFor, type ColorKey } from '@/lib/products/resolveColor'
import { useLang } from '@/app/providers'
import type { Product } from '@/lib/types'
import type { ProductSalesRow } from '@/lib/db/products'

const MP_META: Record<string, { short: string; color: string; bg: string }> = {
  uzum:          { short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
  wildberries:   { short: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.12)' },
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

// Small colour swatch beside a child row's SKU — same treatment as
// Products/Остатки so the eye picks out the variant colour at a glance.
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
  rows: ProductSalesRow[]
  products: Product[]           // to resolve marketplace + fulfillment badges per SKU
  labels: {
    product: string
    qty: string
    inTransit: string
    cancelled: string
    revenue: string
    noSales: string
  }
}

export default function AnalyticsTopSoldTable({ rows, products, labels }: Props) {
  const { lang } = useLang()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setExpanded(prev => {
    const n = new Set(prev)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

  // Preserve the "top 20" behaviour of the original render but let a
  // variant parent count as one visible entry — otherwise a product with
  // many colours could exhaust the slice on itself. Group first, then
  // slice.
  const grouped = groupByVariant(rows.map(r => ({
    id: r.product_id ?? `no-pid:${r.title}`,
    sku: r.sku,
    variant_group_key: r.variant_group_key,
    row: r,
  })))
  const displayed = grouped.slice(0, 20)

  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>{labels.noSales}</p>
  }

  // Match the badge lookup the server did — same SKU/product_id lookup
  // pattern, moved client-side unchanged.
  const badgesFor = (row: ProductSalesRow) => {
    const matching = products.filter(p => p.sku === row.sku || p.id === row.product_id)
    const mps = [...new Set(matching.map(p => p.marketplace).filter(Boolean))]
    const fts = [...new Set(matching.map(p => p.fulfillment_type).filter(Boolean))]
    return (
      <>
        {mps.map(mp => {
          const m = MP_META[mp!]
          return m ? <span key={mp} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.short}</span> : null
        })}
        {fts.map(ft => <FulfillmentBadge key={ft} type={ft} />)}
      </>
    )
  }

  const renderRow = (row: ProductSalesRow, isChild = false) => (
    <tr key={row.product_id ?? `${row.title}:${row.sku}`} style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-5 py-3.5" style={isChild ? { paddingLeft: '2.75rem', borderLeft: '2px solid var(--border)' } : undefined}>
        <p className="font-medium line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--text-base)' }} title={row.title}>{row.title}</p>
        {row.sku && (
          <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
            {isChild && <VariantColorChip colorKey={row.variant_color} lang={lang} />}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.sku}</span>
            {badgesFor(row)}
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: 'var(--c1)' }}>{row.qty_sold}</td>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: row.qty_in_transit > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.qty_in_transit}</td>
      <td className="px-4 py-3.5 text-right font-semibold" style={{ color: row.qty_cancelled + row.qty_returned > 0 ? '#ef4444' : 'var(--text-muted)' }}>{row.qty_cancelled + row.qty_returned}</td>
      <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(row.revenue)} so&apos;m</td>
    </tr>
  )

  const renderParent = (
    item: { key: string; representative: { row: ProductSalesRow }; children: Array<{ row: ProductSalesRow }> },
    isExpanded: boolean,
  ) => {
    // Additive across colours: units delivered / in-transit / cancelled /
    // returned + revenue all sum. Orphan children never land here (grouping
    // rejects null keys upstream), so revenue never picks up a 'Удалённый
    // товар' contribution silently.
    const sum = (f: (r: ProductSalesRow) => number) => item.children.reduce((s, c) => s + f(c.row), 0)
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
        <td className="px-4 py-3.5 text-right font-semibold" style={{ color: 'var(--c1)' }}>{sum(r => r.qty_sold)}</td>
        <td className="px-4 py-3.5 text-right font-semibold" style={{ color: sum(r => r.qty_in_transit) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{sum(r => r.qty_in_transit)}</td>
        <td className="px-4 py-3.5 text-right font-semibold" style={{ color: sum(r => r.qty_cancelled + r.qty_returned) > 0 ? '#ef4444' : 'var(--text-muted)' }}>{sum(r => r.qty_cancelled + r.qty_returned)}</td>
        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(sum(r => r.revenue))} so&apos;m</td>
      </tr>
    )
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
          </tr>
        </thead>
        <tbody>
          {displayed.map(item => (
            <Fragment key={item.type === 'parent' ? `p:${item.key}` : `f:${item.row.row.product_id ?? item.row.row.title}`}>
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
      </table>
    </div>
  )
}
