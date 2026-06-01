'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Check, X, Zap, Building2, Shield,
  TrendingUp, ChevronRight, MessageCircle, ChevronDown,
} from 'lucide-react'

/* ── types ──────────────────────────────────────────────────────────────── */
interface Feature {
  label: string
  free: boolean | string
  pro: boolean | string
  business: boolean | string
}

interface FaqItem {
  q: string
  a: string
}

/* ── data ───────────────────────────────────────────────────────────────── */
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
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '99 000',
    period: '/oy',
    desc: "O'sib kelayotgan biznes uchun kuchli analitika vositalari",
    icon: Shield,
    highlighted: true,
    badge: 'Eng mashhur',
    cta: "Sinab ko'ring",
    href: '/login?plan=pro',
    features: [
      "Unlimited do'konlar",
      'Unlimited mahsulotlar',
      '12 oylik tarix',
      'Uzum + Yandex Market',
      'Unit-ekonomika',
      'Reklama tahlili',
      'Qidiruv iboralari',
      'Eksport Excel',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: '249 000',
    period: '/oy',
    desc: "Yirik biznes va agentliklar uchun kengaytirilgan imkoniyatlar",
    icon: Building2,
    highlighted: false,
    badge: null,
    cta: "Sinab ko'ring",
    href: '/login?plan=business',
    features: [
      "Unlimited do'konlar",
      'Unlimited mahsulotlar',
      '12 oylik tarix',
      'Uzum + Yandex Market',
      'Unit-ekonomika',
      'Reklama tahlili',
      'Qidiruv iboralari',
      'Eksport Excel',
      'API kirish',
      "Prioritet qo'llab-quvvatlash",
      'Custom integratsiyalar',
      'Maxsus hisobotlar',
    ],
  },
] as const

const comparisonFeatures: Feature[] = [
  { label: "Do'konlar soni",           free: '1',          pro: 'Cheksiz',    business: 'Cheksiz'    },
  { label: 'Mahsulotlar soni',         free: '100',        pro: 'Cheksiz',    business: 'Cheksiz'    },
  { label: 'Tarix chuqurligi',         free: '30 kun',     pro: '12 oy',      business: '12 oy'      },
  { label: 'Uzum integratsiya',        free: true,         pro: true,         business: true          },
  { label: 'Yandex Market',           free: false,        pro: true,         business: true          },
  { label: 'Kengaytma (extension)',    free: true,         pro: true,         business: true          },
  { label: 'Unit-ekonomika',           free: false,        pro: true,         business: true          },
  { label: 'Reklama tahlili',          free: false,        pro: true,         business: true          },
  { label: 'Qidiruv iboralari',        free: false,        pro: true,         business: true          },
  { label: 'Eksport Excel',            free: false,        pro: true,         business: true          },
  { label: 'API kirish',               free: false,        pro: false,        business: true          },
  { label: "Prioritet qo'llab-quvvatlash", free: false,   pro: false,        business: true          },
  { label: 'Custom integratsiyalar',   free: false,        pro: false,        business: true          },
  { label: 'Maxsus hisobotlar',        free: false,        pro: false,        business: true          },
]

const faqs: FaqItem[] = [
  {
    q: "Bepul tarifda kredit karta kerakmi?",
    a: "Yo'q. Bepul tarifni boshlash uchun hech qanday to'lov ma'lumoti talab etilmaydi. Shunchaki ro'yxatdan o'ting va darhol foydalanishni boshlang.",
  },
  {
    q: "Pro yoki Business tarifga o'tish qanchalik oson?",
    a: "Juda oson. Hisobingizdan tarifni istalgan vaqt o'zgartirishingiz mumkin. Yangi tarif darhol faollashadi va qolgan kunlar uchun hisob-kitob avtomatik amalga oshiriladi.",
  },
  {
    q: "Yandex Market integratsiyasi qanday ishlaydi?",
    a: "Pro va Business tariflari Yandex Market do'koningizni avtomatik ulaydi. Hisobingizni bog'laganingizdan so'ng barcha mahsulot, buyurtma va tahlillar bir panelda ko'rinadi.",
  },
  {
    q: "Ma'lumotlarim xavfsizmi?",
    a: "Ha. Barcha ma'lumotlar shifrlangan holda saqlanadi va faqat sizga tegishli. Biz hech qachon uchinchi shaxslarga ma'lumot bermayiz. ISO 27001 standartiga muvofiq xavfsizlik ta'minlangan.",
  },
  {
    q: "Tarifni bekor qilsam ma'lumotlarim yo'qolmaydimi?",
    a: "Yo'q. Tarifni bekor qilganingizdan so'ng ma'lumotlaringiz 90 kun davomida saqlanib qoladi. Shu muddatda qayta faollashtirish orqali barcha ma'lumotlaringizga ega bo'lasiz.",
  },
]

/* ── sub-components ─────────────────────────────────────────────────────── */
function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{value}</span>
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/30">
        <Check className="w-3.5 h-3.5 text-violet-400" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5">
      <X className="w-3.5 h-3.5 text-slate-600" />
    </span>
  )
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all"
      style={{ borderColor: open ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)', background: '#0e0e1a' }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-semibold text-sm sm:text-base" style={{ color: '#e2e8f0' }}>{item.q}</span>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0 transition-transform"
          style={{ color: '#a78bfa', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{item.a}</p>
        </div>
      )}
    </div>
  )
}

/* ── main page ──────────────────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#07070f', color: '#e2e8f0' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div
            className="max-w-6xl mx-auto backdrop-blur-xl rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl border"
            style={{ background: 'rgba(14,14,26,0.8)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 neon-border">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight group-hover:text-violet-400 transition-colors" style={{ color: '#e2e8f0' }}>
                Daromadchi
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: '#64748b' }}>
              <Link href="/" className="hover:text-violet-400 transition-colors">Bosh sahifa</Link>
              <Link href="#compare" className="hover:text-violet-400 transition-colors">Taqqoslash</Link>
              <Link href="#faq" className="hover:text-violet-400 transition-colors">Savollar</Link>
            </nav>

            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block text-sm px-3 py-1.5 transition-colors" style={{ color: '#94a3b8' }}>
                Kirish
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/25"
              >
                Boshlash <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* subtle grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <svg className="absolute inset-0 w-full h-full animate-grid-fade" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        {/* orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-600/8 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Shaffof narxlar
          </div>
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-5" style={{ color: '#e2e8f0' }}>
            Tariflar
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed" style={{ color: '#64748b' }}>
            Biznesingiz o&rsquo;sishi bilan birga o&rsquo;sing
          </p>
        </div>
      </section>

      {/* ── Pricing cards ───────────────────────────────────────────────── */}
      <section className="py-4 pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.key}
                  className="relative flex flex-col rounded-3xl border overflow-hidden transition-all"
                  style={{
                    background: plan.highlighted ? 'linear-gradient(145deg, #0e0e1a, #13131f)' : '#0e0e1a',
                    borderColor: plan.highlighted ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)',
                    boxShadow: plan.highlighted ? '0 0 40px rgba(139,92,246,0.15), inset 0 0 40px rgba(139,92,246,0.03)' : undefined,
                  }}
                >
                  {/* top accent line */}
                  {plan.highlighted && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
                  )}

                  {/* badge */}
                  {plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1 rounded-full shadow-lg shadow-violet-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* plan icon + name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center border"
                        style={{
                          background: plan.highlighted ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                          borderColor: plan.highlighted ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{ color: plan.highlighted ? '#a78bfa' : '#94a3b8' }}
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight" style={{ color: '#e2e8f0' }}>{plan.name}</h3>
                      </div>
                    </div>

                    {/* price */}
                    <div className="mb-4">
                      <div className="flex items-end gap-1.5">
                        <span
                          className="text-4xl font-black tabular-nums"
                          style={{ color: plan.highlighted ? '#a78bfa' : '#e2e8f0' }}
                        >
                          {plan.price}
                        </span>
                        <span className="text-sm font-medium pb-1.5" style={{ color: '#64748b' }}>
                          so&rsquo;m{plan.period}
                        </span>
                      </div>
                    </div>

                    {/* desc */}
                    <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748b' }}>
                      {plan.desc}
                    </p>

                    {/* feature list */}
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span
                            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border"
                            style={{
                              background: plan.highlighted ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                              borderColor: plan.highlighted ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <Check
                              className="w-3 h-3"
                              style={{ color: plan.highlighted ? '#a78bfa' : '#94a3b8' }}
                            />
                          </span>
                          <span className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={plan.href}
                      className="flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-sm"
                      style={
                        plan.highlighted
                          ? {
                              background: 'linear-gradient(to right, #7c3aed, #4f46e5)',
                              color: '#ffffff',
                              boxShadow: '0 4px 24px rgba(139,92,246,0.35)',
                            }
                          : {
                              background: 'rgba(255,255,255,0.05)',
                              color: '#94a3b8',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }
                      }
                    >
                      {plan.cta}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison table ────────────────────────────────────────────── */}
      <section id="compare" className="py-20 px-4 sm:px-6" style={{ background: '#0a0a14' }}>
        <div className="max-w-5xl mx-auto">
          {/* section heading */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <Check className="w-3.5 h-3.5" /> Batafsil taqqoslash
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: '#e2e8f0' }}>
              Taqqoslash
            </h2>
            <p className="text-sm sm:text-base" style={{ color: '#64748b' }}>
              Qaysi tarif sizga mos ekanini aniqlang
            </p>
          </div>

          {/* table wrapper */}
          <div className="rounded-3xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0e0e1a' }}>
            {/* table header */}
            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="p-5 col-span-1" />
              {(['Bepul', 'Pro', 'Business'] as const).map((name, idx) => (
                <div
                  key={name}
                  className="p-5 text-center border-l"
                  style={{
                    borderColor: 'rgba(255,255,255,0.06)',
                    background: idx === 1 ? 'rgba(139,92,246,0.07)' : undefined,
                  }}
                >
                  <div
                    className="font-bold text-sm sm:text-base"
                    style={{ color: idx === 1 ? '#a78bfa' : '#e2e8f0' }}
                  >
                    {name}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#64748b' }}>
                    {idx === 0 ? "0 so'm" : idx === 1 ? "99 000 so'm" : "249 000 so'm"}
                  </div>
                </div>
              ))}
            </div>

            {/* table rows */}
            {comparisonFeatures.map((feat, i) => (
              <div
                key={feat.label}
                className="grid grid-cols-4 border-b last:border-b-0"
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <div className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{feat.label}</div>
                {(['free', 'pro', 'business'] as const).map((col, idx) => (
                  <div
                    key={col}
                    className="px-5 py-4 flex items-center justify-center border-l"
                    style={{
                      borderColor: 'rgba(255,255,255,0.04)',
                      background: idx === 1 ? 'rgba(139,92,246,0.04)' : undefined,
                    }}
                  >
                    <FeatureValue value={feat[col]} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <MessageCircle className="w-3.5 h-3.5" /> Ko&rsquo;p so&rsquo;raladigan savollar
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: '#e2e8f0' }}>
              Savollar &amp; Javoblar
            </h2>
            <p className="text-sm sm:text-base" style={{ color: '#64748b' }}>
              Qo&rsquo;shimcha savolingiz bo&rsquo;lsa Telegram orqali bog&rsquo;laning
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqRow key={i} item={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div
            className="relative rounded-3xl p-10 sm:p-14 text-center overflow-hidden border"
            style={{ background: '#0e0e1a', borderColor: 'rgba(139,92,246,0.2)' }}
          >
            {/* decoration */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/8 blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6 mx-auto">
                <MessageCircle className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: '#e2e8f0' }}>
                Hali ham savol bormi?
              </h2>
              <p className="mb-8 leading-relaxed text-sm sm:text-base" style={{ color: '#64748b' }}>
                Bizning jamoa sizga yordam berishga tayyor. Telegram orqali murojaat qiling —
                odatda 15 daqiqa ichida javob beramiz.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="https://t.me/daromadchi_uz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all text-sm text-white"
                  style={{
                    background: 'linear-gradient(to right, #7c3aed, #4f46e5)',
                    boxShadow: '0 4px 24px rgba(139,92,246,0.35)',
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.892z"/>
                  </svg>
                  Telegram orqali yozing
                </a>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl transition-all text-sm border"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
                >
                  Bepul boshlash <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 sm:px-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#e2e8f0' }}>Daromadchi</span>
          </div>
          <p className="text-xs" style={{ color: '#64748b' }}>© 2026 Daromadchi. Barcha huquqlar himoyalangan.</p>
          <Link href="/" className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            Bosh sahifa <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
