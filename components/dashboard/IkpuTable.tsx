'use client'

import { useState, useMemo } from 'react'
import { Search, FileText, Check } from 'lucide-react'
import MpBadge from './MpBadge'
import IkpuLookupDialog from './IkpuLookupDialog'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { normalizeText } from '@/lib/shared/text-similarity'
import type { Product, MarketplaceType } from '@/lib/types'
import { useRouter } from 'next/navigation'

type Filter = 'all' | 'with' | 'without'

interface Props {
  products: Product[]
}

export default function IkpuTable({ products: initialProducts }: Props) {
  const { lang } = useLang()
  const t = translations[lang]?.dashboard ?? translations.uz.dashboard
  const p = t.ikpuPage
  const router = useRouter()

  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null)

  const assignedCount = useMemo(() => products.filter(pr => !!pr.ikpu_code).length, [products])
  const unassignedCount = products.length - assignedCount

  const filtered = useMemo(() => {
    let list = products
    if (filter === 'with') list = list.filter(pr => !!pr.ikpu_code)
    if (filter === 'without') list = list.filter(pr => !pr.ikpu_code)
    if (search.trim()) {
      const q = normalizeText(search.trim())
      list = list.filter(pr =>
        normalizeText(pr.title).includes(q) ||
        (pr.sku && normalizeText(pr.sku).includes(q)) ||
        (pr.ikpu_code && pr.ikpu_code.includes(q))
      )
    }
    return list
  }, [products, filter, search])

  function handleAssigned(productId: string, code: string | null) {
    setProducts(prev => prev.map(pr =>
      pr.id === productId ? { ...pr, ikpu_code: code } : pr
    ))
    router.refresh()
  }

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: p.allProducts, count: products.length },
    { key: 'with', label: p.withCode, count: assignedCount },
    { key: 'without', label: p.withoutCode, count: unassignedCount },
  ]

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label={p.allProducts}
          value={products.length}
          icon={<FileText className="w-5 h-5" style={{ color: 'var(--c1)' }} />}
        />
        <StatCard
          label={p.assigned}
          value={assignedCount}
          icon={<Check className="w-5 h-5" style={{ color: '#22c55e' }} />}
          accent="#22c55e"
        />
        <StatCard
          label={p.notAssigned}
          value={unassignedCount}
          icon={<FileText className="w-5 h-5" style={{ color: '#f59e0b' }} />}
          accent="#f59e0b"
        />
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={filter === key
                ? { background: 'var(--c1)', color: '#fff' }
                : { color: 'var(--text-muted)' }
              }
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={p.searchProducts}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--text)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {t.productsTitle ?? 'Product'}
                </th>
                <th className="text-left text-xs font-medium px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                  SKU
                </th>
                <th className="text-left text-xs font-medium px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                  {t.nav?.products ? t.nav.products : 'Marketplace'}
                </th>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {p.title}
                </th>
                <th className="text-right text-xs font-medium px-4 py-3" style={{ color: 'var(--text-muted)' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {p.searchProducts}
                  </td>
                </tr>
              ) : (
                filtered.map(pr => (
                  <tr key={pr.id} className="group" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {pr.image_url && (
                          <img
                            src={pr.image_url}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                          />
                        )}
                        <span className="truncate max-w-[200px] sm:max-w-[300px] text-sm font-medium">
                          {pr.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
                        {pr.sku || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {pr.marketplace && <MpBadge mp={pr.marketplace as MarketplaceType} />}
                    </td>
                    <td className="px-4 py-3">
                      {pr.ikpu_code ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          <Check size={12} />
                          {pr.ikpu_code}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {p.notAssigned}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDialogProduct(pr)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                        style={{
                          background: pr.ikpu_code ? 'var(--bg-card)' : 'var(--c1)',
                          color: pr.ikpu_code ? 'var(--text)' : '#fff',
                          border: pr.ikpu_code ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {pr.ikpu_code ? p.changeBtn : p.assignBtn}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IKPU lookup dialog */}
      {dialogProduct && (
        <IkpuLookupDialog
          productId={dialogProduct.id}
          productTitle={dialogProduct.title}
          currentCode={dialogProduct.ikpu_code ?? null}
          onAssigned={handleAssigned}
          onClose={() => setDialogProduct(null)}
        />
      )}
    </>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string
  value: number
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent ? `${accent}15` : 'rgba(131,192,249,0.1)' }}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{value}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
        </div>
      </div>
    </div>
  )
}
