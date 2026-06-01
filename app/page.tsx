'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle,
  ShieldCheck, Activity, Sun, Moon, X, ChevronRight, Layers,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

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
      transition={{ delay, duration: 0.5 }} className="text-center">
      <div className="text-4xl sm:text-5xl font-black mb-1.5 tabular-nums">
        {count.toLocaleString()}<span className="text-violet-400">{suffix}</span>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </motion.div>
  )
}

/* ── Theme + Lang ─────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 hover:border-white/20 hover:bg-white/[0.06] transition-all">
      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-violet-400" />}
    </button>
  )
}
function LangToggle() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const langs: Lang[] = ['uz', 'ru', 'en']
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase border border-white/10 hover:border-white/20 text-violet-400 hover:bg-white/[0.06] transition-all">
        {lang}
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 bg-[#0e0e1a] min-w-[3.5rem]">
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

/* ── Dashboard mockup ─────────────────────────────────────────────────────── */
function DashboardMockup({ p }: { p: typeof import('@/lib/i18n').translations.en.preview }) {
  const kpis = [
    { l: p.revenue,  v: '124.5M', c: '#a78bfa' },
    { l: p.profit,   v: '38.2M',  c: '#34d399' },
    { l: p.orders,   v: '1,842',  c: '#60a5fa' },
    { l: p.stock,    v: '3,410',  c: '#fbbf24' },
  ]
  const bars = [28, 52, 38, 68, 44, 82, 62, 90, 72, 58, 78, 94, 68, 86]
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.09] shadow-[0_40px_80px_rgba(0,0,0,0.6)]" style={{ background: '#0d0d1a' }}>
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]" style={{ background: '#111124' }}>
        <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/80" /><div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" /><div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" /></div>
        <div className="flex-1 mx-4 rounded-md h-5 flex items-center px-2 bg-white/[0.04] border border-white/[0.05]">
          <span className="text-[9px] text-slate-500">daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => (
            <div key={k.l} className="rounded-xl p-2.5 border border-white/[0.05]" style={{ background: '#13132a' }}>
              <p className="text-[9px] text-slate-500 mb-1">{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[9px] mt-0.5" style={{ color: k.c }}>↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-xl p-3 border border-white/[0.05]" style={{ background: '#13132a' }}>
            <p className="text-[9px] text-slate-500 mb-2">{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-14">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm"
                  style={{ height: `${h}%`, background: h > 68 ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.3)', boxShadow: h > 80 ? '0 0 8px rgba(139,92,246,0.5)' : undefined }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3 border border-white/[0.05] flex flex-col items-center justify-center" style={{ background: '#13132a' }}>
            <p className="text-[9px] text-slate-500 self-start mb-2">{p.categories}</p>
            <div className="w-11 h-11">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(139,92,246,0.9)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(34,211,238,0.7)" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const featureIcons = [
  { Icon: BarChart2,     iconColor: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20'   },
  { Icon: Calculator,    iconColor: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20'       },
  { Icon: AlertTriangle, iconColor: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'     },
  { Icon: FileText,      iconColor: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { Icon: RefreshCw,     iconColor: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20'       },
  { Icon: Layers,        iconColor: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20'   },
]

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { lang } = useLang()
  const t = translations[lang]
  const [banner, setBanner] = useState(true)

  const featuresRef = useRef(null)
  const stepsRef    = useRef(null)
  const statsRef    = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })
  const stepsInView    = useInView(stepsRef,    { once: true, margin: '-80px' })
  const statsInView    = useInView(statsRef,    { once: true, margin: '-80px' })

  return (
    <div className="min-h-screen overflow-x-hidden text-white" style={{ background: '#06060e' }}>

      {/* ── ANNOUNCEMENT BANNER ────────────────────────────────────────────── */}
      {banner && (
        <div className="relative z-50 py-2.5 px-8 text-center text-xs font-medium"
          style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5,#7c3aed)', backgroundSize: '200% 100%' }}>
          <span className="opacity-90 mr-1.5">🎉 Wildberries integratsiyasi qo'shildi!</span>
          <Link href="/dashboard/settings" className="font-bold underline underline-offset-2 hover:opacity-80 transition-opacity">
            Hozir ulang →
          </Link>
          <button onClick={() => setBanner(false)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <motion.header initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }}
        className="sticky top-0 z-40 border-b border-white/[0.06]"
        style={{ background: 'rgba(6,6,14,0.88)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-white group-hover:text-violet-300 transition-colors tracking-tight">Daromadchi</span>
          </Link>

          {/* Nav with Tavus ■ markers */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '#features', label: t.nav.features },
              { href: '#how',      label: t.nav.how      },
              { href: '/pricing',  label: 'Narxlar'      },
              { href: '/help',     label: 'Yordam'       },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all font-medium">
                <span className="text-[7px] text-violet-500/50">■</span>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 font-medium">
              {t.nav.login}
            </Link>
            <Link href="/login"
              className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20">
              {t.nav.start} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── HERO: centered headline + full-width dashboard below (Tavus layout) ── */}
      <section className="relative pt-20 pb-0 px-6 overflow-hidden">
        {/* Background: large glow blobs like Tavus */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-30"
            style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.5) 0%, rgba(79,70,229,0.2) 40%, transparent 70%)' }} />
          <div className="absolute top-10 left-[10%] w-72 h-72 rounded-full blur-[80px] opacity-20"
            style={{ background: 'rgba(139,92,246,0.6)' }} />
          <div className="absolute top-20 right-[10%] w-48 h-48 rounded-full blur-[60px] opacity-15"
            style={{ background: 'rgba(99,102,241,0.6)' }} />
          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Center-aligned hero text */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Marketplace pills */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { name: 'Uzum Market',   dot: 'bg-orange-400' },
              { name: 'Yandex Market', dot: 'bg-yellow-400' },
              { name: 'Wildberries',   dot: 'bg-purple-400' },
            ].map(mp => (
              <span key={mp.name} className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border border-white/[0.1] text-slate-300"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${mp.dot} flex-shrink-0`} />
                {mp.name}
              </span>
            ))}
          </motion.div>

          {/* Huge headline — Amzigo style */}
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="font-black leading-[1.04] tracking-tight mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}>
            {lang === 'uz' ? (
              <>Do'koningizni<br /><span className="text-violet-400">to'liq nazorat</span> qiling</>
            ) : lang === 'ru' ? (
              <>Полный <span className="text-violet-400">контроль</span><br />над вашим магазином</>
            ) : (
              <>Take <span className="text-violet-400">full control</span><br />of your store</>
            )}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
            className="text-lg text-slate-400 max-w-xl mx-auto mb-9 leading-relaxed">
            {t.hero.subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/login"
              className="group inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-violet-500/30 text-sm">
              {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/dashboard"
              className="inline-flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.04] text-slate-300 transition-all text-sm">
              {t.hero.demo}
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center justify-center gap-5 mb-16">
            {[
              { Icon: ShieldCheck, label: t.hero.secure },
              { Icon: Zap,         label: t.hero.fast   },
              { Icon: RefreshCw,   label: t.hero.sync   },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                <Icon className="w-3.5 h-3.5 text-violet-600" /> {label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Full-width dashboard showcase — Amzigo style */}
        <motion.div initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 max-w-5xl mx-auto">
          {/* Floating stat card — left */}
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-4 top-12 rounded-2xl p-4 shadow-2xl border border-emerald-500/20 z-20 hidden sm:block"
            style={{ background: '#0e0e1a', minWidth: 168 }}>
            <p className="text-[10px] text-slate-500 mb-1.5">{t.preview.orders} · 30 kun</p>
            <p className="text-3xl font-black text-white">1,842</p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-emerald-400 text-xs font-bold">↑ 12.4%</span>
              <span className="text-slate-600 text-[10px]">o'tgan oyga</span>
            </div>
          </motion.div>

          {/* Floating stat card — right */}
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute -right-4 top-16 rounded-2xl p-4 shadow-2xl border border-violet-500/20 z-20 hidden sm:block"
            style={{ background: '#0e0e1a', minWidth: 168 }}>
            <p className="text-[10px] text-slate-500 mb-1.5">{t.preview.revenue} · bugun</p>
            <p className="text-3xl font-black text-white">4.2M</p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-violet-400 text-xs font-bold">↑ 8.1%</span>
              <span className="text-slate-600 text-[10px]">kecha nisbatan</span>
            </div>
          </motion.div>

          {/* Dashboard */}
          <div className="relative mx-6 sm:mx-12">
            <DashboardMockup p={t.preview} />
            {/* Fade bottom to section below */}
            <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{ background: 'linear-gradient(to top, #06060e, transparent)' }} />
          </div>
        </motion.div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="pt-24 pb-20 px-6 border-b border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {([
              { value: 6,   suffix: '+',     label: t.stats[0].label, delay: 0    },
              { value: 30,  suffix: 's',     label: t.stats[1].label, delay: 0.1  },
              { value: 100, suffix: '%',     label: t.stats[2].label, delay: 0.2  },
              { value: 0,   suffix: " so'm", label: t.stats[3].label, delay: 0.3  },
            ] as const).map(item => (
              <StatNum key={item.label} {...item} active={statsInView} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="max-w-2xl mb-16">
            <p className="flex items-center gap-2 text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">
              <span className="text-[7px]">■</span> {t.featuresBadge}
            </p>
            <h2 className="font-black leading-tight mb-4" style={{ fontSize: 'clamp(32px,4vw,52px)' }}>
              {t.featuresTitle}
            </h2>
            <p className="text-slate-400 text-lg">{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {t.features.map((f, i) => {
              const { Icon, iconColor, bg } = featureIcons[i] ?? featureIcons[0]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 28 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.07, duration: 0.5 }}
                  className="group rounded-2xl p-6 border border-white/[0.07] hover:border-violet-500/25 hover:bg-violet-500/[0.03] transition-all cursor-default"
                  style={{ background: '#0d0d1a' }}>
                  <div className={`w-11 h-11 rounded-xl ${bg} border flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
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

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="how" ref={stepsRef} className="py-28 px-6 border-t border-white/[0.05]" style={{ background: '#09091a' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="max-w-2xl mb-16">
            <p className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-4">
              <span className="text-[7px]">■</span> {t.howBadge}
            </p>
            <h2 className="font-black leading-tight" style={{ fontSize: 'clamp(32px,4vw,52px)' }}>
              {t.howTitle1} <span className="text-violet-400">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 28 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="relative group rounded-2xl p-6 border border-white/[0.07] hover:border-violet-500/25 transition-all"
                style={{ background: '#0d0d1a' }}>
                {i < t.steps.length - 1 && (
                  <div className="hidden lg:block absolute top-9 left-full w-4 h-px bg-gradient-to-r from-violet-500/30 to-transparent" />
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

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-12 sm:p-16 text-center overflow-hidden border border-white/[0.08]"
            style={{ background: '#0d0d1a' }}>
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 blur-3xl pointer-events-none opacity-30"
              style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.6) 0%, transparent 70%)' }} />
            <div className="relative">
              <h2 className="font-black mb-4 leading-tight" style={{ fontSize: 'clamp(28px,4vw,48px)' }}>
                {t.ctaTitle1} <span className="text-violet-400">{t.ctaTitle2}</span>
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">{t.ctaSubtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login"
                  className="group inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-violet-500/25 text-sm">
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/pricing"
                  className="inline-flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl border border-white/[0.1] hover:border-white/20 text-slate-300 transition-all text-sm">
                  Narxlar <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-xs text-slate-600 mt-5">3 kun bepul · Karta shart emas</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">Daromadchi</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="/help" className="hover:text-slate-300 transition-colors">Yordam</Link>
            <Link href="/pricing" className="hover:text-slate-300 transition-colors">Narxlar</Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          </div>
          <p className="text-xs text-slate-600">© 2026 Daromadchi. {t.footer}</p>
        </div>
      </footer>
    </div>
  )
}
