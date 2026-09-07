'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, FileText, Check, ChevronDown, ChevronRight, Star } from 'lucide-react'
import MpBadge from './MpBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { normalizeText } from '@/lib/shared/text-similarity'
import type { Product, MarketplaceType } from '@/lib/types'
import type { IkpuResult } from '@/lib/ikpu/client'
import { useRouter } from 'next/navigation'

type Tab = 'search' | 'products'
type Filter = 'all' | 'with' | 'without'

interface Props {
  products: Product[]
}

interface CategoryGroup {
  category: string
  products: Product[]
  ikpuCode: string | null
  suggestion: IkpuResult | null
  loading: boolean
}

export default function IkpuTable({ products: initialProducts }: Props) {
  const { lang } = useLang()
  const t = translations[lang]?.dashboard ?? translations.uz.dashboard
  const p = t.ikpuPage
  const router = useRouter()

  const [products, setProducts] = useState(initialProducts)
  const [activeTab, setActiveTab] = useState<Tab>('search')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<IkpuResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Products tab state
  const [productSearch, setProductSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Record<string, { result: IkpuResult | null; loading: boolean }>>({})
  const [bulkAssigning, setBulkAssigning] = useState<string | null>(null)
  const [assigningProduct, setAssigningProduct] = useState<string | null>(null)

  // Selected IKPU for assigning from search tab
  const [selectedIkpu, setSelectedIkpu] = useState<IkpuResult | null>(null)

  const assignedCount = useMemo(() => products.filter(pr => !!pr.ikpu_code).length, [products])
  const unassignedCount = products.length - assignedCount

  // ─── Search logic (tasnif.soliq.uz style) ──────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); setSearchTotal(0); setHasSearched(false); return }
    setSearching(true)
    setHasSearched(true)
    try {
      const isBarcode = /^\d{8,14}$/.test(q.trim())
      const param = isBarcode ? `barcode=${encodeURIComponent(q.trim())}` : `q=${encodeURIComponent(q.trim())}`
      const res = await fetch(`/api/ikpu/search?${param}&lang=${lang === 'en' ? 'ru' : lang}`)
      if (!res.ok) return
      const data = await res.json()
      setSearchResults(data.results ?? [])
      setSearchTotal(data.total ?? 0)
    } finally {
      setSearching(false)
    }
  }, [lang])

  function handleSearchInput(val: string) {
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  // ─── Category grouping ─────────────────────────────────────────
  const categoryGroups = useMemo(() => {
    let list = products
    if (filter === 'with') list = list.filter(pr => !!pr.ikpu_code)
    if (filter === 'without') list = list.filter(pr => !pr.ikpu_code)
    if (productSearch.trim()) {
      const q = normalizeText(productSearch.trim())
      list = list.filter(pr =>
        normalizeText(pr.title).includes(q) ||
        (pr.sku && normalizeText(pr.sku).includes(q)) ||
        (pr.ikpu_code && pr.ikpu_code.includes(q)) ||
        (pr.category && normalizeText(pr.category).includes(q))
      )
    }

    const grouped = new Map<string, Product[]>()
    for (const pr of list) {
      const cat = pr.category || p.noCategory
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(pr)
    }

    const result: CategoryGroup[] = []
    for (const [category, prods] of grouped) {
      const existingCode = prods.find(pr => pr.ikpu_code)?.ikpu_code ?? null
      const sugg = suggestions[category]
      result.push({
        category,
        products: prods,
        ikpuCode: existingCode,
        suggestion: sugg?.result ?? null,
        loading: sugg?.loading ?? false,
      })
    }
    result.sort((a, b) => {
      if (a.category === p.noCategory) return 1
      if (b.category === p.noCategory) return -1
      return a.category.localeCompare(b.category)
    })
    return result
  }, [products, filter, productSearch, suggestions, p.noCategory])

  // Auto-suggest: search tasnif for each category that has no IKPU code
  useEffect(() => {
    const cats = categoryGroups
      .filter(g => !g.ikpuCode && g.category !== p.noCategory && !suggestions[g.category])
    if (cats.length === 0) return

    for (const g of cats) {
      setSuggestions(prev => ({ ...prev, [g.category]: { result: null, loading: true } }))
      fetch(`/api/ikpu/search?q=${encodeURIComponent(g.category)}&lang=${lang === 'en' ? 'ru' : lang}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const first = data?.results?.[0] ?? null
          setSuggestions(prev => ({ ...prev, [g.category]: { result: first, loading: false } }))
        })
        .catch(() => {
          setSuggestions(prev => ({ ...prev, [g.category]: { result: null, loading: false } }))
        })
    }
  }, [categoryGroups, suggestions, lang, p.noCategory])

  // ─── Assign actions ────────────────────────────────────────────
  async function assignSingle(productId: string, code: string) {
    setAssigningProduct(productId)
    try {
      const res = await fetch('/api/ikpu/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ikpuCode: code }),
      })
      if (res.ok) {
        setProducts(prev => prev.map(pr =>
          pr.id === productId ? { ...pr, ikpu_code: code } : pr
        ))
      }
    } finally {
      setAssigningProduct(null)
    }
  }

  async function bulkAssign(productIds: string[], code: string, category: string) {
    setBulkAssigning(category)
    try {
      const res = await fetch('/api/ikpu/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, ikpuCode: code }),
      })
      if (res.ok) {
        setProducts(prev => prev.map(pr =>
          productIds.includes(pr.id) ? { ...pr, ikpu_code: code } : pr
        ))
      }
    } finally {
      setBulkAssigning(null)
      router.refresh()
    }
  }

  function toggleGroup(cat: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // When user picks an IKPU from search tab and wants to assign to products
  function selectIkpuFromSearch(result: IkpuResult) {
    setSelectedIkpu(result)
    setActiveTab('products')
    setFilter('without')
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
        <StatCard label={p.allProducts} value={products.length}
          icon={<FileText className="w-5 h-5" style={{ color: 'var(--c1)' }} />} />
        <StatCard label={p.assigned} value={assignedCount}
          icon={<Check className="w-5 h-5" style={{ color: '#22c55e' }} />} accent="#22c55e" />
        <StatCard label={p.notAssigned} value={unassignedCount}
          icon={<FileText className="w-5 h-5" style={{ color: '#f59e0b' }} />} accent="#f59e0b" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('search')}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
          style={activeTab === 'search'
            ? { background: 'var(--c1)', color: '#fff' }
            : { color: 'var(--text-muted)' }
          }>
          <Search size={14} /> {p.tabSearch}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
          style={activeTab === 'products'
            ? { background: 'var(--c1)', color: '#fff' }
            : { color: 'var(--text-muted)' }
          }>
          <FileText size={14} /> {p.tabProducts}
          {selectedIkpu && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
              {selectedIkpu.mxikCode.slice(0, 8)}...
            </span>
          )}
        </button>
      </div>

      {/* ═══ Search Tab (tasnif.soliq.uz style) ═══ */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          {/* Big search bar */}
          <div className="rounded-xl p-1" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder={p.searchPlaceholder}
                autoFocus
                className="w-full px-5 py-4 text-base rounded-xl outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <Search size={20} className="absolute right-5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
            {searching && (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.searching}
              </div>
            )}

            {!searching && hasSearched && searchResults.length === 0 && (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.noResults}
              </div>
            )}

            {!searching && hasSearched && searchResults.length > 0 && (
              <>
                {/* Match count */}
                <div className="px-6 py-3 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {p.matchesFound} — {searchTotal.toLocaleString()}
                  </span>
                </div>

                {/* Result cards — tree hierarchy */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {searchResults.map((r) => (
                    <div key={r.mxikCode} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Code + name */}
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                          <span className="font-mono">{r.mxikCode}</span>
                          {' — '}
                          <span className="uppercase">{r.name}</span>
                        </p>
                        {/* Hierarchy tree */}
                        <div className="space-y-0.5 pl-2" style={{ color: 'var(--text-dim)' }}>
                          <TreeRow label={p.group} value={r.groupName} color="#16a34a" />
                          <TreeRow label={p.classLabel} value={r.className} color="#16a34a" indent={1} />
                          <TreeRow label={p.position} value={r.positionName} color="#16a34a" indent={2} />
                          <TreeRow label={p.subPosition} value={r.subPositionName} color="#16a34a" indent={3} />
                        </div>
                      </div>
                      {/* Star / Assign button */}
                      <button
                        onClick={() => selectIkpuFromSearch(r)}
                        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110"
                        style={{ color: '#16a34a' }}
                        title={p.assignBtn}
                      >
                        <Star size={24} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!searching && !hasSearched && (
              <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.searchPlaceholder}...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Products Tab (category-grouped with auto-suggest) ═══ */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Selected IKPU banner */}
          {selectedIkpu && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Check size={16} style={{ color: '#22c55e' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {selectedIkpu.mxikCode} — {selectedIkpu.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const unassigned = products.filter(pr => !pr.ikpu_code).map(pr => pr.id)
                    if (unassigned.length > 0) bulkAssign(unassigned, selectedIkpu.mxikCode, '__all__')
                  }}
                  disabled={bulkAssigning !== null}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: '#22c55e', color: '#fff', opacity: bulkAssigning ? 0.6 : 1 }}>
                  {p.applyToAll}
                </button>
                <button onClick={() => setSelectedIkpu(null)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Filters + product search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {filterTabs.map(({ key, label, count }) => (
                <button key={key} onClick={() => setFilter(key)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={filter === key
                    ? { background: 'var(--c1)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                  }>
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder={p.searchProducts}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          {/* Category groups */}
          <div className="space-y-3">
            {categoryGroups.map(group => {
              const isExpanded = expandedGroups.has(group.category)
              const unassignedInGroup = group.products.filter(pr => !pr.ikpu_code)
              const resolvedCode = selectedIkpu?.mxikCode ?? group.ikpuCode ?? group.suggestion?.mxikCode
              const canBulkAssign = resolvedCode && unassignedInGroup.length > 0

              return (
                <div key={group.category} className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleGroup(group.category)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left"
                    style={{ borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                    {isExpanded
                      ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    }
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {group.category}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        {group.products.length} {p.productsInCategory}
                      </span>
                    </div>

                    {/* IKPU status / suggestion */}
                    <div className="flex items-center gap-2 shrink-0">
                      {group.ikpuCode ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          <Check size={12} /> {group.ikpuCode}
                        </span>
                      ) : group.loading ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>...</span>
                      ) : group.suggestion ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          {p.suggestedCode}: {group.suggestion.mxikCode}
                        </span>
                      ) : null}

                      {canBulkAssign && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            bulkAssign(unassignedInGroup.map(pr => pr.id), resolvedCode!, group.category)
                          }}
                          disabled={bulkAssigning === group.category}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg"
                          style={{
                            background: 'var(--c1)', color: '#fff',
                            opacity: bulkAssigning === group.category ? 0.6 : 1,
                          }}>
                          {bulkAssigning === group.category ? '...' : p.applyToCategory}
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Expanded product list */}
                  {isExpanded && (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {group.products.map(pr => (
                        <div key={pr.id} className="px-4 py-3 flex items-center gap-3">
                          {pr.image_url && (
                            <img src={pr.image_url} alt=""
                              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                              {pr.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {pr.sku && (
                                <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>{pr.sku}</span>
                              )}
                              {pr.marketplace && <MpBadge mp={pr.marketplace as MarketplaceType} />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {pr.ikpu_code ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md"
                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                <Check size={10} /> {pr.ikpu_code}
                              </span>
                            ) : resolvedCode ? (
                              <button
                                onClick={() => assignSingle(pr.id, resolvedCode)}
                                disabled={assigningProduct === pr.id}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                                style={{
                                  background: 'var(--c1)', color: '#fff',
                                  opacity: assigningProduct === pr.id ? 0.6 : 1,
                                }}>
                                {assigningProduct === pr.id ? '...' : p.assignBtn}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setActiveTab('search'); setSearchQuery(pr.category || pr.title) }}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                                style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                                {p.tabSearch}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function TreeRow({ label, value, color, indent = 0 }: {
  label: string; value: string; color: string; indent?: number
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-1 text-xs" style={{ paddingLeft: `${indent * 16}px` }}>
      <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
        {indent > 0 ? '└─' : '├─'}
      </span>
      <span className="font-semibold shrink-0" style={{ color }}>{label}:</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode; accent?: string
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
