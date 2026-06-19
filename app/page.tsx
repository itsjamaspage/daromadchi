'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowRight, Menu, X, Check,
  ChevronDown, BarChart2, Package, Bell,
  LayoutDashboard, ShoppingCart, Megaphone, Layers,
  BookOpen, MessageCircle, Plug2,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import type { Lang } from '@/lib/i18n'

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  ink:       '#0E2233',
  parchment: '#c5e8fe',
  card:      '#FFFFFF',
  stone:     '#4A7090',
  muted:     '#7AACC7',
  green:     '#0E7490',
  greenDk:   '#155E75',
  greenBg:   'rgba(14,116,144,0.09)',
  amber:     '#CA8A04',
  amberBg:   'rgba(202,138,4,0.09)',
  red:       '#DC2626',
  redBg:     'rgba(220,38,38,0.09)',
  hair:      '#93C5FD',
  // dark surfaces
  dCanvas:   '#131321',
  dCard:     '#1C1C2E',
  dCard2:    '#23233A',
  dHair:     'rgba(197,232,254,0.18)',
  dMuted:    'rgba(197,232,254,0.55)',
  dText:     '#E8FFF8',
  // marketplace
  uzum:      '#494fdf',
  wb:        '#CB11AB',
  yandex:    '#E8A000',
}

// Accent colours per theme
const A = {
  light:    '#a0d4fc',   // sky blue for light mode buttons/accents
  lightDk:  '#7bbaf7',
  lightBg:  'rgba(160,212,252,0.15)',
  dark:     '#a0d4fc',   // sky blue for dark mode — stable button color
  darkDk:   '#7bbaf7',
  darkBg:   'rgba(160,212,252,0.12)',
}

// Real dashboard KPI colours — matches KpiCard.tsx
const KPI = {
  violet:  '#494fdf',
  emerald: '#428619',
  blue:    '#376cd5',
  amber:   '#ec7e00',
}

function tx(lang: string, ru: string, uz: string, en: string) {
  return lang === 'ru' ? ru : lang === 'uz' ? uz : en
}

function useIsDark() { return useTheme().theme === 'dark' }

function useAccent() {
  const isDark = useIsDark()
  return {
    color:  isDark ? A.dark   : A.light,
    dk:     isDark ? A.darkDk : A.lightDk,
    bg:     isDark ? A.darkBg : A.lightBg,
    tint:   isDark ? A.dark   : '#0369a1',
    btn:    isDark ? A.dark    : '#131321',
    btnTxt: isDark ? '#131321' : '#ffffff',
    btnHov: isDark ? A.darkDk  : '#0e1a2e',
  }
}

// ── Scroll-triggered fade-up ──────────────────────────────────────────────────
function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-48px' })
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}>
      {children}
    </motion.div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHead({ title, accent, sub, dark = false }: {
  title: string; accent?: string; sub?: string; dark?: boolean
}) {
  const acc = useAccent()
  const isDark = useIsDark()
  const parts = accent ? title.split(accent) : [title]
  return (
    <FadeUp>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, lineHeight: 1.1,
          color: dark ? P.dText : (isDark ? P.dText : P.ink), letterSpacing: '-0.022em', marginBottom: sub ? 16 : 0 }}>
          {accent ? (
            <>{parts[0]}<span style={{ color: acc.tint }}>{accent}</span>{parts[1]}</>
          ) : title}
        </h2>
        {sub && <p style={{ fontSize: 16, color: dark ? P.dMuted : (isDark ? P.dMuted : P.stone), maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>{sub}</p>}
      </div>
    </FadeUp>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const { toggle, theme } = useTheme()
  const { setLang } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { label: tx(lang,'Возможности','Imkoniyatlar','Features'), href: '#features' },
    { label: tx(lang,'Как работает','Qanday ishlaydi','How it works'), href: '#how' },
    { label: tx(lang,'Тарифы','Tariflar','Pricing'), href: '#pricing' },
    { label: tx(lang,'Вопросы','Savollar','FAQ'), href: '#faq' },
    { label: tx(lang,'Помощь','Yordam','Help'), href: '/help' },
  ]

  const scrolledBg = isDark ? 'rgba(19,19,33,0.96)' : 'rgba(255,255,255,0.95)'
  // On non-scrolled: light hero → dark links; dark hero → white links
  const lnk = scrolled ? (isDark ? P.dMuted : P.stone) : (isDark ? 'rgba(255,255,255,0.78)' : P.ink)
  const lnkH = scrolled ? (isDark ? P.dText : P.ink)   : (isDark ? '#fff' : P.ink)
  const borderCol = scrolled ? (isDark ? P.dHair : P.hair) : (isDark ? 'rgba(255,255,255,0.15)' : P.hair)

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? scrolledBg : 'transparent',
      borderBottom: `1px solid ${scrolled ? (isDark ? P.dHair : P.hair) : 'transparent'}`,
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      transition: 'all 0.25s ease',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 76,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/icon.svg" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em',
            color: scrolled ? (isDark ? P.dText : P.ink) : (isDark ? '#fff' : P.ink) }}>
            Daromadchi
          </span>
        </Link>

        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: 28 }}>
          {links.map(n => (
            <a key={n.href} href={n.href}
              style={{ fontSize: 14, fontWeight: 500, color: lnk, textDecoration: 'none', transition: 'color 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.color = lnkH)}
              onMouseLeave={e => (e.currentTarget.style.color = lnk)}>
              {n.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setLangOpen(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent',
                border: `1px solid ${borderCol}`,
                borderRadius: 6, padding: '6px 10px', color: lnk, transition: 'all 0.12s' }}>
              {lang.toUpperCase()}
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 56, zIndex: 200,
                    background: isDark ? P.dCard2 : '#fff',
                    border: `1px solid ${isDark ? P.dHair : P.hair}`, borderRadius: 8, overflow: 'hidden' }}>
                  {(['uz','ru','en'] as Lang[]).map(l => (
                    <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600,
                        background: lang === l ? acc.bg : 'transparent',
                        color: lang === l ? acc.tint : (isDark ? P.dMuted : P.stone), cursor: 'pointer', border: 'none' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={toggle}
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: `1px solid ${borderCol}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 15, color: lnk, transition: 'all 0.12s' }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <Link href="/login" className="hidden md:block"
            style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '9px 14px', color: lnk, transition: 'color 0.12s' }}>
            {tx(lang,'Войти','Kirish','Sign in')}
          </Link>

          <Link href="/login" className="hidden sm:block"
            style={{ fontSize: 14, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '10px 22px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = acc.btnHov)}
            onMouseLeave={e => (e.currentTarget.style.background = acc.btn)}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
          </Link>

          <button className="md:hidden" onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: lnk, padding: 4 }}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: isDark ? P.dCanvas : '#fff', borderTop: `1px solid ${isDark ? P.dHair : P.hair}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {links.map(n => (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                  style={{ fontSize: 16, fontWeight: 500, color: isDark ? P.dText : P.ink, textDecoration: 'none' }}>
                  {n.label}
                </a>
              ))}
              <Link href="/login"
                style={{ marginTop: 8, fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
                  padding: '13px 24px', borderRadius: 8, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Floating stat card — with continuous bob animation ────────────────────────
function FloatCard({ mp, mpColor, metric, value, change, up, delay, floatDur = 3.5, style }: {
  mp: string; mpColor: string; metric: string; value: string
  change: string; up: boolean; delay: number; floatDur?: number
  style: React.CSSProperties
}) {
  const isDark = useIsDark()
  const acc = useAccent()
  return (
    // Outer div: entry animation + absolute position
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ position: 'absolute', ...style }}>
      {/* CSS animation — GPU-accelerated, no JS per frame */}
      <div className="animate-float" style={{ animationDuration: `${floatDur}s`, animationDelay: `${delay * 0.3}s` }}>
        <div style={{
          background: isDark ? 'rgba(28,28,46,0.96)' : 'rgba(255,255,255,0.97)',
          borderRadius: 14, padding: '12px 16px', minWidth: 162,
          boxShadow: isDark
            ? '0 10px 40px rgba(197,232,254,0.12), 0 2px 8px rgba(0,0,0,0.40)'
            : '0 10px 36px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          border: isDark ? '1px solid rgba(197,232,254,0.18)' : '1px solid rgba(186,230,253,0.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: mpColor }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? P.dMuted : P.stone, letterSpacing: '0.02em' }}>{mp}</span>
          </div>
          <p style={{ fontSize: 10, color: isDark ? 'rgba(198,187,255,0.5)' : P.muted, marginBottom: 2 }}>{metric}</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: isDark ? P.dText : P.ink, fontFamily: "'Space Grotesk', system-ui, sans-serif", lineHeight: 1.1 }}>
            {value}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}>
            {up ? <TrendingUp size={11} color={acc.tint}/> : <TrendingDown size={11} color={P.red}/>}
            <span style={{ fontSize: 11, fontWeight: 700, color: up ? acc.tint : P.red }}>{change}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Dashboard mockup — matches real app ───────────────────────────────────────
function DashMockup() {
  const border = '#E2E8F0'
  const bg2    = '#F8FAFD'
  const muted  = '#94A3B8'
  const ink    = '#0F172A'

  const teal = '#0E7490'
  const kpis = [
    { l: 'Выручка',  v: '124 540 000', u: 'сум', d: '+12.4%', pos: true,  c: teal },
    { l: 'Заказы',   v: '1 842',        u: '',    d: '+8.1%',  pos: true,  c: teal },
    { l: 'Расход',   v: '10 200 000',   u: 'сум', d: '+3.2%',  pos: false, c: teal },
    { l: 'Прибыль',  v: '38 200 000',   u: 'сум', d: '+15.7%', pos: true,  c: teal },
  ]

  const sideIcons = [LayoutDashboard, Package, ShoppingCart, BarChart2, Megaphone, Layers, Bell]
  const bars = [28,44,36,62,48,74,56,82,66,52,76,90,62,78]
  const hi   = bars.length - 4

  const rows = [
    { name: 'Куртка зимняя мужская',  sku: 'UZ-00312', rev: '18 240 000', drr: 7.2,  ok: true,  mp: teal },
    { name: 'Кроссовки Nike Air',      sku: 'WB-01847', rev: '12 590 000', drr: 11.4, ok: false, mp: teal },
    { name: 'Рюкзак туристический',    sku: 'YM-00951', rev: '9 870 000',  drr: 9.8,  ok: true,  mp: teal },
    { name: 'Наушники Sony WH-1000',   sku: 'UZ-00488', rev: '8 340 000',  drr: 6.1,  ok: true,  mp: teal },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex',
      border: `1px solid ${border}`,
      boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.08)' }}>

      {/* Mini sidebar */}
      <div style={{ width: 42, background: bg2, borderRight: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, flexShrink: 0 }}>
        <img src="/icon.svg" alt="" style={{ width: 22, height: 22, borderRadius: 5, marginBottom: 8 }} />
        <div style={{ width: '70%', height: 1, background: border, marginBottom: 6 }} />
        {sideIcons.map((Icon, i) => (
          <div key={i} style={{ width: 30, height: 30, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i === 0 ? 'rgba(14,116,144,0.12)' : 'transparent', marginBottom: 2 }}>
            <Icon size={13} color={i === 0 ? teal : muted} />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: bg2, borderBottom: `1px solid ${border}`, padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['Все','Uzum','Wildberries','Yandex Market'].map((tab, i) => (
              <div key={tab} style={{ fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
                background: i === 0 ? teal : 'transparent', color: i === 0 ? '#fff' : muted }}>
                {tab}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: muted }}>17 мар — 30 мар 2026</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: `1px solid ${border}` }}>
          {kpis.map((k, i) => (
            <div key={k.l} style={{ padding: '10px 12px',
              borderRight: i < 3 ? `1px solid ${border}` : 'none',
              borderTop: `2px solid ${k.c}` }}>
              <p style={{ fontSize: 9, color: muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.l}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: ink, fontFamily: 'monospace', lineHeight: 1 }}>
                {k.v}<span style={{ fontSize: 8, fontWeight: 400, color: muted }}> {k.u}</span>
              </p>
              <p style={{ fontSize: 9, marginTop: 3, fontWeight: 700, color: k.pos ? teal : P.red }}>{k.d}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', borderBottom: `1px solid ${border}` }}>
          <div style={{ padding: '10px 12px', borderRight: `1px solid ${border}` }}>
            <p style={{ fontSize: 8, color: muted, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Выручка по дням
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0',
                  background: i >= hi ? teal : 'rgba(14,116,144,0.15)', height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <p style={{ fontSize: 8, color: muted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Площадки
            </p>
            {[{mp:'Uzum',c:teal,pct:'48%'},{mp:'WB',c:teal,pct:'32%'},{mp:'YM',c:teal,pct:'20%'}].map(m => (
              <div key={m.mp} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: m.c }} />
                <span style={{ fontSize: 9, color: ink, flex: 1 }}>{m.mp}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: ink, fontFamily: 'monospace' }}>{m.pct}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 88px 44px 46px',
            padding: '5px 12px', background: bg2, borderBottom: `1px solid ${border}` }}>
            {['Товар','Артикул','Выручка, сум','ДРР%','Статус'].map(h => (
              <span key={h} style={{ fontSize: 8, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {rows.map(r => (
            <div key={r.sku} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 88px 44px 46px',
              padding: '6px 12px', borderBottom: `1px solid ${border}`, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: r.mp, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </div>
              <span style={{ fontSize: 8, color: muted, fontFamily: 'monospace' }}>{r.sku}</span>
              <span style={{ fontSize: 9, color: ink, fontFamily: 'monospace', fontWeight: 600 }}>{r.rev}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: r.drr > 10 ? P.red : teal }}>{r.drr}%</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.ok ? teal : P.red }} />
                <span style={{ fontSize: 8, color: muted }}>{r.ok ? 'Норма' : 'Мало'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 1. HERO ───────────────────────────────────────────────────────────────────
function HeroSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()

  // Light mode: light blue gradient hero  /  Dark mode: deep purple-navy hero
  const heroBg    = isDark ? P.dCanvas : 'linear-gradient(160deg, #c5e8fe 0%, #a0d4fc 40%, #a0d4fc 100%)'
  const glowColor = isDark ? 'rgba(197,232,254,0.12)' : 'rgba(144,213,255,0.55)'
  const headCol   = isDark ? P.dText   : P.ink
  const subCol    = isDark ? P.dMuted  : P.stone
  const secLinkCol = isDark ? 'rgba(255,255,255,0.62)' : P.stone
  const fadeTarget = isDark ? P.dCanvas : P.parchment

  return (
    <section style={{ position: 'relative', background: heroBg, overflow: 'hidden',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", paddingBottom: 0 }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 90% 55% at 50% -5%, ${glowColor} 0%, transparent 65%)` }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 45% 30% at 50% 0%, ${isDark ? 'rgba(197,232,254,0.06)' : 'rgba(14,116,144,0.08)'} 0%, transparent 55%)` }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '130px 100px 0',
        position: 'relative', zIndex: 10, textAlign: 'center' }}>

        {/* Floating stat cards — desktop only */}
        <div className="hidden lg:block">
          <FloatCard mp="Uzum" mpColor={acc.color} metric="Выручка" value="24.5M сум" change="+12%" up delay={0.35} floatDur={3.6}
            style={{ left: '-40px', top: '170px', transform: 'rotate(-4deg)', zIndex: 5 }} />
          <FloatCard mp="Wildberries" mpColor={acc.color} metric="Заказы" value="1 842" change="+8.1%" up delay={0.5} floatDur={4.1}
            style={{ right: '-40px', top: '150px', transform: 'rotate(3.5deg)', zIndex: 15 }} />
          <FloatCard mp="Yandex Market" mpColor={acc.color} metric="ДРР" value="8.2%" change="-1.4%" up={false} delay={0.65} floatDur={3.9}
            style={{ left: '-60px', top: '340px', transform: 'rotate(-2deg)', zIndex: 15 }} />
          <FloatCard mp="Uzum" mpColor={acc.color} metric="Прибыль" value="6.8M сум" change="+15%" up delay={0.8} floatDur={4.4}
            style={{ right: '-60px', top: '320px', transform: 'rotate(4.5deg)', zIndex: 5 }} />
        </div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.6 }}
          style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, lineHeight: 1.08,
            color: headCol, marginBottom: 18, letterSpacing: '-0.024em' }}>
          {tx(lang,
            <>Аналитика трёх маркетплейсов —<br/>всё на одном экране</>,
            <>Uch marketpleysning analitikasi —<br/>hammasi bitta ekranda</>,
            <>Three marketplace analytics —<br/>all on one screen</>
          )}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6 }}
          style={{ fontSize: 'clamp(14px, 1.6vw, 17px)', color: subCol, marginBottom: 36,
            maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.65 }}>
          {tx(lang,
            'Выручка, ДРР, остатки и юнит-экономика по Uzum, Wildberries и Yandex Market — всё в одной таблице с автообновлением',
            'Uzum, Wildberries va Yandex Market bo\'yicha daromad, DRR, qoldiqlar va birlik-iqtisod — barchasi bitta jadvalda',
            'Revenue, ad spend, stock and unit economics across Uzum, Wildberries and Yandex Market — all in one place'
          )}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30, duration: 0.55 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 56 }}>
          <Link href="/login"
            style={{ fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '14px 34px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s', display: 'inline-block' }}
            onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start for free')}
          </Link>
          <a href="#how"
            style={{ fontSize: 14, fontWeight: 600, color: secLinkCol, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : P.ink)}
            onMouseLeave={e => (e.currentTarget.style.color = secLinkCol)}>
            {tx(lang,'Как это работает','Qanday ishlaydi','How it works')} <ArrowRight size={14}/>
          </a>
        </motion.div>

        {/* Dashboard mockup — constrained width */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.40, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ maxWidth: 840, margin: '0 auto', position: 'relative', zIndex: 20 }}>
          <DashMockup />
        </motion.div>
      </div>

      <div style={{ height: 64, background: `linear-gradient(to bottom, transparent, ${fadeTarget})`,
        position: 'relative', zIndex: 5 }} />
    </section>
  )
}

// ── 2. COMPARISON TABLE ───────────────────────────────────────────────────────
function ComparisonSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg  = isDark ? P.dCanvas : P.parchment
  const cardBg = isDark ? P.dCard   : P.card
  const headBg = isDark ? P.dCard : P.parchment
  const bdr    = isDark ? P.dHair   : P.hair
  const txt    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone

  const rows = [
    tx(lang,'Выручка по всем площадкам','Barcha saytlar bo\'yicha daromad','Revenue across all platforms'),
    tx(lang,'ДРР в реальном времени','Real vaqt DRR','Real-time ad spend ratio'),
    tx(lang,'Остатки по складам','Ombor qoldiqlari','Stock by warehouse'),
    tx(lang,'Юнит-экономика','Birlik-iqtisod','Unit economics'),
    tx(lang,'Уведомления в Telegram','Telegram bildirishnomalari','Telegram notifications'),
    tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export'),
  ]

  return (
    <section id="comparison" style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Сейчас вы видите только половину данных','Hozir siz ma\'lumotlarning yarmini ko\'ryapsiz','You\'re only seeing half the data')}
          accent={tx(lang,'половину данных','yarmini','half the data')}
          sub={tx(lang,
            'Три отдельных кабинета не дают общей картины — приходится переключаться и складывать цифры вручную',
            'Uchta alohida kabinet umumiy rasmni bermaydi — raqamlarni qo\'lda hisoblashga to\'g\'ri keladi',
            'Three separate dashboards give no unified view — you switch tabs and add up numbers by hand'
          )}
        />
        <FadeUp delay={0.1}>
          <div style={{ background: cardBg, borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${bdr}`, boxShadow: isDark ? '0 4px 24px rgba(197,232,254,0.06)' : '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              background: headBg, borderBottom: `1px solid ${bdr}` }}>
              <div style={{ padding: '16px 24px' }}/>
              <div style={{ padding: '16px 24px', textAlign: 'center', borderLeft: `1px solid ${bdr}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: sub }}>
                  {tx(lang,'3 кабинета по отдельности','3 ta alohida kabinet','3 separate dashboards')}
                </p>
              </div>
              <div style={{ padding: '16px 24px', textAlign: 'center',
                background: isDark ? 'rgba(197,232,254,0.08)' : acc.bg, borderLeft: `1px solid ${bdr}` }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: acc.tint }}>Daromadchi</p>
              </div>
            </div>
            {rows.map((feature, i) => (
              <div key={feature} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom: i < rows.length - 1 ? `1px solid ${bdr}` : 'none' }}>
                <div style={{ padding: '15px 24px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: txt }}>{feature}</span>
                </div>
                <div style={{ padding: '15px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${bdr}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: isDark ? 'rgba(220,38,38,0.15)' : P.redBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={13} color={P.red}/>
                  </div>
                </div>
                <div style={{ padding: '15px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(197,232,254,0.06)' : acc.bg, borderLeft: `1px solid ${bdr}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: isDark ? 'rgba(197,232,254,0.15)' : `${acc.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={13} color={acc.tint}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeUp>
        <FadeUp delay={0.2} style={{ textAlign: 'center', marginTop: 36 }}>
          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '14px 36px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Попробовать бесплатно','Bepul sinab ko\'ring','Try for free')}
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}

// ── 3. FEATURES ───────────────────────────────────────────────────────────────
function FeaturesSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg   = isDark ? P.dCanvas : P.parchment
  const bentoBg = isDark ? P.dCard   : P.card
  const cardBg  = isDark ? P.dCard : P.card
  const border  = isDark ? P.dHair   : '#E2E8F0'
  const bg2     = isDark ? P.dCanvas : '#F8FAFD'
  const muted   = isDark ? P.dMuted  : '#94A3B8'
  const ink     = isDark ? P.dText   : '#0F172A'

  return (
    <section id="features" style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Главный инструмент для роста прибыли','Foyda o\'sishi uchun asosiy vosita','The main tool for profit growth')}
          accent={tx(lang,'роста прибыли','o\'sishi','profit growth')}
          sub={tx(lang,'Один экран вместо десяти вкладок','O\'nta yorliq o\'rniga bitta ekran','One screen instead of ten tabs')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <FadeUp delay={0.05}>
            <div style={{ background: bentoBg, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, height: '100%', minHeight: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: acc.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Таблица товаров','Mahsulotlar jadvali','Products table')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'ДРР, расходы и остатки — всё в одном месте','DRR, xarajatlar va qoldiqlar — barchasi bir joyda','DRR, costs and stock — all in one place')}
              </p>
              <div style={{ background: cardBg, borderRadius: 12, overflow: 'hidden', border: `1px solid ${border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 60px 42px',
                  padding: '6px 12px', background: bg2, borderBottom: `1px solid ${border}` }}>
                  {['Товар','Выручка','ДРР%','Склад'].map(h => (
                    <span key={h} style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                  ))}
                </div>
                {[
                  { n:'Куртка зимняя', rev:'18.2M', drr:7.2,  ok:true  },
                  { n:'Кроссовки Nike',rev:'12.6M', drr:11.4, ok:false },
                  { n:'Рюкзак 40L',    rev:'9.9M',  drr:9.8,  ok:true  },
                  { n:'Наушники Sony', rev:'8.3M',  drr:6.1,  ok:true  },
                  { n:'Кроссовки Puma',rev:'7.1M',  drr:13.2, ok:false },
                ].map((r,i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 60px 42px',
                    padding: '7px 12px', borderBottom: i < 4 ? `1px solid ${border}` : 'none', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: acc.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: ink }}>{r.rev}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: r.drr > 11 ? P.red : acc.tint }}>{r.drr}%</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.ok ? acc.color : P.red }} />
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div style={{ background: bentoBg, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, height: '100%', minHeight: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: acc.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Дашборд','Dashboard','Dashboard')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'Выручка, заказы, расход и прибыль — за любой период','Daromad, buyurtmalar, xarajatlar — istalgan davr uchun','Revenue, orders, spend and profit — for any period')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { l:'Выручка', v:'124.5M сум', d:'+12.4%', pos: true  },
                  { l:'Заказы',  v:'1 842',       d:'+8.1%',  pos: true  },
                  { l:'Расход',  v:'10.2M сум',   d:'+3.2%',  pos: false },
                  { l:'Прибыль', v:'38.2M сум',   d:'+15.7%', pos: true  },
                ].map(k => (
                  <div key={k.l} style={{ background: cardBg, borderRadius: 10, padding: '12px', borderTop: `2px solid ${acc.color}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{k.l}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: ink, fontFamily: 'monospace', lineHeight: 1.1 }}>{k.v}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: k.pos ? acc.tint : P.red, marginTop: 2 }}>{k.d}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: cardBg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
                  {[30,48,38,65,52,78,60,82,70,55,75,92,66,80].map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`,
                      background: i >= 10 ? acc.color : `${acc.color}28` }} />
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.15}>
            <div style={{ background: bentoBg, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: acc.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tx(lang,'Юнит-экономика','Birlik-iqtisod','Unit economics')}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: ink, marginBottom: 14 }}>
                  {tx(lang,'Рентабельность по каждому товару','Har bir mahsulot bo\'yicha rentabellik','Profitability per product')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { l: tx(lang,'Закупка','Sotib olish','Purchase'), v: '12 000 сум' },
                    { l: tx(lang,'Логистика','Logistika','Logistics'), v: '1 800 сум' },
                    { l: tx(lang,'Реклама','Reklama','Ad spend'), v: '2 350 сум' },
                    { l: tx(lang,'Цена продажи','Sotish narxi','Sale price'), v: '28 500 сум' },
                  ].map(row => (
                    <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px', background: cardBg, borderRadius: 8, border: `1px solid ${border}` }}>
                      <span style={{ fontSize: 11, color: muted }}>{row.l}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ink, fontFamily: 'monospace' }}>{row.v}</span>
                    </div>
                  ))}
                  <div style={{ padding: '9px 10px', background: acc.bg, borderRadius: 8,
                    border: `1px solid ${isDark ? P.dHair : `${acc.color}25`}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: acc.dk }}>{tx(lang,'Маржа','Marja','Margin')}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: acc.tint, fontFamily: 'monospace' }}>52.6% ↑</span>
                  </div>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: acc.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tx(lang,'Уведомления','Bildirishnomalar','Notifications')}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: ink, marginBottom: 14 }}>
                  {tx(lang,'Алерты в Telegram каждые 15 мин','Har 15 daqiqada Telegram xabarlari','Telegram alerts every 15 min')}
                </p>
                <div style={{ background: isDark ? P.dCanvas : P.parchment, borderRadius: 12, padding: '10px',
                  border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { icon: '🔔', text: tx(lang,'Остатки «Куртка» — 12 шт, 3 дня','Qoldiqlar — 12 ta, 3 kun','Stock low — 12 pcs, 3 days') },
                    { icon: '📈', text: tx(lang,'ДРР превысил 15% по 3 товарам','3 ta mahsulot DRR 15% dan oshdi','DRR exceeded 15% on 3 products') },
                    { icon: '✅', text: tx(lang,'WB: новый заказ #WB-48291','WB: yangi buyurtma #WB-48291','WB: new order #WB-48291') },
                  ].map((n, i) => (
                    <div key={i} style={{ background: cardBg, borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${acc.color}` }}>
                      <p style={{ fontSize: 10, color: ink, lineHeight: 1.4 }}>{n.icon} {n.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div style={{ background: bentoBg, borderRadius: 20, padding: '24px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: acc.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'Скачайте отчёт в один клик — все данные как в таблице','Hisobotni bir marta bosish bilan yuklab oling','Download report in one click')}
              </p>
              <div style={{ background: cardBg, borderRadius: 12, overflow: 'hidden', border: `1px solid ${border}`, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#217346' }}>
                  <div style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>X</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>daromadchi_report_2026.xlsx</span>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 40px' }}>
                    {['A','B','C','D'].map(h => (
                      <div key={h} style={{ background: '#217346', padding: '3px 6px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{h}</span>
                      </div>
                    ))}
                    {[['Куртка зимняя','18 240 000','7.2%','120'],['Кроссовки','12 590 000','11.4%','84'],['Рюкзак 40L','9 870 000','9.8%','67']].map((row,ri) =>
                      row.map((cell,ci) => (
                        <div key={`${ri}-${ci}`} style={{ padding: '4px 6px',
                          border: `1px solid ${isDark ? '#2A2050' : '#E2E8E0'}`,
                          borderTop: 'none', borderLeft: ci > 0 ? 'none' : `1px solid ${isDark ? '#2A2050' : '#E2E8E0'}` }}>
                          <span style={{ fontSize: 9, color: ink, fontFamily: ci > 0 ? 'monospace' : 'inherit' }}>{cell}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <Link href="/login"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
                  padding: '10px 20px', borderRadius: 8, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = acc.btnHov)}
                onMouseLeave={e => (e.currentTarget.style.background = acc.btn)}>
                {tx(lang,'Скачать отчёт','Hisobotni yuklab olish','Download report')} <ArrowRight size={14}/>
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ── 4. HOW IT WORKS — interactive accordion ───────────────────────────────────
function HowItWorksSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const [active, setActive] = useState(0)

  const secBg  = isDark ? P.dCard : P.parchment
  const ink    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone
  const uiBg   = isDark ? 'rgba(28,28,46,0.95)' : P.parchment
  const uiBdr  = isDark ? P.dHair   : P.hair
  const fldBg  = isDark ? P.dCard2 : '#fff'

  const steps = [
    {
      color: acc.tint,
      title: tx(lang,'Регистрация','Ro\'yxatdan o\'tish','Register'),
      desc: tx(lang,
        'Только email и пароль. Менее 30 секунд — и вы внутри',
        'Faqat email va parol. 30 soniyadan kam — va siz ichkaridasiz',
        'Just email and password. Under 30 seconds and you\'re in'
      ),
      ui: (
        <div style={{ background: uiBg, borderRadius: 16, padding: '20px',
          border: `1px solid ${uiBdr}`, boxShadow: isDark ? '0 8px 32px rgba(197,232,254,0.08)' : '0 8px 32px rgba(0,0,0,0.10)' }}>
          {[{l:'Email',v:'seller@example.com'},{l:tx(lang,'Пароль','Parol','Password'),v:'••••••••••'}].map(f => (
            <div key={f.l} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: sub, marginBottom: 5 }}>{f.l}</p>
              <div style={{ background: fldBg, border: `1px solid ${uiBdr}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, color: ink }}>{f.v}</span>
              </div>
            </div>
          ))}
          <div style={{ background: acc.color, borderRadius: 8, padding: '11px', textAlign: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#131321' }}>{tx(lang,'Зарегистрироваться','Ro\'yxatdan o\'tish','Sign up')}</span>
          </div>
        </div>
      ),
    },
    {
      color: acc.tint,
      title: tx(lang,'Подключите магазин','Do\'koningizni ulang','Connect your store'),
      desc: tx(lang,
        'Вставьте API-ключ из кабинета Uzum, WB или Яндекс — мы не можем менять данные в вашем магазине, только читать',
        'Uzum, WB yoki Yandex kabinetidan API kalitini kiriting — biz faqat o\'qiy olamiz',
        'Paste API key from Uzum, WB or Yandex — we can only read data, never modify your store'
      ),
      ui: (
        <div style={{ background: uiBg, borderRadius: 16, padding: '20px',
          border: `1px solid ${uiBdr}`, boxShadow: isDark ? '0 8px 32px rgba(197,232,254,0.08)' : '0 8px 32px rgba(0,0,0,0.10)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: sub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {tx(lang,'Ваши магазины','Do\'konlaringiz','Your stores')}
          </p>
          {[{mp:'Uzum',c:acc.color,status:'✅'},{mp:'Wildberries',c:acc.color,status:'✅'},{mp:'Yandex Market',c:acc.color,status:'⏳'}].map(m => (
            <div key={m.mp} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', background: fldBg, borderRadius: 10, border: `1px solid ${uiBdr}`, marginBottom: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.c }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: ink, flex: 1 }}>{m.mp}</span>
              <span style={{ fontSize: 16 }}>{m.status}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      color: acc.tint,
      title: tx(lang,'Данные готовы','Ma\'lumotlar tayyor','Data is ready'),
      desc: tx(lang,
        'Данные синхронизируются автоматически — вся история продаж с момента подключения, без ручного ввода',
        'Ma\'lumotlar avtomatik sinxronlanadi — do\'koningizni ulagan paytdan boshlab barcha sotuv tarixi',
        'Data syncs automatically — full sales history from the moment you connect, no manual entry needed'
      ),
      ui: (
        <div style={{ background: uiBg, borderRadius: 16, padding: '20px',
          border: `1px solid ${uiBdr}`, boxShadow: isDark ? '0 8px 32px rgba(197,232,254,0.08)' : '0 8px 32px rgba(0,0,0,0.10)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[{l:'Заказы',v:'1 842',d:'+300%',c:acc.color},{l:'ДРР',v:'8.2%',d:'-20.9%',c:acc.color}].map(k => (
              <div key={k.l} style={{ background: fldBg, borderRadius: 10, padding: '14px',
                border: `1px solid ${uiBdr}`, borderTop: `2px solid ${k.c}` }}>
                <p style={{ fontSize: 11, color: sub, marginBottom: 4 }}>{k.l}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: ink, fontFamily: 'monospace' }}>{k.v}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: k.c, marginTop: 3 }}>{k.d}</p>
              </div>
            ))}
          </div>
          <div style={{ background: fldBg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${uiBdr}` }}>
            <p style={{ fontSize: 10, color: sub, marginBottom: 8, fontWeight: 600 }}>
              {tx(lang,'Выручка по дням','Kunlik daromad','Daily revenue')}
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
              {[40,55,48,70,62,80,72,90,76,60,84,96,70,88].map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`,
                  background: i >= 10 ? acc.color : (isDark ? `${acc.color}30` : 'rgba(14,116,144,0.15)') }} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <section id="how" style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Настройте магазин за 5 минут','Do\'koningizni 5 daqiqada sozlang','Set up your store in 5 minutes')}
          accent={tx(lang,'за 5 минут','5 daqiqada','in 5 minutes')}
          sub={tx(lang,'Три шага до полной аналитики','To\'liq tahlilgacha uch qadam','Three steps to full analytics')}
        />

        {/* Two-column: accordion tabs left, active UI right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 48, alignItems: 'start' }}>

          {/* Left: accordion */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((s, i) => {
              const isActive = active === i
              return (
                <div key={i}
                  onClick={() => setActive(i)}
                  style={{ cursor: isActive ? 'default' : 'pointer',
                    borderLeft: `3px solid ${isActive ? s.color : (isDark ? 'rgba(197,232,254,0.15)' : P.hair)}`,
                    padding: '0 0 0 20px', marginBottom: 4,
                    transition: 'border-color 0.2s' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? s.color : (isDark ? 'rgba(197,232,254,0.10)' : P.hair),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800,
                      color: isActive ? '#131321' : (isDark ? P.dMuted : P.stone),
                      transition: 'all 0.2s',
                      boxShadow: isActive ? `0 4px 14px ${s.color}50` : 'none' }}>
                      {i + 1}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0,
                      color: isActive ? (isDark ? P.dText : P.ink) : (isDark ? P.dMuted : P.stone),
                      transition: 'color 0.2s' }}>
                      {s.title}
                    </h3>
                  </div>

                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: 14, color: sub, lineHeight: 1.65,
                          paddingBottom: 18, paddingLeft: 50, paddingRight: 8 }}>
                          {s.desc}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            <div style={{ paddingLeft: 20, marginTop: 8 }}>
              <Link href="/login"
                style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
                  padding: '13px 32px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
                {tx(lang,'Подключить бесплатно','Bepul ulash','Connect for free')}
              </Link>
            </div>
          </div>

          {/* Right: active UI illustration */}
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}>
              {steps[active].ui}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// ── 5. WHO IS IT FOR ──────────────────────────────────────────────────────────
function WhoSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg  = isDark ? P.dCanvas : P.parchment
  const cardBg = isDark ? P.dCard   : P.card
  const bdr    = isDark ? P.dHair   : P.hair
  const ink    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone

  const cards = [
    {
      color: acc.tint,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(14,116,144,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#0E7490" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#0E7490" opacity="0.65"/>
        </svg>
      ),
      title: tx(lang,'Начинающий продавец','Yangi sotuvchi','New seller'),
      desc: tx(lang,'Подбираете первый товар? UNIT-экономика покажет реальную маржу до закупки — без Excel и формул',
        'Birinchi mahsulotni tanlayapsizmi? UNIT-iqtisod sotib olishdan oldin haqiqiy marjani ko\'rsatadi',
        'Picking your first product? Unit economics shows real margin before purchase — no Excel needed'),
      features: [tx(lang,'Калькулятор маржи','Marja kalkulyatori','Margin calculator'),
        tx(lang,'Анализ конкурентов','Raqobatchilarni tahlil','Competitor analysis'),
        tx(lang,'Подбор ниши','Nishani tanlash','Niche selection')],
    },
    {
      color: acc.tint,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(14,116,144,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#0E7490" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#0E7490" opacity="0.65"/>
        </svg>
      ),
      title: tx(lang,'Растущий магазин','O\'sib borayotgan do\'kon','Growing store'),
      desc: tx(lang,'Тратите на рекламу, но не понимаете, окупается ли? Таблица покажет ДРР по каждому товару в реальном времени',
        'Reklamaga xarajat qilyapsizmi, lekin to\'layaptimi bilmayapsizmi? Jadval DRR ni ko\'rsatadi',
        'Spending on ads but unsure of ROI? The table shows DRR per product in real time'),
      features: [tx(lang,'ДРР по товарам','Mahsulotlar bo\'yicha DRR','DRR per product'),
        tx(lang,'Контроль остатков','Qoldiqlarni nazorat','Stock control'),
        tx(lang,'Уведомления Telegram','Telegram bildirishnomalari','Telegram alerts')],
    },
    {
      color: acc.tint,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(14,116,144,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#0E7490" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#0E7490" opacity="0.65"/>
        </svg>
      ),
      title: tx(lang,'Менеджер магазинов','Do\'konlar menejeri','Store manager'),
      desc: tx(lang,'Ведёте несколько магазинов клиентов? Настройте пресеты, каждое утро открывайте дашборд — и всё под контролем',
        'Bir nechta mijoz do\'konini boshqaryapsizmi? Presetlarni sozlang, har ertalab dashbordni oching',
        'Managing multiple client stores? Set presets, open the dashboard each morning — everything under control'),
      features: [tx(lang,'Несколько магазинов','Bir nechta do\'kon','Multiple stores'),
        tx(lang,'Пресеты колонок','Ustunlar presetlari','Column presets'),
        tx(lang,'Сводный отчёт','Yig\'ma hisobot','Summary report')],
    },
  ]

  return (
    <section style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Кому подходит Daromadchi','Daromadchi kimga mos keladi','Who is Daromadchi for')}
          accent={tx(lang,'подходит','mos keladi','for')}
          sub={tx(lang,'Для продавцов на Uzum, Wildberries и Yandex Market в Узбекистане',
            'O\'zbekistondagi Uzum, Wildberries va Yandex Market sotuvchilari uchun',
            'For sellers on Uzum, Wildberries and Yandex Market in Uzbekistan')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {cards.map((c, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div style={{ background: cardBg, borderRadius: 20, padding: '32px 28px',
                border: `1px solid ${bdr}`, textAlign: 'center', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = isDark ? '0 12px 36px rgba(197,232,254,0.10)' : '0 12px 36px rgba(0,0,0,0.10)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>{c.avatar}</div>
                <span style={{ fontSize: 30, fontWeight: 900, color: c.color, fontFamily: 'var(--font-mono-landing), monospace',
                  display: 'block', marginBottom: 10 }}>{String(i+1).padStart(2,'0')}</span>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: ink, marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontSize: 14, color: sub, lineHeight: 1.65, marginBottom: 20 }}>{c.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={13} color={c.color}/>
                      <span style={{ fontSize: 13, color: sub }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 6. PRICING — theme-aware ──────────────────────────────────────────────────
function SlotPrice({ value, trigger, delay = 0 }: { value: string; trigger: boolean; delay?: number }) {
  const DIGITS = '0123456789'
  const blank = value.replace(/\d/g, '-')
  const [display, setDisplay] = useState(blank)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!trigger) return
    const plainLen = value.replace(/ /g, '').length
    timerRef.current = setTimeout(() => {
      let frame = 0
      const total = 22 + plainLen * 3
      const iv = setInterval(() => {
        if (frame >= total) { setDisplay(value); clearInterval(iv); return }
        setDisplay(
          value.split('').map((ch, i) => {
            if (ch === ' ') return ' '
            const charIdx = value.slice(0, i + 1).replace(/ /g, '').length - 1
            const revealFrame = Math.floor(total * 0.55 * ((charIdx + 1) / plainLen))
            return frame > revealFrame ? ch : DIGITS[Math.floor(Math.random() * 10)]
          }).join('')
        )
        frame++
      }, 48)
    }, delay * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [trigger, value, delay])

  return <span className="tabular-nums">{display}</span>
}

function PricingSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const sectionRef = useRef(null)
  const inView = useInView(sectionRef, { once: true, amount: 0.3 })

  const secBg  = isDark ? P.dCanvas : P.parchment
  const ink    = isDark ? P.dText   : P.ink
  const muted  = isDark ? P.dMuted  : P.stone
  const bdr    = isDark ? P.dHair   : P.hair
  const cardBg = isDark ? P.dCard : P.card

  const tiers = [
    {
      name: tx(lang,'Бесплатно','Bepul','Free'), price: '0',
      sub: tx(lang,'навсегда','abadiy','forever'), highlight: false,
      features: [
        tx(lang,'Демо-данные','Demo ma\'lumotlar','Demo data'),
        tx(lang,'1 магазин','1 do\'kon','1 store'),
        tx(lang,'6 страниц аналитики','6 tahlil sahifasi','6 analytics pages'),
      ],
      cta: tx(lang,'Начать бесплатно','Bepul boshlash','Start free'), ctaHref: '/login',
    },
    {
      name: 'Pro', price: '300 000', badge: tx(lang,'Популярный','Ommabop','Popular'),
      sub: tx(lang,'сум / месяц','so\'m / oy','sum / month'), highlight: true,
      features: [
        tx(lang,'До 3 магазинов','3 ta do\'kongacha','Up to 3 stores'),
        tx(lang,'Вся аналитика','Barcha tahlillar','All analytics'),
        tx(lang,'Автосинхронизация','Avto-sinxronizatsiya','Auto-sync'),
        tx(lang,'P&L отчёт','P&L hisobot','P&L report'),
        tx(lang,'Email-уведомления','Email ogohlantirishlar','Email notifications'),
      ],
      cta: tx(lang,'Попробовать Pro','Pro ni sinab ko\'rish','Try Pro'), ctaHref: '/login',
    },
    {
      name: 'Pro+', price: '600 000',
      sub: tx(lang,'сум / месяц','so\'m / oy','sum / month'), highlight: false,
      features: [
        tx(lang,'5+ магазинов','5+ do\'konlar','5+ stores'),
        tx(lang,'Всё из Pro','Barcha Pro imkoniyatlar','Everything in Pro'),
        tx(lang,'API-доступ','API kirish','API access'),
        tx(lang,'Приоритетная поддержка','Ustuvor yordam','Priority support'),
      ],
      cta: tx(lang,'Подключить Pro+','Pro+ ulash','Get Pro+'), ctaHref: '/login',
    },
  ]

  return (
    <section id="pricing" ref={sectionRef} style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: acc.tint, marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {tx(lang,'ТАРИФЫ','TARIFLAR','PRICING')}
          </p>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: ink,
            letterSpacing: '-0.022em', marginBottom: 16 }}>
            {tx(lang,'Тариф для вашего бизнеса','Biznesingizga mos tarif','A plan for your business')}
          </h2>
          <p style={{ fontSize: 16, color: muted, maxWidth: 400, margin: '0 auto' }}>
            {tx(lang,'Начните бесплатно, масштабируйтесь по мере роста',
              'Bepul boshlang, o\'sish bilan kengaytiring','Start free, scale as you grow')}
          </p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {tiers.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: -140, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: t.highlight ? 1.02 : 1 } : {}}
              transition={{ delay: i * 0.18, type: 'spring', stiffness: 160, damping: 18 }}
              style={{
                background: t.highlight ? P.parchment : cardBg,
                borderRadius: 20, padding: '28px 24px',
                border: `1px solid ${t.highlight ? acc.color : bdr}`,
                boxShadow: t.highlight
                  ? `0 16px 48px ${acc.color}30`
                  : isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
                position: 'relative', display: 'flex', flexDirection: 'column',
              }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.highlight ? acc.dk : muted }}>
                  {t.name}
                </p>
                {(t as any).badge && (
                  <span style={{ background: acc.color, borderRadius: 100, padding: '3px 12px',
                    fontSize: 10, fontWeight: 800, color: '#131321', letterSpacing: '0.04em' }}>
                    {(t as any).badge}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: ink,
                  fontFamily: 'var(--font-mono-landing), monospace' }}>
                  {t.price === '0' ? '0' : <SlotPrice value={t.price} trigger={inView} delay={i * 0.18 + 0.4} />}
                </span>
              </div>
              <p style={{ fontSize: 13, color: muted, marginBottom: 24 }}>{t.sub}</p>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {t.features.map((f, fi) => (
                  <motion.div key={f}
                    initial={{ opacity: 0, x: -8 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: i * 0.18 + 0.7 + fi * 0.05, duration: 0.25 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Check size={14} color={acc.tint} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, color: ink, lineHeight: 1.4 }}>{f}</span>
                  </motion.div>
                ))}
              </div>

              <Link href={t.ctaHref}
                style={{ display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 700,
                  background: acc.btn, color: acc.btnTxt, padding: '13px 24px', borderRadius: 10,
                  textDecoration: 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov }}
                onMouseLeave={e => { e.currentTarget.style.background = acc.btn }}>
                {t.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 7. RESOURCES ──────────────────────────────────────────────────────────────
function ResourcesSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg  = isDark ? P.dCanvas : P.parchment
  const cardBg = isDark ? P.dCard   : P.card
  const bdr    = isDark ? P.dHair   : P.hair
  const ink    = isDark ? P.dText   : P.ink
  const muted  = isDark ? P.dMuted  : P.stone

  const cards = [
    {
      icon: <BookOpen size={20} color={acc.tint} />, title: tx(lang,'Справка','Yordam markazi','Help center'),
      items: [
        { t: tx(lang,'Быстрый старт за 5 минут','5 daqiqada tez boshlash','Quick start in 5 minutes'), sub: tx(lang,'Пошаговое руководство','Bosqichma-bosqich qo\'llanma','Step-by-step guide') },
        { t: tx(lang,'Как работает ДРР','DRR qanday ishlaydi','How DRR works'), sub: tx(lang,'Формула и примеры','Formula va misollar','Formula and examples') },
        { t: tx(lang,'Настройка юнит-экономики','Birlik-iqtisodni sozlash','Setting up unit economics'), sub: tx(lang,'Укажите закупку и логистику','Xarid va logistikani kiriting','Enter purchase costs and logistics') },
      ],
      link: tx(lang,'Все статьи →','Barcha maqolalar →','All articles →'), linkColor: acc.tint, href: '/help',
    },
    {
      icon: <MessageCircle size={20} color={acc.tint} />, title: 'Telegram',
      items: [
        { t: tx(lang,'Канал с обновлениями','Yangilanishlar kanali','Updates channel'), sub: tx(lang,'Новые функции и релизы','Yangi funksiyalar va relizlar','New features & releases'), dot: acc.tint },
        { t: tx(lang,'Чат поддержки','Qo\'llab-quvvatlash chati','Support chat'), sub: tx(lang,'Ответ в течение часа','Bir soat ichida javob','Reply within an hour'), dot: acc.tint },
        { t: tx(lang,'Сообщество продавцов','Sotuvchilar hamjamiyati','Sellers community'), sub: tx(lang,'Советы и кейсы','Maslahatlar va holatlar','Tips & case studies'), dot: acc.tint },
      ],
      link: tx(lang,'Открыть Telegram →','Telegramni ochish →','Open Telegram →'), linkColor: acc.tint, href: 'https://t.me/daromadchi',
    },
    {
      icon: <Plug2 size={20} color={acc.tint} />, title: tx(lang,'Интеграции','Integratsiyalar','Integrations'),
      items: [
        { t: 'Uzum Market', sub: tx(lang,'Подключение через API-ключ','API kalit orqali ulash','Connect via API key'), dot: acc.tint },
        { t: 'Wildberries', sub: tx(lang,'Подключение через токен WB','WB token orqali ulash','Connect via WB token'), dot: acc.tint },
        { t: 'Yandex Market', sub: tx(lang,'OAuth-авторизация','OAuth-avtorizatsiya','OAuth authorisation'), dot: acc.tint },
      ],
      link: tx(lang,'Инструкция по подключению →','Ulash yo\'riqnomasi →','Connection guide →'), linkColor: acc.tint, href: '/help',
    },
  ]

  return (
    <section id="resources" style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Помощь и интеграции','Yordam va integratsiyalar','Help & integrations')}
          accent={tx(lang,'интеграции','integratsiyalar','integrations')}
          sub={tx(lang,'Документация, Telegram-сообщество и подключение площадок',
            'Hujjatlar, Telegram-hamjamiyat va maydonchalarni ulash',
            'Documentation, Telegram community and marketplace connections')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {cards.map((c, i) => (
            <FadeUp key={c.title} delay={i * 0.1}>
              <div style={{ background: cardBg, borderRadius: 20, padding: '24px',
                border: `1px solid ${bdr}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  {c.icon}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: ink }}>{c.title}</h3>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {c.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                      {('dot' in item) && <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot as string, marginTop: 5, flexShrink: 0 }} />}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: ink, marginBottom: 2, lineHeight: 1.4 }}>{item.t}</p>
                        <p style={{ fontSize: 11, color: muted }}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={(c as any).href ?? '/help'} style={{ fontSize: 13, fontWeight: 700, color: c.linkColor, textDecoration: 'none', marginTop: 20, display: 'block' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {c.link}
                </Link>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 8. FAQ ────────────────────────────────────────────────────────────────────
function FaqSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const [open, setOpen] = useState<number | null>(0)
  const secBg = isDark ? P.dCard : P.parchment
  const bdr   = isDark ? P.dHair   : P.hair
  const ink   = isDark ? P.dText   : P.ink
  const sub   = isDark ? P.dMuted  : P.stone

  const faqs = [
    { q: tx(lang,'Безопасно ли подключать API-ключ?','API kalitini ulash xavfsizmi?','Is it safe to connect my API key?'),
      a: tx(lang,'Да. Мы используем только Read Only ключи — мы можем читать данные из вашего магазина, но никогда не можем изменять цены, товары или заказы. Ключ хранится в зашифрованном виде.',
        'Ha. Biz faqat Read Only kalitlaridan foydalanamiz — biz do\'kongingizdagi ma\'lumotlarni o\'qiy olamiz, lekin narxlar, mahsulotlar yoki buyurtmalarni hech qachon o\'zgartira olmaymiz.',
        'Yes. We only use Read Only keys — we can read data from your store but can never modify prices, products or orders. The key is stored encrypted.') },
    { q: tx(lang,'Как быстро появляются данные после подключения?','Ulanganidan keyin ma\'lumotlar qanchalik tez paydo bo\'ladi?','How quickly does data appear after connecting?'),
      a: tx(lang,'Первая синхронизация занимает до 5 минут и подтягивает историю за последние 7 дней. Далее данные обновляются автоматически каждые 15 минут для заказов и каждые 4 часа для статистики.',
        'Birinchi sinxronizatsiya 5 daqiqagacha davom etadi va so\'nggi 7 kunlik tarixni tortib oladi. Keyin buyurtmalar uchun har 15 daqiqada, statistika uchun har 4 soatda avtomatik yangilanadi.',
        'First sync takes up to 5 minutes and pulls 7 days of history. After that, orders update every 15 minutes and statistics every 4 hours.') },
    { q: tx(lang,'Поддерживаете ли все три маркетплейса?','Uchala marketpleysni ham qo\'llayapsizmi?','Do you support all three marketplaces?'),
      a: tx(lang,'Да — Uzum Market, Wildberries и Yandex Market полностью поддерживаются. Данные из всех трёх платформ объединяются в единую таблицу с разбивкой по площадкам.',
        'Ha — Uzum Market, Wildberries va Yandex Market to\'liq qo\'llaniladi.',
        'Yes — Uzum Market, Wildberries and Yandex Market are fully supported. Data from all three platforms is merged into one table with per-platform breakdown.') },
    { q: tx(lang,'Как работает юнит-экономика?','Birlik-iqtisod qanday ishlaydi?','How does unit economics work?'),
      a: tx(lang,'Вы вводите закупочную цену, логистику и прочие расходы по каждому товару. Daromadchi автоматически рассчитывает маржу, ROI и минимальную цену продажи для безубыточности.',
        'Har bir mahsulot uchun xarid narxi, logistika va boshqa xarajatlarni kiritasiz. Daromadchi avtomatik ravishda marja, ROI va minimal sotish narxini hisoblaydi.',
        'You enter purchase price, logistics and other costs per product. Daromadchi automatically calculates margin, ROI and minimum break-even price.') },
    { q: tx(lang,'Есть ли мобильная версия?','Mobil versiya bormi?','Is there a mobile version?'),
      a: tx(lang,'Веб-версия адаптирована для мобильных устройств и работает в любом браузере. Нативное мобильное приложение в дорожной карте на август 2026 года.',
        'Veb-versiya mobil qurilmalar uchun moslashtirilgan. Mahalliy mobil ilova avgust 2026 yo\'l xaritasida.',
        'The web version is mobile-responsive and works in any browser. A native mobile app is on the roadmap for August 2026.') },
    { q: tx(lang,'Можно ли попробовать перед оплатой?','To\'lovdan oldin sinab ko\'rsa bo\'ladimi?','Can I try before paying?'),
      a: tx(lang,'Да, есть бесплатный тариф без ограничения по времени: до 1 магазина, топ-50 товаров, ежедневные обновления. Для доступа ко всем функциям — Pro от 149 000 сум/мес.',
        'Ha, vaqt cheklovisiz bepul tarif mavjud: 1 do\'kongacha, top-50 mahsulot, kunlik yangilanishlar.',
        'Yes, there\'s a free tier with no time limit: up to 1 store, top 50 products, daily updates. For all features — Pro from 149,000 sum/month.') },
  ]

  return (
    <section id="faq" style={{ background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={tx(lang,'Частые вопросы','Tez-tez so\'raladigan savollar','Frequently asked questions')}
          accent={tx(lang,'вопросы','savollar','questions')}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {faqs.map((f, i) => (
            <FadeUp key={i} delay={i * 0.06}>
              <div style={{ borderBottom: `1px solid ${bdr}` }}>
                <button onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: acc.tint,
                      fontFamily: 'var(--font-mono-landing), monospace', minWidth: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: ink }}>{f.q}</span>
                  </div>
                  <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={18} color={sub}/>
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: 14, color: sub, lineHeight: 1.7, paddingBottom: 20, paddingLeft: 34 }}>
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 9. CTA ────────────────────────────────────────────────────────────────────
function CtaSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg   = isDark ? P.dCanvas : 'linear-gradient(160deg, #c5e8fe 0%, #a0d4fc 55%, #a0d4fc 100%)'
  const headCol = isDark ? P.dText   : P.ink
  const subCol  = isDark ? P.dMuted  : P.stone
  const badgeCol = isDark ? 'rgba(255,255,255,0.45)' : P.stone
  const glowColor = isDark ? 'rgba(197,232,254,0.12)' : 'rgba(144,213,255,0.45)'

  return (
    <section style={{ position: 'relative', background: secBg, overflow: 'hidden',
      padding: '100px 24px', fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 55% at 50% 120%, ${glowColor} 0%, transparent 65%)` }} />

      <div className="hidden lg:block">
        <FloatCard mp="Uzum" mpColor={acc.color} metric="Выручка" value="24.5M сум" change="+12%" up delay={0} floatDur={3.8}
          style={{ left: '4%', top: '20%', transform: 'rotate(-3.5deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Wildberries" mpColor={acc.color} metric="Заказы" value="1 842" change="+8%" up delay={0.1} floatDur={4.3}
          style={{ right: '3%', top: '18%', transform: 'rotate(4deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Yandex Market" mpColor={acc.color} metric="ДРР" value="8.2%" change="-1.4%" up={false} delay={0.15} floatDur={3.6}
          style={{ left: '6%', bottom: '20%', transform: 'rotate(-2deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Uzum" mpColor={acc.color} metric="Прибыль" value="6.8M сум" change="+15%" up delay={0.2} floatDur={4.1}
          style={{ right: '5%', bottom: '22%', transform: 'rotate(3deg)', zIndex: 5, opacity: 0.9 }} />
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <FadeUp>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, color: headCol,
            lineHeight: 1.08, letterSpacing: '-0.024em', marginBottom: 20 }}>
            {tx(lang,'Хватит работать вслепую — начните видеть цифры',
              'Ko\'r-ko\'rona ishlamayin — raqamlarni ko\'ra boshlang',
              'Stop flying blind — start seeing the numbers')}
          </h2>
          <p style={{ fontSize: 16, color: subCol, lineHeight: 1.65, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
            {tx(lang,'Подключите магазин за несколько минут. Бесплатный тариф, без привязки карты',
              'Do\'koningizni bir necha daqiqada ulang. Bepul tarif, karta bog\'lanmaydi',
              'Connect your store in minutes. Free plan, no credit card required')}
          </p>
          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 16, fontWeight: 700,
              background: acc.btn, color: acc.btnTxt,
              padding: '16px 44px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s', marginBottom: 20 }}
            onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start for free')}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {[tx(lang,'✓ 14 дней бесплатно','✓ 14 kun bepul','✓ 14 days free'),
              tx(lang,'✓ Без карты','✓ Kartasiz','✓ No card'),
              tx(lang,'✓ Быстрое подключение','✓ Tez ulanish','✓ Quick setup')].map(s => (
              <span key={s} style={{ fontSize: 13, color: badgeCol, fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function FooterSection({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const footBg  = isDark ? P.dCanvas  : P.card
  const bdr     = isDark ? P.dHair    : P.hair
  const txt     = isDark ? P.dText    : P.ink
  const muted   = isDark ? P.dMuted   : P.stone
  const subtle  = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)'

  const cols = [
    { head: tx(lang,'Продукт','Mahsulot','Product'), links: [
      { label: tx(lang,'Войти','Kirish','Sign in'), href: '/login' },
      { label: tx(lang,'Регистрация','Ro\'yxatdan o\'tish','Register'), href: '/login' },
      { label: tx(lang,'Тарифы','Tariflar','Pricing'), href: '#pricing' },
      { label: tx(lang,'Возможности','Imkoniyatlar','Features'), href: '#features' },
    ]},
    { head: tx(lang,'Маркетплейсы','Marketpleyslar','Marketplaces'), links: [
      { label: 'Uzum Market', href: '#' }, { label: 'Wildberries', href: '#' }, { label: 'Yandex Market', href: '#' },
    ]},
    { head: tx(lang,'Контакты','Aloqa','Contact'), links: [
      { label: 'Telegram', href: 'https://t.me/daromadchi' }, { label: 'support@daromadchi.uz', href: 'mailto:support@daromadchi.uz' },
    ]},
  ]

  return (
    <footer style={{ background: footBg, padding: '64px 24px 32px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", borderTop: `1px solid ${bdr}`,
      transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, marginBottom: 56 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: txt }}>Daromadchi</span>
            </div>
            <p style={{ fontSize: 13, color: muted, lineHeight: 1.65, maxWidth: 240 }}>
              {tx(lang,'Аналитика Uzum, Wildberries и Yandex Market для продавцов из Узбекистана',
                'O\'zbekistondagi sotuvchilar uchun Uzum, Wildberries va Yandex Market tahlili',
                'Analytics for Uzum, Wildberries and Yandex Market sellers in Uzbekistan')}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {['Uzum','WB','YM'].map(mp => (
                <div key={mp} style={{ fontSize: 10, fontWeight: 700, color: isDark ? A.dark : A.light, background: isDark ? A.darkBg : A.lightBg, borderRadius: 4, padding: '3px 7px' }}>
                  {mp}
                </div>
              ))}
            </div>
          </div>
          {cols.map(col => (
            <div key={col.head}>
              <p style={{ fontSize: 11, fontWeight: 700, color: subtle,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                {col.head}
              </p>
              {col.links.map(l => (
                <a key={l.label} href={l.href}
                  style={{ display: 'block', fontSize: 14, color: muted, textDecoration: 'none', marginBottom: 10, transition: 'color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = txt)}
                  onMouseLeave={e => (e.currentTarget.style.color = muted)}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${bdr}`, paddingTop: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: subtle }}>
            © 2025 Daromadchi. {tx(lang,'ООО «Daromadchi» · ИНН: 123456789 · г. Ташкент, Узбекистан',
              'MChJ «Daromadchi» · INN: 123456789 · Toshkent shahri, O\'zbekiston',
              'LLC «Daromadchi» · TIN: 123456789 · Tashkent, Uzbekistan')}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[tx(lang,'Политика конфиденциальности','Maxfiylik siyosati','Privacy policy'),
              tx(lang,'Публичная оферта','Ommaviy oferta','Terms of service')].map(l => (
              <a key={l} href="#" style={{ fontSize: 12, color: subtle, textDecoration: 'none', transition: 'color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.color = muted)}
                onMouseLeave={e => (e.currentTarget.style.color = subtle)}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── PAGE ROOT ─────────────────────────────────────────────────────────────────
export default function Page() {
  const { lang } = useLang()
  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <Navbar lang={lang} />
      <HeroSection lang={lang} />
      <ComparisonSection lang={lang} />
      <FeaturesSection lang={lang} />
      <HowItWorksSection lang={lang} />
      <WhoSection lang={lang} />
      <PricingSection lang={lang} />
      <ResourcesSection lang={lang} />
      <FaqSection lang={lang} />
      <CtaSection lang={lang} />
      <FooterSection lang={lang} />
    </div>
  )
}
