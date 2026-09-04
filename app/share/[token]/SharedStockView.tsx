'use client'

import { useState } from 'react'
import { Package, Search } from 'lucide-react'
import type { SharedProduct } from '@/lib/db/share'

const MP_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  uzum:          { label: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.15)' },
  yandex_market: { label: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.15)' },
}

const FT_LABEL: Record<string, string> = {
  fbs: 'FBS',
  fbo: 'FBO',
  fby: 'FBY',
}

function StockBadge({ qty }: { qty: number }) {
  const color = qty === 0
    ? 'var(--share-stock-zero, #ef4444)'
    : qty <= 5
    ? 'var(--share-stock-low, #f59e0b)'
    : 'var(--share-stock-ok, #22c55e)'
  const bg = qty === 0
    ? 'var(--share-stock-zero-bg, rgba(239,68,68,0.1))'
    : qty <= 5
    ? 'var(--share-stock-low-bg, rgba(245,158,11,0.1))'
    : 'var(--share-stock-ok-bg, rgba(34,197,94,0.1))'
  return (
    <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md"
      style={{ color, background: bg }}>
      {qty}
    </span>
  )
}

export default function SharedStockView({ products }: { products: SharedProduct[] }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? products.filter(p => {
        const q = search.toLowerCase()
        return p.title.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
      })
    : products

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--share-bg, #0f0f1a)',
      color: 'var(--share-text, #e2e8f0)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        :root {
          --share-bg: #0f0f1a;
          --share-card: #1a1a2e;
          --share-border: #2a2a3e;
          --share-text: #e2e8f0;
          --share-text-muted: #94a3b8;
          --share-input-bg: #141425;
          --share-stock-ok: #34d399;
          --share-stock-ok-bg: rgba(52,211,153,0.12);
          --share-stock-low: #f59e0b;
          --share-stock-low-bg: rgba(245,158,11,0.12);
          --share-stock-zero: #f87171;
          --share-stock-zero-bg: rgba(248,113,113,0.12);
        }
        @media (prefers-color-scheme: light) {
          :root:not([data-theme="dark"]) {
            --share-bg: #f8fafc;
            --share-card: #ffffff;
            --share-border: #e2e8f0;
            --share-text: #1e293b;
            --share-text-muted: #64748b;
            --share-input-bg: #f1f5f9;
            --share-stock-ok: #15803d;
            --share-stock-ok-bg: rgba(21,128,61,0.08);
            --share-stock-low: #b45309;
            --share-stock-low-bg: rgba(180,83,9,0.08);
            --share-stock-zero: #b91c1c;
            --share-stock-zero-bg: rgba(185,28,28,0.08);
          }
        }
        :root[data-theme="light"] {
          --share-bg: #f8fafc;
          --share-card: #ffffff;
          --share-border: #e2e8f0;
          --share-text: #1e293b;
          --share-text-muted: #64748b;
          --share-input-bg: #f1f5f9;
          --share-stock-ok: #15803d;
          --share-stock-ok-bg: rgba(21,128,61,0.08);
          --share-stock-low: #b45309;
          --share-stock-low-bg: rgba(180,83,9,0.08);
          --share-stock-zero: #b91c1c;
          --share-stock-zero-bg: rgba(185,28,28,0.08);
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6" style={{ color: 'var(--share-text-muted)' }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--share-text)' }}>
              Warehouse Stock
            </h1>
            <p className="text-xs" style={{ color: 'var(--share-text-muted)' }}>
              {products.length} products
            </p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--share-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{
              background: 'var(--share-input-bg)',
              border: '1px solid var(--share-border)',
              color: 'var(--share-text)',
            }}
          />
        </div>

        <div className="rounded-2xl overflow-hidden" style={{
          background: 'var(--share-card)',
          border: '1px solid var(--share-border)',
        }}>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--share-text-muted)' }}>
              No products found
            </div>
          ) : (
            filtered.map((p, i) => {
              const mp = MP_BADGE[p.marketplace]
              const ft = p.fulfillment_type ? FT_LABEL[p.fulfillment_type] ?? p.fulfillment_type.toUpperCase() : null
              return (
                <div key={i}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--share-border)' : 'none' }}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-10 h-14 rounded-lg object-cover shrink-0"
                      style={{ background: 'var(--share-input-bg)' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-10 h-14 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ background: 'var(--share-input-bg)' }}>
                      <Package className="w-4 h-4" style={{ color: 'var(--share-text-muted)' }} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--share-text)' }}>
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.sku && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--share-text-muted)' }}>
                          {p.sku}
                        </span>
                      )}
                      {mp && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: mp.bg, color: mp.color }}>
                          {mp.label}
                        </span>
                      )}
                      {ft && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--share-input-bg)', color: 'var(--share-text-muted)' }}>
                          {ft}
                        </span>
                      )}
                    </div>
                  </div>

                  <StockBadge qty={p.stock_quantity} />
                </div>
              )
            })
          )}
        </div>

        <p className="text-center text-[10px] mt-6" style={{ color: 'var(--share-text-muted)' }}>
          Daromadchi
        </p>
      </div>
    </div>
  )
}
