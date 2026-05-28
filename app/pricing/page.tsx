'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, X, Zap, TrendingUp, ArrowRight } from 'lucide-react'
import { useTheme } from '../providers'

// TODO: replace with your personal Telegram @username for paid plan CTAs
const SALES_TELEGRAM = 'daromadchii_bot'

const MONTHLY = { free: 0, pro: 149000, pro_plus: 349000 }
const ANNUAL  = { free: 0, pro: Math.round(149000 * 10), pro_plus: Math.round(349000 * 10) }

function fmt(n: number) {
  return n.toLocaleString('uz-UZ') + " so'm"
}

const FEATURES: { label: string; free: boolean | string; pro: boolean | string; pro_plus: boolean | string }[] = [
  { label: "Do'kon soni",              free: '1 ta',     pro: '3 ta',      pro_plus: '5 ta'      },
  { label: 'Buyurtmalar tarixi',       free: '7 kun',    pro: 'Cheksiz',   pro_plus: 'Cheksiz'   },
  { label: 'Uzum Market',              free: true,       pro: true,        pro_plus: true         },
  { label: 'Yandex Market',            free: true,       pro: true,        pro_plus: true         },
  { label: 'Real vaqt sinxronizatsiya',free: false,      pro: true,        pro_plus: true         },
  { label: 'Telegram xabarnomalar',    free: false,      pro: true,        pro_plus: true         },
  { label: 'Kunlik hisobot (Telegram)',free: false,      pro: true,        pro_plus: true         },
  { label: 'Mahsulot zaxira xabarlari',free: false,      pro: true,        pro_plus: true         },
  { label: 'Savdo pasayishi xabarlari',free: false,      pro: true,        pro_plus: true         },
  { label: 'Chrome kengayma',          free: true,       pro: true,        pro_plus: true         },
  { label: 'Unit-ekonomika kalkulyator',free: true,      pro: true,        pro_plus: true         },
  { label: 'AI savdo tahlili',         free: false,      pro: false,       pro_plus: true         },
  { label: 'Raqobatchi narx kuzatish', free: false,      pro: false,       pro_plus: true         },
  { label: 'Hisobotlarni eksport (CSV)',free: false,     pro: false,       pro_plus: true         },
  { label: 'Ustuvor qo\'llab-quvvatlash',free: false,   pro: false,       pro_plus: true         },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="w-4 h-4 text-emerald-400 mx-auto" />
  if (value === false) return <X     className="w-4 h-4 text-slate-600 mx-auto"   />
  return <span className="text-xs font-semibold" style={{ color: 'var(--text-base)' }}>{value}</span>
}

export default function PricingPage() {
  const { theme } = useTheme()
  const [annual, setAnnual]  = useState(false)

  const card  = theme === 'dark' ? '#0e0e1a' : '#ffffff'
  const card2 = theme === 'dark' ? '#13131f' : '#f8f8ff'

  const prices = annual ? ANNUAL : MONTHLY

  return (
    <div className="min-h-screen py-20 px-4 sm:px-6" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto backdrop-blur-xl rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl border"
            style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
            </Link>
            <Link href="/login"
              className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/25">
              Kirish <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto pt-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
            <Zap className="w-3.5 h-3.5" /> Narx rejalar
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4" style={{ color: 'var(--text-base)' }}>
            O'zingizga mos{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              rejani tanlang
            </span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Uzum va Yandex Market savdongizni bepul boshlang. Tayyor bo'lgach — Pro ga o'ting.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className="text-sm font-medium" style={{ color: annual ? 'var(--text-muted)' : 'var(--text-base)' }}>
              Oylik
            </span>
            <button
              onClick={() => setAnnual(a => !a)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-violet-600' : 'bg-slate-700'}`}
              aria-label="Toggle annual billing"
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${annual ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: annual ? 'var(--text-base)' : 'var(--text-muted)' }}>
              Yillik
              <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                2 oy tekin
              </span>
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">

          {/* Free */}
          <div className="rounded-2xl p-7 border flex flex-col" style={{ background: card, borderColor: 'var(--border)' }}>
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-base)' }}>Bepul</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Boshlash uchun</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black" style={{ color: 'var(--text-base)' }}>0</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>so'm / oy</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {['1 ta do\'kon', '7 kun tarix', 'Uzum + Yandex Market', 'Chrome kengayma', 'Unit-eko kalkulyator'].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/login"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold border transition-all hover:border-violet-500/50"
              style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
              Boshlash
            </Link>
          </div>

          {/* Pro — highlighted */}
          <div className="relative rounded-2xl p-7 border flex flex-col shadow-xl shadow-violet-500/10"
            style={{ background: card2, borderColor: 'rgba(139,92,246,0.4)' }}>
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg shadow-violet-500/30 whitespace-nowrap">
                ⭐ Eng mashhur
              </span>
            </div>
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1 text-violet-400">Pro</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                {annual ? `${fmt(ANNUAL.pro / 12)} / oy, yillik to'lov` : 'O'sib borayotgan sotuvchilar uchun'}
              </p>
              <div className="flex items-baseline gap-1">
                {annual
                  ? <>
                      <span className="text-4xl font-black text-violet-400">{fmt(Math.round(ANNUAL.pro / 12))}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ oy</span>
                    </>
                  : <>
                      <span className="text-4xl font-black text-violet-400">{fmt(MONTHLY.pro)}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ oy</span>
                    </>
                }
              </div>
              {annual && (
                <p className="text-xs mt-1 text-emerald-400">
                  Yillik: {fmt(ANNUAL.pro)} — 2 oy tekin!
                </p>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                '3 ta do\'kon',
                'Cheksiz tarix',
                'Telegram xabarnomalar',
                'Kunlik hisobot',
                'Real vaqt sinxronizatsiya',
                'Mahsulot & savdo xabarlari',
                'Chrome kengayma',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-base)' }}>
                  <Check className="w-4 h-4 text-violet-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <a href={`https://t.me/${SALES_TELEGRAM}`} target="_blank" rel="noopener noreferrer"
              className="w-full text-center py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-violet-500/25">
              Boshlash →
            </a>
          </div>

          {/* Pro+ */}
          <div className="rounded-2xl p-7 border flex flex-col" style={{ background: card, borderColor: 'var(--border)' }}>
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-base)' }}>
                Pro<span className="text-violet-400">+</span>
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                {annual ? `${fmt(Math.round(ANNUAL.pro_plus / 12))} / oy, yillik to'lov` : 'Katta sotuvchilar uchun'}
              </p>
              <div className="flex items-baseline gap-1">
                {annual
                  ? <>
                      <span className="text-4xl font-black" style={{ color: 'var(--text-base)' }}>{fmt(Math.round(ANNUAL.pro_plus / 12))}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ oy</span>
                    </>
                  : <>
                      <span className="text-4xl font-black" style={{ color: 'var(--text-base)' }}>{fmt(MONTHLY.pro_plus)}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ oy</span>
                    </>
                }
              </div>
              {annual && (
                <p className="text-xs mt-1 text-emerald-400">
                  Yillik: {fmt(ANNUAL.pro_plus)} — 2 oy tekin!
                </p>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                '5 ta do\'kon',
                'Hamma Pro xususiyatlar',
                'AI savdo tahlili',
                'Raqobatchi narx kuzatish',
                'Hisobotlarni eksport (CSV)',
                'Ustuvor qo\'llab-quvvatlash',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <a href={`https://t.me/${SALES_TELEGRAM}`} target="_blank" rel="noopener noreferrer"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold border transition-all hover:border-violet-500/50"
              style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
              Boshlash →
            </a>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          <div className="px-6 py-4 border-b" style={{ background: card2, borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Xususiyatlar taqqoslamasi</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: card2 }}>
                  <th className="text-left px-6 py-3 font-medium" style={{ color: 'var(--text-muted)', width: '50%' }}>Xususiyat</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Bepul</th>
                  <th className="text-center px-4 py-3 font-semibold text-violet-400">Pro</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Pro+</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr key={row.label}
                    className="border-b transition-colors hover:bg-violet-500/5"
                    style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'transparent' : `${card}80` }}>
                    <td className="px-6 py-3.5 font-medium" style={{ color: 'var(--text-muted)' }}>{row.label}</td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.free} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.pro} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.pro_plus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ / note */}
        <p className="text-center text-xs mt-10" style={{ color: 'var(--text-muted)' }}>
          To'lov haqida savol bormi?{' '}
          <a href={`https://t.me/${SALES_TELEGRAM}`} target="_blank" rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            Telegram orqali yozing →
          </a>
        </p>
      </div>
    </div>
  )
}
