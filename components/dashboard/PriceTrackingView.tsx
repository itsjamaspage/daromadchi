'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import type { WatchlistItem } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'

function fp(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const LABELS = {
  uz: {
    add: '+ Raqobatchi qo\'shish',
    addTitle: 'Raqobatchi qo\'shish',
    labelLbl: 'Nom *', labelPh: 'Masalan: Nike Air Max 90',
    urlLbl: 'Uzum havolasi (ixtiyoriy)', urlPh: 'https://uzum.uz/product/...',
    myProductLbl: 'Mening mahsulotim (ixtiyoriy)', myProductPh: 'Mahsulot nomi',
    compPriceLbl: 'Raqobatchi narxi (so\'m)', myPriceLbl: 'Mening narxim (so\'m)',
    save: 'Qo\'shish', cancel: 'Bekor', saving: 'Saqlanmoqda...',
    empty: 'Hali raqobatchilar yo\'q',
    emptyDesc: 'Narx kuzatuvini boshlash uchun raqobatchi qo\'shing',
    colLabel: 'Raqobatchi', colComp: 'Raqobatchi narxi',
    colMy: 'Mening narxim', colDiff: 'Farq', colUpdated: 'Yangilangan', colActions: '',
    cheaper: 'Raqobatchi arzonroq', expensive: 'Raqobatchi qimmatroq', same: 'Bir xil',
    openUrl: 'Ochish', deleteConfirm: 'O\'chirishni tasdiqlaysizmi?',
    updatePrice: 'Narxni yangilash', noPrice: '—',
    editSave: 'Saqlash', editCancel: 'Bekor',
  },
  ru: {
    add: '+ Добавить конкурента',
    addTitle: 'Добавить конкурента',
    labelLbl: 'Название *', labelPh: 'Например: Nike Air Max 90',
    urlLbl: 'Ссылка на Uzum (необязательно)', urlPh: 'https://uzum.uz/product/...',
    myProductLbl: 'Мой товар (необязательно)', myProductPh: 'Название товара',
    compPriceLbl: 'Цена конкурента (сум)', myPriceLbl: 'Моя цена (сум)',
    save: 'Добавить', cancel: 'Отмена', saving: 'Сохранение...',
    empty: 'Конкурентов пока нет',
    emptyDesc: 'Добавьте конкурента для отслеживания цен',
    colLabel: 'Конкурент', colComp: 'Цена конкурента',
    colMy: 'Моя цена', colDiff: 'Разница', colUpdated: 'Обновлено', colActions: '',
    cheaper: 'Конкурент дешевле', expensive: 'Конкурент дороже', same: 'Одинаково',
    openUrl: 'Открыть', deleteConfirm: 'Удалить?',
    updatePrice: 'Обновить цену', noPrice: '—',
    editSave: 'Сохранить', editCancel: 'Отмена',
  },
  en: {
    add: '+ Add competitor',
    addTitle: 'Add competitor',
    labelLbl: 'Name *', labelPh: 'e.g. Nike Air Max 90',
    urlLbl: 'Uzum link (optional)', urlPh: 'https://uzum.uz/product/...',
    myProductLbl: 'My product (optional)', myProductPh: 'Product name',
    compPriceLbl: 'Competitor price (sum)', myPriceLbl: 'My price (sum)',
    save: 'Add', cancel: 'Cancel', saving: 'Saving...',
    empty: 'No competitors yet',
    emptyDesc: 'Add a competitor to start tracking prices',
    colLabel: 'Competitor', colComp: 'Competitor price',
    colMy: 'My price', colDiff: 'Diff', colUpdated: 'Updated', colActions: '',
    cheaper: 'Competitor cheaper', expensive: 'Competitor more expensive', same: 'Same price',
    openUrl: 'Open', deleteConfirm: 'Delete this competitor?',
    updatePrice: 'Update prices', noPrice: '—',
    editSave: 'Save', editCancel: 'Cancel',
  },
}

export default function PriceTrackingView() {
  const { lang } = useLang()
  const t = LABELS[lang] ?? LABELS.uz
  const printRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ label: '', competitor_url: '', my_product_title: '', my_price: '', last_competitor_price: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrices, setEditPrices] = useState({ my_price: '', last_competitor_price: '' })

  async function fetchItems() {
    try {
      const res = await fetch('/api/price-tracking/competitors')
      if (res.ok) setItems(await res.json())
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  async function handleAdd() {
    if (!form.label.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/price-tracking/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          competitor_url: form.competitor_url || null,
          my_product_title: form.my_product_title || null,
          my_price: form.my_price ? Number(form.my_price.replace(/\s/g, '')) : null,
          last_competitor_price: form.last_competitor_price ? Number(form.last_competitor_price.replace(/\s/g, '')) : null,
        }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems(prev => [...prev, item])
        setForm({ label: '', competitor_url: '', my_product_title: '', my_price: '', last_competitor_price: '' })
        setShowAdd(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/price-tracking/competitors/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleEditSave(id: string) {
    const res = await fetch(`/api/price-tracking/competitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        my_price: editPrices.my_price ? Number(editPrices.my_price.replace(/\s/g, '')) : undefined,
        last_competitor_price: editPrices.last_competitor_price ? Number(editPrices.last_competitor_price.replace(/\s/g, '')) : undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    }
    setEditingId(null)
  }

  function diffDisplay(item: WatchlistItem) {
    if (!item.my_price || !item.last_competitor_price) return null
    const diff = item.last_competitor_price - item.my_price
    const pct = (diff / item.my_price) * 100
    if (Math.abs(diff) < 100) return (
      <span className="flex items-center gap-1 text-[var(--text-muted)] text-sm">
        <Minus className="w-3 h-3" /> {t.same}
      </span>
    )
    if (diff < 0) return (
      <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold">
        <TrendingDown className="w-3 h-3" />
        {fp(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%)
      </span>
    )
    return (
      <span className="flex items-center gap-1 text-red-400 text-sm font-semibold">
        <TrendingUp className="w-3 h-3" />
        +{fp(diff)} (+{pct.toFixed(1)}%)
      </span>
    )
  }

  const exportData = items.map(i => ({
    [t.colLabel]: i.label,
    [t.colComp]: i.last_competitor_price ?? '',
    [t.colMy]: i.my_price ?? '',
    'URL': i.competitor_url ?? '',
  }))

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(n => (
        <div key={n} className="h-14 bg-[var(--bg-card2)] rounded-2xl border border-[var(--border)]" />
      ))}
    </div>
  )

  return (
    <div className="space-y-4" ref={printRef}>
      <div className="flex items-center gap-3 justify-between">
        <div />
        <div className="flex items-center gap-2">
          {items.length > 0 && <ExportButton data={exportData} filename="narx-kuzatuvi" targetRef={printRef} />}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--c1)', color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> {t.add}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-6 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
            <TrendingDown className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-[var(--text-base)] font-semibold">{t.empty}</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">{t.emptyDesc}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--c1)', color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> {t.add}
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[t.colLabel, t.colComp, t.colMy, t.colDiff, t.colUpdated, t.colActions].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-base)] text-sm font-medium">{item.label}</span>
                          {item.competitor_url && (
                            <a href={item.competitor_url} target="_blank" rel="noopener noreferrer"
                              className="text-[var(--text-muted)] hover:text-violet-400 transition-colors" title={t.openUrl}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {item.my_product_title && (
                          <p className="text-[var(--text-muted)] text-xs mt-0.5">{item.my_product_title}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editPrices.last_competitor_price}
                          onChange={e => setEditPrices(p => ({ ...p, last_competitor_price: e.target.value }))}
                          className="w-28 px-2 py-1 rounded-lg text-xs border focus:outline-none"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-[var(--text-dim)] text-sm tabular-nums">
                          {item.last_competitor_price ? fp(item.last_competitor_price) : <span className="text-[var(--text-muted)]">{t.noPrice}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editPrices.my_price}
                          onChange={e => setEditPrices(p => ({ ...p, my_price: e.target.value }))}
                          className="w-28 px-2 py-1 rounded-lg text-xs border focus:outline-none"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-[var(--text-base)] text-sm font-semibold tabular-nums">
                          {item.my_price ? fp(item.my_price) : <span className="text-[var(--text-muted)] font-normal">{t.noPrice}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {diffDisplay(item)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs whitespace-nowrap">
                      {item.last_checked_at ? timeSince(item.last_checked_at) : t.noPrice}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={() => handleEditSave(item.id)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                              style={{ background: 'var(--c1)', color: '#fff' }}
                            >{t.editSave}</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded-lg text-xs transition-colors text-[var(--text-muted)] hover:text-[var(--text-base)]"
                            >{t.editCancel}</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(item.id)
                                setEditPrices({
                                  my_price: item.my_price?.toString() ?? '',
                                  last_competitor_price: item.last_competitor_price?.toString() ?? '',
                                })
                              }}
                              title={t.updatePrice}
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-[var(--text-base)] font-semibold text-sm">{t.addTitle}</h2>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-base)] p-1 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-[var(--text-muted)] text-xs mb-1 block">{t.labelLbl}</label>
                <input
                  type="text" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder={t.labelPh}
                  className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                />
              </div>
              <div>
                <label className="text-[var(--text-muted)] text-xs mb-1 block">{t.urlLbl}</label>
                <input
                  type="url" value={form.competitor_url} onChange={e => setForm(p => ({ ...p, competitor_url: e.target.value }))}
                  placeholder={t.urlPh}
                  className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text-muted)] text-xs mb-1 block">{t.compPriceLbl}</label>
                  <input
                    type="number" value={form.last_competitor_price} onChange={e => setForm(p => ({ ...p, last_competitor_price: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs mb-1 block">{t.myPriceLbl}</label>
                  <input
                    type="number" value={form.my_price} onChange={e => setForm(p => ({ ...p, my_price: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[var(--text-muted)] text-xs mb-1 block">{t.myProductLbl}</label>
                <input
                  type="text" value={form.my_product_title} onChange={e => setForm(p => ({ ...p, my_product_title: e.target.value }))}
                  placeholder={t.myProductPh}
                  className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-base)' }}
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm transition-colors text-[var(--text-muted)] hover:text-[var(--text-base)]">
                {t.cancel}
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.label.trim() || saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--c1)', color: '#fff' }}
              >
                {saving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
