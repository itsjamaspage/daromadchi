/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState, useMemo } from 'react'
import { Calculator, TrendingDown, AlertTriangle, Info, Zap } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

const UZUM_RATES = [5, 5, 6, 8, 8, 9, 7, 10, 10, 10, 11, 9, 12, 10, 6, 10]

// Wildberries UZ — exact rates from official WB commission table (commission.xlsx, WB warehouse / FBY)
const WB_CATS: { name: Record<string, string>; rate: number }[] = [
  { name: { uz: 'Smartfonlar',                    ru: 'Смартфоны',                         en: 'Smartphones'                     }, rate: 3    },
  { name: { uz: 'Planshetlar',                    ru: 'Планшеты',                          en: 'Tablets'                         }, rate: 5    },
  { name: { uz: 'Noutbuklar',                     ru: 'Ноутбуки',                          en: 'Laptops'                         }, rate: 5    },
  { name: { uz: 'Kompyuterlar',                   ru: 'Компьютеры',                        en: 'Desktop computers'               }, rate: 9.5  },
  { name: { uz: 'Aqlli soat va fitness',          ru: 'Смарт-часы и фитнес-трекеры',       en: 'Smartwatches & fitness trackers' }, rate: 14.5 },
  { name: { uz: 'Elektronika aksessuarlari',      ru: 'Аксессуары для электроники',        en: 'Electronic accessories'          }, rate: 20   },
  { name: { uz: 'Maishiy texnika',                ru: 'Бытовая техника',                   en: 'Home appliances'                 }, rate: 14   },
  { name: { uz: 'Kiyim',                          ru: 'Одежда',                            en: 'Clothing'                       }, rate: 23   },
  { name: { uz: 'Ichki kiyim',                    ru: 'Нижнее бельё',                      en: 'Underwear'                      }, rate: 23   },
  { name: { uz: 'Sport kiyimi',                   ru: 'Спортивная одежда',                 en: 'Sportswear'                     }, rate: 23   },
  { name: { uz: 'Poyabzal',                       ru: 'Обувь',                             en: 'Footwear'                       }, rate: 18   },
  { name: { uz: 'Sport jihozlari va aksessuarlar',ru: 'Спорттовары и аксессуары',          en: 'Sports equipment & accessories'  }, rate: 18   },
  { name: { uz: "Go'zallik va parvarish",         ru: 'Красота и уход',                    en: 'Beauty & care'                  }, rate: 18   },
  { name: { uz: 'Uy tekstili va interer',         ru: 'Текстиль для дома и декор',         en: 'Home textiles & interior decor'  }, rate: 19   },
  { name: { uz: "O'yinchoqlar",                   ru: 'Игрушки',                           en: 'Toys'                           }, rate: 18   },
  { name: { uz: 'Oziq-ovqat',                     ru: 'Продукты питания',                  en: 'Groceries'                      }, rate: 11   },
  { name: { uz: 'Avtomobil qismlari',             ru: 'Автозапчасти',                      en: 'Car parts & accessories'         }, rate: 8    },
  { name: { uz: 'Bolalar kiyimi va mahsulotlari', ru: 'Детская одежда и товары',           en: 'Baby clothing & products'        }, rate: 8    },
  { name: { uz: 'Boshqa',                         ru: 'Другое',                            en: 'Other'                          }, rate: 17   },
]

// Yandex Market Go UZ — category commissions (partner.market.yandex.uz official tariff table)
// Apple: 1.5% (explicit). Others: midpoint of official band per category.
const YANDEX_CATS: { name: Record<string, string>; rate: number }[] = [
  { name: { uz: 'Apple mahsulotlari', ru: 'Продукция Apple', en: 'Apple products' }, rate: 1.5 },
  { name: { uz: 'Smartfonlar va telefonlar', ru: 'Смартфоны и телефоны', en: 'Smartphones & phones' }, rate: 4 },
  { name: { uz: 'Noutbuk va kompyuterlar', ru: 'Ноутбуки и компьютеры', en: 'Laptops & computers' }, rate: 4 },
  { name: { uz: 'Elektronika va aksessuarlar', ru: 'Электроника и аксессуары', en: 'Electronics & accessories' }, rate: 5 },
  { name: { uz: 'Maishiy texnika', ru: 'Бытовая техника', en: 'Home appliances' }, rate: 6 },
  { name: { uz: 'Avtomobil va ehtiyot qismlar', ru: 'Автотовары и запчасти', en: 'Automotive & parts' }, rate: 8 },
  { name: { uz: "Go'zallik va parvarish", ru: 'Красота и уход', en: 'Beauty & care' }, rate: 10 },
  { name: { uz: 'Uy, oshxona va mebel', ru: 'Дом, кухня и мебель', en: 'Home, kitchen & furniture' }, rate: 11 },
  { name: { uz: 'Kiyim, poyabzal va sumkalar', ru: 'Одежда, обувь и сумки', en: 'Apparel, shoes & bags' }, rate: 12 },
]

type MP = 'uzum' | 'yandex' | 'wildberries'

const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] focus:ring-1 focus:ring-[var(--border)] transition-all"

export default function CalculatorPage() {
  const { lang } = useLang()
  const t = dashT[lang].calculator
  const [mp, setMp] = useState<MP>('uzum')
  const UZUM_CATEGORIES = t.categories.map((name, i) => ({ name, rate: UZUM_RATES[i], approx: false }))
  const YANDEX_CATEGORIES = YANDEX_CATS.map(c => ({ name: c.name[lang] ?? c.name.uz, rate: c.rate, approx: true }))
  const WB_CATEGORIES = WB_CATS.map(c => ({ name: c.name[lang] ?? c.name.uz, rate: c.rate, approx: false }))
  const CATEGORIES = mp === 'uzum' ? UZUM_CATEGORIES : mp === 'yandex' ? YANDEX_CATEGORIES : WB_CATEGORIES
  const isApprox = mp !== 'uzum'
  const [price,      setPrice]      = useState('')
  const [cost,       setCost]       = useState('')
  const [logistics,  setLogistics]  = useState('')
  const [adSpend,    setAdSpend]    = useState('')
  const [returnRate, setReturnRate] = useState('5')
  const [units,      setUnits]      = useState('100')
  const [catIdx,     setCatIdx]     = useState(0)
  const [volume,        setVolume]        = useState('')     // liters, for Uzum logistics fee
  const [payoutSched,   setPayoutSched]   = useState<'monthly'|'biweekly'|'weekly'|'daily'>('biweekly')

  const commission = CATEGORIES[catIdx].rate

  const result = useMemo(() => {
    const p  = parseFloat(price)      || 0
    const c  = parseFloat(cost)       || 0
    const l  = parseFloat(logistics)  || 0
    const ad = parseFloat(adSpend)    || 0
    const rr = parseFloat(returnRate) / 100
    const u  = Math.max(1, parseInt(units) || 1)
    if (p <= 0 || c <= 0) return null

    // Uzum platform logistics fee (volume-based, from 01.06.2026)
    const vol = parseFloat(volume) || 0
    const uzumLogFee = (mp === 'uzum' && vol > 0)
      ? Math.min(50000, vol <= 1 ? 5250 : 5250 + (Math.ceil(vol) - 1) * 250)
      : 0

    // Uzum payout schedule fee (charged on each withdrawal)
    const payoutRate = mp === 'uzum'
      ? ({ daily: 0.015, weekly: 0.01, biweekly: 0, monthly: 0 } as Record<string,number>)[payoutSched] ?? 0
      : 0
    const payoutFeeAmt = p * payoutRate

    // What the seller THINKS they made (naive)
    const naiveProfit      = (p - c) * u
    const naiveProfitUnit  = p - c

    // Deductions per unit
    const commAmt      = p * (commission / 100)
    const returnLoss   = p * rr                          // lost revenue on returns
    const returnLogist = l * rr                          // extra logistics for returns
    const netRevenue   = p * (1 - rr) - commAmt

    const realProfitUnit = netRevenue - c - l - (ad / u) - uzumLogFee - payoutFeeAmt
    const realProfit     = realProfitUnit * u

    const stolen         = naiveProfit - realProfit       // what Uzum/costs "steal"
    const stolenPct      = naiveProfit > 0 ? (stolen / naiveProfit) * 100 : 0
    const keepPct        = 100 - stolenPct

    const margin         = p > 0 ? (realProfitUnit / p) * 100 : 0
    const drr            = p * u > 0 ? (ad / (p * u)) * 100 : 0
    const roi            = c > 0 ? (realProfitUnit / c) * 100 : 0
    const breakeven      = c + l + commAmt + (ad / u) + (p * rr * 0.05) + uzumLogFee + payoutFeeAmt

    return {
      naiveProfitUnit, naiveProfit,
      realProfitUnit,  realProfit,
      stolen,          stolenPct, keepPct,
      commAmt, returnLoss, returnLogist,
      adPerUnit: ad / u,
      margin, drr, roi, breakeven,
      units: u, price: p, cost: c, logistics: l, adSpend: ad,
      uzumLogFee, payoutFeeAmt,
    }
  }, [price, cost, logistics, adSpend, returnRate, units, commission, volume, payoutSched, mp])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2">
            <Calculator className="w-6 h-6" style={{ color: 'var(--c1)' }} />
            {t.title}
          </h1>
        </div>
        <p className="text-[var(--text-muted)] text-sm">
          {t.subtitlePre} <strong className="text-[var(--text-base)]">{t.subtitleStrong}</strong> {t.subtitlePost}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Inputs ──────────────────────────────────────────────────── */}
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{t.productInfo}</h2>

          {/* Marketplace selector */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl w-fit">
            {([
              { id: 'uzum',        label: 'Uzum Market' },
              { id: 'yandex',      label: 'Yandex Market' },
              { id: 'wildberries', label: 'Wildberries' },
            ] as { id: MP; label: string }[]).map(m => (
              <button
                key={m.id}
                onClick={() => { setMp(m.id); setCatIdx(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mp === m.id
                    ? 'border border-[var(--border)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
                }`}
                style={mp === m.id ? { background: 'var(--bg-card2)', color: 'var(--c1)' } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.sellPrice}</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number"
                placeholder="890 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.cost}</label>
              <input value={cost} onChange={e => setCost(e.target.value)} type="number"
                placeholder="520 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.logistics}</label>
              <input value={logistics} onChange={e => setLogistics(e.target.value)} type="number"
                placeholder="25 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.adSpend}</label>
              <input value={adSpend} onChange={e => setAdSpend(e.target.value)} type="number"
                placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.returnRate}</label>
              <input value={returnRate} onChange={e => setReturnRate(e.target.value)} type="number"
                placeholder="5" min="0" max="100" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.monthlyUnits}</label>
              <input value={units} onChange={e => setUnits(e.target.value)} type="number"
                placeholder="100" min="1" className={inputCls} />
            </div>
          </div>

          {mp === 'uzum' && (
            <>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">
                  {lang === 'ru' ? 'Объём товара (литры)' : lang === 'en' ? 'Product volume (litres)' : 'Tovar hajmi (litr)'}
                </label>
                <input value={volume} onChange={e => setVolume(e.target.value)} type="number"
                  step="0.1" placeholder="1.5" className={inputCls} />
                {volume && parseFloat(volume) > 0 && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    {lang === 'ru' ? 'Логистика Uzum: ' : lang === 'en' ? 'Uzum logistics: ' : 'Uzum logistika: '}
                    {fmt(Math.min(50000, parseFloat(volume) <= 1 ? 5250 : 5250 + (Math.ceil(parseFloat(volume)) - 1) * 250))} so&apos;m
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">
                  {lang === 'ru' ? 'График выплат' : lang === 'en' ? 'Payout schedule' : 'Chiqarish grafigi'}
                </label>
                <select value={payoutSched} onChange={e => setPayoutSched(e.target.value as typeof payoutSched)} className={inputCls}>
                  <option value="monthly">{lang === 'ru' ? 'Ежемесячно — 0%' : lang === 'en' ? 'Monthly — 0%' : 'Oyda bir — 0%'}</option>
                  <option value="biweekly">{lang === 'ru' ? 'Раз в 2 нед — 0%' : lang === 'en' ? 'Bi-weekly — 0%' : 'Har 2 haftada — 0%'}</option>
                  <option value="weekly">{lang === 'ru' ? 'Еженедельно — 1%' : lang === 'en' ? 'Weekly — 1%' : 'Har hafta — 1%'}</option>
                  <option value="daily">{lang === 'ru' ? 'Ежедневно — 1.5%' : lang === 'en' ? 'Daily — 1.5%' : 'Har kuni — 1.5%'}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.category}</label>
            <select value={catIdx} onChange={e => setCatIdx(Number(e.target.value))} className={inputCls}>
              {CATEGORIES.map((c, i) => (
                <option key={c.name} value={i}>{c.name} — {c.rate}% {t.commissionSuffix}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-card2)',  borderColor: 'var(--border)' }}>
            <Info className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c1)' }} />
            <p className="text-xs text-[var(--text-base)]">
              {mp === 'uzum' ? 'Uzum' : mp === 'yandex' ? 'Yandex Market' : 'Wildberries'} {lang === 'ru' ? 'комиссия:' : lang === 'en' ? 'commission:' : 'komissiyasi:'}
              {' '}<span className="font-semibold" style={{ color: 'var(--c1)' }}>{isApprox ? '~' : ''}{commission}%</span> · {CATEGORIES[catIdx].name}
              {isApprox && <span className="ml-1 font-medium text-amber-700">({lang === 'ru' ? 'приблизительно' : lang === 'en' ? 'approximate' : 'taxminiy'})</span>}
            </p>
          </div>
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] gap-3">
              <Calculator className="w-10 h-10 text-[var(--text-dim)]" />
              <p className="text-[var(--text-muted)] text-sm text-center">{t.enterToSee}<br/>{t.enterPriceCost}</p>
            </div>
          ) : (
            <>
              {/* ── REALITY CHECK ─────────────────────────────────────── */}
              <div className="rounded-2xl overflow-hidden border border-[var(--border2)]">
                <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2" style={{ background: 'var(--bg-card2)' }}>
                  <Zap className="w-4 h-4" style={{ color: 'var(--c1)' }} />
                  <span className="text-[var(--text-base)] font-bold text-sm">{t.realityCheck}</span>
                </div>

                <div className="bg-[var(--bg-card2)] p-5 space-y-4">
                  {/* Two-column comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-[var(--text-muted)] text-[11px] mb-1">{t.youThink}</p>
                      <p className="text-[var(--text-base)] font-bold text-xl">{fmt(result.naiveProfit)}</p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-0.5">so'm</p>
                    </div>
                    <div className={`border rounded-xl p-4 ${result.realProfit > 0 ? 'bg-emerald-500/[0.08] border-emerald-500/25' : 'bg-red-500/[0.08] border-red-500/25'}`}>
                      <p className="text-[var(--text-muted)] text-[11px] mb-1">{t.yourReal}</p>
                      <p className={`font-bold text-xl ${result.realProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(result.realProfit)}
                      </p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-0.5">so'm</p>
                    </div>
                  </div>

                  {/* The "stolen" line */}
                  <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-red-400 text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t.uzumTook}
                      </span>
                      <span className="text-red-400 font-bold text-sm">{fmt(result.stolen)} so'm</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, result.keepPct))}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1.5">
                      <span className="text-emerald-400">{t.kept} {result.keepPct.toFixed(0)}%</span>
                      <span className="text-red-400">{t.gone} {result.stolenPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Cost breakdown per unit */}
                  <div className="space-y-1.5">
                    <p className="text-[var(--text-muted)] text-xs font-medium">{t.breakdownTitle}</p>
                    {[
                      { label: `${t.bdCommission} (${commission}%)`, value: result.commAmt,     color: 'bg-red-500' },
                      { label: t.bdCost,                            value: result.cost,         color: 'bg-orange-500' },
                      { label: t.bdLogistics,                       value: result.logistics,    color: 'bg-amber-500' },
                      ...(result.uzumLogFee > 0 ? [{ label: lang === 'ru' ? 'Логистика Uzum' : lang === 'en' ? 'Uzum logistics' : 'Uzum logistika', value: result.uzumLogFee, color: 'bg-orange-500' }] : []),
                      ...(result.payoutFeeAmt > 0 ? [{ label: lang === 'ru' ? 'Услуга вывода' : lang === 'en' ? 'Payout fee' : 'Chiqarish xizmati', value: result.payoutFeeAmt, color: 'bg-pink-500' }] : []),
                      { label: t.bdReturnLoss,                      value: result.returnLoss * (parseFloat(returnRate)/100), color: 'bg-rose-500' },
                      { label: t.bdAd,                              value: result.adPerUnit,    color: 'bg-[var(--c1)]' },
                    ].filter(r => r.value > 0).map(r => {
                      const pct = result.price > 0 ? (r.value / result.price) * 100 : 0
                      return (
                        <div key={r.label} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.color}`} />
                          <span className="text-[var(--text-muted)] flex-1">{r.label}</span>
                          <span className="text-[var(--text-dim)] tabular-nums">{fmt(r.value)} so'm</span>
                          <span className="text-[var(--text-muted)] w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                    <div className="border-t border-[var(--border)] pt-1.5 flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                      <span className="text-[var(--text-base)] font-semibold flex-1">{t.netProfitUnit}</span>
                      <span className={`font-bold tabular-nums ${result.realProfitUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(result.realProfitUnit)} so'm
                      </span>
                      <span className={`w-10 text-right tabular-nums font-semibold ${result.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: t.margin,    value: `${result.margin.toFixed(1)}%`,    good: result.margin >= 20,  bad: result.margin < 5   },
                  { label: t.roi,       value: `${result.roi.toFixed(0)}%`,        good: result.roi >= 30,     bad: result.roi < 0      },
                  { label: t.drr,       value: `${result.drr.toFixed(1)}%`,        good: result.drr < 15,      bad: result.drr > 25     },
                  { label: t.breakeven, value: `${fmt(result.breakeven)} s'm`, good: result.price > result.breakeven, bad: result.price <= result.breakeven },
                ].map(({ label, value, good, bad }) => (
                  <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[var(--text-muted)] text-[10px] mb-0.5">{label}</p>
                    <p className={`text-base font-bold ${good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-amber-400'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {result.realProfit <= 0 && (
                <div className="flex items-start gap-2 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnLossPre} <strong>{fmt(Math.abs(result.realProfit))} {t.warnLossStrong}</strong> {t.warnLossMid} <strong>{fmt(result.breakeven)} {t.warnLossEnd}</strong></span>
                </div>
              )}
              {result.margin > 0 && result.margin < 15 && (
                <div className="flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnMarginPre} {result.margin.toFixed(1)}% {t.warnMarginPost}</span>
                </div>
              )}
              {result.drr > 25 && (
                <div className="flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnDrrPre} {result.drr.toFixed(1)}% {t.warnDrrPost}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
