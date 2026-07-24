'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

// Inline-editable cost_price cell — used on the Analytics margin table.
// Click the value → number input → Enter saves via PATCH
// /api/products/update (same endpoint the Products page uses). On success
// router.refresh() re-runs the server component so profit, margin and
// warehouse value recompute with the new cost.
export default function EditableCostCell({
  productId,
  initialCost,
}: {
  productId: string
  initialCost: number | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState<number | null>(initialCost)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save() {
    const raw = inputRef.current?.value.trim() ?? ''
    const parsed = raw === '' ? null : Number(raw)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setEditing(false); return
    }
    setSaving(true)
    setValue(parsed)
    setEditing(false)
    try {
      await fetch('/api/products/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, costPrice: parsed }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          defaultValue={value ?? ''}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-24 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-sm text-right text-[var(--text-base)] focus:outline-none"
          autoFocus
        />
        <button onClick={save} className="text-emerald-500 hover:text-emerald-400" aria-label="Save">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-dim)]" aria-label="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={saving}
      className="border-b border-dashed border-transparent hover:border-[var(--border2)] cursor-text disabled:opacity-50"
      style={{ color: value && value > 0 ? 'var(--text-dim)' : 'var(--text-muted)' }}
      title="Tannarxni tahrirlash / Edit cost"
    >
      {value && value > 0 ? fmt(value) : <span className="opacity-70">+ tannarx</span>}
    </button>
  )
}
