'use client'

import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import EditableCostCell from '@/components/dashboard/EditableCostCell'

// The P&L "Себестоимость" card. COGS = Σ(qty × cost_price), so the total
// itself isn't directly editable (you can't back-solve one sum into many
// products). Instead the card opens a per-product editor: each product sold
// in the period gets an inline cost-price cell (the same EditableCostCell +
// /api/products/update the Products page uses). Saving a cost writes it back
// to that product and router.refresh() re-runs the P&L server component, so
// COGS and net profit update here and everywhere that product's cost feeds.
interface CogsProduct {
  productId: string
  title: string | null
  sku: string | null
  qty: number
  costPrice: number | null
}

interface Labels {
  title: string
  hint: string
  product: string
  qty: string
  cost: string
  empty: string
  done: string
}

export default function CogsCardEditor({
  total,
  products,
  labels,
}: {
  total: string
  products: CogsProduct[]
  labels: Labels
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 group"
        title={labels.hint}
      >
        <span className="text-xl font-bold text-[var(--text-base)]">{total}</span>
        <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--c1)] transition-colors" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-[var(--text-base)] font-bold">{labels.title}</h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{labels.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-base)] flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              {products.length === 0 ? (
                <p className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">{labels.empty}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                      <th className="text-left font-medium px-5 py-2">{labels.product}</th>
                      <th className="text-right font-medium px-3 py-2">{labels.qty}</th>
                      <th className="text-right font-medium px-5 py-2">{labels.cost}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.productId} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-5 py-2.5">
                          <div className="text-[var(--text-base)] font-medium leading-tight">{p.title ?? p.sku ?? p.productId}</div>
                          {p.sku && <div className="text-[var(--text-muted)] text-xs font-mono">{p.sku}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[var(--text-base)] tabular-nums">×{p.qty}</td>
                        <td className="px-5 py-2.5 text-right">
                          <EditableCostCell productId={p.productId} initialCost={p.costPrice} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[var(--border)] text-right">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-primary text-sm font-semibold px-4 py-2 rounded-lg"
              >
                {labels.done}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
