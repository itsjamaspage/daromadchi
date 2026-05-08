import { getT } from '@/lib/server-i18n'
import { Calculator, Info } from 'lucide-react'
import UnitEconomicsTable from '@/components/dashboard/UnitEconomicsTable'
import { getUnitEconomicsItems, getUnitEcoSettings } from '@/lib/db/unit-economics'

export default async function UnitEconomicsPage() {
  const [t, items, settings] = await Promise.all([
    getT(),
    getUnitEconomicsItems(),
    getUnitEcoSettings(),
  ])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-white">{d.unitEcoTitle}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {items.length} {d.productCount}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{d.unitEcoSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://uzum.uz" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Calculator className="w-4 h-4" /> {d.openUzum}
          </a>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300/80 leading-relaxed">{d.unitEcoNote}</p>
      </div>

      <UnitEconomicsTable items={items} defaultSettings={settings} />
    </div>
  )
}
