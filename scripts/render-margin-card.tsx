/**
 * Render samples of the «Маржа после комиссии» KPI card in all three locales,
 * using the REAL KpiCard component and the REAL dashT strings — so the sample
 * can't drift from what ships. Two scenarios × three locales × light/dark.
 *
 * Run: node --import tsx scripts/render-margin-card.tsx > /tmp/margin-card.html
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrendingUp } from 'lucide-react'
import KpiCard, { type KpiBreakdownRow } from '../components/dashboard/KpiCard'
import { dashT } from '../lib/dashT'
import { formatSum } from '../lib/format-sum'

type Lang = 'ru' | 'uz' | 'en'
const LANGS: Lang[] = ['ru', 'uz', 'en']
const mpName = (mp: string) => ({ uzum: 'Uzum', yandex_market: 'Yandex Market' } as Record<string, string>)[mp] ?? mp

// Realistic figures from the reported dashboard: Uzum counted (200k, 44.5k fee →
// 155.5k margin), Yandex still awaiting settlement (115k).
function card(lang: Lang, scenario: 'counted_and_pending' | 'all_pending') {
  const t = dashT[lang]
  const d = t.dashboard

  if (scenario === 'all_pending') {
    // Everything awaiting settlement → margin 0, no breakdown, coverage only.
    const coverage = `${t.kpi.awaiting}: ${mpName('yandex_market')} (${formatSum(115_000)})`
    return <KpiCard title={d.marginAfterCommission} value={formatSum(0)} change={null}
      icon={TrendingUp} color="emerald" coverage={coverage} />
  }

  const counted = 200_000, fees = 44_500, margin = counted - fees
  const breakdown: KpiBreakdownRow[] = [
    { label: t.kpi.sales,  value: formatSum(counted) },
    { label: t.kpi.fees,   value: formatSum(fees), kind: 'minus' },
    { label: t.kpi.margin, value: formatSum(margin), kind: 'total' },
  ]
  const coverage = `${t.kpi.counted}: ${mpName('uzum')} · ${t.kpi.awaiting}: ${mpName('yandex_market')} (${formatSum(115_000)})`
  return <KpiCard title={d.marginAfterCommission} value={formatSum(margin)} change={92}
    icon={TrendingUp} color="emerald" breakdown={breakdown} coverage={coverage} />
}

const LIGHT = `--bg-card:#e8f0fd;--border:#cddaf0;--text-base:#191c1f;--text-muted:#191c1f;--text-dim:#2d3748;--c1:#0284c7`
const DARK  = `--bg-card:#1e1e1e;--border:rgba(255,255,255,0.08);--text-base:#fff;--text-muted:rgba(255,255,255,0.72);--text-dim:rgba(255,255,255,0.6);--c1:#fff`

function themeBlock(label: string, vars: string, ground: string) {
  const rows = LANGS.map(lang => `
    <div class="col">
      <div class="cap">${lang.toUpperCase()} · counted + pending</div>
      <div class="cell" style="${vars}">${renderToStaticMarkup(card(lang, 'counted_and_pending'))}</div>
      <div class="cap">${lang.toUpperCase()} · all pending</div>
      <div class="cell" style="${vars}">${renderToStaticMarkup(card(lang, 'all_pending'))}</div>
    </div>`).join('')
  return `<section style="background:${ground}"><h2 style="${vars};color:var(--text-base)">${label}</h2><div class="grid">${rows}</div></section>`
}

const html = `<!doctype html><meta charset="utf-8"><title>Margin card samples</title>
<style>
  body{margin:0;font:14px system-ui,sans-serif}
  section{padding:24px}
  h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px;opacity:.7}
  .grid{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:20px;max-width:900px}
  .col{display:flex;flex-direction:column;gap:8px}
  .cap{font-size:11px;opacity:.55;color:#888}
  .cell{}
</style>
${themeBlock('Light theme', LIGHT, '#83c0f7')}
${themeBlock('Dark theme', DARK, '#0b0b0b')}`

process.stdout.write(html)
