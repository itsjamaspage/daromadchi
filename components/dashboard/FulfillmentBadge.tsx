// Small pill showing how a product/listing is fulfilled — same look
// wherever it appears (Products page, Stocks table, dashboard alerts).
// Returns null when the value is unknown so unsynced products don't
// display a misleading label.

const STYLES: Record<string, { bg: string; color: string; label: string }> = {
  fbs: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'FBS' },
  fbo: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', label: 'FBO' },
  fby: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', label: 'FBY' },
}

export default function FulfillmentBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null
  const key = type.toLowerCase()
  const s = STYLES[key]
  if (!s) return null
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
