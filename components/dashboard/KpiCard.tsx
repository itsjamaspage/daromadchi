import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

/** One line of the arithmetic behind a headline figure. */
export interface KpiBreakdownRow {
  label: string
  value: string
  /** 'minus' prefixes a −; 'total' rules off and sets it in the base colour. */
  kind?: 'plus' | 'minus' | 'total'
}

interface KpiCardProps {
  title: string
  value: string
  /** small muted line under the value, e.g. "+1 bekor qilingan" */
  note?: string
  /**
   * The working behind `value`. A profit of 40 000 next to 200 000 of sales
   * reads as a bug until you can see the 130 000 of stock and 30 000 of fees
   * that produced it — so the card shows its arithmetic instead of asserting a
   * total. Laid out as a receipt, right-aligned and tabular, because that is
   * the shape a seller already knows how to read.
   */
  breakdown?: KpiBreakdownRow[]
  /** Says the figure is incomplete and why. Rendered in the warning colour. */
  warning?: string
  change?: number | null
  icon: LucideIcon
  color: 'violet' | 'emerald' | 'blue' | 'amber'
}

const colorMap = {
  violet:  { bgRgba: 'var(--bg-card2)',  color: 'var(--c1)' },
  emerald: { bgRgba: 'rgba(66,134,25,0.08)',   color: '#428619' },
  blue:    { bgRgba: 'rgba(55,108,213,0.08)',  color: '#376cd5' },
  amber:   { bgRgba: 'rgba(236,126,0,0.08)',   color: '#ec7e00' },
}

export default function KpiCard({ title, value, note, breakdown, warning, change, icon: Icon, color }: KpiCardProps) {
  const c = colorMap[color]
  const isPositive = (change ?? 0) >= 0

  return (
    <div
      className="rounded-[20px] p-5 transition-all"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `2px solid ${c.color}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bgRgba }}>
          <Icon className="w-5 h-5" style={{ color: c.color }} />
        </div>
        {change != null && (
          <span
            title="vs prior period"
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full cursor-default"
            style={{
              background: isPositive ? 'rgba(66,134,25,0.08)' : 'rgba(226,59,74,0.08)',
              color:      isPositive ? '#428619'              : '#e23b4a',
            }}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium mb-1 tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-base)' }}>
        {value}
      </p>
      {note && (
        <p className="text-[11px] font-medium mt-0.5" style={{ color: '#ef4444' }}>
          {note}
        </p>
      )}
      {breakdown && breakdown.length > 0 && (
        <dl className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          {breakdown.map(row => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 text-[11px]"
              style={row.kind === 'total'
                ? { marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: '1px solid var(--border)' }
                : undefined}
            >
              <dt style={{ color: 'var(--text-muted)' }}>{row.label}</dt>
              <dd
                className="tabular-nums"
                style={{
                  color: row.kind === 'total' ? 'var(--text-base)' : 'var(--text-dim)',
                  fontWeight: row.kind === 'total' ? 600 : 500,
                }}
              >
                {row.kind === 'minus' ? '−' : ''}{row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {warning && (
        <p className="text-[11px] font-medium mt-2" style={{ color: '#ef4444' }}>
          {warning}
        </p>
      )}
    </div>
  )
}
