'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Search, Trash2, Settings2, ExternalLink, ChevronUp, ChevronDown,
  Package, Plus, X, Check, Pencil,
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

type FromExtension = Omit<UnitEconomicsItem, 'id' | 'addedAt'>

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

  const [extPending, setExtPending]   = useState<FromExtension | null>(fromExtension ?? null)
  const [extSaving, setExtSaving]     = useState(false)
  const [extError, setExtError]       = useState<string | null>(null)

  // Edit modal
  const [editingItem, setEditingItem] = useState<UnitEconomicsItem | null>(null)
  const [editDraft, setEditDraft]     = useState<Partial<UnitEconomicsItem>>({})
  const [editSaving, setEditSaving]   = useState(false)

  function openEdit(item: UnitEconomicsItem) {
    setEditingItem(item)
    setEditDraft({
      title:         item.title,
      costPrice:     item.costPrice,
      sellingPrice:  item.sellingPrice,
      commissionPct: item.commissionPct,
      delivery:      item.delivery,
      lastMile:      item.lastMile,
      acquiring:     item.acquiring,
      adSpend:       item.adSpend,
      tax:           item.tax,
      stock:         item.stock,
      supplierUrl:   item.supplierUrl,
    })
  }

  function recalc(draft: Partial<UnitEconomicsItem>): Partial<UnitEconomicsItem> {
    const sp  = draft.sellingPrice  ?? 0
    const cp  = draft.costPrice     ?? 0
    const com = sp * (draft.commissionPct ?? 0) / 100
    const del = draft.delivery  ?? 0
    const lm  = draft.lastMile  ?? 0
    const acq = draft.acquiring ?? 0
    const ad  = draft.adSpend   ?? 0
    const tax = draft.tax       ?? 0
    const np  = sp - cp - com - del - lm - acq - ad - tax
    const margin = sp > 0 ? (np / sp) * 100 : 0
    const roi    = cp > 0 ? (np / cp) * 100 : 0
    return { ...draft, commission: com, netProfit: np, margin, roi }
  }

  function setDraftField(key: keyof UnitEconomicsItem, value: unknown) {
    setEditDraft(prev => recalc({ ...prev, [key]: value }))
  }

  async function saveEdit() {
    if (!editingItem) return
    const final = recalc(editDraft)
    setEditSaving(true)
    await fetch('/api/unit-economics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingItem.id, ...final }),
    }).catch(() => {})
    setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...final } : i))
    setEditSaving(false)
    setEditingItem(null)
  }

  async function saveFromExtension() {
    if (!extPending) return
    setExtSaving(true)
    setExtError(null)
    try {
      const res = await fetch('/api/unit-economics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extPending),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setExtError(json.error === 'auth' ? 'Kirish talab qilinadi. Sahifani yangilang yoki qayta kiring.' : (json.error || 'Xatolik yuz berdi'))
        setExtSaving(false)
        return
      }
      const newItem: UnitEconomicsItem = { ...extPending, id: json.id, addedAt: new Date().toISOString() }
      setItems(prev => [newItem, ...prev])
      setExtPending(null)
    } catch {
      setExtError('Tarmoq xatosi. Qayta urinib ko\'ring.')
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
      {/* Extension banner */}
      {extPending && (
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-300 truncate">{extPending.title}</p>
            <p className="text-xs text-violet-400/70 mt-0.5">
              {extPending.marketplace?.toUpperCase()} · {extPending.sellingPrice ? `${new Intl.NumberFormat('uz-UZ').format(Math.round(extPending.sellingPrice))} so'm` : ''} · {extPending.margin ? `${Math.round(extPending.margin)}% marja` : ''}
            </p>
            {extError && <p className="text-xs text-red-400 mt-1">{extError}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setExtPending(null)}
              className="px-3 py-1.5 text-xs font-semibold text-violet-400/70 hover:text-violet-300 border border-violet-500/20 rounded-lg transition-colors">
              Bekor
            </button>
            <button onClick={saveFromExtension} disabled={extSaving}
              className="px-4 py-1.5 text-xs font-semibold btn-primary disabled:opacity-50 rounded-lg transition-colors">
              {extSaving ? 'Saqlanmoqda…' : "Qo'shish"}
            </button>
          </div>
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
                {col.label}{col.always ? <span className="ml-1 text-[9px] opacity-50 font-normal">fixed</span> : ''}
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
                  <th className="px-3 py-3" />
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
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {item.image
                                ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                                : <Package className="w-4 h-4 text-violet-400" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[var(--text-base)] font-medium text-xs leading-tight max-w-[180px] truncate">{item.title}</p>
                              <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{item.category || item.marketplace}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {item.productUrl && (
                                <a href={item.productUrl} target="_blank" rel="noreferrer"
                                  className="text-[var(--text-muted)] hover:text-violet-400 transition-colors">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
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
                    {/* Always-visible edit button */}
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(item)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 transition-colors border border-violet-500/20">
                        <Pencil className="w-3 h-3" /> Tahrir
                      </button>
                    </td>
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

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingItem(null) }}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {editingItem.image
                    ? <img src={editingItem.image} alt="" className="w-full h-full object-cover" />
                    : <Package className="w-4 h-4 text-violet-400" />}
                </div>
                <p className="text-sm font-semibold text-[var(--text-base)] truncate">{editingItem.title}</p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors flex-shrink-0 ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fields */}
            <div className="p-5 space-y-4">
              {/* Title */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Mahsulot nomi</span>
                <input type="text" value={editDraft.title ?? ''}
                  onChange={e => setDraftField('title', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Selling price */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Sotuv narxi (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.sellingPrice || ''}
                    onChange={e => setDraftField('sellingPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Cost price */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Tannarx (so&apos;m) <span className="text-violet-400">*ROI uchun</span></span>
                  <input type="number" min={0} value={editDraft.costPrice || ''}
                    onChange={e => setDraftField('costPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-violet-500/50 rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500" />
                </label>
                {/* Commission % */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Komissiya (%)</span>
                  <input type="number" min={0} max={100} step={0.5} value={editDraft.commissionPct || ''}
                    onChange={e => setDraftField('commissionPct', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Delivery */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Yetkazib berish (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.delivery || ''}
                    onChange={e => setDraftField('delivery', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Ad spend */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Reklama (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.adSpend || ''}
                    onChange={e => setDraftField('adSpend', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Tax */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Soliq (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.tax || ''}
                    onChange={e => setDraftField('tax', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Acquiring */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Ekvayring (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.acquiring || ''}
                    onChange={e => setDraftField('acquiring', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Last mile */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Oxirgi milya (so&apos;m)</span>
                  <input type="number" min={0} value={editDraft.lastMile || ''}
                    onChange={e => setDraftField('lastMile', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Stock */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Zaxira (dona)</span>
                  <input type="number" min={0} value={editDraft.stock ?? ''}
                    onChange={e => setDraftField('stock', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
                {/* Supplier URL */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Ta&apos;minotchi havolasi</span>
                  <input type="url" value={editDraft.supplierUrl ?? ''}
                    onChange={e => setDraftField('supplierUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50" />
                </label>
              </div>

              {/* Live preview */}
              {(() => {
                const calc = recalc(editDraft)
                return (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Foyda</p>
                      <p className={`text-xs font-bold ${(calc.netProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(calc.netProfit ?? 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('uz-UZ').format(Math.round(calc.netProfit ?? 0))} so&apos;m
                      </p>
                    </div>
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">ROI</p>
                      <p className={`text-xs font-bold ${(calc.roi ?? 0) >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {Math.round(calc.roi ?? 0)}%
                      </p>
                    </div>
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Marja</p>
                      <p className={`text-xs font-bold ${(calc.margin ?? 0) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {(calc.margin ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-[var(--border)]">
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 btn-primary py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                {editSaving ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
              <button onClick={() => setEditingItem(null)}
                className="px-5 py-2.5 bg-[var(--bg-card2)] hover:bg-[var(--bg-input)] text-[var(--text-muted)] text-sm font-semibold rounded-xl transition-colors">
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
