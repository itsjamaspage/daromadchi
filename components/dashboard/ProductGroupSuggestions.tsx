'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Check, X } from 'lucide-react'
import { useLang } from '@/app/providers'
import { resolveColor } from '@/lib/products/resolveColor'
import type { MarketplaceType } from '@/lib/types'

// Marketplace pill styling — mirrors StocksTable's MP_META so the UZ/YM badges
// here match the rows below.
const MP_META: Record<string, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',        short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'  },
  yandex_market: { label: 'Yandex',      short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
}

type Signals = {
  colorMatch?: boolean
  categoryMatch?: boolean
  titleSim?: number
  priceRatio?: number | null
  barcodeMatch?: boolean
}

type Suggestion = {
  id: string
  a_match_key: string
  b_match_key: string
  a_title: string | null
  b_title: string | null
  a_marketplace: MarketplaceType | null
  b_marketplace: MarketplaceType | null
  score: string | number
  tier: 'strong' | 'likely' | 'weak' | string
  signals: Signals | null
}

const TIER_STYLE: Record<string, { color: string; bg: string }> = {
  strong: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  likely: { color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  weak:   { color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
}

function MpBadge({ mp }: { mp: MarketplaceType | null }) {
  const m = mp ? MP_META[mp] : null
  if (!m) return null
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.short}
    </span>
  )
}

// A single product side: marketplace badge + title (or a "deleted" placeholder
// when the product row was removed and the FK went SET NULL).
function Side({ title, mp, missingLabel }: { title: string | null; mp: MarketplaceType | null; missingLabel: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <MpBadge mp={mp} />
      <span className="text-sm truncate" style={{ color: title ? 'var(--text-base)' : 'var(--text-muted)' }}>
        {title ?? missingLabel}
      </span>
    </div>
  )
}

export default function ProductGroupSuggestions() {
  const { lang } = useLang()
  const router = useRouter()
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const T = {
    title:     lang === 'ru' ? 'Предложенные группировки' : lang === 'en' ? 'Suggested groupings' : 'Tavsiya etilgan guruhlar',
    subtitle:  lang === 'ru' ? 'Один и тот же товар на разных площадках? Подтвердите, чтобы объединить остатки.'
             : lang === 'en' ? 'The same product across marketplaces? Approve to merge their stock.'
             : 'Turli platformalarda bir xil mahsulotmi? Qoldiqlarni birlashtirish uchun tasdiqlang.',
    approve:   lang === 'ru' ? 'Подтвердить' : lang === 'en' ? 'Approve' : 'Tasdiqlash',
    reject:    lang === 'ru' ? 'Отклонить'  : lang === 'en' ? 'Reject'  : 'Rad etish',
    matchedOn: lang === 'ru' ? 'Совпадение:' : lang === 'en' ? 'Matched on:' : 'Mos keldi:',
    deleted:   lang === 'ru' ? '(товар удалён)' : lang === 'en' ? '(product deleted)' : '(mahsulot o‘chirilgan)',
    sTitle:    lang === 'ru' ? 'название' : lang === 'en' ? 'title' : 'nomi',
    sColor:    lang === 'ru' ? 'один цвет' : lang === 'en' ? 'same color' : 'bir rang',
    sCategory: lang === 'ru' ? 'одна категория' : lang === 'en' ? 'same category' : 'bir kategoriya',
    sBarcode:  lang === 'ru' ? 'штрихкод' : lang === 'en' ? 'barcode' : 'shtrix-kod',
    sPrice:    lang === 'ru' ? 'цена' : lang === 'en' ? 'price' : 'narx',
    tier: (tr: string) =>
      tr === 'strong' ? (lang === 'ru' ? 'высокая' : lang === 'en' ? 'strong' : 'yuqori')
      : tr === 'likely' ? (lang === 'ru' ? 'вероятная' : lang === 'en' ? 'likely' : 'ehtimoliy')
      : (lang === 'ru' ? 'слабая' : lang === 'en' ? 'weak' : 'past'),
  }

  useEffect(() => {
    let alive = true
    fetch('/api/product-groups/suggestions?status=pending')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (alive) setItems(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [])

  async function act(id: string, action: 'approve' | 'reject') {
    if (busyId) return                       // in-flight guard: one action at a time
    setBusyId(id)
    try {
      const res = await fetch('/api/product-groups/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) return                    // leave the card in place so the user can retry
      setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))
      router.refresh()                       // re-run the server page → остатки regroups
    } finally {
      setBusyId(null)
    }
  }

  // Hidden entirely until loaded AND non-empty (your "no pop-up nagging" call).
  if (!items || items.length === 0) return null

  function matchedChips(s: Suggestion): string[] {
    const sig = s.signals ?? {}
    const chips: string[] = []
    if (typeof sig.titleSim === 'number') chips.push(`${T.sTitle} ${sig.titleSim.toFixed(2)}`)
    if (sig.colorMatch) chips.push(T.sColor)
    if (sig.categoryMatch) chips.push(T.sCategory)
    if (sig.barcodeMatch) chips.push(T.sBarcode)
    if (sig.priceRatio != null) chips.push(`${T.sPrice} ×${sig.priceRatio.toFixed(2)}`)
    return chips
  }

  return (
    <section className="rounded-2xl border p-4"
      style={{ background: 'var(--bg-card2)', borderColor: 'var(--border2)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-4 h-4" style={{ color: 'var(--c1)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{T.title}</h2>
        <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-[11px] font-bold rounded-full"
          style={{ background: 'var(--c1)', color: 'var(--on-c1)' }}>
          {items.length}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{T.subtitle}</p>

      <ul className="space-y-2">
        {items.map((s) => {
          const color = resolveColor(s.a_title) ?? resolveColor(s.b_title)
          const tier = TIER_STYLE[s.tier] ?? TIER_STYLE.weak
          const busy = busyId === s.id
          const chips = matchedChips(s)
          return (
            <li key={s.id} className="rounded-xl border p-3"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Side title={s.a_title} mp={s.a_marketplace} missingLabel={T.deleted} />
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>⇄</span>
                  <Side title={s.b_title} mp={s.b_marketplace} missingLabel={T.deleted} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => act(s.id, 'approve')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(22,163,74,0.14)', color: '#16a34a' }}
                  >
                    <Check className="w-3.5 h-3.5" /> {T.approve}
                  </button>
                  <button
                    onClick={() => act(s.id, 'reject')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
                  >
                    <X className="w-3.5 h-3.5" /> {T.reject}
                  </button>
                </div>
              </div>

              {/* Why it matched — color swatch, tier/score, and the fired signals,
                  so a decision is informed instead of a rubber-stamp. */}
              <div className="flex items-center gap-2 flex-wrap mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {color && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color.hex, boxShadow: color.ring ? 'inset 0 0 0 1px var(--border)' : undefined }} />
                  </span>
                )}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: tier.bg, color: tier.color }}>
                  {T.tier(s.tier)} · {Number(s.score).toFixed(2)}
                </span>
                {chips.length > 0 && (
                  <span>{T.matchedOn} {chips.join(' · ')}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
