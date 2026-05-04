'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  ShieldCheck, Sparkles, ChevronRight, Activity, Sun, Moon,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── animated counter ───────────────────────────────────────────────────── */
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

function StatCard({ value, suffix, labelKey, delay, labelIdx }: {
  value: number; suffix: string; labelKey: Lang; labelIdx: number; delay: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useCounter(value, 2000, inView)
  const t = translations[labelKey]
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }} className="text-center">
      <div className="text-4xl sm:text-5xl font-black mb-2 tabular-nums" style={{ color: 'var(--text-base)' }}>
        {count.toLocaleString()}<span className="shimmer-text">{suffix}</span>
      </div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t.stats[labelIdx].label}</div>
    </motion.div>
  )
}

function NeonGrid() {
  const { theme } = useTheme()
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg className="absolute inset-0 w-full h-full animate-grid-fade" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none"
              stroke={theme === 'dark' ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}
              strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="animate-float absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-violet-600/10 blur-3xl animate-pulse-glow" />
      <div className="animate-float2 absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-600/8 blur-3xl animate-pulse-glow2" />
      <div className="animate-float3 absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-cyan-500/6 blur-3xl" />
    </div>
  )
}

/* ── theme + lang controls ──────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark'
        ? <Sun className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4 text-violet-500" />}
    </button>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const langs: Lang[] = ['uz', 'ru', 'en']

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all border"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: '#a78bfa' }}>
        {lang}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden border shadow-xl z-50"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', minWidth: '4rem' }}>
          {langs.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }}
              className="w-full px-3 py-2 text-xs font-bold uppercase text-left transition-all"
              style={{
                background: lang === l ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: lang === l ? '#a78bfa' : 'var(--text-muted)',
              }}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── dashboard preview ──────────────────────────────────────────────────── */
function DashboardPreview() {
  const { theme } = useTheme()
  const card  = theme === 'dark' ? '#0e0e1a' : '#ffffff'
  const card2 = theme === 'dark' ? '#13131f' : '#f8f8ff'
  const border = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.15)'
  const textMuted = theme === 'dark' ? '#64748b' : '#9ca3af'
  const textSub = theme === 'dark' ? '#475569' : '#d1d5db'

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl border animate-spin-slow" style={{ borderColor: 'rgba(139,92,246,0.1)' }} />
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/20 border" style={{ background: card, borderColor: border }}>
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: card2, borderColor: border }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 rounded-md h-5 mx-4 flex items-center px-2 border" style={{ background: 'var(--bg-input)', borderColor: border }}>
            <span className="text-[9px]" style={{ color: textMuted }}>daromadchi.uz/dashboard</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        </div>

        <div className="p-3 space-y-2.5">
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'Revenue',  v: '124.5M', c: 'text-violet-400', g: 'from-violet-500/20 to-transparent' },
              { l: 'Profit',   v: '38.2M',  c: 'text-emerald-400', g: 'from-emerald-500/20 to-transparent' },
              { l: 'Orders',   v: '1,842',  c: 'text-blue-400',    g: 'from-blue-500/20 to-transparent' },
              { l: 'Stock',    v: '3,410',  c: 'text-amber-400',   g: 'from-amber-500/20 to-transparent' },
            ].map(k => (
              <div key={k.l} className="rounded-xl p-2.5 relative overflow-hidden border" style={{ background: card2, borderColor: border }}>
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${k.g}`} />
                <p className="text-[9px] mb-1" style={{ color: textMuted }}>{k.l}</p>
                <p className={`font-bold text-sm ${k.c}`}>{k.v}</p>
                <p className="text-emerald-400 text-[9px] mt-0.5">↑ 12.4%</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 rounded-xl p-3 border" style={{ background: card2, borderColor: border }}>
              <p className="text-[9px] mb-2" style={{ color: textMuted }}>Daily revenue</p>
              <div className="flex items-end gap-1 h-16">
                {[30,55,40,70,45,85,65,90,75,60,80,95,70,85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm"
                    style={{ height: `${h}%`, background: 'linear-gradient(to top,rgba(139,92,246,0.8),rgba(99,102,241,0.4))', boxShadow: h > 70 ? '0 0 8px rgba(139,92,246,0.5)' : undefined }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3 border flex flex-col gap-2" style={{ background: card2, borderColor: border }}>
              <p className="text-[9px] self-start" style={{ color: textMuted }}>Categories</p>
              <div className="relative w-14 h-14 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke={textSub} strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(34,211,238,0.7)" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-6 top-1/3 rounded-xl px-3 py-2 shadow-lg shadow-emerald-500/10 hidden sm:block border"
        style={{ background: card2, borderColor: 'rgba(52,211,153,0.3)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">+12.4% revenue</span>
        </div>
      </motion.div>

      <motion.div animate={{ y: [0,8,0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -right-6 bottom-1/3 rounded-xl px-3 py-2 shadow-lg shadow-violet-500/10 hidden sm:block border"
        style={{ background: card2, borderColor: 'rgba(139,92,246,0.3)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-violet-400 text-xs font-medium">AI ready</span>
        </div>
      </motion.div>
    </div>
  )
}

/* ── feature icon config ────────────────────────────────────────────────── */
const featureIcons = [
  { Icon: BarChart2,    glow: 'hover:shadow-violet-500/20', border: 'hover:border-violet-500/40', iconBg: 'bg-violet-500/10 border-violet-500/20', iconColor: 'text-violet-400',  grad: 'from-violet-500 to-purple-600'  },
  { Icon: Calculator,  glow: 'hover:shadow-cyan-500/20',    border: 'hover:border-cyan-500/40',    iconBg: 'bg-cyan-500/10 border-cyan-500/20',     iconColor: 'text-cyan-400',    grad: 'from-cyan-500 to-blue-600'      },
  { Icon: AlertTriangle,glow:'hover:shadow-amber-500/20',  border: 'hover:border-amber-500/40',   iconBg: 'bg-amber-500/10 border-amber-500/20',   iconColor: 'text-amber-400',   grad: 'from-amber-500 to-orange-600'   },
  { Icon: FileText,    glow: 'hover:shadow-emerald-500/20', border: 'hover:border-emerald-500/40', iconBg: 'bg-emerald-500/10 border-emerald-500/20',iconColor: 'text-emerald-400', grad: 'from-emerald-500 to-green-600'  },
  { Icon: RefreshCw,   glow: 'hover:shadow-pink-500/20',    border: 'hover:border-pink-500/40',    iconBg: 'bg-pink-500/10 border-pink-500/20',     iconColor: 'text-pink-400',    grad: 'from-pink-500 to-rose-600'      },
  { Icon: DollarSign,  glow: 'hover:shadow-indigo-500/20',  border: 'hover:border-indigo-500/40',  iconBg: 'bg-indigo-500/10 border-indigo-500/20', iconColor: 'text-indigo-400',  grad: 'from-indigo-500 to-violet-600'  },
]

const stepColors = [
  { color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  { color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/30'   },
  { color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/30'   },
  { color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/30' },
]

/* ── main page ──────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { theme } = useTheme()
  const { lang }  = useLang()
  const t = translations[lang]

  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0,500], [0,-80])
  const heroOpacity = useTransform(scrollY, [0,400], [1,0])

  const featuresRef = useRef(null)
  const stepsRef    = useRef(null)
  const statsRef    = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })
  const stepsInView    = useInView(stepsRef,    { once: true, margin: '-100px' })
  const statsInView    = useInView(statsRef,    { once: true, margin: '-100px' })

  const card  = theme === 'dark' ? '#0e0e1a' : '#ffffff'
  const card2 = theme === 'dark' ? '#0e0e1a' : '#f8f8ff'

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <motion.header initial={{ y:-80, opacity:0 }} animate={{ y:0, opacity:1 }}
        transition={{ duration:0.6, ease:'easeOut' }} className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto backdrop-blur-xl rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl border"
            style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 neon-border">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-medium">
                <Zap className="w-2.5 h-2.5" /> Beta
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              <a href="#features" className="hover:text-violet-500 transition-colors">{t.nav.features}</a>
              <a href="#how"      className="hover:text-violet-500 transition-colors">{t.nav.how}</a>
              <a href="#stats"    className="hover:text-violet-500 transition-colors">{t.nav.stats}</a>
            </nav>

            <div className="flex items-center gap-2">
              <LangToggle />
              <ThemeToggle />
              <Link href="/login" className="hidden sm:block text-sm px-3 py-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}>
                {t.nav.login}
              </Link>
              <Link href="/login"
                className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/25">
                {t.nav.start} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 px-4 sm:px-6 overflow-hidden">
        <NeonGrid />
        <FloatingOrbs />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent animate-beam" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.6 }}
                className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                {t.badge}
              </motion.div>

              <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4, duration:0.7 }}
                className="text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-6"
                style={{ color: 'var(--text-base)' }}>
                {t.hero.title1}{' '}
                <span className="shimmer-text animate-neon-flicker">{t.hero.title2}</span>{' '}
                {t.hero.title3}
              </motion.h1>

              <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5, duration:0.6 }}
                className="text-lg max-w-lg mb-8 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.hero.subtitle}
              </motion.p>

              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.6, duration:0.6 }}
                className="flex flex-col sm:flex-row gap-3">
                <Link href="/login"
                  className="group flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-violet-500/30 text-sm">
                  {t.hero.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/dashboard"
                  className="flex items-center justify-center gap-2 font-medium px-7 py-3.5 rounded-2xl transition-all text-sm border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                  {t.hero.demo}
                </Link>
              </motion.div>

              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.9, duration:0.6 }}
                className="flex items-center gap-6 mt-8">
                {([
                  { Icon: ShieldCheck, label: t.hero.secure },
                  { Icon: Zap,         label: t.hero.fast },
                  { Icon: RefreshCw,   label: t.hero.sync },
                ] as const).map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Icon className="w-3.5 h-3.5 text-violet-400" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity:0, x:60, scale:0.95 }} animate={{ opacity:1, x:0, scale:1 }}
              transition={{ delay:0.5, duration:0.9, ease:'easeOut' }}>
              <DashboardPreview />
            </motion.div>
          </div>
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: `linear-gradient(to top, var(--bg-base), transparent)` }} />
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section id="stats" ref={statsRef} className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity:0, y:40 }} animate={statsInView ? { opacity:1, y:0 } : {}}
            transition={{ duration:0.6 }}
            className="relative rounded-3xl p-10 overflow-hidden border"
            style={{ background: card, borderColor: 'var(--border)' }}>
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <FloatingOrbs />
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-8">
              <StatCard value={6}   suffix="+"     labelKey={lang} labelIdx={0} delay={0}   />
              <StatCard value={30}  suffix="s"     labelKey={lang} labelIdx={1} delay={0.1} />
              <StatCard value={100} suffix="%"     labelKey={lang} labelIdx={2} delay={0.2} />
              <StatCard value={0}   suffix=" so'm" labelKey={lang} labelIdx={3} delay={0.3} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="py-24 px-4 sm:px-6 relative">
        <NeonGrid />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial={{ opacity:0, y:30 }} animate={featuresInView ? { opacity:1, y:0 } : {}}
            transition={{ duration:0.6 }} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" /> {t.featuresBadge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: 'var(--text-base)' }}>
              {t.featuresTitle.split(' ').slice(0,-2).join(' ')}{' '}
              <span className="shimmer-text">{t.featuresTitle.split(' ').slice(-2).join(' ')}</span>
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((f, i) => {
              const { Icon, glow, border, iconBg, iconColor, grad } = featureIcons[i]
              return (
                <motion.div key={f.title}
                  initial={{ opacity:0, y:40 }} animate={featuresInView ? { opacity:1, y:0 } : {}}
                  transition={{ delay: i*0.1, duration:0.6 }}
                  className={`neon-card group border rounded-2xl p-6 cursor-default hover:shadow-xl ${glow} ${border}`}
                  style={{ background: card2, borderColor: 'var(--border)' }}>
                  <div className={`w-11 h-11 rounded-xl ${iconBg} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: 'var(--text-base)' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                  <div className={`mt-4 h-px bg-gradient-to-r ${grad} opacity-0 group-hover:opacity-100 transition-opacity rounded-full`} />
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section id="how" ref={stepsRef} className="py-24 px-4 sm:px-6 relative overflow-hidden"
        style={{ background: theme === 'dark' ? '#0a0a14' : '#f0f0fa' }}>
        <FloatingOrbs />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial={{ opacity:0, y:30 }} animate={stepsInView ? { opacity:1, y:0 } : {}}
            transition={{ duration:0.6 }} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 text-xs text-cyan-400 font-medium mb-4">
              <Zap className="w-3.5 h-3.5" /> {t.howBadge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="shimmer-text">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity:0, y:40 }} animate={stepsInView ? { opacity:1, y:0 } : {}}
                transition={{ delay: i*0.15, duration:0.6 }}
                className="relative group">
                {i < t.steps.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent z-0" />
                )}
                <div className="relative z-10 border rounded-2xl p-6 transition-all group-hover:shadow-lg"
                  style={{ background: card2, borderColor: 'var(--border)' }}>
                  <div className={`w-11 h-11 rounded-xl ${stepColors[i].bg} border flex items-center justify-center text-base font-black ${stepColors[i].color} mb-5 group-hover:scale-110 transition-transform`}>
                    0{i+1}
                  </div>
                  <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-base)' }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <NeonGrid />
        <FloatingOrbs />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div initial={{ opacity:0, scale:0.95 }} whileInView={{ opacity:1, scale:1 }}
            viewport={{ once:true }} transition={{ duration:0.7 }}
            className="relative rounded-3xl p-10 sm:p-14 text-center overflow-hidden border"
            style={{ background: card }}>
            <div className="absolute inset-0 rounded-3xl border border-violet-500/20" />
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/10 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5" /> {t.ctaBadge}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: 'var(--text-base)' }}>
                {t.ctaTitle1} <span className="shimmer-text">{t.ctaTitle2}</span>
              </h2>
              <p className="mb-8 max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.ctaSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login"
                  className="group flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-violet-500/30 text-sm">
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/dashboard"
                  className="flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl transition-all text-sm border"
                  style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                  {t.hero.demo}
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi. {t.footer}</p>
          <Link href="/dashboard" className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            Dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
