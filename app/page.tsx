'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText, Zap,
  ArrowRight, RefreshCw, AlertTriangle, ShieldCheck,
  Activity, Sun, Moon, X, Layers, ChevronRight,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── typewriter ───────────────────────────────────────────────────────────── */
function useTypewriter(words: string[], speed = 80, pause = 1800) {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = words[idx % words.length]
    let timeout: ReturnType<typeof setTimeout>
    if (!deleting && displayed.length < word.length) {
      timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), speed)
    } else if (!deleting && displayed.length === word.length) {
      timeout = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), speed / 2)
    } else {
      setDeleting(false)
      setIdx(i => i + 1)
    }
    return () => clearTimeout(timeout)
  }, [displayed, deleting, idx, words, speed, pause])

  return displayed
}

/* ── counter ──────────────────────────────────────────────────────────────── */
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

/* ── particles canvas (dark only) ────────────────────────────────────────── */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      color: Math.random() > 0.6 ? '#00d4ff' : '#ff2d9b',
      alpha: Math.random() * 0.5 + 0.15,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })
      // draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 100) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - d / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
}

/* ── theme + lang ─────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border"
      style={{ background: 'var(--bg-card2)', borderColor: 'var(--border2)' }}>
      {theme === 'dark'
        ? <Sun className="w-4 h-4" style={{ color: '#fbbf24' }} />
        : <Moon className="w-4 h-4" style={{ color: 'var(--c1)' }} />}
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all"
        style={{ background: 'var(--bg-card2)', borderColor: 'var(--border2)', color: 'var(--c1)', fontFamily: 'var(--font-display)' }}>
        {lang} <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[4rem]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)' }}>
            {langs.map(l => (
              <button key={l} onClick={() => { setLang(l); setOpen(false) }}
                className="w-full px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-left transition-all"
                style={{ background: lang === l ? 'rgba(0,212,255,0.1)' : 'transparent', color: lang === l ? 'var(--c1)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── dashboard mockup ─────────────────────────────────────────────────────── */
function DashboardMockup({ p }: { p: typeof import('@/lib/i18n').translations.en.preview }) {
  const kpis = [
    { l: p.revenue, v: '124.5M', c: 'var(--c1)' },
    { l: p.profit,  v: '38.2M',  c: '#34d399'   },
    { l: p.orders,  v: '1,842',  c: 'var(--c2)'  },
    { l: p.stock,   v: '3,410',  c: '#fbbf24'   },
  ]
  const bars = [28, 52, 38, 68, 44, 82, 62, 90, 72, 58, 78, 94, 68, 86]
  return (
    <div className="w-full rounded-2xl overflow-hidden neon-card"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--bg-card2)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div className="flex-1 mx-3 rounded-md h-5 flex items-center px-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 animate-pulse" style={{ color: '#34d399' }} />
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => (
            <div key={k.l} className="rounded-xl p-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.c, fontFamily: 'var(--font-display)' }}>{k.v}</p>
              <p className="text-[9px] mt-0.5 text-emerald-400">↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-xl p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] mb-2" style={{ color: 'var(--text-muted)' }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-14">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t"
                  style={{ height: `${h}%`, background: h > 68 ? 'var(--c1)' : 'rgba(0,212,255,0.22)', boxShadow: h > 80 ? '0 0 6px var(--c1)' : undefined }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3 flex flex-col items-center justify-center" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] self-start mb-2" style={{ color: 'var(--text-muted)' }}>{p.categories}</p>
            <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="4" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--c1)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--c2)" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── feature data ─────────────────────────────────────────────────────────── */
const FEAT_ICONS = [
  { Icon: BarChart2,     c: 'var(--c1)',  bg: 'rgba(0,212,255,0.08)',   border: 'rgba(0,212,255,0.22)'  },
  { Icon: Calculator,    c: '#34d399',    bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.22)' },
  { Icon: AlertTriangle, c: '#fbbf24',    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
  { Icon: FileText,      c: 'var(--c2)',  bg: 'rgba(255,45,155,0.08)', border: 'rgba(255,45,155,0.22)' },
  { Icon: RefreshCw,     c: '#a78bfa',    bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
  { Icon: Layers,        c: '#fb923c',    bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.22)' },
]

const MARKETS = [
  { name: 'Uzum Market',   dot: '#fb923c' },
  { name: 'Yandex Market', dot: '#fbbf24' },
  { name: 'Wildberries',   dot: 'var(--c2)' },
]

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme()
  const { lang }  = useLang()
  const t = translations[lang]
  const isDark = theme === 'dark'
  const [banner, setBanner] = useState(true)

  const typedWords = lang === 'uz'
    ? ["do'konni", 'savdoni', 'daromadni', 'reklamani']
    : lang === 'ru'
    ? ['магазин', 'продажи', 'прибыль', 'рекламу']
    : ['your store', 'your sales', 'your profit', 'your ads']
  const typed = useTypewriter(typedWords, 75, 1600)

  const featRef  = useRef(null)
  const stepsRef = useRef(null)
  const statsRef = useRef(null)
  const featInView  = useInView(featRef,  { once: true, margin: '-80px' })
  const stepsInView = useInView(stepsRef, { once: true, margin: '-80px' })
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' })

  /* stat counters */
  const c0 = useCounter(6,   1800, statsInView)
  const c1 = useCounter(30,  1800, statsInView)
  const c2 = useCounter(100, 1800, statsInView)

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* ── ANNOUNCEMENT BANNER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ height: 40, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            className="relative flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
            style={{ background: 'linear-gradient(90deg,#0284c7,var(--c2),#0284c7)', backgroundSize: '200% 100%', animation: 'grad-shift 4s ease infinite', height: 40 }}>
            🎉 Wildberries integratsiyasi qo'shildi! &nbsp;
            <Link href="/dashboard/settings" className="underline underline-offset-2 font-bold hover:opacity-80">
              Hozir ulang →
            </Link>
            <button onClick={() => setBanner(false)} className="absolute right-4 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          NAVBAR — Tavus style: full-width, uppercase, ■ markers, glowing CTA
      ══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40" style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(20px)', borderBottom: `1px solid var(--border2)` }}>
        {/* Glowing top line */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, var(--c1), var(--c2), var(--c1), transparent)`, opacity: isDark ? 0.7 : 0.4 }} />

        <div className="max-w-[1300px] mx-auto px-6 h-16 flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, var(--c1), var(--c2))`, boxShadow: isDark ? '0 0 18px rgba(0,212,255,0.4)' : '0 4px 12px rgba(2,132,199,0.35)' }}>
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              DAROMADCHI
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden md:block h-5 w-px" style={{ background: 'var(--border2)' }} />

          {/* Nav links — Tavus: ■ + ALL CAPS */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {[
              { href: '#features', label: t.nav.features },
              { href: '#how',      label: t.nav.how      },
              { href: '/pricing',  label: 'Narxlar'      },
              { href: '/help',     label: 'Yordam'       },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="group flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all relative overflow-hidden"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-base)'; el.style.background = 'var(--bg-card2)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.background = 'transparent' }}>
                <span className="text-[7px] transition-colors" style={{ color: 'var(--c1)' }}>■</span>
                {item.label.toUpperCase()}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <LangToggle />
            <ThemeToggle />
            <div className="hidden sm:block h-5 w-px mx-1" style={{ background: 'var(--border2)' }} />
            <Link href="/login"
              className="hidden sm:block text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              {t.nav.login.toUpperCase()}
            </Link>
            <Link href="/login"
              className="btn-cta flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white px-5 py-2.5 rounded-xl transition-all"
              style={{ background: `linear-gradient(135deg, var(--c1), var(--c2))`, boxShadow: isDark ? '0 0 20px rgba(0,212,255,0.3)' : '0 4px 14px rgba(2,132,199,0.35)', fontFamily: 'var(--font-display)' }}>
              {t.nav.start.toUpperCase()} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Amzigo: left text + right product screenshot
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center px-6 py-20 overflow-hidden">
        {isDark && <Particles />}

        {/* Background glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
          {isDark && <>
            <div className="absolute -top-40 -left-20 w-[700px] h-[700px] rounded-full opacity-15"
              style={{ background: 'radial-gradient(ellipse, var(--c1) 0%, transparent 65%)' }} />
            <div className="absolute -bottom-40 right-[-10%] w-[500px] h-[500px] rounded-full opacity-10"
              style={{ background: 'radial-gradient(ellipse, var(--c2) 0%, transparent 65%)' }} />
          </>}
        </div>

        <div className="relative max-w-[1300px] mx-auto w-full" style={{ zIndex: 2 }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-16 xl:gap-24 items-center">

            {/* LEFT */}
            <div>
              {/* Marketplace pills */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}
                className="flex flex-wrap items-center gap-2 mb-8">
                {MARKETS.map(mp => (
                  <span key={mp.name} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: mp.dot, boxShadow: isDark ? `0 0 5px ${mp.dot}` : undefined }} />
                    {mp.name}
                  </span>
                ))}
              </motion.div>

              {/* HEADLINE with typewriter */}
              <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
                <h1 className="font-black leading-[1.05] tracking-tight mb-6"
                  style={{ fontSize: 'clamp(40px, 5.5vw, 78px)', fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
                  {lang === 'uz' ? 'Nazorat qiling' : lang === 'ru' ? 'Контролируйте' : 'Control'}<br />
                  <span className="grad-text" style={isDark ? { filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.4))' } : {}}>
                    {typed}
                  </span>
                  <span className="animate-blink" style={{ color: 'var(--c1)' }}>|</span>
                </h1>
              </motion.div>

              <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.55 }}
                className="text-lg leading-relaxed mb-9 max-w-lg" style={{ color: 'var(--text-muted)' }}>
                {t.hero.subtitle}
              </motion.p>

              {/* CTA row */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 mb-9">
                <Link href="/login"
                  className="btn-cta group inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ fontFamily: 'var(--font-display)', background: `linear-gradient(135deg, var(--c1), var(--c2))`, boxShadow: isDark ? '0 0 32px rgba(0,212,255,0.35), 0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(2,132,199,0.35)' }}>
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                  {t.hero.demo}
                </Link>
              </motion.div>

              {/* Trust */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52, duration: 0.5 }}
                className="flex flex-wrap items-center gap-5">
                {[{ Icon: ShieldCheck, l: t.hero.secure }, { Icon: Zap, l: t.hero.fast }, { Icon: RefreshCw, l: t.hero.sync }]
                  .map(({ Icon, l }) => (
                    <div key={l} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} /> {l}
                    </div>
                  ))}
                <div className="h-3 w-px" style={{ background: 'var(--border2)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--c1)' }}>3 kun bepul</span>
              </motion.div>
            </div>

            {/* RIGHT — mockup with floating cards (Amzigo style) */}
            <motion.div initial={{ opacity: 0, x: 50, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative">

              {/* Floating card left */}
              <div className="animate-float-up absolute -left-8 top-8 z-20 rounded-2xl p-4 hidden lg:block"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', minWidth: 164, boxShadow: isDark ? '0 0 30px rgba(0,212,255,0.15), 0 20px 50px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,80,160,0.14)' }}>
                <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{t.preview.orders} · 30 kun</p>
                <p className="text-2xl font-black" style={{ color: 'var(--text-base)', fontFamily: 'var(--font-display)' }}>1,842</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs font-bold text-emerald-400">↑ 12.4%</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>o'tgan oy</span>
                </div>
              </div>

              {/* Floating card right */}
              <div className="animate-float-down absolute -right-8 top-1/3 z-20 rounded-2xl p-4 hidden lg:block"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', minWidth: 164, boxShadow: isDark ? '0 0 30px rgba(255,45,155,0.12), 0 20px 50px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,80,160,0.14)' }}>
                <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{t.preview.revenue} · bugun</p>
                <p className="text-2xl font-black" style={{ color: 'var(--text-base)', fontFamily: 'var(--font-display)' }}>4.2M</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs font-bold" style={{ color: 'var(--c1)' }}>↑ 8.1%</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>kecha</span>
                </div>
              </div>

              {/* Spinning ring (dark only) */}
              {isDark && (
                <div className="absolute -inset-4 rounded-3xl animate-spin-slow pointer-events-none"
                  style={{ border: '1px solid', borderColor: 'rgba(0,212,255,0.08)' }} />
              )}

              <DashboardMockup p={t.preview} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-16 px-6" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card2)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { n: c0, suffix: '+',     label: t.stats[0].label, delay: 0   },
            { n: c1, suffix: 's',     label: t.stats[1].label, delay: 0.1 },
            { n: c2, suffix: '%',     label: t.stats[2].label, delay: 0.2 },
            { n: 0,  suffix: " so'm", label: t.stats[3].label, delay: 0.3 },
          ].map(({ n, suffix, label, delay }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={statsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay, duration: 0.5 }}>
              <div className="text-4xl sm:text-5xl font-black mb-2 tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
                {n.toLocaleString()}<span className="grad-text">{suffix}</span>
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" ref={featRef} className="py-28 px-6">
        <div className="max-w-[1300px] mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={featInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="mb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-3 flex items-center gap-2"
              style={{ color: 'var(--c1)', fontFamily: 'var(--font-display)' }}>
              <span style={{ fontSize: 6 }}>■</span> {t.featuresBadge.toUpperCase()}
            </p>
            <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(28px,3.5vw,52px)', fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.featuresTitle}
            </h2>
            <p className="text-base" style={{ color: 'var(--text-muted)', maxWidth: 480 }}>{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((f, i) => {
              const { Icon, c, bg, border } = FEAT_ICONS[i] ?? FEAT_ICONS[0]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 30 }} animate={featInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.07, duration: 0.5 }}
                  className="neon-card rounded-2xl p-6 cursor-default group"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                    style={{ background: bg, border: `1px solid ${border}` }}>
                    <Icon className="w-5 h-5" style={{ color: c }} />
                  </div>
                  <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>{f.title}</h3>
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
        <div className="max-w-[1300px] mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
            className="mb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-3 flex items-center gap-2"
              style={{ color: 'var(--c2)', fontFamily: 'var(--font-display)' }}>
              <span style={{ fontSize: 6 }}>■</span> {t.howBadge.toUpperCase()}
            </p>
            <h2 className="font-black leading-tight" style={{ fontSize: 'clamp(28px,3.5vw,52px)', fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="grad-text">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 30 }} animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="neon-card relative rounded-2xl p-6 group"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {i < t.steps.length - 1 && (
                  <div className="hidden lg:block absolute top-9 left-full w-4 h-px"
                    style={{ background: `linear-gradient(90deg,var(--c1),transparent)`, opacity: 0.4 }} />
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black mb-5 group-hover:scale-110 transition-transform"
                  style={{ fontFamily: 'var(--font-display)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.22)', color: 'var(--c1)', boxShadow: isDark ? '0 0 12px rgba(0,212,255,0.2)' : undefined }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-bold text-sm mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>{s.title}</h3>
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
            {/* top + bottom glow lines */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px"
              style={{ background: 'linear-gradient(90deg,transparent,var(--c1),transparent)' }} />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px"
              style={{ background: 'linear-gradient(90deg,transparent,var(--c2),transparent)' }} />
            {isDark && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-48 blur-3xl opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse,var(--c1) 0%,transparent 70%)' }} />
            )}
            <div className="relative">
              <h2 className="font-black mb-4 leading-tight" style={{ fontSize: 'clamp(24px,3.5vw,48px)', fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
                {t.ctaTitle1} <span className="grad-text">{t.ctaTitle2}</span>
              </h2>
              <p className="mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.ctaSubtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login"
                  className="btn-cta group inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ fontFamily: 'var(--font-display)', background: `linear-gradient(135deg, var(--c1), var(--c2))`, boxShadow: isDark ? '0 0 30px rgba(0,212,255,0.3)' : '0 8px 24px rgba(2,132,199,0.3)' }}>
                  {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/pricing"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl transition-all text-sm"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-dim)' }}>
                  Narxlar →
                </Link>
              </div>
              <p className="text-xs mt-5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                3 kun bepul · Karta shart emas
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1300px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, var(--c1), var(--c2))` }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>DAROMADCHI</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            <Link href="/help" className="uppercase tracking-wider hover:underline transition-all">Yordam</Link>
            <Link href="/pricing" className="uppercase tracking-wider hover:underline transition-all">Narxlar</Link>
            <Link href="/dashboard" className="uppercase tracking-wider hover:underline transition-all">Dashboard</Link>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi.</p>
        </div>
      </footer>
    </div>
  )
}
