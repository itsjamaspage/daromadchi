'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText, Zap,
  ArrowRight, RefreshCw, AlertTriangle, ShieldCheck,
  Activity, Sun, Moon, X, Layers,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── counter hook ─────────────────────────────────────────────────────────── */
function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let t0: number
    const tick = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [start, target, duration])
  return count
}

function StatNum({ value, suffix, label, delay, active }: {
  value: number; suffix: string; label: string; delay: number; active: boolean
}) {
  const n = useCounter(value, 2000, active)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5 }} className="text-center">
      <div className="text-4xl sm:text-5xl font-black mb-2 tabular-nums" style={{ color: 'var(--text-base)' }}>
        {n.toLocaleString()}<span className="neon-gradient-text">{suffix}</span>
      </div>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </motion.div>
  )
}

/* ── theme + lang ─────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
      style={{ background: 'var(--bg-input)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-violet-600" />}
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
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border2)', color: 'var(--neon-v)' }}>
        {lang}
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[3.5rem]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)' }}>
          {langs.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }}
              className="w-full px-3 py-2 text-[10px] font-black uppercase tracking-widest text-left transition-all"
              style={{ background: lang === l ? 'rgba(168,85,247,0.12)' : 'transparent', color: lang === l ? 'var(--neon-v)' : 'var(--text-muted)' }}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── dashboard mockup (Amzigo style) ─────────────────────────────────────── */
function DashboardMockup({ p }: { p: typeof import('@/lib/i18n').translations.en.preview }) {
  const kpis = [
    { l: p.revenue, v: '124.5M', c: 'var(--neon-v)' },
    { l: p.profit,  v: '38.2M',  c: '#34d399'        },
    { l: p.orders,  v: '1,842',  c: 'var(--neon-c)'  },
    { l: p.stock,   v: '3,410',  c: '#fbbf24'        },
  ]
  const bars = [28, 52, 38, 68, 44, 82, 62, 90, 72, 58, 78, 94, 68, 86]
  return (
    <div className="w-full rounded-2xl overflow-hidden neon-card"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--bg-card2)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex-1 mx-3 rounded-md h-5 flex items-center px-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => (
            <div key={k.l} className="rounded-xl p-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[9px] mt-0.5 text-emerald-400">↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-xl p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] mb-2" style={{ color: 'var(--text-muted)' }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-14">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm"
                  style={{ height: `${h}%`, background: h > 68 ? 'var(--neon-v)' : 'rgba(168,85,247,0.28)', boxShadow: h > 80 ? '0 0 8px var(--neon-v)' : undefined }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3 flex flex-col items-center justify-center" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] self-start mb-2" style={{ color: 'var(--text-muted)' }}>{p.categories}</p>
            <div className="w-11 h-11">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(168,85,247,0.9)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
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

/* ── feature icons ────────────────────────────────────────────────────────── */
const FEAT_ICONS = [
  { Icon: BarChart2,     c: 'text-violet-400',  bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.25)' },
  { Icon: Calculator,    c: 'text-cyan-400',    bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)' },
  { Icon: AlertTriangle, c: 'text-amber-400',   bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
  { Icon: FileText,      c: 'text-emerald-400', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  { Icon: RefreshCw,     c: 'text-pink-400',    bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.25)' },
  { Icon: Layers,        c: 'text-indigo-400',  bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)' },
]

const MARKETPLACES = [
  { name: 'Uzum Market',   dot: '#fb923c' },
  { name: 'Yandex Market', dot: '#fbbf24' },
  { name: 'Wildberries',   dot: '#a855f7' },
]

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme()
  const { lang }  = useLang()
  const t = translations[lang]
  const [banner, setBanner] = useState(true)

  const featRef  = useRef(null)
  const stepsRef = useRef(null)
  const statsRef = useRef(null)
  const featInView  = useInView(featRef,  { once: true, margin: '-80px' })
  const stepsInView = useInView(stepsRef, { once: true, margin: '-80px' })
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' })

  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* ── ANNOUNCEMENT BANNER ─────────────────────────────────────────── */}
      {banner && (
        <div className="relative py-2.5 px-8 text-center text-xs font-semibold text-white z-50"
          style={{ background: 'linear-gradient(90deg,#7c3aed 0%,#0891b2 50%,#7c3aed 100%)', backgroundSize: '200%', animation: 'shimmer 6s linear infinite' }}>
          🎉 Wildberries integratsiyasi qo'shildi! &nbsp;
          <Link href="/dashboard/settings" className="underline underline-offset-2 font-bold hover:opacity-80 transition-opacity">
            Hozir ulang →
          </Link>
          <button onClick={() => setBanner(false)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAVUS-STYLE NAVBAR
          Full width · border-bottom · ALL CAPS with ■ prefix
      ══════════════════════════════════════════════════════════════════ */}
      <motion.header initial={{ y: -52, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="sticky top-0 z-40"
        style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(18px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto px-6 h-[60px] flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)', boxShadow: isDark ? '0 0 16px rgba(168,85,247,0.5)' : '0 4px 12px rgba(124,58,237,0.3)' }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight" style={{ color: 'var(--text-base)' }}>DAROMADCHI</span>
          </Link>

          {/* Nav items — Tavus style: ALL CAPS + ■ prefix */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {[
              { href: '#features', label: t.nav.features.toUpperCase() },
              { href: '#how',      label: t.nav.how.toUpperCase()      },
              { href: '/pricing',  label: 'NARXLAR'                    },
              { href: '/help',     label: 'YORDAM'                     },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold tracking-wider transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-base)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <span style={{ color: 'var(--neon-v)', fontSize: 7 }}>■</span>
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login"
              className="hidden sm:block text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 transition-all"
              style={{ color: 'var(--text-muted)' }}>
              {t.nav.login.toUpperCase()}
            </Link>
            <Link href="/login"
              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white px-4 py-2.5 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: isDark ? '0 0 16px rgba(168,85,247,0.4)' : '0 4px 14px rgba(124,58,237,0.35)' }}>
              {t.nav.start.toUpperCase()} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Amzigo layout: left text + right product screenshot
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center px-6 py-20 overflow-hidden">

        {/* Background glow (dark only) */}
        {isDark && <>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 left-[40%] w-[700px] h-[700px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(ellipse, rgba(120,40,255,0.6) 0%, transparent 65%)' }} />
            <div className="absolute top-1/3 right-[-10%] w-[400px] h-[400px] rounded-full opacity-12"
              style={{ background: 'radial-gradient(ellipse, rgba(34,211,238,0.5) 0%, transparent 65%)' }} />
            {/* Neon beam */}
            <div className="absolute top-1/2 left-0 right-0 h-px animate-beam opacity-30"
              style={{ background: 'linear-gradient(90deg, transparent, var(--neon-c), transparent)' }} />
          </div>
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none opacity-25"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        </>}

        <div className="relative z-10 max-w-[1280px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* LEFT — text (Amzigo style: huge bold left-aligned) */}
            <div>
              {/* Marketplace pills */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45 }}
                className="flex flex-wrap items-center gap-2 mb-7">
                {MARKETPLACES.map(mp => (
                  <span key={mp.name}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: mp.dot, boxShadow: isDark ? `0 0 6px ${mp.dot}` : undefined }} />
                    {mp.name}
                  </span>
                ))}
              </motion.div>

              {/* Headline — very large bold like Amzigo */}
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }}
                className="font-black leading-[1.04] tracking-tight mb-5"
                style={{ fontSize: 'clamp(44px,5.5vw,80px)', color: 'var(--text-base)' }}>
                {lang === 'uz' ? (<>Do'koningizni<br /><span className="neon-gradient-text">to'liq nazorat</span><br />qiling</>) :
                 lang === 'ru' ? (<>Полный<br /><span className="neon-gradient-text">контроль</span><br />над магазином</>) :
                 (<>Take <span className="neon-gradient-text">full control</span><br />of your store</>)}
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.5 }}
                className="text-lg leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--text-muted)' }}>
                {t.hero.subtitle}
              </motion.p>

              {/* CTA buttons — Amzigo style */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/login"
                  className="group inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)', boxShadow: isDark ? '0 0 30px rgba(168,85,247,0.4), 0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(124,58,237,0.35)' }}>
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                  {t.hero.demo}
                </Link>
              </motion.div>

              {/* Trust signals */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.58, duration: 0.5 }}
                className="flex items-center gap-5">
                {[{ Icon: ShieldCheck, l: t.hero.secure }, { Icon: Zap, l: t.hero.fast }, { Icon: RefreshCw, l: t.hero.sync }]
                  .map(({ Icon, l }) => (
                    <div key={l} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--neon-v)' } as React.CSSProperties} />
                      {l}
                    </div>
                  ))}
              </motion.div>
            </div>

            {/* RIGHT — dashboard screenshot with floating cards (Amzigo) */}
            <motion.div initial={{ opacity: 0, x: 48, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.38, duration: 0.75, ease: 'easeOut' }}
              className="relative">

              {/* Floating card — top left */}
              <div className="animate-float-up absolute -left-6 top-8 rounded-2xl p-4 z-20 hidden lg:block"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', minWidth: 160, boxShadow: isDark ? '0 0 24px rgba(168,85,247,0.2), 0 16px 40px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)' }}>
                <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t.preview.orders} · 30 kun</p>
                <p className="text-2xl font-black" style={{ color: 'var(--text-base)' }}>1,842</p>
                <p className="text-xs font-bold text-emerald-400 mt-1">↑ 12.4% <span className="font-normal" style={{ color: 'var(--text-muted)' }}>o'tgan oy</span></p>
              </div>

              {/* Floating card — right */}
              <div className="animate-float-down absolute -right-6 top-1/3 rounded-2xl p-4 z-20 hidden lg:block"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', minWidth: 160, boxShadow: isDark ? '0 0 24px rgba(34,211,238,0.15), 0 16px 40px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)' }}>
                <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t.preview.revenue} · bugun</p>
                <p className="text-2xl font-black" style={{ color: 'var(--text-base)' }}>4.2M</p>
                <p className="text-xs font-bold mt-1" style={{ color: 'var(--neon-c)' }}>↑ 8.1% <span className="font-normal" style={{ color: 'var(--text-muted)' }}>kecha</span></p>
              </div>

              {/* Neon ring (dark only) */}
              {isDark && (
                <div className="absolute -inset-3 rounded-3xl animate-spin-slow pointer-events-none"
                  style={{ border: '1px solid', borderColor: 'rgba(168,85,247,0.12)' }} />
              )}

              <DashboardMockup p={t.preview} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-16 px-6" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card2)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {([
            { value: 6,   suffix: '+',     label: t.stats[0].label, delay: 0    },
            { value: 30,  suffix: 's',     label: t.stats[1].label, delay: 0.1  },
            { value: 100, suffix: '%',     label: t.stats[2].label, delay: 0.2  },
            { value: 0,   suffix: " so'm", label: t.stats[3].label, delay: 0.3  },
          ] as const).map(s => <StatNum key={s.label} {...s} active={statsInView} />)}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" ref={featRef} className="py-28 px-6">
        <div className="max-w-[1280px] mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={featInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="mb-14">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-3"
              style={{ color: 'var(--neon-v)' }}>
              <span style={{ fontSize: 6 }}>■</span> {t.featuresBadge.toUpperCase()}
            </p>
            <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(28px,3.5vw,48px)', color: 'var(--text-base)' }}>
              {t.featuresTitle}
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 480 }}>{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {t.features.map((f, i) => {
              const { Icon, c, bg, border } = FEAT_ICONS[i] ?? FEAT_ICONS[0]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 28 }} animate={featInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.07, duration: 0.5 }}
                  className="neon-card rounded-2xl p-6 cursor-default"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: bg, border: `1px solid ${border}` }}>
                    <Icon className={`w-5 h-5 ${c}`} />
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: 'var(--text-base)' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="how" ref={stepsRef} className="py-28 px-6"
        style={{ background: 'var(--bg-card2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="mb-14">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-3"
              style={{ color: 'var(--neon-c)' }}>
              <span style={{ fontSize: 6 }}>■</span> {t.howBadge.toUpperCase()}
            </p>
            <h2 className="font-black leading-tight" style={{ fontSize: 'clamp(28px,3.5vw,48px)', color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="neon-gradient-text">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 28 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="neon-card relative rounded-2xl p-6"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {i < t.steps.length - 1 && (
                  <div className="hidden lg:block absolute top-9 left-full w-4 h-px" style={{ background: 'linear-gradient(90deg,var(--neon-v),transparent)' }} />
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black mb-5"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: 'var(--neon-v)', boxShadow: isDark ? '0 0 12px rgba(168,85,247,0.2)' : undefined }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-base)' }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
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
            className="relative rounded-3xl p-12 sm:p-16 text-center overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)' }}>
            {isDark && <>
              <div className="absolute top-0 left-1/4 right-1/4 h-px" style={{ background: 'linear-gradient(90deg,transparent,var(--neon-v),transparent)' }} />
              <div className="absolute bottom-0 left-1/4 right-1/4 h-px" style={{ background: 'linear-gradient(90deg,transparent,var(--neon-c),transparent)' }} />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-40 blur-3xl opacity-25 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse,rgba(168,85,247,0.7) 0%,transparent 70%)' }} />
            </>}
            <div className="relative">
              <h2 className="font-black mb-4 leading-tight" style={{ fontSize: 'clamp(24px,3.5vw,44px)', color: 'var(--text-base)' }}>
                {t.ctaTitle1} <span className="neon-gradient-text">{t.ctaTitle2}</span>
              </h2>
              <p className="mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.ctaSubtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login"
                  className="group inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)', boxShadow: isDark ? '0 0 30px rgba(168,85,247,0.4)' : '0 8px 24px rgba(124,58,237,0.3)' }}>
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/pricing"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                  Narxlar →
                </Link>
              </div>
              <p className="text-xs mt-5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>3 kun bepul · Karta shart emas</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)' }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight" style={{ color: 'var(--text-base)' }}>DAROMADCHI</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Link href="/help"    className="hover:underline transition-all" style={{ ':hover': { color: 'var(--text-base)' } } as React.CSSProperties}>YORDAM</Link>
            <Link href="/pricing" className="hover:underline transition-all">NARXLAR</Link>
            <Link href="/dashboard" className="hover:underline transition-all">DASHBOARD</Link>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi.</p>
        </div>
      </footer>
    </div>
  )
}
