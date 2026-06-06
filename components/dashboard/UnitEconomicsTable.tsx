'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Search, Trash2, Settings2, ExternalLink, ChevronUp, ChevronDown,
  Package, Plus, X, Check,
} from 'lucide-react'
import type { UnitEconomicsItem, UnitEcoSettings } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

function fs(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}
function fsPct(n: number) {
  return n.toFixed(1) + '%'
}

function roiColor(roi: number) {
  return roi >= 80 ? 'text-emerald-400' : roi >= 30 ? 'text-amber-400' : 'text-red-400'
}
function roiBg(roi: number) {
  return roi >= 80 ? 'bg-emerald-500/10 text-emerald-400' : roi >= 30 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
}
function marginColor(m: number) {
  return m >= 20 ? 'text-emerald-400' : m >= 10 ? 'text-amber-400' : 'text-red-400'
}
function stockColor(s: number | undefined) {
  if (s === undefined) return 'text-[var(--text-muted)]'
  return s >= 30 ? 'text-emerald-400' : s >= 10 ? 'text-amber-400' : 'text-red-400'
}

const ALL_COLUMNS = [
  { key: 'title',       label: 'Mahsulot',      always: true  },
  { key: 'sku',         label: 'SKU',            always: false },
  { key: 'sellingPrice',label: 'Narx',           always: false },
  { key: 'costPrice',   label: 'Tannarx',        always: false },
  { key: 'commission',  label: 'Komissiya',      always: false },
  { key: 'delivery',    label: 'Yetkazish',      always: false },
  { key: 'lastMile',    label: 'Oxirgi milya',   always: false },
  { key: 'acquiring',   label: 'Ekvayring',      always: false },
  { key: 'adSpend',     label: 'Reklama',        always: false },
  { key: 'tax',         label: 'Soliq',          always: false },
  { key: 'netProfit',   label: 'Foyda',          always: true  },
  { key: 'roi',         label: 'ROI',            always: true  },
  { key: 'margin',      label: 'Marja',          always: false },
  { key: 'stock',       label: 'Zaxira',         always: false },
  { key: 'supplierUrl', label: 'Ta\'minotchi',   always: false },
] as const

type ColKey = typeof ALL_COLUMNS[number]['key']
const DEFAULT_VISIBLE: ColKey[] = ['title','sellingPrice','costPrice','commission','delivery','adSpend','netProfit','roi','margin','stock','supplierUrl']

const DEFAULT_SETTINGS: UnitEcoSettings = {
  acquiringPct: 1.5,
  lastMilePct: 0,
  adPct: 5,
  taxPct: 6,
  taxType: 'income',
  defaultCommissionPct: 10,
}

interface FromExtension {
  source: string; title: string; price: number; commPct: number
  commission: number; delivery: number; acquiring: number; adSpend: number
  tax: number; packaging: number; profit: number; margin: number; roi: number
  url: string; productId: string
}

interface Props {
  items: UnitEconomicsItem[]
  defaultSettings?: UnitEcoSettings
  fromExtension?: FromExtension | null
}

export default function UnitEconomicsTable({ items: initialItems, defaultSettings, fromExtension }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const initSettings = defaultSettings ?? DEFAULT_SETTINGS
  const [items, setItems]               = useState(initialItems)
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [sortKey, setSortKey]           = useState<ColKey>('roi')
  const [sortDir, setSortDir]           = useState<'asc'|'desc'>('desc')
  const [visibleCols, setVisibleCols]   = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE))
  const [showColPicker, setShowColPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings]         = useState<UnitEcoSettings>(initSettings)
  const [draftSettings, setDraftSettings] = useState<UnitEcoSettings>(initSettings)
  const [editingSupplier, setEditingSupplier] = useState<string|null>(null)
  const supplierRef = useRef<HTMLInputElement>(null)
  const printRef    = useRef<HTMLDivElement>(null)
  const [extPending, setExtPending] = useState<FromExtension | null>(fromExtension ?? null)
  const [extSaving, setExtSaving]   = useState(false)

  async function saveFromExtension() {
    if (!extPending) return
    setExtSaving(true)
    const marketplace = extPending.source === 'wb' ? 'wildberries'
      : extPending.source === 'yandex_market' ? 'yandex' : 'uzum'
    try {
      const res = await fetch('/api/unit-economics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         extPending.title || 'Mahsulot',
          marketplace,
          sellingPrice:  extPending.price,
          costPrice:     extPending.packaging || 0,
          commissionPct: extPending.commPct,
          commission:    extPending.commission,
          delivery:      extPending.delivery,
          acquiring:     extPending.acquiring,
          adSpend:       extPending.adSpend,
          tax:           extPending.tax,
          netProfit:     extPending.profit,
          roi:           extPending.roi,
          margin:        extPending.margin,
          productUrl:    extPending.url || undefined,
        }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setItems(prev => [newItem, ...prev])
        setExtPending(null)
      }
    } finally {
      setExtSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items
      .filter(it => !q || it.title.toLowerCase().includes(q) || (it.sku||'').toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortKey as keyof UnitEconomicsItem] as number ?? 0
        const bv = b[sortKey as keyof UnitEconomicsItem] as number ?? 0
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
  }, [items, search, sortKey, sortDir])

  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }

  function deleteSelected() {
    const ids = [...selected]
    setItems(prev => prev.filter(i => !selected.has(i.id)))
    setSelected(new Set())
    fetch('/api/unit-economics', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  function saveSupplier(id: string, val: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, supplierUrl: val } : i))
    setEditingSupplier(null)
    fetch('/api/unit-economics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, supplierUrl: val }),
    }).catch(() => {})
  }

  const exportData = filtered.map(it => {
    const cols = ALL_COLUMNS.filter(c => c.always || visibleCols.has(c.key))
    return Object.fromEntries(cols.map(c => {
      const v = it[c.key as keyof UnitEconomicsItem]
      return [c.label, typeof v === 'number' ? Math.round(v) : (v ?? '')]
    })) as Record<string, string | number>
  })

  const shownCols = ALL_COLUMNS.filter(c => c.always || visibleCols.has(c.key))

  function SortIcon({ col }: { col: ColKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-violet-400" />
      : <ChevronDown className="w-3 h-3 text-violet-400" />
  }

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Extension import banner */}
      {extPending && (
        <div className="flex items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-400 truncate">{extPending.title || 'Mahsulot'}</p>
            <p className="text-xs text-slate-300 mt-0.5">
              {extPending.source?.toUpperCase()} · {new Intl.NumberFormat('uz-UZ').format(extPending.price)} so&apos;m · {extPending.margin}% marja
            </p>
          </div>
          <button onClick={() => setExtPending(null)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card2)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 text-xs rounded-xl border border-[var(--border)] transition-colors">
            <X className="w-3.5 h-3.5" /> Bekor
          </button>
          <button onClick={saveFromExtension} disabled={extSaving}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors">
            <Check className="w-3.5 h-3.5" /> {extSaving ? 'Saqlanmoqda...' : "Qo'shish"}
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={d.ueSearch}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {selected.size > 0 && (
            <button onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-xl border border-red-500/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> O&apos;chirish ({selected.size})
            </button>
          )}
          <button onClick={() => { setShowColPicker(v => !v); setShowSettings(false) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)] text-[var(--text-muted)] hover:text-[var(--text-base)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-all">
            <Package className="w-3.5 h-3.5" /> {d.ueColumns}
          </button>
          <button onClick={() => { setShowSettings(v => !v); setShowColPicker(false); setDraftSettings(settings) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)] text-[var(--text-muted)] hover:text-[var(--text-base)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-all">
            <Settings2 className="w-3.5 h-3.5" /> {d.ueSettings}
          </button>
          <ExportButton data={exportData} filename="unit-ekonomika" targetRef={printRef} />
        </div>
      </div>

      {/* Column picker */}
      {showColPicker && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">Ko&apos;rsatiladigan ustunlar</p>
          <div className="flex flex-wrap gap-2">
            {ALL_COLUMNS.map(col => (
              <button key={col.key}
                disabled={col.always}
                onClick={() => !col.always && toggleCol(col.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCols.has(col.key) || col.always
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'bg-[var(--bg-card2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-dim)]'
                } ${col.always ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}>
                {col.always ? '🔒 ' : ''}{col.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-4">Standart xarajatlar</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'acquiringPct',       label: 'Ekvayring (%)',       step: '0.1', min: 0, max: 5  },
              { key: 'adPct',              label: 'Reklama (%)',          step: '0.5', min: 0, max: 30 },
              { key: 'taxPct',             label: 'Soliq (%)',            step: '0.5', min: 0, max: 20 },
              { key: 'defaultCommissionPct', label: 'Komissiya (%)',      step: '0.5', min: 0, max: 30 },
              { key: 'lastMilePct',        label: 'Oxirgi milya (%)',     step: '0.5', min: 0, max: 10 },
            ].map(({ key, label, step, min, max }) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
                <input
                  type="number" step={step} min={min} max={max}
                  value={draftSettings[key as keyof UnitEcoSettings] as number}
                  onChange={e => setDraftSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">Soliq turi</span>
              <select
                value={draftSettings.taxType}
                onChange={e => setDraftSettings(prev => ({ ...prev, taxType: e.target.value as UnitEcoSettings['taxType'] }))}
                className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50">
                <option value="income">Daromad (6%)</option>
                <option value="income_minus_expense">Daromad − xarajat (15%)</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => {
                setSettings(draftSettings)
                setShowSettings(false)
                fetch('/api/unit-economics/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(draftSettings),
                }).catch(() => {})
              }}
              className="px-4 py-2 btn-primary text-xs font-semibold rounded-xl transition-colors">
              Saqlash
            </button>
            <button onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-[var(--bg-card2)] hover:bg-[var(--bg-input)] text-[var(--text-muted)] text-xs font-semibold rounded-xl transition-colors">
              Bekor
            </button>
          </div>
        </div>
      )}

      {/* Summary indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: d.ueTotalProducts, value: `${filtered.length}` },
          { label: d.ueAvgRoi,        value: filtered.length ? `${Math.round(filtered.reduce((s,i)=>s+i.roi,0)/filtered.length)}%` : '—' },
          { label: d.ueAvgMargin,     value: filtered.length ? `${Math.round(filtered.reduce((s,i)=>s+i.margin,0)/filtered.length)}%` : '—' },
          { label: d.ueTotalProfit,   value: filtered.length ? fs(filtered.reduce((s,i)=>s+i.netProfit,0)) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-sm font-bold text-[var(--text-base)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <Plus className="w-8 h-8 text-violet-400/50 mx-auto mb-3" />
          <p className="text-[var(--text-base)] font-semibold mb-1">{d.ueNoProducts}</p>
          <p className="text-[var(--text-muted)] text-sm">{d.ueNoProductsHint}</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded border-[var(--border2)] bg-transparent accent-violet-500" />
                  </th>
                  {shownCols.map(col => (
                    <th key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-dim)] whitespace-nowrap transition-colors">
                      <span className="flex items-center gap-1">
                        {col.label} <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(item => (
                  <tr key={item.id}
                    className={`hover:bg-[var(--bg-card2)] transition-colors ${selected.has(item.id) ? 'bg-violet-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                        className="rounded border-[var(--border2)] bg-transparent accent-violet-500" />
                    </td>

                    {shownCols.map(col => {
                      if (col.key === 'title') return (
                        <td key="title" className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-[var(--text-base)] font-medium text-xs leading-tight max-w-[180px] truncate">{item.title}</p>
                              <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{item.category || item.marketplace}</p>
                            </div>
                            {item.productUrl && (
                              <a href={item.productUrl} target="_blank" rel="noreferrer"
                                className="text-[var(--text-muted)] hover:text-violet-400 transition-colors flex-shrink-0">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      )
                      if (col.key === 'sku') return <td key="sku" className="px-3 py-3 text-[var(--text-muted)] text-xs font-mono">{item.sku || '—'}</td>
                      if (col.key === 'sellingPrice') return <td key="sellingPrice" className="px-3 py-3 text-[var(--text-base)] text-xs">{fs(item.sellingPrice)}</td>
                      if (col.key === 'costPrice') return <td key="costPrice" className="px-3 py-3 text-[var(--text-muted)] text-xs">{fs(item.costPrice)}</td>
                      if (col.key === 'commission') return <td key="commission" className="px-3 py-3 text-xs"><span className="text-red-400">−{fs(item.commission)}</span><span className="text-[var(--text-muted)] text-[10px] ml-1">({item.commissionPct}%)</span></td>
                      if (col.key === 'delivery') return <td key="delivery" className="px-3 py-3 text-red-400 text-xs">−{fs(item.delivery)}</td>
                      if (col.key === 'lastMile') return <td key="lastMile" className="px-3 py-3 text-red-400 text-xs">{item.lastMile > 0 ? `−${fs(item.lastMile)}` : '—'}</td>
                      if (col.key === 'acquiring') return <td key="acquiring" className="px-3 py-3 text-red-400 text-xs">−{fs(item.acquiring)}</td>
                      if (col.key === 'adSpend') return <td key="adSpend" className="px-3 py-3 text-red-400 text-xs">−{fs(item.adSpend)}</td>
                      if (col.key === 'tax') return <td key="tax" className="px-3 py-3 text-red-400 text-xs">−{fs(item.tax)}</td>
                      if (col.key === 'netProfit') return (
                        <td key="netProfit" className={`px-3 py-3 text-xs font-bold ${item.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.netProfit >= 0 ? '+' : ''}{fs(item.netProfit)}
                        </td>
                      )
                      if (col.key === 'roi') return (
                        <td key="roi" className="px-3 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${roiBg(item.roi)}`}>
                            {item.roi}%
                          </span>
                        </td>
                      )
                      if (col.key === 'margin') return (
                        <td key="margin" className={`px-3 py-3 text-xs font-semibold ${marginColor(item.margin)}`}>
                          {fsPct(item.margin)}
                        </td>
                      )
                      if (col.key === 'stock') return (
                        <td key="stock" className={`px-3 py-3 text-xs font-semibold ${stockColor(item.stock)}`}>
                          {item.stock ?? '—'}
                        </td>
                      )
                      if (col.key === 'supplierUrl') return (
                        <td key="supplierUrl" className="px-3 py-3">
                          {editingSupplier === item.id ? (
                            <div className="flex items-center gap-1">
                              <input ref={supplierRef}
                                defaultValue={item.supplierUrl || ''}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveSupplier(item.id, supplierRef.current?.value || '')
                                  if (e.key === 'Escape') setEditingSupplier(null)
                                }}
                                className="w-32 px-2 py-1 bg-[var(--bg-input)] border border-violet-500/50 rounded text-xs text-[var(--text-base)] focus:outline-none"
                                autoFocus />
                              <button onClick={() => saveSupplier(item.id, supplierRef.current?.value || '')}
                                className="text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingSupplier(null)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-dim)]"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingSupplier(item.id)}
                              className="text-xs text-[var(--text-muted)] hover:text-violet-400 transition-colors truncate max-w-[100px] block">
                              {item.supplierUrl ? (
                                <span className="text-violet-400 flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" /> Havola
                                </span>
                              ) : <span className="border-b border-dashed border-[var(--border2)]">+ Qo&apos;shish</span>}
                            </button>
                          )}
                        </td>
                      )
                      return null
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center">
        {d.ueNote}
      </p>
    </div>
  )
}
