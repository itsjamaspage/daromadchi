'use client'

/**
 * One inline-editable number cell, for every seller-owned value on the
 * Analytics table: cost, price override, stock override.
 *
 * It began as EditableCostCell and is generalised rather than copied, because
 * three near-identical cells is how two of them end up behaving differently.
 *
 * ── What "override" means here ──────────────────────────────────────────────
 * Cost is simply ours — the marketplace never reports it. Price and stock ARE
 * reported, and both syncs rewrite them (selling_price on every heavy pass,
 * stock_quantity every 15 minutes), so the seller's number lives in a separate
 * column and is layered on top for display. Clearing the field removes the
 * override and the marketplace's own number comes back — an edit hides the
 * real value, it never destroys it.
 *
 * LOCAL ONLY. Saving here writes one Daromadchi row. Nothing about it reaches
 * Uzum or Yandex.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Pencil } from 'lucide-react'

export type EditableField = 'costPrice' | 'priceOverride' | 'stockOverride'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}
function fmtInt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

interface Props {
  productId: string
  field: EditableField
  /** Current effective value: the override when set, otherwise the
   *  marketplace's own number (or null for a cost never entered). */
  value: number | null
  /** True when `value` came from a seller override rather than the
   *  marketplace. Drives the marker that tells the two apart. */
  overridden?: boolean
  /** Money renders with the currency suffix; stock is a bare count. */
  kind?: 'money' | 'int'
  /** Shown when there is nothing to display and no override — e.g. "+ cost". */
  emptyLabel?: string
  title?: string
}

export default function EditableValueCell({
  productId, field, value, overridden = false, kind = 'money', emptyLabel, title,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shown, setShown] = useState<number | null>(value)
  const [isOverride, setIsOverride] = useState(overridden)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save() {
    const raw = inputRef.current?.value.trim() ?? ''
    // Empty clears the value. For price and stock that restores the
    // marketplace's number; for cost it goes back to "not entered".
    const parsed = raw === '' ? null : Number(raw)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) { setEditing(false); return }
    if (parsed !== null && field === 'stockOverride' && !Number.isInteger(parsed)) { setEditing(false); return }

    setSaving(true)
    setEditing(false)
    // Optimistic: the number changes under the cursor immediately, and
    // router.refresh() below re-runs the server component so profit, margin,
    // stock value and the KPI cards recompute from the saved value.
    setShown(parsed)
    setIsOverride(field !== 'costPrice' && parsed !== null)
    try {
      const res = await fetch('/api/products/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Only this one key is sent, so a price edit cannot touch the cost.
        body: JSON.stringify({ productId, [field]: parsed }),
      })
      // On failure put the old value back rather than leaving a number on
      // screen that was never saved.
      if (!res.ok) { setShown(value); setIsOverride(overridden); return }
      router.refresh()
    } catch {
      setShown(value); setIsOverride(overridden)
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
          step={field === 'stockOverride' ? 1 : 'any'}
          min={0}
          defaultValue={shown ?? ''}
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

  const hasValue = shown !== null && shown > 0
  const label = hasValue ? (kind === 'int' ? fmtInt(shown!) : fmtMoney(shown!)) : null

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={saving}
      className="group/edit cursor-text disabled:opacity-50 inline-flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-input)] transition-colors"
      style={{ color: hasValue ? 'var(--text-dim)' : 'var(--text-muted)' }}
      title={title}
      aria-label={title}
    >
      {label ?? <span className="opacity-70">{emptyLabel ?? '—'}</span>}
      {/* A dot, not a colour change: the number must stay readable, and the
          seller needs to know at a glance which figures are theirs rather than
          the marketplace's — otherwise an override looks like live data. */}
      {isOverride && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--c1)' }} aria-hidden />
      )}
      {/* The pencil is always rendered, not hover-only. A dashed underline that
          appears on hover tells you a cell is editable only once you have
          already guessed it might be — and on touch there is no hover at all,
          so the affordance was invisible on a phone. Low opacity keeps a
          column of them from competing with the numbers. */}
      <Pencil
        className="w-3 h-3 shrink-0 opacity-40 group-hover/edit:opacity-100 transition-opacity"
        style={{ color: 'var(--c1)' }}
        aria-hidden
      />
    </button>
  )
}
