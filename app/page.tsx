'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, BarChart2, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  ShieldCheck, Sparkles, Sun, Moon, Globe, X, Menu,
  Star, Quote, CheckCircle, Activity,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

/* ── Typewriter ─────────────────────────────────────────────────────────── */
function useTypewriter(words: string[], speed = 80, pause = 2200) {
  const [idx, setIdx]           = useState(0)
  const [text, setText]         = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const word = words[idx % words.length]
    let timer: ReturnType<typeof setTimeout>
    if (deleting) {
      if (text.length === 0) { setDeleting(false); setIdx(i => i + 1) }
      else timer = setTimeout(() => setText(s => s.slice(0, -1)), speed / 2)
    } else {
      if (text.length === word.length) timer = setTimeout(() => setDeleting(true), pause)
      else timer = setTimeout(() => setText(word.slice(0, text.length + 1)), speed)
    }
    return () => clearTimeout(timer)
  }, [text, deleting, idx, words, speed, pause])
  return text
}

/* ── Animated counter ───────────────────────────────────────────────────── */
function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTs: number
    const step = (ts: number) => {
      if (!startTs) startTs = ts
      const p = Math.min((ts - startTs) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function StatNum({ value, suffix }: { value: number; suffix: string }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true })
  const count  = useCounter(value, 2000, inView)
  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}<span style={{ color: 'var(--c1)' }}>{suffix}</span>
    </span>
  )
}

/* ── Particles canvas ───────────────────────────────────────────────────── */
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      color: Math.random() > 0.5 ? '#00d4ff' : '#ff2d9b',
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color + '99'; ctx.fill()
      })
      dots.forEach((a, i) => dots.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < 100) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - d / 100)})`
          ctx.lineWidth = 0.5; ctx.stroke()
        }
      }))
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.55, pointerEvents: 'none' }} />
}

/* ── Theme toggle ───────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
    </button>
  )
}

/* ── Lang toggle ────────────────────────────────────────────────────────── */
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
        <Globe className="w-3.5 h-3.5" /> {lang.toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden border shadow-xl z-50"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', minWidth: '4.5rem' }}>
            {langs.map(l => (
              <button key={l} onClick={() => { setLang(l); setOpen(false) }}
                className="w-full px-3 py-2 text-xs font-semibold uppercase text-left transition-all"
                style={{ background: lang === l ? 'rgba(0,212,255,0.1)' : 'transparent', color: lang === l ? 'var(--c1)' : 'var(--text-muted)' }}>
                {l}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Dashboard mockup ───────────────────────────────────────────────────── */
function DashboardMockup({ p }: { p: typeof translations.en.preview }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const bg     = isDark ? '#071425' : '#ffffff'
  const bg2    = isDark ? '#0b1c34' : '#f0f8ff'
  const border = isDark ? 'rgba(0,210,255,0.12)' : 'rgba(0,120,200,0.15)'
  const muted  = isDark ? '#4a7a9b' : '#6b8eab'
  const c1     = isDark ? '#00d4ff' : '#0284c7'
  const c2     = isDark ? '#ff2d9b' : '#db2777'

  const kpis = [
    { l: p.revenue, v: '124.5M', color: c1 },
    { l: p.profit,  v: '38.2M',  color: '#22c55e' },
    { l: p.orders,  v: '1,842',  color: c2 },
    { l: p.stock,   v: '3,410',  color: '#f59e0b' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border" style={{ background: bg, borderColor: border }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: bg2, borderColor: border }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 h-5 mx-3 rounded-md border flex items-center px-2"
          style={{ background: isDark ? '#0f2040' : '#dceefa', borderColor: border }}>
          <span className="text-[9px]" style={{ color: muted }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 text-green-400 animate-pulse" />
      </div>

      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => (
            <div key={k.l} className="rounded-lg p-2.5 border" style={{ background: bg2, borderColor: border }}>
              <p className="text-[8px] mb-1" style={{ color: muted }}>{k.l}</p>
              <p className="font-bold text-[11px]" style={{ color: k.color }}>{k.v}</p>
              <p className="text-green-400 text-[8px] mt-0.5">↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-lg p-2.5 border" style={{ background: bg2, borderColor: border }}>
            <p className="text-[8px] mb-2" style={{ color: muted }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-14">
              {[30,50,38,70,45,82,60,88,72,55,78,92,65,80].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm"
                  style={{ height: `${h}%`, background: isDark ? 'linear-gradient(to top,#00d4ff88,#00d4ff22)' : 'linear-gradient(to top,#0284c788,#0284c722)' }} />
              ))}
            </div>
          </div>
          <div className="rounded-lg p-2.5 border flex flex-col" style={{ background: bg2, borderColor: border }}>
            <p className="text-[8px] mb-1" style={{ color: muted }}>{p.categories}</p>
            <div className="relative w-12 h-12 mx-auto mt-1">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke={isDark ? 'rgba(0,210,255,0.15)' : 'rgba(0,120,200,0.15)'} strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c1} strokeWidth="4" strokeDasharray="38 50" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c2} strokeWidth="4" strokeDasharray="22 66" strokeDashoffset="-38" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="14 74" strokeDashoffset="-60" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Testimonial data ───────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: 'Jasur Toshmatov', role: 'Uzum Market sotuvchisi',  text: "Daromadchi bizning savdoni 40% oshirishimizga yordam berdi. DRR tahlili juda qulay.", stars: 5 },
  { name: 'Malika Rahimova', role: 'Yandex Market',           text: "Qoldiq ogohlantirishlari tufayli endi birortam mahsulot tamom bo'lmaydi. Ajoyib!", stars: 5 },
  { name: 'Otabek Xasanov',  role: 'Wildberries sotuvchisi',  text: "P&L hisobot birinchi oyda 3 soatni tejadi. Barcha raqamlar bir joyda.", stars: 5 },
]

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme()
  const { lang }  = useLang()
  const t = translations[lang]
  const isDark = theme === 'dark'

  const [showBar,  setShowBar]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const typeWords =
    lang === 'uz' ? ["do'koningizni", 'savdoingizni', 'daromadingizni'] :
    lang === 'ru' ? ['ваш магазин', 'ваши продажи', 'вашу прибыль'] :
                    ['your store', 'your sales', 'your revenue']
  const typeText = useTypewriter(typeWords, 75, 2200)

  const featuresRef    = useRef(null)
  const howRef         = useRef(null)
  const pricingRef     = useRef(null)
  const testimonialRef = useRef(null)
  const ctaRef         = useRef(null)
  const featuresInView    = useInView(featuresRef,    { once: true, margin: '-80px' })
  const howInView         = useInView(howRef,         { once: true, margin: '-80px' })
  const pricingInView     = useInView(pricingRef,     { once: true, margin: '-80px' })
  const testimonialInView = useInView(testimonialRef, { once: true, margin: '-80px' })
  const ctaInView         = useInView(ctaRef,         { once: true, margin: '-80px' })

  const card  = isDark ? 'var(--bg-card)'  : '#ffffff'
  const card2 = isDark ? 'var(--bg-card2)' : '#f0f8ff'
  const helpLabel = lang === 'uz' ? 'Yordam' : lang === 'ru' ? 'Помощь' : 'Help'

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* ────────────────────────── NAVBAR ───────────────────────────── */}
      <motion.header initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55 }}
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
        style={{ background: 'rgba(13,14,20,0.75)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #0099cc)' }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Daromadchi
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {[
              { href: '#features', label: lang === 'uz' ? 'Imkoniyatlar' : t.nav.features },
              { href: '#how',      label: lang === 'uz' ? 'Qanday ishlaydi' : t.nav.how },
              { href: '#pricing',  label: lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing' },
              { href: '/help',     label: helpLabel },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="transition-opacity opacity-60 hover:opacity-100"
                style={{ color: '#e2e8f0' }}>
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-sm font-medium px-3 py-2 opacity-60 hover:opacity-100 transition-opacity text-white">
              {t.nav.login}
            </Link>
            <Link href="/login"
              className="text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1 whitespace-nowrap transition-all hover:shadow-[0_0_20px_rgba(0,212,255,0.4)]"
              style={{ background: '#00d4ff', color: '#0d0e14' }}>
              {lang === 'uz' ? 'Bepul boshlash' : t.nav.start}
            </Link>
            <button className="md:hidden p-2 rounded-xl text-white/60"
              onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t overflow-hidden"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(13,14,20,0.97)' }}>
              <div className="px-5 py-4 flex flex-col gap-2">
                {[
                  lang === 'uz' ? 'Imkoniyatlar' : t.nav.features,
                  lang === 'uz' ? 'Qanday ishlaydi' : t.nav.how,
                  lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing',
                  helpLabel,
                ].map(label => (
                  <a key={label} href="#" onClick={() => setMenuOpen(false)}
                    className="text-sm font-medium py-2 opacity-80 text-white">
                    {label}
                  </a>
                ))}
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="mt-2 text-sm font-bold py-3 text-center rounded-xl"
                  style={{ background: '#00d4ff', color: '#0d0e14' }}>
                  {lang === 'uz' ? 'Bepul boshlash' : t.nav.start}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ────────────────────────── HERO ─────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-5 overflow-hidden"
        style={{ background: '#0d0e14' }}>
        {/* Aurora radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,212,255,0.18) 0%, transparent 60%)' }} />
        <Particles />

        {/* Floating cards — LEFT */}
        <div className="absolute left-[3%] top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-3 pointer-events-none" style={{ zIndex: 2 }}>
          {[
            { label: 'DRR', value: '8.5%', sub: 'Reklama ulushi', color: '#00d4ff', rotate: '-5deg', delay: 0 },
            { label: 'Tushum', value: '45.2M', sub: "so'm bugun", color: '#22c55e', rotate: '-3deg', delay: 0.4 },
            { label: 'Buyurtmalar', value: '342', sub: 'bugun', color: '#f59e0b', rotate: '-7deg', delay: 0.8 },
          ].map((fc, i) => (
            <motion.div key={fc.label}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: fc.delay }}
              className="rounded-2xl px-4 py-3 border shadow-xl"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                transform: `rotate(${fc.rotate})`,
                backdropFilter: 'blur(12px)',
                minWidth: '148px',
              }}>
              <p className="text-[10px] font-semibold mb-0.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>{fc.label}</p>
              <p className="text-xl font-black" style={{ color: fc.color }}>{fc.value}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{fc.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Floating cards — RIGHT */}
        <div className="absolute right-[3%] top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-3 pointer-events-none" style={{ zIndex: 2 }}>
          {[
            { label: 'Foyda', value: '+43%', sub: "o'tgan oyga", color: '#22c55e', rotate: '5deg', delay: 0.2 },
            { label: 'Qoldiq', value: '1,284', sub: 'dona', color: '#a78bfa', rotate: '3deg', delay: 0.6 },
            { label: 'ROI', value: '312%', sub: 'reklama samarasi', color: '#00d4ff', rotate: '6deg', delay: 1.0 },
          ].map((fc, i) => (
            <motion.div key={fc.label}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.5 + i * 0.6, repeat: Infinity, ease: 'easeInOut', delay: fc.delay }}
              className="rounded-2xl px-4 py-3 border shadow-xl"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                transform: `rotate(${fc.rotate})`,
                backdropFilter: 'blur(12px)',
                minWidth: '148px',
              }}>
              <p className="text-[10px] font-semibold mb-0.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>{fc.label}</p>
              <p className="text-xl font-black" style={{ color: fc.color }}>{fc.value}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{fc.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* CENTER content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto w-full">

          {/* Social proof pill */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex items-center gap-3 rounded-full px-4 py-2 mb-8 border"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            {/* Avatar bubbles */}
            <div className="flex items-center">
              {[
                'linear-gradient(135deg,#f97316,#ec4899)',
                'linear-gradient(135deg,#06b6d4,#3b82f6)',
                'linear-gradient(135deg,#22c55e,#16a34a)',
                'linear-gradient(135deg,#a78bfa,#7c3aed)',
              ].map((grad, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0d0e14] flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: grad, marginLeft: i === 0 ? 0 : '-8px', zIndex: 4 - i, position: 'relative' }}>
                  {['J', 'M', 'O', 'A'][i]}
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
              500+ sotuvchilar Uzum Market&apos;da
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }}
            className="text-5xl sm:text-6xl lg:text-[68px] font-black leading-[1.08] tracking-tight mb-5 text-white"
            style={{ fontFamily: 'var(--font-display)' }}>
            {lang === 'uz' ? (
              <>Savdo va reklama tahlili —<br />
                <span style={{ color: '#00d4ff' }}>hammasi bitta ekranda</span>
              </>
            ) : lang === 'ru' ? (
              <>Аналитика продаж и рекламы —<br />
                <span style={{ color: '#00d4ff' }}>всё на одном экране</span>
              </>
            ) : (
              <>Sales &amp; ad analytics —<br />
                <span style={{ color: '#00d4ff' }}>all on one screen</span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
            className="text-lg mb-8 leading-relaxed max-w-xl"
            style={{ color: 'rgba(180,195,215,0.85)' }}>
            {lang === 'uz'
              ? 'DRR, qoldiq, narx va birlik iqtisodiyoti. Savdoni kuniga 5 daqiqada boshqaring.'
              : lang === 'ru'
              ? 'DRR, остатки, цены и юнит-экономика. Управляйте продажами за 5 минут в день.'
              : 'DRR, stock, pricing & unit economics. Manage your sales in 5 minutes a day.'}
          </motion.p>

          {/* CTA buttons */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
            className="flex flex-col sm:flex-row gap-3 mb-4">
            <Link href="/login"
              className="flex items-center justify-center gap-2 font-bold px-8 rounded-2xl transition-all text-sm"
              style={{
                background: '#00d4ff',
                color: '#0d0e14',
                height: '48px',
                boxShadow: '0 8px 32px rgba(0,212,255,0.35)',
              }}>
              {lang === 'uz' ? '30 kun bepul boshlash' : lang === 'ru' ? '30 дней бесплатно' : 'Start 30 days free'}
            </Link>
            <Link href="/dashboard"
              className="flex items-center justify-center gap-2 font-medium px-8 rounded-2xl transition-all text-sm border"
              style={{
                borderColor: 'rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.8)',
                height: '48px',
                background: 'rgba(255,255,255,0.05)',
              }}>
              {lang === 'uz' ? "Demo ko'rish →" : lang === 'ru' ? 'Смотреть демо →' : 'View demo →'}
            </Link>
          </motion.div>

          {/* No card required */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.68 }}
            className="text-xs mb-12"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            {lang === 'uz' ? 'Karta shart emas' : lang === 'ru' ? 'Карта не нужна' : 'No credit card required'}
          </motion.p>

          {/* Dashboard mockup */}
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62, duration: 0.9 }}
            className="relative w-full max-w-4xl">
            <div className="absolute -inset-4 rounded-3xl blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, #00d4ff, transparent 70%)' }} />
            <DashboardMockup p={t.preview} />
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────── TICKER ──────────────────────────── */}
      <div className="py-3.5 overflow-hidden border-y"
        style={{ borderColor: 'var(--border)', background: isDark ? 'rgba(0,212,255,0.03)' : 'rgba(2,132,199,0.03)' }}>
        <div className="animate-ticker flex gap-14 whitespace-nowrap text-sm font-semibold">
          {Array(4).fill(null).flatMap((_, gi) => [
            <span key={`${gi}a`} style={{ color: 'var(--c1)' }}>● Uzum Market API</span>,
            <span key={`${gi}b`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;DRR tahlili&nbsp;·&nbsp;</span>,
            <span key={`${gi}c`} style={{ color: 'var(--c2)' }}>● Wildberries</span>,
            <span key={`${gi}d`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;P&amp;L hisobot&nbsp;·&nbsp;</span>,
            <span key={`${gi}e`} style={{ color: 'var(--c1)' }}>● Yandex Market</span>,
            <span key={`${gi}f`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;Birlik iqtisodiyoti&nbsp;·&nbsp;</span>,
          ])}
        </div>
      </div>

      {/* ─────────────────────────── NEON BAND ───────────────────────── */}
      <section className="py-20 px-5 relative overflow-hidden"
        style={{ background: isDark
          ? 'linear-gradient(135deg, #020c1a 0%, #041530 50%, #020c1a 100%)'
          : 'linear-gradient(135deg, #0369a1 0%, #0284c7 60%, #0369a1 100%)' }}>
        {isDark && (
          <>
            <div className="absolute top-0 left-1/3 w-px h-full opacity-[0.07]" style={{ background: 'var(--c1)' }} />
            <div className="absolute top-0 right-1/3 w-px h-full opacity-[0.07]" style={{ background: 'var(--c2)' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-3xl opacity-10"
              style={{ background: 'var(--c1)' }} />
          </>
        )}
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-4 opacity-70 text-white">
              ● Sizning muvaffaqiyatingiz shu yerdan boshlanadi
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug mb-3"
              style={{ fontFamily: 'var(--font-display)' }}>
              Marketplace savdosining murakkabligini soddalashtirish uchun yaratilgan.
            </h2>
            <p className="text-base sm:text-lg text-white/60 mb-12 max-w-2xl">
              Uzum, Yandex Market va Wildberries sotuvchilari uchun — bitta platformada barcha raqamlar.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '📊', title: 'Analitika markazi', desc: "Real vaqtda savdo ko'rsatkichlari va reklama tahlili." },
              { icon: '🔔', title: 'Zaxira nazorati',   desc: 'Avtomatik ogohlantirishlar va buyurtma tavsiyalari.' },
              { icon: '💰', title: 'Foyda hisobi',      desc: 'Har bir mahsulot uchun aniq foyda va zarar hisobi.' },
            ].map((c, i) => (
              <motion.div key={c.title} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
                className="rounded-2xl p-6 border backdrop-blur-sm"
                style={{ background: isDark ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.12)', borderColor: isDark ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.3)' }}>
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className="font-bold text-white mb-2">{c.title}</h3>
                <p className="text-sm text-white/65">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── STATS ───────────────────────────── */}
      <section className="py-16 px-5" style={{ background: card2 }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: 6,   suffix: '+',     label: t.stats[0].label },
            { value: 30,  suffix: 's',     label: t.stats[1].label },
            { value: 100, suffix: '%',     label: t.stats[2].label },
            { value: 0,   suffix: " so'm", label: t.stats[3].label },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl sm:text-4xl font-black mb-1" style={{ color: 'var(--text-base)' }}>
                <StatNum value={s.value} suffix={s.suffix} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────── FEATURES ────────────────────────── */}
      <section id="features" ref={featuresRef} className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-4 border"
              style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(2,132,199,0.08)', borderColor: 'var(--border2)', color: 'var(--c1)' }}>
              <Sparkles className="w-3.5 h-3.5" /> {t.featuresBadge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.featuresTitle}
            </h2>
            <p className="max-w-xl mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((f, i) => {
              const icons = [BarChart2, Calculator, AlertTriangle, FileText, RefreshCw, DollarSign]
              const Icon = icons[i]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 40 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="neon-card rounded-2xl p-6 border cursor-default group"
                  style={{ background: card, borderColor: 'var(--border)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                    style={{ background: isDark ? 'rgba(0,212,255,0.1)' : 'rgba(2,132,199,0.1)', border: '1px solid var(--border2)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--c1)' }} />
                  </div>
                  <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-base)' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── HOW IT WORKS ────────────────────── */}
      <section id="how" ref={howRef} className="py-24 px-5 relative overflow-hidden"
        style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={howInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-4 border"
              style={{ background: isDark ? 'rgba(255,45,155,0.08)' : 'rgba(219,39,119,0.08)', borderColor: 'var(--c2)', color: 'var(--c2)' }}>
              <Zap className="w-3.5 h-3.5" /> {t.howBadge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="grad-text">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 40 }} animate={howInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="rounded-2xl p-6 border group hover:scale-[1.03] transition-transform"
                style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-black mb-5"
                  style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))', color: '#fff', fontFamily: 'var(--font-display)' }}>
                  0{i + 1}
                </div>
                <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-base)' }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── PRICING ─────────────────────────── */}
      <section id="pricing" ref={pricingRef} className="py-24 px-5" style={{ background: isDark ? 'var(--bg-base)' : '#f0f8ff' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {lang === 'uz' ? '30 kun bepul. Karta shart emas.' : lang === 'ru' ? '30 дней бесплатно. Карта не нужна.' : '30 days free. No card required.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              {
                name: lang === 'uz' ? 'Bepul' : lang === 'ru' ? 'Бесплатно' : 'Free',
                price: '0', highlight: false,
                features: lang === 'uz' ? ["1 do'kon", '6 tahlil sahifasi', "Demo ma'lumotlar"]
                  : lang === 'ru' ? ['1 магазин', '6 страниц аналитики', 'Демо-данные']
                  : ['1 store', '6 analytics pages', 'Demo data'],
              },
              {
                name: 'Pro', price: '300 000', highlight: true,
                features: lang === 'uz' ? ["3 do'kon", 'Barcha tahlillar', 'Avto-sinxronizatsiya', 'P&L hisobot', 'Email ogohlantirishlar']
                  : lang === 'ru' ? ['3 магазина', 'Все аналитики', 'Авто-синхронизация', 'Отчёт P&L', 'Email-уведомления']
                  : ['3 stores', 'All analytics', 'Auto-sync', 'P&L report', 'Email alerts'],
              },
              {
                name: 'Pro+', price: '600 000', highlight: false,
                features: lang === 'uz' ? ["Cheksiz do'konlar", 'Barcha Pro imkoniyatlar', 'API kirish', 'Ustuvor yordam']
                  : lang === 'ru' ? ['Неограниченно магазинов', 'Все Pro возможности', 'API доступ', 'Приоритетная поддержка']
                  : ['Unlimited stores', 'All Pro features', 'API access', 'Priority support'],
              },
            ] as const).map((plan, i) => (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: 30 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl p-6 border relative"
                style={{ background: plan.highlight ? (isDark ? 'rgba(0,212,255,0.07)' : 'rgba(2,132,199,0.06)') : card, borderColor: plan.highlight ? 'var(--c1)' : 'var(--border)' }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                    {lang === 'uz' ? 'OMMABOP' : lang === 'ru' ? 'ПОПУЛЯРНЫЙ' : 'POPULAR'}
                  </div>
                )}
                <h3 className="font-bold mb-1" style={{ color: 'var(--text-base)' }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-black" style={{ color: 'var(--text-base)' }}>{plan.price}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>so&apos;m/oy</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--c1)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={plan.highlight
                    ? { background: 'linear-gradient(135deg, var(--c1), var(--c2))', color: '#fff' }
                    : { background: 'var(--bg-input)', color: 'var(--text-dim)', border: '1px solid var(--border2)' }}>
                  {lang === 'uz' ? 'Boshlash' : lang === 'ru' ? 'Начать' : 'Get started'}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── TESTIMONIALS ────────────────────── */}
      <section ref={testimonialRef} className="py-24 px-5 relative overflow-hidden"
        style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={testimonialInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {lang === 'uz' ? 'Sotuvchilar nima deydi' : lang === 'ru' ? 'Что говорят продавцы' : 'What sellers say'}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((review, i) => (
              <motion.div key={review.name}
                initial={{ opacity: 0, y: 40 + i * 8 }} animate={testimonialInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="rounded-2xl p-6 border"
                style={{ background: isDark ? 'rgba(0,212,255,0.04)' : '#fff', borderColor: 'var(--border)' }}>
                <Quote className="w-8 h-8 mb-4 opacity-30" style={{ color: 'var(--c1)' }} />
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                  &ldquo;{review.text}&rdquo;
                </p>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array(review.stars).fill(0).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>{review.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{review.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── CTA ─────────────────────────────── */}
      <section ref={ctaRef} className="py-24 px-5 relative overflow-hidden">
        {isDark && <Particles />}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: isDark
            ? 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,212,255,0.06) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(2,132,199,0.06) 0%, transparent 70%)' }} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={ctaInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.7 }}>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 border"
              style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(2,132,199,0.08)', borderColor: 'var(--border2)', color: 'var(--c1)' }}>
              <Sparkles className="w-3.5 h-3.5" /> {t.ctaBadge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.ctaTitle1} <span className="grad-text">{t.ctaTitle2}</span>
            </h2>
            <p className="text-lg mb-8 max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>{t.ctaSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login"
                className="group flex items-center justify-center gap-2 text-white font-bold px-10 py-4 rounded-2xl transition-all text-sm"
                style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))', boxShadow: '0 8px 32px rgba(0,212,255,0.28)' }}>
                {t.hero.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/dashboard"
                className="flex items-center justify-center gap-2 font-medium px-10 py-4 rounded-2xl transition-all text-sm border"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                {t.hero.demo}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────── FOOTER ──────────────────────────── */}
      <footer className="border-t py-10 px-5" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>Daromadchi</span>
            </Link>
            <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              <a href="#features" className="opacity-70 hover:opacity-100 transition-opacity">{t.nav.features}</a>
              <a href="#how"      className="opacity-70 hover:opacity-100 transition-opacity">{t.nav.how}</a>
              <Link href="/help"  className="opacity-70 hover:opacity-100 transition-opacity">{helpLabel}</Link>
              <Link href="/login" className="opacity-70 hover:opacity-100 transition-opacity">{t.nav.login}</Link>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi. {t.footer}</p>
            <Link href="/dashboard" className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--c1)' }}>
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────── STICKY BAR ──────────────────────── */}
      <AnimatePresence>
        {showBar && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t"
            style={{ background: isDark ? 'rgba(2,12,26,0.97)' : 'rgba(240,248,255,0.97)', borderColor: 'var(--border)', backdropFilter: 'blur(20px)' }}>
            <div className="max-w-5xl mx-auto px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
                🚀{' '}
                {lang === 'uz' ? "30 kun bepul sinab ko'ring. Karta shart emas."
                 : lang === 'ru' ? '30 дней бесплатно. Карта не нужна.'
                 : '30 days free. No credit card required.'}
              </p>
              <Link href="/login"
                className="shrink-0 text-sm font-bold px-6 py-2.5 rounded-xl text-white"
                style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                {t.hero.cta} ↗
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
