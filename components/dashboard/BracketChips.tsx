'use client'

interface Bracket {
  key: string
  label: string
  test: (value: number) => boolean
}

interface BracketChipsProps {
  label: string
  brackets: Bracket[]
  selected: string
  onChange: (key: string) => void
}

export const ALL_BRACKET = '__all__'

export function revenueBrackets(lang: 'uz' | 'ru' | 'en'): Bracket[] {
  const all = lang === 'ru' ? 'Все' : lang === 'uz' ? 'Barchasi' : 'All'
  return [
    { key: ALL_BRACKET, label: all, test: () => true },
    { key: 'lt100k', label: '< 100K', test: v => v < 100_000 },
    { key: '100k-500k', label: '100K – 500K', test: v => v >= 100_000 && v < 500_000 },
    { key: '500k-1m', label: '500K – 1M', test: v => v >= 500_000 && v < 1_000_000 },
    { key: 'gt1m', label: '> 1M', test: v => v >= 1_000_000 },
  ]
}

export default function BracketChips({ label, brackets, selected, onChange }: BracketChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>{label}:</span>
      {brackets.map(b => (
        <button key={b.key} onClick={() => onChange(b.key)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border"
          style={selected === b.key ? {
            background: 'var(--bg-card2)',
            color: 'var(--c1)',
            borderColor: 'var(--c1)',
          } : {
            color: 'var(--text-muted)',
            borderColor: 'var(--border)',
          }}>
          {b.label}
        </button>
      ))}
    </div>
  )
}
