import { getT } from '@/lib/server-i18n'
import { Calculator, Info } from 'lucide-react'
import UnitEconomicsTable from '@/components/dashboard/UnitEconomicsTable'
import { getUnitEconomicsItems, getUnitEcoSettings } from '@/lib/db/unit-economics'

export default async function UnitEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [t, items, settings, sp] = await Promise.all([
    getT(),
    getUnitEconomicsItems(),
    getUnitEcoSettings(),
    searchParams,
  ])
  const d = t.dashboard

  const fromExtension = sp.source ? {
    source:     String(sp.source     || ''),
    title:      String(sp.title      || ''),
    price:      Number(sp.price      || 0),
    commPct:    Number(sp.commPct    || 0),
    commission: Number(sp.commission || 0),
    delivery:   Number(sp.delivery   || 0),
    acquiring:  Number(sp.acquiring  || 0),
    adSpend:    Number(sp.adSpend    || 0),
    tax:        Number(sp.tax        || 0),
    packaging:  Number(sp.packaging  || 0),
    profit:     Number(sp.profit     || 0),
    margin:     Number(sp.margin     || 0),
    roi:        Number(sp.roi        || 0),
    url:        String(sp.url        || ''),
    productId:  String(sp.productId  || ''),
  } : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.unitEcoTitle}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {items.length} {d.productCount}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.unitEcoSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://uzum.uz" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Calculator className="w-4 h-4" /> {d.openUzum}
          </a>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">{d.unitEcoNote}</p>
      </div>

      <UnitEconomicsTable items={items} defaultSettings={settings} fromExtension={fromExtension} />
    </div>
  )
}
