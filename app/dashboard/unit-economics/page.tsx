import { getT } from '@/lib/server-i18n'
import { Info } from 'lucide-react'
import UnitEconomicsTable from '@/components/dashboard/UnitEconomicsTable'
import { getUnitEconomicsItems, getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { MarketplaceType } from '@/lib/types'

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

  function str(v: string | string[] | undefined) { return v ? String(v) : '' }
  function num(v: string | string[] | undefined) { return parseFloat(str(v)) || 0 }

  const sourceRaw = str(sp.source)
  const marketplace: MarketplaceType =
    sourceRaw === 'wb' ? 'wildberries' :
    sourceRaw === 'yandex_market' ? 'yandex_market' : 'uzum'

  const fromExtension = sourceRaw ? {
    title:         str(sp.title) || 'Mahsulot',
    productUrl:    str(sp.url),
    marketplace,
    sellingPrice:  num(sp.price),
    costPrice:     0,
    commissionPct: num(sp.commPct),
    commission:    num(sp.commission),
    delivery:      num(sp.delivery),
    lastMile:      0,
    acquiring:     num(sp.acquiring),
    adSpend:       num(sp.adSpend),
    tax:           num(sp.tax),
    netProfit:     num(sp.profit),
    margin:        num(sp.margin),
    roi:           str(sp.roi) ? num(sp.roi) : null,
    sku:           str(sp.productId) || undefined,
  } : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.unitEcoTitle}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'rgba(131,192,249,0.12)', borderColor: 'rgba(131,192,249,0.30)', color: 'var(--c1)' }}>
              {items.length} {d.productCount}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.unitEcoSubtitle}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-info)' }}>{d.unitEcoNote}</p>
      </div>

      <UnitEconomicsTable items={items} defaultSettings={settings} fromExtension={fromExtension} />
    </div>
  )
}
