'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText,
  RefreshCw, AlertTriangle, ArrowUpRight,
  Activity, Sun, Moon, X, Layers, ChevronRight, Check,
  Package, LayoutDashboard, Store,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── useCounter ────────────────────────────────────────────────────────────── */
function useCounter(target: number, duration = 1800, start = false) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    let t0: number
    const raf = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      setN(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [start, target, duration])
  return n
}

/* ── ThemeToggle ───────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {theme === 'dark'
        ? <Sun className="w-4 h-4" style={{ color: '#fbbf24' }} />
        : <Moon className="w-4 h-4" style={{ color: '#5c27f5' }} />}
    </button>
  )
}

/* ── LangToggle ────────────────────────────────────────────────────────────── */
function LangToggle() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const langs: Lang[] = ['uz', 'ru', 'en']

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        {lang.toUpperCase()}
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[4rem]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {langs.map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); setOpen(false) }}
                className="w-full px-3 py-2.5 text-xs font-medium text-left transition-all"
                style={{
                  background: lang === l ? 'rgba(92,39,245,0.08)' : 'transparent',
                  color: lang === l ? '#5c27f5' : 'var(--text-muted)',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── DashboardMockup ───────────────────────────────────────────────────────── */
function DashboardMockup({ p }: { p: typeof import('@/lib/i18n').translations.en.preview }) {
  const kpis = [
    { l: p.revenue, v: '124.5M', c: '#5c27f5' },
    { l: p.profit,  v: '38.2M',  c: '#34d399' },
    { l: p.orders,  v: '1,842',  c: '#818cf8' },
    { l: p.stock,   v: '3,410',  c: '#fbbf24' },
  ]
  const bars = [28, 52, 38, 68, 44, 82, 62, 90, 72, 58, 78, 94, 68, 86]

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(92,39,245,0.12)',
        boxShadow: '0 32px 80px rgba(92,39,245,0.18), 0 8px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: '#f8f7ff', borderBottom: '1px solid rgba(92,39,245,0.10)' }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div
          className="flex-1 mx-3 rounded-md h-5 flex items-center px-2"
          style={{ background: '#ede9fe', border: '1px solid rgba(92,39,245,0.15)' }}
        >
          <span className="text-[9px]" style={{ color: '#7c3aed' }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 animate-pulse" style={{ color: '#34d399' }} />
      </div>

      {/* Content */}
      <div className="p-3 space-y-2" style={{ background: '#faf9ff' }}>
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => (
            <div
              key={k.l}
              className="rounded-xl p-2.5"
              style={{ background: '#ffffff', border: '1px solid rgba(92,39,245,0.10)' }}
            >
              <p className="text-[9px] mb-1" style={{ color: '#9ca3af' }}>{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[9px] mt-0.5 text-emerald-500">&#8593; 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div
            className="col-span-2 rounded-xl p-3"
            style={{ background: '#ffffff', border: '1px solid rgba(92,39,245,0.10)' }}
          >
            <p className="text-[9px] mb-2" style={{ color: '#9ca3af' }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-14">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${h}%`, background: h > 68 ? '#5c27f5' : 'rgba(92,39,245,0.18)' }}
                />
              ))}
            </div>
          </div>
          <div
            className="rounded-xl p-3 flex flex-col items-center justify-center"
            style={{ background: '#ffffff', border: '1px solid rgba(92,39,245,0.10)' }}
          >
            <p className="text-[9px] self-start mb-2" style={{ color: '#9ca3af' }}>{p.categories}</p>
            <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#ede9fe" strokeWidth="4" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#5c27f5" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#818cf8" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── FeatureCard (extracted to avoid hooks-in-map) ─────────────────────────── */
const FEAT_ICONS = [
  { Icon: BarChart2,     color: '#5c27f5' },
  { Icon: Calculator,    color: '#34d399' },
  { Icon: AlertTriangle, color: '#f59e0b' },
  { Icon: FileText,      color: '#818cf8' },
  { Icon: RefreshCw,     color: '#06b6d4' },
  { Icon: Layers,        color: '#fb923c' },
]

function FeatureCard({
  title,
  desc,
  icon,
  index,
  inView,
}: {
  title: string
  desc: string
  icon: { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }
  index: number
  inView: boolean
}) {
  const { Icon, color } = icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      className="rounded-2xl p-6 cursor-default group transition-all hover:-translate-y-1"
      style={{
        background: '#f5f3ff',
        border: '1px solid rgba(92,39,245,0.08)',
        boxShadow: '0 2px 12px rgba(92,39,245,0.06)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <h3 className="font-bold mb-2 text-base" style={{ color: '#0f0a1e' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{desc}</p>
    </motion.div>
  )
}

/* ── TestimonialCard (extracted) ───────────────────────────────────────────── */
function TestimonialCard({
  quote,
  name,
  role,
  index,
  inView,
  offsetY = 0,
}: {
  quote: string
  name: string
  role: string
  index: number
  inView: boolean
  offsetY?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: offsetY } : {}}
      transition={{ delay: index * 0.12, duration: 0.6 }}
      className="rounded-2xl p-7 flex flex-col justify-between"
      style={{ background: '#5c27f5', minHeight: 220 }}
    >
      <p className="text-white text-sm leading-relaxed mb-6 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <p className="text-white text-xs font-semibold" style={{ opacity: 0.7 }}>
        &bull; {name} &mdash; {role}
      </p>
    </motion.div>
  )
}

/* ── PricingCard (extracted) ───────────────────────────────────────────────── */
function PricingCard({
  name,
  desc,
  price,
  period,
  features,
  highlight,
  index,
  inView,
}: {
  name: string
  desc: string
  price: string
  period: string
  features: string[]
  highlight?: boolean
  index: number
  inView: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="rounded-2xl p-7 flex flex-col"
      style={{
        background: highlight ? '#5c27f5' : '#ffffff',
        border: highlight ? 'none' : '1px solid rgba(92,39,245,0.12)',
        boxShadow: highlight
          ? '0 20px 60px rgba(92,39,245,0.35)'
          : '0 4px 20px rgba(92,39,245,0.08)',
      }}
    >
      <div className="mb-5">
        <h3
          className="text-xl font-bold mb-1.5"
          style={{ color: highlight ? '#ffffff' : '#0f0a1e' }}
        >
          {name}
        </h3>
        <p className="text-sm" style={{ color: highlight ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>
          {desc}
        </p>
      </div>
      <hr style={{ borderColor: highlight ? 'rgba(255,255,255,0.15)' : 'rgba(92,39,245,0.12)', marginBottom: 20 }} />
      <div className="mb-5">
        <span className="text-3xl font-black" style={{ color: highlight ? '#ffffff' : '#0f0a1e' }}>
          {price}
        </span>
        {period && (
          <span className="text-sm ml-1" style={{ color: highlight ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>
            {period}
          </span>
        )}
      </div>
      <p
        className="text-xs font-semibold mb-4 uppercase tracking-wider"
        style={{ color: highlight ? 'rgba(255,255,255,0.6)' : '#5c27f5' }}
      >
        Kiritilgan imkoniyatlar
      </p>
      <ul className="space-y-2.5 flex-1 mb-6">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              style={{ color: highlight ? '#c4b5fd' : '#5c27f5' }}
            />
            <span style={{ color: highlight ? 'rgba(255,255,255,0.85)' : '#374151' }}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className="w-full py-3 rounded-xl text-sm font-bold text-center transition-all hover:opacity-90 block"
        style={{
          background: highlight ? 'rgba(255,255,255,0.15)' : '#5c27f5',
          color: '#ffffff',
          border: highlight ? '1px solid rgba(255,255,255,0.25)' : 'none',
        }}
      >
        Boshlash &#8599;
      </Link>
    </motion.div>
  )
}

/* ── StickyBar ─────────────────────────────────────────────────────────────── */
function StickyBar() {
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && !closed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
          style={{ background: '#0d0d1a', borderTop: '1px solid rgba(92,39,245,0.3)' }}
        >
          <p className="text-sm text-white font-medium">
            3 kun bepul boshlang &middot; <span style={{ color: '#a78bfa' }}>Karta shart emas</span>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: '#5c27f5' }}
            >
              Hozir boshlash &#8599;
            </Link>
            <button
              onClick={() => setClosed(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme()
  const { lang }  = useLang()
  const t = translations[lang]
  const isDark = theme === 'dark'

  /* scroll refs */
  const purpleRef  = useRef(null)
  const floatRef   = useRef(null)
  const featRef    = useRef(null)
  const pricingRef = useRef(null)
  const testiRef   = useRef(null)

  const purpleInView  = useInView(purpleRef,  { once: true, margin: '-60px' })
  const floatInView   = useInView(floatRef,   { once: true, margin: '-60px' })
  const featInView    = useInView(featRef,    { once: true, margin: '-60px' })
  const pricingInView = useInView(pricingRef, { once: true, margin: '-60px' })
  const testiInView   = useInView(testiRef,   { once: true, margin: '-60px' })

  /* useCounter kept for possible future stats section */
  const _c = useCounter(0, 1800, false)
  void _c

  /* theme-aware colors */
  const pageBg   = isDark ? 'var(--bg-base)' : '#ffffff'
  const textDark = isDark ? 'var(--text-base)' : '#0f0a1e'
  const textGray = isDark ? 'var(--text-muted)' : '#6b7280'

  /* pricing plans */
  const plans = [
    {
      name: 'Bepul',
      desc: "Boshlash uchun ideal — hech narsa to'lash shart emas.",
      price: "0 so'm",
      period: '/oyiga',
      features: [
        '1 ta marketplace',
        'Asosiy analitika',
        "30 kunlik ma'lumot tarixi",
        "Email qo'llab-quvvatlash",
      ],
      highlight: false,
    },
    {
      name: 'Pro',
      desc: 'Faol sotuvchilar uchun barcha kerakli imkoniyatlar.',
      price: "300,000 so'm",
      period: '/oyiga',
      features: [
        'Barcha marketplacelar',
        "To'liq reklama tahlili",
        'P&L hisoboti',
        'Qoldiq ogohlantirishlari',
        'Telegram bot integratsiyasi',
        "Ustuvor qo'llab-quvvatlash",
      ],
      highlight: true,
    },
    {
      name: 'Pro+',
      desc: 'Katta hajmdagi savdo uchun kengaytirilgan imkoniyatlar.',
      price: "600,000 so'm",
      period: '/oyiga',
      features: [
        "Pro'ning hamma imkoniyati",
        'ABC/XYZ tahlili',
        'Birlik iqtisodiyoti kalkulyatori',
        "Ko'p foydalanuvchi",
        'API kirish',
        "Maxsus qo'llab-quvvatlash",
      ],
      highlight: false,
    },
  ]

  /* testimonials */
  const testimonials = [
    {
      quote: "Daromadchi yordamida reklamamdagi ortiqcha xarajatlarni aniqladim va oylik foydamni 40% ga oshirdim. Endi hamma narsa bitta panelda ko'rinadi.",
      name: 'Jasur Toshmatov',
      role: 'Uzum Market Sotuvchi',
      offsetY: 0,
    },
    {
      quote: "Wildberries va Uzum savdolarimni bitta joyda ko'rish juda qulay. Qoldiq ogohlantirishlari funksiyasi ombor boshqaruvimni tubdan o'zgartirdi.",
      name: 'Dilnoza Yusupova',
      role: 'Yandex Market Sotuvchi',
      offsetY: 24,
    },
    {
      quote: "P&L hisobotlari juda aniq va tushunish oson. Endi moliyaviy qarorlarni ko'r-ko'rona emas, aniq raqamlarga asoslanib qabul qilaman.",
      name: 'Bobur Rahimov',
      role: "Ko'p Marketplace Sotuvchi",
      offsetY: 0,
    },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: pageBg, color: textDark }}>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — NAVBAR
      ══════════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: isDark ? 'rgba(2,12,26,0.92)' : 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDark ? 'rgba(92,39,245,0.15)' : 'rgba(92,39,245,0.10)'}`,
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-8">
          {/* Logo LEFT */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#5c27f5' }}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: textDark }}>Daromadchi</span>
          </Link>

          {/* Nav links CENTER */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {[
              { href: '#features', label: 'Imkoniyatlar'    },
              { href: '#how',      label: 'Qanday ishlaydi' },
              { href: '/pricing',  label: 'Narxlar'         },
              { href: '/help',     label: 'Yordam'          },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-2 rounded-lg text-sm font-normal transition-all"
                style={{ color: textGray }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = textDark
                  el.style.background = isDark ? 'rgba(92,39,245,0.08)' : '#f5f3ff'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = textGray
                  el.style.background = 'transparent'
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* RIGHT: lang + theme + login + cta */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <LangToggle />
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:block text-sm px-4 py-2 rounded-lg transition-all"
              style={{ color: textGray }}
            >
              Kirish
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90"
              style={{ background: '#5c27f5' }}
            >
              Bepul boshlash <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 py-20 lg:py-28 overflow-hidden"
        style={{ background: isDark ? 'var(--bg-base)' : '#ffffff' }}
      >
        {/* Soft bg blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(92,39,245,0.08) 0%, transparent 65%)' }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(92,39,245,0.05) 0%, transparent 65%)' }}
          />
        </div>

        <div className="max-w-[1200px] mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-16 xl:gap-20 items-center">

            {/* LEFT text */}
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="font-black leading-[1.08] mb-6"
                style={{ fontSize: 'clamp(44px, 5.5vw, 82px)', color: textDark }}
              >
                Do&rsquo;koningizni{' '}
                <span style={{ color: '#5c27f5' }}>to&rsquo;liq</span>
                {' '}nazorat qiling
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.55 }}
                className="text-lg leading-relaxed mb-10 max-w-md"
                style={{ color: textGray }}
              >
                Reklama tahlili, qoldiq ogohlantirishlari, foyda hisobotlari &mdash; barchasi bitta panelda.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 mb-6"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:opacity-90 text-base"
                  style={{ background: '#5c27f5', boxShadow: '0 8px 28px rgba(92,39,245,0.35)' }}
                >
                  30 kun bepul boshlash <ArrowUpRight className="w-4 h-4" />
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="text-sm"
                style={{ color: textGray }}
              >
                Karta shart emas
              </motion.p>
            </div>

            {/* RIGHT: mockup + floating cards */}
            <motion.div
              initial={{ opacity: 0, x: 48, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* Floating card top-left: orders */}
              <div
                className="animate-float-up absolute -left-6 -top-4 z-20 rounded-2xl p-4 hidden lg:block"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(92,39,245,0.12)',
                  boxShadow: '0 12px 40px rgba(92,39,245,0.14)',
                  minWidth: 170,
                }}
              >
                <p className="text-[10px] mb-1" style={{ color: '#9ca3af' }}>Jami buyurtmalar &middot; 428 &#8599;</p>
                <p className="text-2xl font-black" style={{ color: '#0f0a1e' }}>428</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-bold text-emerald-500">&#8599; +18.2%</span>
                </div>
              </div>

              {/* Floating card bottom-left: bar chart (dark) */}
              <div
                className="animate-float-down absolute -left-6 bottom-8 z-20 rounded-2xl p-4 hidden lg:block"
                style={{
                  background: '#0d0d1a',
                  border: '1px solid rgba(92,39,245,0.3)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                  minWidth: 170,
                }}
              >
                <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Savdo samaradorligi</p>
                <div className="flex items-end gap-0.5 h-8 mb-1">
                  {[40, 60, 45, 75, 55, 80, 65].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ height: `${h}%`, background: h > 65 ? '#5c27f5' : 'rgba(92,39,245,0.35)' }}
                    />
                  ))}
                </div>
                <p className="text-xs text-white font-semibold">DRR: 12.4%</p>
              </div>

              {/* Floating card bottom-right: revenue growth (dark) */}
              <div
                className="animate-float-up absolute -right-6 bottom-4 z-20 rounded-2xl p-4 hidden lg:block"
                style={{
                  background: '#0d0d1a',
                  border: '1px solid rgba(92,39,245,0.3)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                  minWidth: 140,
                }}
              >
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Daromad o&rsquo;sishi &middot; 643</p>
                <p className="text-2xl font-black text-white">643</p>
                <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>&#8599; so&rsquo;m mlrd</p>
              </div>

              <DashboardMockup p={t.preview} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — PURPLE BAND
      ══════════════════════════════════════════════════════════════════ */}
      <section ref={purpleRef} className="px-6 py-20" style={{ background: '#5c27f5' }}>
        <div className="max-w-[1200px] mx-auto">
          {/* Small tag */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={purpleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              Sizning muvaffaqiyatingiz shu yerdan boshlanadi
            </span>
          </motion.div>

          {/* Large white text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={purpleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-white font-bold leading-snug mb-14"
            style={{ fontSize: 'clamp(20px, 2.8vw, 36px)', maxWidth: 780 }}
          >
            Daromadchi marketplace savdosining murakkabligini soddalashtirish uchun yaratilgan.
            Uzum, Yandex Market va Wildberries sotuvchilari uchun &mdash; bitta platformada barcha raqamlar.
          </motion.p>

          {/* 3 dark cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {([
              {
                icon: LayoutDashboard,
                title: 'Analitika markazi',
                content: (
                  <div className="mt-4 space-y-2">
                    {(['Uzum Market', 'Yandex Market', 'Wildberries'] as const).map((m, i) => (
                      <div
                        key={m}
                        className="flex items-center justify-between py-1.5 border-b"
                        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                      >
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{m}</span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: ['#a78bfa', '#c4b5fd', '#818cf8'][i] }}
                        >
                          {(['124.5M', '38.2M', '61.3M'] as const)[i]} so&rsquo;m
                        </span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: BarChart2,
                title: "Savdo ko'rsatkichlari",
                content: (
                  <div className="mt-4 flex items-end gap-1 h-16">
                    {[35, 55, 40, 70, 50, 85, 65, 90, 75].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{ height: `${h}%`, background: h > 65 ? '#a78bfa' : 'rgba(167,139,250,0.3)' }}
                      />
                    ))}
                  </div>
                ),
              },
              {
                icon: Package,
                title: 'Ombor nazorati',
                content: (
                  <div className="mt-4 space-y-2">
                    {([
                      { sku: 'SKU-001', days: 12, status: 'warn'   },
                      { sku: 'SKU-047', days: 3,  status: 'danger' },
                      { sku: 'SKU-112', days: 28, status: 'ok'     },
                    ] as const).map(({ sku, days, status }) => (
                      <div
                        key={sku}
                        className="flex items-center justify-between py-1.5 border-b"
                        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                      >
                        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{sku}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{
                            background: status === 'danger' ? 'rgba(239,68,68,0.2)'  : status === 'warn' ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)',
                            color:      status === 'danger' ? '#f87171'              : status === 'warn' ? '#fcd34d'              : '#6ee7b7',
                          }}
                        >
                          {days} kun
                        </span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ] as Array<{ icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; content: React.ReactNode }>).map(({ icon: Icon, title, content }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 28 }}
                animate={purpleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className="rounded-2xl p-6"
                style={{ background: '#0d0d1a' }}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <Icon className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
                {content}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — LIGHT FLOATING SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={floatRef}
        id="how"
        className="px-6 py-20 relative overflow-hidden"
        style={{ background: '#f5f3ff' }}
      >
        <div className="max-w-[1200px] mx-auto text-center relative">
          {/* Floating icons scattered around */}
          <div className="absolute inset-0 pointer-events-none">
            {([
              { Icon: BarChart2,     x: '5%',  y: '20%', delay: 0,   color: '#5c27f5', dur: 4   },
              { Icon: Store,         x: '90%', y: '15%', delay: 0.5, color: '#818cf8', dur: 5   },
              { Icon: AlertTriangle, x: '8%',  y: '65%', delay: 1,   color: '#f59e0b', dur: 6   },
              { Icon: RefreshCw,     x: '85%', y: '70%', delay: 1.5, color: '#34d399', dur: 4.5 },
              { Icon: Calculator,    x: '50%', y: '82%', delay: 0.8, color: '#a78bfa', dur: 5.5 },
            ] as Array<{ Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; x: string; y: string; delay: number; color: string; dur: number }>).map(({ Icon, x, y, delay, color, dur }, i) => (
              <div
                key={i}
                className="absolute animate-float-up"
                style={{ left: x, top: y, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: '#ffffff', border: '1px solid rgba(92,39,245,0.12)' }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={floatInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2
              className="font-black mb-4 leading-tight"
              style={{ fontSize: 'clamp(28px, 3.5vw, 52px)', color: '#0f0a1e' }}
            >
              3 marketplace, bitta panel
            </h2>
            <p
              className="text-base mb-6"
              style={{ color: '#6b7280', maxWidth: 500, margin: '0 auto 24px' }}
            >
              Uzum Market, Yandex Market va Wildberries &mdash; ularning barchasini bitta dashboarddan boshqaring.
            </p>
            <Link
              href="#features"
              className="inline-flex items-center gap-1 text-sm font-semibold transition-all hover:underline"
              style={{ color: '#5c27f5' }}
            >
              Barcha imkoniyatlarni ko&rsquo;rish <ArrowUpRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Market pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={floatInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex items-center justify-center gap-6 mt-12 flex-wrap"
          >
            {[
              { name: 'Uzum Market',   dot: '#fb923c' },
              { name: 'Yandex Market', dot: '#fbbf24' },
              { name: 'Wildberries',   dot: '#818cf8' },
            ].map(mp => (
              <div
                key={mp.name}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(92,39,245,0.10)',
                  color: '#374151',
                  boxShadow: '0 2px 12px rgba(92,39,245,0.07)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: mp.dot }} />
                {mp.name}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — FEATURES GRID
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        ref={featRef}
        className="px-6 py-20"
        style={{ background: isDark ? 'var(--bg-base)' : '#ffffff' }}
      >
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={featInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2
              className="font-black mb-3 leading-tight"
              style={{ fontSize: 'clamp(26px, 3.2vw, 48px)', color: textDark }}
            >
              {t.featuresTitle}
            </h2>
            <p className="text-base" style={{ color: textGray, maxWidth: 480, margin: '0 auto' }}>
              {t.featuresSubtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((f, i) => (
              <FeatureCard
                key={f.title}
                title={f.title}
                desc={f.desc}
                icon={FEAT_ICONS[i] ?? FEAT_ICONS[0]}
                index={i}
                inView={featInView}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 6 — PRICING PREVIEW
      ══════════════════════════════════════════════════════════════════ */}
      <section ref={pricingRef} className="px-6 py-20" style={{ background: '#ede9fe' }}>
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2
              className="font-black mb-3 leading-tight"
              style={{ fontSize: 'clamp(26px, 3.2vw, 48px)', color: '#0f0a1e' }}
            >
              Narxlar
            </h2>
            <p className="text-base" style={{ color: '#6b7280', maxWidth: 440, margin: '0 auto' }}>
              3 kun bepul sinab ko&rsquo;ring. Karta shart emas.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {plans.map((plan, i) => (
              <PricingCard
                key={plan.name}
                name={plan.name}
                desc={plan.desc}
                price={plan.price}
                period={plan.period}
                features={plan.features}
                highlight={plan.highlight}
                index={i}
                inView={pricingInView}
              />
            ))}
          </div>

          {/* Full-width purple CTA bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
              style={{ background: '#5c27f5', boxShadow: '0 8px 28px rgba(92,39,245,0.3)' }}
            >
              3 kun bepul boshlang <ArrowUpRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 7 — TESTIMONIALS
      ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={testiRef}
        className="px-6 py-20"
        style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}
      >
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={testiInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2
              className="font-black mb-3 leading-tight"
              style={{ fontSize: 'clamp(26px, 3.2vw, 48px)', color: '#0f0a1e' }}
            >
              Sotuvchilar nima deydi
            </h2>
            <p className="text-base" style={{ color: '#6b7280' }}>
              Daromadchi bilan savdolarini o&rsquo;stirgan sotuvchilar fikri
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {testimonials.map((item, i) => (
              <TestimonialCard
                key={item.name}
                quote={item.quote}
                name={item.name}
                role={item.role}
                index={i}
                inView={testiInView}
                offsetY={item.offsetY}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 8 — CTA SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="px-6 py-20"
        style={{ background: isDark ? 'var(--bg-base)' : '#ffffff' }}
      >
        <div className="max-w-[760px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2
              className="font-black mb-4 leading-tight"
              style={{ fontSize: 'clamp(28px, 3.5vw, 52px)', color: textDark }}
            >
              Bugun boshlang,{' '}
              <span style={{ color: '#5c27f5' }}>3 kun bepul</span>
            </h2>
            <p
              className="text-base mb-10"
              style={{ color: textGray, maxWidth: 460, margin: '0 auto 40px' }}
            >
              Karta shart emas. Ro&rsquo;yxatdan o&rsquo;ting va barcha imkoniyatlarni sinab ko&rsquo;ring.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 text-white font-bold px-10 py-4 rounded-2xl transition-all hover:opacity-90 text-base"
                style={{ background: '#5c27f5', boxShadow: '0 8px 28px rgba(92,39,245,0.35)' }}
              >
                Bepul boshlash <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 font-semibold px-10 py-4 rounded-2xl transition-all text-base"
                style={{
                  background: isDark ? 'var(--bg-card)' : '#f5f3ff',
                  border: '1px solid rgba(92,39,245,0.18)',
                  color: '#5c27f5',
                }}
              >
                Narxlarni ko&rsquo;rish
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 9 — FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer
        className="px-6 py-8"
        style={{
          background: isDark ? 'var(--bg-card)' : '#ffffff',
          borderTop: `1px solid ${isDark ? 'var(--border)' : 'rgba(92,39,245,0.10)'}`,
        }}
      >
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#5c27f5' }}
            >
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: textDark }}>Daromadchi</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: textGray }}>
            <Link href="/help"      className="hover:underline transition-all">Yordam</Link>
            <Link href="/pricing"   className="hover:underline transition-all">Narxlar</Link>
            <Link href="/dashboard" className="hover:underline transition-all">Dashboard</Link>
          </div>
          <p className="text-sm" style={{ color: textGray }}>&copy; 2026 Daromadchi.</p>
        </div>
      </footer>

      {/* ── STICKY BOTTOM BAR ────────────────────────────────────────────── */}
      <StickyBar />
    </div>
  )
}
