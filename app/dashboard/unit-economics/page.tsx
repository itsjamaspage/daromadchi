import { getT, getLang } from '@/lib/server-i18n'
import { Info, Download, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import UnitEconomicsTable from '@/components/dashboard/UnitEconomicsTable'
import { getUnitEconomicsItems, getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { MarketplaceType } from '@/lib/types'

export default async function UnitEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [t, lang, items, settings, sp] = await Promise.all([
    getT(),
    getLang(),
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
    roi:           str(sp.roi) ? num(sp.roi) : 0,
    sku:           str(sp.productId) || undefined,
  } : null

  const extTitle = lang === 'ru' ? 'Установите расширение для браузера'
    : lang === 'en' ? 'Install the browser extension'
    : 'Brauzer kengaytmasini o\'rnating'

  const extDesc = lang === 'ru'
    ? 'Расширение работает в Chrome, Edge и Brave. Откройте карточку товара на Uzum.uz или WB и добавьте продукт одним нажатием — все данные попадут сюда автоматически.'
    : lang === 'en'
    ? 'Works in Chrome, Edge and Brave. Open any product on Uzum.uz or WB and add it with one click — all data appears here automatically.'
    : 'Chrome, Edge va Brave\'da ishlaydi. Uzum.uz yoki WB\'da mahsulot kartasini oching va bir tugma bilan qo\'shing — barcha ma\'lumotlar avtomatik tushadi.'

  const extBtn = lang === 'ru' ? 'Установить' : lang === 'en' ? 'Install now' : 'O\'rnatish'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.unitEcoTitle}</h1>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border-2" style={{ background: 'var(--bg-card2)',  borderColor: 'var(--border)', color: 'var(--c1)' }}>
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: 'var(--bg-card2)', border: '2px solid var(--border)' }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <Download className="w-4 h-4 text-[var(--c1)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-base)] mb-0.5">{extTitle}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{extDesc}</p>
          </div>
        </div>
        <Link href="/extension"
          className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded-xl"
          style={{ background: '#ffffff', color: '#0e1b2e', border: '2px solid rgba(255,255,255,0.7)' }}>
          {extBtn}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <UnitEconomicsTable items={items} defaultSettings={settings} fromExtension={fromExtension} />
    </div>
  )
}
