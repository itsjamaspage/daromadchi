'use client'

import { useLang } from '@/app/providers'
import { resolveColor, COLOR_LABELS } from '@/lib/products/resolveColor'

// Small color pill shown next to the marketplace/fulfillment badges on a product
// row. The color is parsed from the product TITLE (see resolveColor). The label
// follows the current UI language. The tooltip is a native `title` attribute:
// the products table lives inside an overflow-x-auto container, where a CSS
// pop-up tooltip would clip at the row edge — `title` never clips.
export function ColorBadge({ title, note }: { title?: string | null; note?: string }) {
  const { lang } = useLang()
  const c = resolveColor(title)
  if (!c) return null

  const name = COLOR_LABELS[c.key][lang]
  const defaultNote =
    lang === 'ru' ? `${name} — вариант товара`
    : lang === 'en' ? `${name} — product variant`
    : `${name} rang — mahsulot varianti`
  const text = note ?? defaultNote

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded cursor-default"
      style={{ background: 'var(--bg-card2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      title={text}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: c.hex, boxShadow: c.ring ? 'inset 0 0 0 1px var(--border)' : undefined }}
      />
      {name}
    </span>
  )
}
