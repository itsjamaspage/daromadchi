'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  ShieldCheck, Sparkles, Activity, Sun, Moon, X, ChevronRight, Layers,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── animated counter ────────────────────────────────────────────────────── */
function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - progress, 3)) * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function StatNum({ value, suffix, label, delay, active }: {
  value: number; suffix: string; label: string; delay: number; active: boolean
}) {
  const count = useCounter(value, 2000, active)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5 }}>
      <div className="text-4xl sm:text-5xl font-black mb-2 tabular-nums text-white">
        {count.toLocaleString()}<span className="text-violet-400">{suffix}</span>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </motion.div>
  )
}

/* ── controls ─────────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border border-white/[0.08] hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07]"
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
      {theme === 'dark'
        ? <Sun className="w-3.5 h-3.5 text-amber-400" />
        : <Moon className="w-3.5 h-3.5 text-violet-500" />}
    </button>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const langs: Lang[] = ['uz', 'ru', 'en']

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase border border-white/[0.08] hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07] text-violet-400 transition-all">
        {lang}
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden border border-white/[0.1] shadow-2xl z-50 bg-[#0e0e1a] min-w-[4rem]">
          {langs.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }}
              className={`w-full px-3 py-2 text-[11px] font-bold uppercase text-left transition-all ${lang === l ? 'bg-violet-500/15 text-violet-400' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── dashboard preview (Amzigo-style) ────────────────────────────────────── */
function DashboardPreview({ p }: { p: typeof import('@/lib/i18n').translations.en.preview }) {
  const kpis = [
    { l: p.revenue,  v: '124.5M', c: '#a78bfa', bar: 'rgba(139,92,246,0.7)'  },
    { l: p.profit,   v: '38.2M',  c: '#34d399', bar: 'rgba(52,211,153,0.7)'  },
    { l: p.orders,   v: '1,842',  c: '#60a5fa', bar: 'rgba(96,165,250,0.7)'  },
    { l: p.stock,    v: '3,410',  c: '#fbbf24', bar: 'rgba(251,191,36,0.7)'  },
  ]
  const bars = [30, 55, 40, 70, 45, 85, 65, 90, 75, 60, 80, 95, 70, 88]

  return (
    <div className="relative">
      {/* Main card */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/[0.08]"
        style={{ background: '#0e0e1a' }}>
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]" style={{ background: '#13131f' }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex-1 rounded-md h-5 mx-4 flex items-center px-2 bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[9px] text-slate-500">daromadchi.uz/dashboard</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        </div>

        <div className="p-3 space-y-2.5">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2">
            {kpis.map(k => (
              <div key={k.l} className="rounded-xl p-2.5 border border-white/[0.05]" style={{ background: '#13131f' }}>
                <p className="text-[9px] text-slate-500 mb-1">{k.l}</p>
                <p className="font-bold text-sm" style={{ color: k.c }}>{k.v}</p>
                <p className="text-[9px] mt-0.5" style={{ color: k.c }}>↑ 12.4%</p>
              </div>
            ))}
          </div>

          {/* Chart + donut */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 rounded-xl p-3 border border-white/[0.05]" style={{ background: '#13131f' }}>
              <p className="text-[9px] text-slate-500 mb-2">{p.dailyRevenue}</p>
              <div className="flex items-end gap-0.5 h-16">
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm transition-all"
                    style={{ height: `${h}%`, background: h > 70 ? 'rgba(139,92,246,0.85)' : 'rgba(139,92,246,0.35)', boxShadow: h > 80 ? '0 0 6px rgba(139,92,246,0.5)' : undefined }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3 border border-white/[0.05] flex flex-col items-center justify-center gap-2" style={{ background: '#13131f' }}>
              <p className="text-[9px] text-slate-500 self-start">{p.categories}</p>
              <div className="relative w-12 h-12">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(139,92,246,0.85)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(34,211,238,0.7)" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating stat cards — Amzigo style */}
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-12 top-1/4 rounded-2xl p-3.5 shadow-2xl shadow-emerald-500/10 hidden lg:block border border-emerald-500/20"
        style={{ background: '#0e0e1a', minWidth: 160 }}>
        <p className="text-[10px] text-slate-500 mb-1">{p.orders} · 30 kun</p>
        <p className="text-2xl font-black text-white">1,842</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-emerald-400 text-xs font-semibold">↑ 12.4%</span>
          <span className="text-slate-600 text-[10px]">o'tgan oyga</span>
        </div>
      </motion.div>

      <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -right-12 top-1/3 rounded-2xl p-3.5 shadow-2xl shadow-violet-500/10 hidden lg:block border border-violet-500/20"
        style={{ background: '#0e0e1a', minWidth: 160 }}>
        <p className="text-[10px] text-slate-500 mb-1">{p.revenue} · bugun</p>
        <p className="text-2xl font-black text-white">4.2M</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-violet-400 text-xs font-semibold">↑ 8.1%</span>
          <span className="text-slate-600 text-[10px]">kecha nisbatan</span>
        </div>
      </motion.div>

      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -right-10 bottom-10 rounded-2xl p-3 shadow-2xl shadow-blue-500/10 hidden lg:block border border-blue-500/20"
        style={{ background: '#0e0e1a' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white text-xs font-semibold">{p.revenueUp}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">3 marketplace</p>
      </motion.div>
    </div>
  )
}

/* ── feature config ───────────────────────────────────────────────────────── */
const featureIcons = [
  { Icon: BarChart2,     iconColor: 'text-violet-400',  iconBg: 'bg-violet-500/10 border-violet-500/20',   accent: 'violet'   },
  { Icon: Calculator,    iconColor: 'text-cyan-400',    iconBg: 'bg-cyan-500/10 border-cyan-500/20',       accent: 'cyan'     },
  { Icon: AlertTriangle, iconColor: 'text-amber-400',   iconBg: 'bg-amber-500/10 border-amber-500/20',     accent: 'amber'    },
  { Icon: FileText,      iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20', accent: 'emerald'  },
  { Icon: RefreshCw,     iconColor: 'text-pink-400',    iconBg: 'bg-pink-500/10 border-pink-500/20',       accent: 'pink'     },
  { Icon: Layers,        iconColor: 'text-indigo-400',  iconBg: 'bg-indigo-500/10 border-indigo-500/20',   accent: 'indigo'   },
]

/* ── marketplace badges ───────────────────────────────────────────────────── */
const MARKETPLACES = [
  { name: 'Uzum Market',    color: 'text-orange-400',  dot: 'bg-orange-400'  },
  { name: 'Yandex Market',  color: 'text-yellow-400',  dot: 'bg-yellow-400'  },
  { name: 'Wildberries',    color: 'text-purple-400',  dot: 'bg-purple-400'  },
]

/* ── main page ────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { lang } = useLang()
  const t = translations[lang]
  const [bannerOpen, setBannerOpen] = useState(true)

  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -60])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])

  const featuresRef = useRef(null)
  const stepsRef    = useRef(null)
  const statsRef    = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })
  const stepsInView    = useInView(stepsRef,    { once: true, margin: '-80px' })
  const statsInView    = useInView(statsRef,    { once: true, margin: '-80px' })

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07070f] text-white selection:bg-violet-500/30">

      {/* ── Announcement banner (Tavus-style) ───────────────────────────── */}
      {bannerOpen && (
        <div className="relative bg-violet-600 text-white text-center py-2.5 px-8 text-xs font-medium z-50">
          <span className="opacity-90">🎉 Wildberries integratsiyasi qo'shildi!</span>
          <Link href="/dashboard/settings" className="ml-2 underline underline-offset-2 font-bold hover:opacity-80 transition-opacity">
            Hozir ulang →
          </Link>
          <button onClick={() => setBannerOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Navbar (Tavus-style: full-width, minimal, markers before links) ── */}
      <motion.header initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07070f]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors">Daromadchi</span>
          </Link>

          {/* Nav links — Tavus style with ■ markers */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '#features', label: t.nav.features },
              { href: '#how',      label: t.nav.how      },
              { href: '/pricing',  label: 'Narxlar'      },
              { href: '/help',     label: 'Yordam'       },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                <span className="text-[8px] text-violet-500/60">■</span>
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login"
              className="hidden sm:block text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">
              {t.nav.login}
            </Link>
            <Link href="/login"
              className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20">
              {t.nav.start} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-56px)] flex items-center pt-16 pb-20 px-5 overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.15) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Glow blobs */}
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-violet-600/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-16 items-center">

            {/* Left — text */}
            <div>
              {/* Marketplace pills */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-wrap items-center gap-2 mb-8">
                {MARKETPLACES.map(mp => (
                  <span key={mp.name} className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
                    <span className={`w-1.5 h-1.5 rounded-full ${mp.dot}`} />
                    <span className="text-slate-300">{mp.name}</span>
                  </span>
                ))}
              </motion.div>

              {/* Headline — Amzigo + Tavus: very large, bold, editorial */}
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-5xl sm:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight mb-6">
                {lang === 'uz' ? (
                  <>
                    Do'koningizni<br />
                    <span className="text-violet-400">to'liq nazorat</span><br />
                    qiling
                  </>
                ) : lang === 'ru' ? (
                  <>
                    Полный<br />
                    <span className="text-violet-400">контроль</span><br />
                    над магазином
                  </>
                ) : (
                  <>
                    Take full<br />
                    <span className="text-violet-400">control</span><br />
                    of your store
                  </>
                )}
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="text-lg text-slate-400 max-w-md mb-8 leading-relaxed">
                {t.hero.subtitle}
              </motion.p>

              {/* CTAs — Amzigo style */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/login"
                  className="group inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-xl shadow-violet-500/25 text-sm">
                  {t.hero.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] text-slate-300 transition-all text-sm">
                  {t.hero.demo}
                </Link>
              </motion.div>

              {/* Trust signals */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
                className="flex items-center gap-5">
                {[
                  { Icon: ShieldCheck, label: t.hero.secure },
                  { Icon: Zap,         label: t.hero.fast   },
                  { Icon: RefreshCw,   label: t.hero.sync   },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon className="w-3.5 h-3.5 text-violet-500" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — dashboard preview (more prominent, Amzigo-style) */}
            <motion.div initial={{ opacity: 0, x: 40, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              className="lg:pl-8">
              <DashboardPreview p={t.preview} />
            </motion.div>
          </div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #07070f, transparent)' }} />
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-16 px-5 border-y border-white/[0.05]" style={{ background: '#0a0a12' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {([
              { value: 6,   suffix: '+',     label: t.stats[0].label, delay: 0   },
              { value: 30,  suffix: 's',     label: t.stats[1].label, delay: 0.1 },
              { value: 100, suffix: '%',     label: t.stats[2].label, delay: 0.2 },
              { value: 0,   suffix: " so'm", label: t.stats[3].label, delay: 0.3 },
            ] as const).map(item => (
              <StatNum key={item.label} {...item} active={statsInView} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="mb-14">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[8px] text-violet-500">■</span>
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">{t.featuresBadge}</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4 max-w-lg leading-tight">
              {t.featuresTitle}
            </h2>
            <p className="text-slate-400 max-w-md">{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {t.features.map((f, i) => {
              const { Icon, iconColor, iconBg } = featureIcons[i] ?? featureIcons[0]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 30 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] hover:bg-white/[0.02] transition-all cursor-default"
                  style={{ background: '#0e0e1a' }}>
                  <div className={`w-10 h-10 rounded-xl ${iconBg} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how" ref={stepsRef} className="py-24 px-5 border-t border-white/[0.05]" style={{ background: '#0a0a12' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="mb-14">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[8px] text-cyan-500">■</span>
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">{t.howBadge}</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">
              {t.howTitle1} <span className="text-violet-400">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 30 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative group border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all"
                style={{ background: '#0e0e1a' }}>
                {i < t.steps.length - 1 && (
                  <div className="hidden lg:block absolute top-9 left-full w-4 h-px bg-gradient-to-r from-violet-500/40 to-transparent z-0" />
                )}
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-sm font-black text-violet-400 mb-5 group-hover:scale-110 transition-transform">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-bold text-white text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-12 sm:p-16 overflow-hidden border border-white/[0.08]"
            style={{ background: '#0e0e1a' }}>
            {/* top + bottom accent lines */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-40 bg-violet-600/10 blur-3xl pointer-events-none" />

            <div className="relative text-center">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5" /> {t.ctaBadge}
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
                {t.ctaTitle1} <span className="text-violet-400">{t.ctaTitle2}</span>
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">{t.ctaSubtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login"
                  className="group inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-violet-500/25 text-sm">
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/pricing"
                  className="inline-flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-slate-300 transition-all text-sm">
                  Narxlar <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-xs text-slate-600 mt-4">3 kun bepul · Karta shart emas</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-white">Daromadchi</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="/help" className="hover:text-slate-400 transition-colors">Yordam</Link>
            <Link href="/pricing" className="hover:text-slate-400 transition-colors">Narxlar</Link>
            <Link href="/dashboard" className="hover:text-slate-400 transition-colors">Dashboard</Link>
          </div>
          <p className="text-xs text-slate-600">© 2026 Daromadchi. {t.footer}</p>
        </div>
      </footer>
    </div>
  )
}
