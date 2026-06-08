'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Check, X, Zap, Shield, Star,
  TrendingUp, ChevronRight, MessageCircle, ChevronDown,
  Lock, Users, FileText, Clock, Mail,
} from 'lucide-react'

interface Feature { label: string; free: boolean | string; pro: boolean | string; proplus: boolean | string }
interface FaqItem  { q: string; a: string }

/* ── Pro features (Pro AND Pro+) ────────────────────────────────────────
   Everything a seller needs day-to-day lives here.
   Wildberries, custom reports, deep analytics — all in Pro.
   ─────────────────────────────────────────────────────────────────────── */
const PRO_FEATURES = [
  "Unlimited do'konlar",
  'Unlimited mahsulotlar',
  '12 oylik tarix',
  'Uzum + Yandex Market + Wildberries',
  'Unit-ekonomika',
  'Reklama tahlili',
  'Qidiruv iboralari',
  'Eksport Excel / PDF',
  'F&Z (P&L) hisobot',
  'Mavsumiylik tahlili',
  'Narx kuzatuvi',
  'Maxsus hisobotlar',
  'API kirish',
]

/* ── Pro+ exclusive extras ───────────────────────────────────────────────
   These are power-user features most solo sellers never need:
   – Team accounts: only agencies / large ops with multiple managers
   – Scheduled email reports: convenience, not core analytics
   – Priority support: support speed tier, not a product feature
   – White-label PDF: branding cosmetic for resellers/agencies
   ─────────────────────────────────────────────────────────────────────── */
const PROPLUS_EXTRAS = [
  { icon: Users,    label: 'Jamoa (5 foydalanuvchi)',            desc: "Rol va ruxsat boshqaruvi" },
  { icon: Mail,     label: 'Avtomatik hisobot emailga',          desc: "Kunlik/haftalik yetkazib berish" },
  { icon: Clock,    label: "Prioritet qo'llab-quvvatlash",       desc: "15 daqiqa ichida javob (Pro: standart navbat)" },
  { icon: FileText, label: 'White-label PDF (brend logosi bilan)', desc: "Hisobotlarda o'z logoyingiz" },
]

const plans = [
  {
    key: 'free',
    name: 'Bepul',
    price: '0',
    period: '/oy',
    desc: "Boshlash uchun ideal — hech qanday to'lov talab etilmaydi",
    icon: Zap,
    highlighted: false,
    badge: null,
    cta: 'Boshlash',
    href: '/login',
    features: [
      "1 ta do'kon",
      '100 ta mahsulot',
      '30 kunlik tarix',
      'Uzum integratsiya',
      'Kengaytma (extension)',
    ],
    extras: [],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '300 000',
    period: '/oy',
    desc: "O'sib kelayotgan biznes uchun to'liq analitika vositalari",
    icon: Shield,
    highlighted: true,
    badge: 'Eng mashhur',
    cta: "Sinab ko'ring",
    href: '/login?plan=pro',
    features: PRO_FEATURES,
    extras: [],
  },
  {
    key: 'proplus',
    name: 'Pro+',
    price: '600 000',
    period: '/oy',
    desc: "Yirik biznes uchun — Pro imkoniyatlari + eksklyuziv funksiyalar",
    icon: Star,
    highlighted: false,
    badge: 'Maksimal',
    cta: "Pro+ ni boshlash",
    href: '/login?plan=proplus',
    features: PRO_FEATURES,
    extras: PROPLUS_EXTRAS,
  },
] as const

const comparisonFeatures: Feature[] = [
  // ── Core (both Pro & Pro+) ────────────────────────────────────────────
  { label: "Do'konlar soni",                     free: '1',      pro: 'Cheksiz', proplus: 'Cheksiz' },
  { label: 'Mahsulotlar soni',                   free: '100',    pro: 'Cheksiz', proplus: 'Cheksiz' },
  { label: 'Tarix chuqurligi',                   free: '30 kun', pro: '12 oy',   proplus: '12 oy'   },
  { label: 'Uzum integratsiya',                  free: true,     pro: true,      proplus: true      },
  { label: 'Yandex Market',                     free: false,    pro: true,      proplus: true      },
  { label: 'Wildberries',                        free: false,    pro: true,      proplus: true      },
  { label: 'Kengaytma (extension)',              free: true,     pro: true,      proplus: true      },
  { label: 'Unit-ekonomika',                     free: false,    pro: true,      proplus: true      },
  { label: 'Reklama tahlili',                    free: false,    pro: true,      proplus: true      },
  { label: 'Qidiruv iboralari',                  free: false,    pro: true,      proplus: true      },
  { label: 'Eksport Excel / PDF',                free: false,    pro: true,      proplus: true      },
  { label: 'F&Z (P&L) hisobot',                 free: false,    pro: true,      proplus: true      },
  { label: 'Mavsumiylik tahlili',                free: false,    pro: true,      proplus: true      },
  { label: 'Narx kuzatuvi',                      free: false,    pro: true,      proplus: true      },
  { label: 'Maxsus hisobotlar',                  free: false,    pro: true,      proplus: true      },
  { label: 'API kirish',                         free: false,    pro: true,      proplus: true      },
  // ── Pro+ exclusive (power-user extras) ───────────────────────────────
  { label: 'Jamoa (5 foydalanuvchi)',             free: false,    pro: false,     proplus: true      },
  { label: 'Avtomatik hisobot emailga',           free: false,    pro: false,     proplus: true      },
  { label: "Prioritet qo'llab-quvvatlash",        free: false,    pro: false,     proplus: true      },
  { label: 'White-label PDF',                    free: false,    pro: false,     proplus: true      },
]

const faqs: FaqItem[] = [
  {
    q: "Bepul tarifda kredit karta kerakmi?",
    a: "Yo'q. Bepul tarifni boshlash uchun hech qanday to'lov ma'lumoti talab etilmaydi.",
  },
  {
    q: "Pro va Pro+ orasidagi asosiy farq nima?",
    a: "Pro tarifi o'sib kelayotgan biznes uchun barcha asosiy analitika vositalarini beradi. Pro+ esa qo'shimcha ravishda API kirish, 5 ta jamoa a'zosi, Wildberries integratsiyasi, maxsus hisobotlar va 15 daqiqali prioritet qo'llab-quvvatlashni taqdim etadi.",
  },
  {
    q: "Pro+ da Wildberries integratsiyasi qanday ishlaydi?",
    a: "Pro+ tarifida Wildberries do'koningizni ham ulab, Uzum va Yandex Market bilan birga bitta panelda ko'rishingiz mumkin. Uch bozorni bir joydan boshqarish imkoniyati faqat Pro+ da mavjud.",
  },
  {
    q: "Tarifni istalgan vaqt o'zgartirish mumkinmi?",
    a: "Ha. Bepuldan Pro ga yoki Pro dan Pro+ ga istalgan vaqt o'tishingiz mumkin. O'zgarish darhol kuchga kiradi.",
  },
  {
    q: "Ma'lumotlarim xavfsizmi?",
    a: "Ha. Barcha ma'lumotlar shifrlangan holda saqlanadi va faqat sizga tegishli. Hech qachon uchinchi shaxslarga ma'lumot berilmaydi.",
  },
]

/* ── helpers ──────────────────────────────────────────────────────────── */
function FeatureValue({ value, col }: { value: boolean | string; col: 'free' | 'pro' | 'proplus' }) {
  const isProplus = col === 'proplus'
  if (typeof value === 'string') {
    return <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{value}</span>
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{
          background: isProplus ? 'rgba(234,179,8,0.12)' : 'rgba(139,92,246,0.12)',
          border: `1px solid ${isProplus ? 'rgba(234,179,8,0.3)' : 'rgba(139,92,246,0.3)'}`,
        }}>
        <Check className="w-3.5 h-3.5" style={{ color: isProplus ? '#eab308' : '#a78bfa' }} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
      <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
    </span>
  )
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-2xl overflow-hidden transition-all"
      style={{ borderColor: open ? 'rgba(139,92,246,0.3)' : 'var(--border)', background: 'var(--bg-card2)' }}>
      <button className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen(o => !o)}>
        <span className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text-base)' }}>{item.q}</span>
        <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform"
          style={{ color: '#a78bfa', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
        </div>
      )}
    </div>
  )
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto backdrop-blur-xl rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl border"
            style={{ background: 'rgba(var(--bg-card-rgb,14,14,26),0.8)', borderColor: 'var(--border)' }}>
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight group-hover:text-violet-400 transition-colors" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Link href="/" className="hover:text-violet-400 transition-colors">Bosh sahifa</Link>
              <Link href="#compare" className="hover:text-violet-400 transition-colors">Taqqoslash</Link>
              <Link href="#faq" className="hover:text-violet-400 transition-colors">Savollar</Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block text-sm px-3 py-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}>Kirish</Link>
              <Link href="/login" className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/25">
                Boshlash <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="0.5" />
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-600/8 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> Shaffof narxlar
          </div>
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-5" style={{ color: 'var(--text-base)' }}>Tariflar</h1>
          <p className="text-lg sm:text-xl leading-relaxed" style={{ color: 'var(--text-muted)' }}>Biznesingiz o&rsquo;sishi bilan birga o&rsquo;sing</p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-4 pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => {
              const Icon = plan.icon
              const isProplus = plan.key === 'proplus'
              return (
                <div key={plan.key} className="relative flex flex-col rounded-3xl border overflow-hidden transition-all"
                  style={{
                    background: plan.highlighted
                      ? 'linear-gradient(145deg, var(--bg-card2), var(--bg-input))'
                      : isProplus
                      ? 'linear-gradient(145deg, var(--bg-card2), var(--bg-input))'
                      : 'var(--bg-card2)',
                    borderColor: plan.highlighted
                      ? 'rgba(139,92,246,0.5)'
                      : isProplus
                      ? 'rgba(234,179,8,0.4)'
                      : 'var(--border)',
                    boxShadow: plan.highlighted
                      ? '0 0 40px rgba(139,92,246,0.15)'
                      : isProplus
                      ? '0 0 40px rgba(234,179,8,0.1)'
                      : undefined,
                  }}>
                  {/* top accent line */}
                  {plan.highlighted && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />}
                  {isProplus && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />}

                  {/* badge */}
                  {plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-lg text-white"
                        style={{
                          background: isProplus
                            ? 'linear-gradient(to right, #ca8a04, #eab308)'
                            : 'linear-gradient(to right, #7c3aed, #4f46e5)',
                          boxShadow: isProplus ? '0 4px 12px rgba(234,179,8,0.3)' : '0 4px 12px rgba(139,92,246,0.3)',
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* icon + name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{
                        background: plan.highlighted ? 'rgba(139,92,246,0.15)' : isProplus ? 'rgba(234,179,8,0.12)' : 'var(--bg-input)',
                        borderColor: plan.highlighted ? 'rgba(139,92,246,0.3)' : isProplus ? 'rgba(234,179,8,0.3)' : 'var(--border2)',
                      }}>
                        <Icon className="w-5 h-5" style={{ color: plan.highlighted ? '#a78bfa' : isProplus ? '#eab308' : 'var(--text-muted)' }} />
                      </div>
                      <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-base)' }}>{plan.name}</h3>
                    </div>

                    {/* price */}
                    <div className="mb-4">
                      <div className="flex items-end gap-1.5">
                        <span className="text-4xl font-black tabular-nums" style={{
                          color: plan.highlighted ? '#a78bfa' : isProplus ? '#eab308' : 'var(--text-base)',
                        }}>{plan.price}</span>
                        <span className="text-sm font-medium pb-1.5" style={{ color: 'var(--text-muted)' }}>so&rsquo;m{plan.period}</span>
                      </div>
                    </div>

                    {/* desc */}
                    <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{plan.desc}</p>

                    {/* features */}
                    <ul className="space-y-2.5 mb-5 flex-1">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border" style={{
                            background: plan.highlighted ? 'rgba(139,92,246,0.15)' : 'var(--bg-input)',
                            borderColor: plan.highlighted ? 'rgba(139,92,246,0.3)' : 'var(--border2)',
                          }}>
                            <Check className="w-3 h-3" style={{ color: plan.highlighted ? '#a78bfa' : 'var(--text-muted)' }} />
                          </span>
                          <span className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Pro+ exclusive block */}
                    {isProplus && plan.extras.length > 0 && (
                      <div className="mb-6 rounded-2xl p-4 border" style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.25)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="w-3.5 h-3.5" style={{ color: '#eab308' }} />
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#eab308' }}>
                            Faqat Pro+ da
                          </span>
                        </div>
                        <ul className="space-y-2.5">
                          {plan.extras.map(({ icon: ExtraIcon, label, desc }) => (
                            <li key={label} className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border" style={{ background: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.35)' }}>
                                <ExtraIcon className="w-3 h-3" style={{ color: '#eab308' }} />
                              </span>
                              <div>
                                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-base)' }}>{label}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA */}
                    <Link href={plan.href}
                      className="flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-sm"
                      style={
                        plan.highlighted ? { background: 'linear-gradient(to right, #7c3aed, #4f46e5)', color: '#fff', boxShadow: '0 4px 24px rgba(139,92,246,0.35)' }
                        : isProplus ? { background: 'linear-gradient(to right, #ca8a04, #eab308)', color: '#1a1000', boxShadow: '0 4px 24px rgba(234,179,8,0.3)' }
                        : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border2)' }
                      }>
                      {plan.cta} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pro vs Pro+ callout banner */}
          <div className="mt-8 rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: 'rgba(234,179,8,0.05)', borderColor: 'rgba(234,179,8,0.2)' }}>
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}>
              <Star className="w-5 h-5" style={{ color: '#eab308' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Pro+ nima qo&rsquo;shadi?</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Pro dagi hamma narsa bor. Pro+ faqat katta jamoalar va agentliklar uchun qo&rsquo;shimcha beradi: <span style={{ color: '#eab308' }}>5 foydalanuvchi jamoa, avtomatik email hisobot, prioritet qo&rsquo;llab-quvvatlash va white-label PDF</span>.
              </p>
            </div>
            <Link href="/login?plan=proplus" className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
              style={{ background: 'linear-gradient(to right, #ca8a04, #eab308)', color: '#1a1000' }}>
              Pro+ ni ko&rsquo;rish →
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="compare" className="py-20 px-4 sm:px-6" style={{ background: 'var(--bg-card)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <Check className="w-3.5 h-3.5" /> Batafsil taqqoslash
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text-base)' }}>Taqqoslash</h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>Qaysi tarif sizga mos ekanini aniqlang</p>
          </div>

          <div className="rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
            {/* header */}
            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="p-5 col-span-1" />
              {(['Bepul', 'Pro', 'Pro+'] as const).map((name, idx) => (
                <div key={name} className="p-5 text-center border-l" style={{
                  borderColor: 'var(--border)',
                  background: idx === 1 ? 'rgba(139,92,246,0.07)' : idx === 2 ? 'rgba(234,179,8,0.06)' : undefined,
                }}>
                  <div className="font-bold text-sm sm:text-base" style={{ color: idx === 1 ? '#a78bfa' : idx === 2 ? '#eab308' : 'var(--text-base)' }}>{name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {idx === 0 ? "0 so'm" : idx === 1 ? "300 000 so'm" : "600 000 so'm"}
                  </div>
                  {idx === 2 && (
                    <div className="mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>MAKSIMAL</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pro+ exclusive section label */}
            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <div className="px-5 py-2 col-span-4 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Asosiy imkoniyatlar</span>
              </div>
            </div>

            {/* rows — split into shared and proplus-only */}
            {comparisonFeatures.map((feat, i) => {
              const isProplusOnly = !feat.pro && feat.proplus
              return (
                <div key={feat.label}
                  className={`grid grid-cols-4 border-b last:border-b-0 ${isProplusOnly ? '' : ''}`}
                  style={{
                    borderColor: 'var(--border)',
                    background: isProplusOnly ? 'rgba(234,179,8,0.03)' : i % 2 === 0 ? 'transparent' : 'var(--bg-card2)',
                  }}>
                  <div className="px-5 py-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {isProplusOnly && <Lock className="w-3 h-3 flex-shrink-0" style={{ color: '#eab308' }} />}
                    {feat.label}
                  </div>
                  {(['free', 'pro', 'proplus'] as const).map((col, idx) => (
                    <div key={col} className="px-5 py-4 flex items-center justify-center border-l" style={{
                      borderColor: 'var(--border)',
                      background: idx === 1 ? 'rgba(139,92,246,0.04)' : idx === 2 ? 'rgba(234,179,8,0.04)' : undefined,
                    }}>
                      <FeatureValue value={feat[col]} col={col} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <MessageCircle className="w-3.5 h-3.5" /> Ko&rsquo;p so&rsquo;raladigan savollar
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text-base)' }}>Savollar &amp; Javoblar</h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>Qo&rsquo;shimcha savolingiz bo&rsquo;lsa Telegram orqali bog&rsquo;laning</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => <FaqRow key={i} item={faq} />)}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-3xl p-10 sm:p-14 text-center overflow-hidden border"
            style={{ background: 'var(--bg-card2)', borderColor: 'rgba(139,92,246,0.2)' }}>
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6 mx-auto">
                <MessageCircle className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: 'var(--text-base)' }}>Hali ham savol bormi?</h2>
              <p className="mb-8 leading-relaxed text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
                Bizning jamoa sizga yordam berishga tayyor. Odatda 15 daqiqa ichida javob beramiz.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all text-sm text-white"
                  style={{ background: 'linear-gradient(to right, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(139,92,246,0.35)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.892z"/>
                  </svg>
                  Telegram orqali yozing
                </a>
                <Link href="/login" className="flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl transition-all text-sm border"
                  style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}>
                  Bepul boshlash <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi. Barcha huquqlar himoyalangan.</p>
          <Link href="/" className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            Bosh sahifa <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
