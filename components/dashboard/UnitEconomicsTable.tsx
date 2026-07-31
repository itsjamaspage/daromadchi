'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Trash2, Settings2, ExternalLink, ChevronUp, ChevronDown,
  Package, Plus, X, Check, Pencil, RefreshCw,
} from 'lucide-react'
import type { UnitEconomicsItem, UnitEcoSettings, MarketplaceType } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import FulfillmentBadge from '@/components/dashboard/FulfillmentBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { WB_ENABLED } from '@/lib/feature-flags'

const MP_META: Record<string, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',          short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { label: 'Yandex Market', short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
  wildberries:   { label: 'Wildberries',   short: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.12)' },
}

function fs(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}
function fsPct(n: number) {
  return n.toFixed(1) + '%'
}

function roiBg(roi: number) {
  return roi >= 80 ? 'bg-emerald-100 text-emerald-700' : roi >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
}
function marginColor(m: number) {
  return m >= 20 ? 'text-emerald-600' : m >= 10 ? 'text-amber-600' : 'text-red-600'
}
function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select()
}
function stockColor(s: number | undefined) {
  if (s === undefined) return 'text-[var(--text-muted)]'
  return s >= 30 ? 'text-emerald-600' : s >= 10 ? 'text-amber-600' : 'text-red-600'
}

const COL_KEYS = [
  'title', 'sku', 'sellingPrice', 'costPrice', 'landedCost', 'commission',
  'delivery', 'lastMile', 'acquiring', 'adSpend', 'tax', 'netProfit',
  'roi', 'margin', 'stock', 'supplierUrl',
] as const
type ColKey = typeof COL_KEYS[number]
const COL_ALWAYS = new Set<ColKey>(['title', 'netProfit', 'roi'])

const COL_I18N_KEY: Record<ColKey, string> = {
  title: 'ueColProduct', sku: 'ueColSku', sellingPrice: 'ueColPrice', costPrice: 'ueColCost',
  landedCost: 'ueColLanded', commission: 'ueColCommission', delivery: 'ueColDelivery',
  lastMile: 'ueColLastMile', acquiring: 'ueColAcquiring', adSpend: 'ueColAdSpend',
  tax: 'ueColTax', netProfit: 'ueColProfit', roi: 'ueColRoi', margin: 'ueColMargin',
  stock: 'ueColStock', supplierUrl: 'ueColSupplier',
}
const DEFAULT_VISIBLE: ColKey[] = ['title','sellingPrice','costPrice','landedCost','commission','delivery','adSpend','netProfit','roi','margin','stock','supplierUrl']

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
  const router = useRouter()
  const ALL_COLUMNS = useMemo(() => COL_KEYS.map(key => ({
    key, label: (d as unknown as Record<string, string>)[COL_I18N_KEY[key]] ?? key, always: COL_ALWAYS.has(key),
  })), [d])
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
  const [mpFilter, setMpFilter] = useState<'all' | 'uzum' | 'yandex_market' | 'wildberries'>('all')
  const [editingSupplier, setEditingSupplier] = useState<string|null>(null)
  const supplierRef = useRef<HTMLInputElement>(null)
  // Inline cost editor: click the Tannarx cell to enter a new value —
  // Enter to save, Esc to cancel. Persists via /api/unit-economics PATCH
  // and the server recalculates margin/ROI on next fetch (this component
  // also patches the local row so the derived numbers update instantly).
  const [editingCost, setEditingCost] = useState<string|null>(null)
  const costRef = useRef<HTMLInputElement>(null)
  const printRef    = useRef<HTMLDivElement>(null)

  const [extPending, setExtPending]   = useState<FromExtension | null>(fromExtension ?? null)
  const [extSaving, setExtSaving]     = useState(false)
  const [extError, setExtError]       = useState<string | null>(null)

  const [recalcState, setRecalcState] = useState<'idle' | 'running' | 'done' | 'err'>('idle')
  async function handleRecalc() {
    setRecalcState('running')
    try {
      const res = await fetch('/api/unit-economics/recalc', { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      setRecalcState('done')
      router.refresh()
      setTimeout(() => setRecalcState('idle'), 2500)
    } catch {
      setRecalcState('err')
      setTimeout(() => setRecalcState('idle'), 2500)
    }
  }

  // Edit modal
  const [editingItem, setEditingItem] = useState<UnitEconomicsItem | null>(null)
  const [editDraft, setEditDraft]     = useState<Partial<UnitEconomicsItem>>({})
  const [editSaving, setEditSaving]   = useState(false)

  function openEdit(item: UnitEconomicsItem) {
    setEditingItem(item)
    setEditDraft({
      title:         item.title,
      costPrice:     item.costPrice,
      landedCost:    item.landedCost,
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
    // Landed cost: what it actually cost to bring the unit from the supplier
    // (cargo/customs). Part of the true unit cost, so it reduces profit and
    // sits in the ROI denominator alongside the purchase price.
    const lc  = draft.landedCost    ?? 0
    const com = sp * (draft.commissionPct ?? 0) / 100
    const del = draft.delivery  ?? 0
    const lm  = draft.lastMile  ?? 0
    const acq = draft.acquiring ?? 0
    const ad  = draft.adSpend   ?? 0
    const tax = draft.tax       ?? 0
    const np  = sp - cp - lc - com - del - lm - acq - ad - tax
    const margin = sp > 0 ? (np / sp) * 100 : 0
    const roi    = cp + lc > 0 ? (np / (cp + lc)) * 100 : 0
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
      // Refresh the server component so the "N products" header count
      // in the page shell matches the new table length, and so the
      // row picks up real per-SKU rates via getRealRatesBySku on the
      // next render (its output isn't part of client state).
      router.refresh()
    } catch {
      setExtError('Tarmoq xatosi. Qayta urinib ko\'ring.')
      setExtSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items
      .filter(it => mpFilter === 'all' || it.marketplace === mpFilter)
      .filter(it => !q || it.title.toLowerCase().includes(q) || (it.sku||'').toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortKey as keyof UnitEconomicsItem] as number ?? 0
        const bv = b[sortKey as keyof UnitEconomicsItem] as number ?? 0
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
  }, [items, search, sortKey, sortDir, mpFilter])

  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
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
    }).then(() => router.refresh()).catch(() => {})
  }

  // Per-row delete — mirrors deleteSelected but for a single id, wired
  // to a Trash icon at the end of each row so the seller can wipe a
  // stale item (e.g. a sunset-marketplace product) without going
  // through the bulk checkbox + Delete button flow.
  function deleteOne(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    fetch('/api/unit-economics', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).then(() => router.refresh()).catch(() => {})
  }

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
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

  function saveCost(id: string, raw: string) {
    // Empty = clear cost (null). Non-numeric or negative = ignore.
    const trimmed = raw.trim()
    const parsed = trimmed === '' ? 0 : Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) { setEditingCost(null); return }
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      // Recompute derived fields locally so the row updates instantly instead
      // of waiting for a refetch.
      const updated = recalc({ ...i, costPrice: parsed }) as UnitEconomicsItem
      return updated
    }))
    setEditingCost(null)
    fetch('/api/unit-economics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, costPrice: parsed }),
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
      ? <ChevronUp className="w-3 h-3 text-[var(--c1)]" />
      : <ChevronDown className="w-3 h-3 text-[var(--c1)]" />
  }

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Extension banner */}
      {extPending && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--c1)' }}>{extPending.title}</p>
            <p className="text-xs text-[var(--c1)]/70 mt-0.5">
              {MP_META[extPending.marketplace ?? '']?.label ?? extPending.marketplace?.toUpperCase()} · {extPending.sellingPrice ? `${new Intl.NumberFormat('uz-UZ').format(Math.round(extPending.sellingPrice))} so'm` : ''} · {extPending.margin ? `${Math.round(extPending.margin)}% marja` : ''}
            </p>
            {extError && <p className="text-xs text-red-400 mt-1">{extError}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setExtPending(null)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              title={d.ueBtnCancel}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <button onClick={saveFromExtension} disabled={extSaving}
              className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
              title={d.ueBtnAdd}>
              {extSaving
                ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/></svg>
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              }
            </button>
          </div>
        </div>
      )}

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {((['all', 'uzum', 'yandex_market', 'wildberries'] as const).filter(mp => mp !== 'wildberries' || WB_ENABLED)).map(mp => (
          <button
            key={mp}
            onClick={() => setMpFilter(mp)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mpFilter === mp
                ? 'text-[var(--c1)]'
                : 'text-[var(--text-base)] hover:text-[var(--c1)]'
            }`}
            style={mpFilter === mp ? { background: 'var(--bg-card2)', border: '1px solid var(--border)' } : undefined}
          >
            {mp === 'all' ? d.tabAll : MP_META[mp]?.label ?? mp}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={d.ueSearch}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {selected.size > 0 && (
            <button onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-xl border border-red-300 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> O&apos;chirish ({selected.size})
            </button>
          )}
          <button onClick={handleRecalc} disabled={recalcState === 'running'}
            title={lang === 'ru' ? 'Пересчитать по актуальным формулам (v2.5.0)'
              : lang === 'en' ? 'Recalculate rows with the current formulas (v2.5.0)'
              : "Amaldagi formulalar bilan qayta hisoblash (v2.5.0)"}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all disabled:opacity-60 disabled:cursor-wait ${
              recalcState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : recalcState === 'err' ? 'bg-red-500/10 border-red-500/30 text-red-500'
              : 'bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)] text-[var(--text-muted)] hover:text-[var(--text-base)] border-[var(--border)]'
            }`}>
            <RefreshCw className={`w-3.5 h-3.5 ${recalcState === 'running' ? 'animate-spin' : ''}`} />
            {recalcState === 'done' ? (lang === 'ru' ? 'Готово' : lang === 'en' ? 'Done' : 'Tayyor')
              : recalcState === 'err' ? (lang === 'ru' ? 'Ошибка' : lang === 'en' ? 'Error' : 'Xato')
              : (lang === 'ru' ? 'Пересчитать' : lang === 'en' ? 'Recalculate' : 'Qayta hisoblash')}
          </button>
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
            {ALL_COLUMNS.map(col => {
              const active = visibleCols.has(col.key) || col.always
              return (
                <button key={col.key}
                  disabled={col.always}
                  onClick={() => !col.always && toggleCol(col.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-[var(--bg-card2)] border border-[var(--border)]'
                      : 'bg-[var(--bg-card2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-dim)]'
                  } ${col.always ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                  style={active ? { color: 'var(--c1)' } : {}}>
                  {col.label}{col.always ? <span className="ml-1 text-[9px] opacity-50 font-normal">fixed</span> : ''}
                </button>
              )
            })}
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
                  className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">Soliq turi</span>
              <select
                value={draftSettings.taxType}
                onChange={e => setDraftSettings(prev => ({ ...prev, taxType: e.target.value as UnitEcoSettings['taxType'] }))}
                className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]">
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
        {(() => {
          const withCost = filtered.filter(i => i.costPrice > 0)
          return [
            { label: d.ueTotalProducts, value: `${filtered.length}` },
            { label: d.ueAvgRoi,        value: withCost.length ? `${Math.round(withCost.reduce((s,i)=>s+i.roi,0)/withCost.length)}%` : '—' },
            { label: d.ueAvgMargin,     value: filtered.length ? `${Math.round(filtered.reduce((s,i)=>s+i.margin,0)/filtered.length)}%` : '—' },
            { label: d.ueTotalProfit,   value: filtered.length ? fs(filtered.reduce((s,i)=>s+i.netProfit,0)) : '—' },
          ]
        })().map(({ label, value }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-sm font-bold text-[var(--text-base)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card2)] border border-dashed border-[var(--border)] rounded-2xl p-10 text-center">
          <Plus className="w-8 h-8 text-[var(--c1)]/50 mx-auto mb-3" />
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
                      className="rounded border-[var(--border2)] bg-transparent accent-[var(--c1)]" />
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
                    className={`font-semibold hover:bg-[var(--bg-card2)] transition-colors ${selected.has(item.id) ? 'bg-[var(--c1)]/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                        className="rounded border-[var(--border2)] bg-transparent accent-[var(--c1)]" />
                    </td>

                    {shownCols.map(col => {
                      if (col.key === 'title') return (
                        <td key="title" className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-card2)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {item.image
                                ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                                : <Package className="w-4 h-4 text-[var(--c1)]" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[var(--text-base)] font-medium text-xs leading-tight max-w-[180px] truncate">{item.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.marketplace && MP_META[item.marketplace] && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: MP_META[item.marketplace].bg, color: MP_META[item.marketplace].color }}>{MP_META[item.marketplace].short}</span>
                                )}
                                {item.category && <span className="text-[var(--text-base)] text-[10px] opacity-70">{item.category}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {item.productUrl && (
                                <a href={item.productUrl} target="_blank" rel="noreferrer"
                                  className="text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                      if (col.key === 'sku') return <td key="sku" className="px-3 py-3 text-[var(--text-base)] text-xs font-mono">{item.sku || '—'}</td>
                      if (col.key === 'sellingPrice') return <td key="sellingPrice" className="px-3 py-3 text-[var(--text-base)] text-xs">{fs(item.sellingPrice)}</td>
                      if (col.key === 'costPrice') return (
                        <td key="costPrice" className="px-3 py-3 text-xs">
                          {editingCost === item.id ? (
                            <div className="flex items-center gap-1">
                              <input ref={costRef}
                                type="number"
                                defaultValue={item.costPrice || ''}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveCost(item.id, costRef.current?.value ?? '')
                                  if (e.key === 'Escape') setEditingCost(null)
                                }}
                                className="w-24 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs text-[var(--text-base)] focus:outline-none"
                                autoFocus />
                              <button onClick={() => saveCost(item.id, costRef.current?.value ?? '')}
                                className="text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingCost(null)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-dim)]"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingCost(item.id)}
                              className="text-[var(--text-base)] text-xs border-b border-dashed border-transparent hover:border-[var(--border2)] cursor-text"
                              title={d.ueEditCostInline}>
                              {item.costPrice > 0 ? fs(item.costPrice) : <span className="text-[var(--text-muted)]">{d.ueEditCostPlaceholder}</span>}
                            </button>
                          )}
                        </td>
                      )
                      if (col.key === 'landedCost') return <td key="landedCost" className="px-3 py-3 text-[var(--text-base)] text-xs">{item.landedCost ? fs(item.landedCost) : '—'}</td>
                      if (col.key === 'commission') return (
                        <td key="commission" className="px-3 py-3 text-xs">
                          <span className="text-red-600">−{fs(item.commission)}</span>
                          <span className="text-[var(--text-base)] text-[10px] ml-1 opacity-60">({Math.round(item.commissionPct * 10) / 10}%)</span>
                          {/* "R" badge = commission % was computed from
                              this SKU's actual settlements, not the default
                              Unit Economics %. Sellers see at a glance
                              which rows are trustworthy. */}
                          {item.ratesSource === 'real' && (
                            <span
                              className="ml-1.5 inline-flex items-center justify-center text-[9px] font-bold rounded px-1 py-0.5 align-middle"
                              style={{ background: 'rgba(16,185,129,0.15)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}
                              title={`Real rate from ${item.ratesSourceItemCount ?? 0} settled sale${(item.ratesSourceItemCount ?? 0) === 1 ? '' : 's'}`}
                            >R</span>
                          )}
                        </td>
                      )
                      if (col.key === 'delivery') return <td key="delivery" className="px-3 py-3 text-red-600 text-xs">{item.delivery > 0 ? `−${fs(item.delivery)}` : <span className="text-[var(--text-muted)]">—</span>}</td>
                      if (col.key === 'lastMile') return <td key="lastMile" className="px-3 py-3 text-red-600 text-xs">{item.lastMile > 0 ? `−${fs(item.lastMile)}` : <span className="text-[var(--text-muted)]">—</span>}</td>
                      if (col.key === 'acquiring') return <td key="acquiring" className="px-3 py-3 text-red-600 text-xs">{item.acquiring > 0 ? `−${fs(item.acquiring)}` : <span className="text-[var(--text-muted)]">—</span>}</td>
                      if (col.key === 'adSpend') return <td key="adSpend" className="px-3 py-3 text-red-600 text-xs">{item.adSpend > 0 ? `−${fs(item.adSpend)}` : <span className="text-[var(--text-muted)]">—</span>}</td>
                      if (col.key === 'tax') return <td key="tax" className="px-3 py-3 text-red-600 text-xs">{item.tax > 0 ? `−${fs(item.tax)}` : <span className="text-[var(--text-muted)]">—</span>}</td>
                      if (col.key === 'netProfit') return (
                        <td key="netProfit" className={`px-3 py-3 text-xs font-bold ${item.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.netProfit >= 0 ? '+' : ''}{fs(item.netProfit)}
                        </td>
                      )
                      if (col.key === 'roi') return (
                        <td key="roi" className="px-3 py-3">
                          {item.costPrice === 0 ? (
                            <button onClick={() => openEdit(item)}
                              className="text-xs text-amber-700 border border-amber-300 bg-amber-100 px-2 py-0.5 rounded-lg hover:bg-amber-200 transition-colors"
                              title={d.ueEditNoCost}>
                              —
                            </button>
                          ) : (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${roiBg(item.roi)}`}>
                              {item.roi.toFixed(0)}%
                            </span>
                          )}
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
                                className="w-32 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs text-[var(--text-base)] focus:outline-none"
                                autoFocus />
                              <button onClick={() => saveSupplier(item.id, supplierRef.current?.value || '')}
                                className="text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingSupplier(null)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-dim)]"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingSupplier(item.id)}
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors truncate max-w-[100px] block">
                              {item.supplierUrl ? (
                                <span className="text-[var(--c1)] flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" /> {d.ueBtnLink}
                                </span>
                              ) : <span className="border-b border-dashed border-[var(--border2)]">+ {d.ueBtnAdd}</span>}
                            </button>
                          )}
                        </td>
                      )
                      return null
                    })}
                    {/* Always-visible edit + delete buttons */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[var(--bg-card2)] hover:bg-[#6aabf0]/20 text-[var(--c1)] hover:text-[var(--c1)] transition-colors border border-[var(--border)]">
                          <Pencil className="w-3 h-3" /> {d.ueBtnEdit}
                        </button>
                        <button
                          onClick={() => { if (confirm(lang === 'ru' ? `Удалить «${item.title}»?` : lang === 'en' ? `Delete "${item.title}"?` : `«${item.title}» ni o'chirasizmi?`)) deleteOne(item.id) }}
                          title={lang === 'ru' ? 'Удалить' : lang === 'en' ? 'Delete' : "O'chirish"}
                          className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-card2)] hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-500 transition-colors border border-[var(--border)]">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-card2)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {editingItem.image
                    ? <img src={editingItem.image} alt="" className="w-full h-full object-cover" />
                    : <Package className="w-4 h-4 text-[var(--c1)]" />}
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
                <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditTitle}</span>
                <input type="text" value={editDraft.title ?? ''}
                  onChange={e => setDraftField('title', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Selling price */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditPrice}</span>
                  <input type="number" min={0} value={editDraft.sellingPrice ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('sellingPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Cost price */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditCost} <span className="text-[var(--c1)]">{d.ueEditCostHint}</span></span>
                  <input type="number" min={0} value={editDraft.costPrice ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('costPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Landed cost (bringing from supplier / China) */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditLanded} <span className="text-[var(--c1)]">{d.ueEditLandedHint}</span></span>
                  <input type="number" min={0} value={editDraft.landedCost ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('landedCost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Commission % */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditCommission}</span>
                  <input type="number" min={0} max={100} step={0.5} value={editDraft.commissionPct ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('commissionPct', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Delivery */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditDelivery}</span>
                  <input type="number" min={0} value={editDraft.delivery ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('delivery', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Ad spend */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditAdSpend}</span>
                  <input type="number" min={0} value={editDraft.adSpend ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('adSpend', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Tax */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditTax}</span>
                  <input type="number" min={0} value={editDraft.tax ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('tax', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Acquiring */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditAcquiring}</span>
                  <input type="number" min={0} value={editDraft.acquiring ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('acquiring', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Last mile */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditLastMile}</span>
                  <input type="number" min={0} value={editDraft.lastMile ?? 0}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('lastMile', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Stock */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditStock}</span>
                  <input type="number" min={0} value={editDraft.stock ?? ''}
                    onFocus={selectOnFocus}
                    onChange={e => setDraftField('stock', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
                {/* Supplier URL */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{d.ueEditSupplier}</span>
                  <input type="url" value={editDraft.supplierUrl ?? ''}
                    onChange={e => setDraftField('supplierUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)]" />
                </label>
              </div>

              {/* Live preview */}
              {(() => {
                const calc = recalc(editDraft)
                return (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{d.ueEditProfit}</p>
                      <p className={`text-xs font-bold ${(calc.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {(calc.netProfit ?? 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('uz-UZ').format(Math.round(calc.netProfit ?? 0))} so&apos;m
                      </p>
                    </div>
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{d.ueEditRoi}</p>
                      <p className={`text-xs font-bold ${(calc.roi ?? 0) >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(calc.roi ?? 0)}%
                      </p>
                    </div>
                    <div className="bg-[var(--bg-card2)] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{d.ueEditMargin}</p>
                      <p className={`text-xs font-bold ${(calc.margin ?? 0) >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
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
                {editSaving ? d.ueEditSaving : d.ueEditSave}
              </button>
              <button onClick={() => setEditingItem(null)}
                className="px-5 py-2.5 bg-[var(--bg-card2)] hover:bg-[var(--bg-input)] text-[var(--text-muted)] text-sm font-semibold rounded-xl transition-colors">
                {d.ueEditCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
