import { getT } from '@/lib/server-i18n'
import { Info, Puzzle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
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
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border-2" style={{ background: 'rgba(131,192,249,0.15)', borderColor: 'rgba(131,192,249,0.7)', color: 'var(--c1)' }}>
              {items.length} {d.productCount}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.unitEcoSubtitle}</p>
        </div>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--c1)]" />
        <p className="text-xs leading-relaxed text-[var(--text-base)]">{d.unitEcoNote}</p>
      </div>

      {/* Extension install CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl px-5 py-4 border-2"
        style={{ background: 'rgba(131,192,249,0.08)', borderColor: 'rgba(131,192,249,0.35)' }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(131,192,249,0.15)', border: '1px solid rgba(131,192,249,0.3)' }}>
            <Puzzle className="w-4 h-4 text-[var(--c1)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-base)] mb-0.5">
              {(t.lang as string) === 'ru' ? 'Установите расширение для браузера' :
               (t.lang as string) === 'en' ? 'Install the browser extension' :
               'Brauzer kengaytmasini o\'rnating'}
            </p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {(t.lang as string) === 'ru'
                ? 'Расширение работает в Chrome, Edge и Brave. Откройте карточку на Uzum.uz или WB и добавьте товар одним нажатием — все данные попадут сюда автоматически.'
                : (t.lang as string) === 'en'
                ? 'Works in Chrome, Edge and Brave. Open any product on Uzum.uz or WB and add it with one click — all data lands here automatically.'
                : 'Chrome, Edge va Brave\'da ishlaydi. Uzum.uz yoki WB\'da mahsulot kartasini oching va bir tugma bilan qo\'shing — barcha ma\'lumotlar avtomatik tushadi.'}
            </p>
          </div>
        </div>
        <Link href="/extension"
          className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors hover:opacity-90"
          style={{ background: '#83c0f9', color: '#131321' }}>
          {(t.lang as string) === 'ru' ? 'Установить' : (t.lang as string) === 'en' ? 'Install now' : 'O\'rnatish'}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <UnitEconomicsTable items={items} defaultSettings={settings} fromExtension={fromExtension} />
    </div>
  )
}
