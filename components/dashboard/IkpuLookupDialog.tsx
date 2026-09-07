'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { IkpuResult } from '@/lib/ikpu/client'

interface Props {
  productId: string
  productTitle: string
  currentCode: string | null
  onAssigned: (productId: string, code: string | null) => void
  onClose: () => void
}

export default function IkpuLookupDialog({ productId, productTitle, currentCode, onAssigned, onClose }: Props) {
  const { lang } = useLang()
  const t = translations[lang]?.dashboard ?? translations.ru.dashboard
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IkpuResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const isBarcode = /^\d{8,14}$/.test(q.trim())
      const param = isBarcode ? `barcode=${encodeURIComponent(q.trim())}` : `q=${encodeURIComponent(q.trim())}`
      const res = await fetch(`/api/ikpu/search?${param}&lang=${lang === 'uz' ? 'uz' : 'ru'}`)
      if (!res.ok) return
      const data = await res.json()
      setResults(data.results ?? [])
    } finally {
      setSearching(false)
    }
  }, [lang])

  function handleInput(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  async function assign(code: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/ikpu/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ikpuCode: code }),
      })
      if (res.ok) {
        onAssigned(productId, code)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      const res = await fetch('/api/ikpu/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ikpuCode: null }),
      })
      if (res.ok) {
        onAssigned(productId, null)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {t.ikpuSearch}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {productTitle}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Current code */}
        {currentCode && (
          <div className="mx-5 mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
              {t.ikpuCode}: {currentCode}
            </span>
            <button onClick={remove} disabled={saving}
              className="text-xs px-2 py-0.5 rounded hover:opacity-70"
              style={{ color: 'var(--c-error, #e53e3e)' }}>
              {t.ikpuRemove}
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="mx-5 mb-3 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder={t.ikpuSearchPlaceholder}
            autoFocus
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ minHeight: 0 }}>
          {searching && (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-dim)' }}>
              {t.ikpuSearching}
            </p>
          )}
          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-dim)' }}>
              {t.ikpuNoResults}
            </p>
          )}
          {results.map((r) => (
            <div key={r.mxikCode}
              className="flex items-start justify-between gap-3 py-2.5 border-b last:border-0"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {r.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                  {r.mxikCode} &middot; {r.className} &middot; {r.positionName}
                </p>
                {r.brandName && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.brandName}
                  </p>
                )}
              </div>
              <button
                onClick={() => assign(r.mxikCode)}
                disabled={saving}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background: 'var(--c1)',
                  color: '#fff',
                  opacity: saving ? 0.6 : 1,
                }}>
                {t.ikpuAssign}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
