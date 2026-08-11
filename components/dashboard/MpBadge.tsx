import type { MarketplaceType } from '@/lib/types'

// Shared marketplace-code chip. Used on the Products table and the
// Alerts table so rows with identical SKUs across marketplaces are
// visually distinguishable (YM vs UZ).
const MP_META: Record<MarketplaceType, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',          short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { label: 'Yandex Market', short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
}

export { MP_META }

export default function MpBadge({ mp }: { mp: MarketplaceType }) {
  const m = MP_META[mp]
  if (!m) return null
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.color }}
      title={m.label}
    >
      {m.short}
    </span>
  )
}
