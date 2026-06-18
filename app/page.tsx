'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowRight, Menu, X, Check,
  ChevronDown, BarChart2, DollarSign, Package, Calculator,
  Bell, Globe, Activity, Zap, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import type { Lang } from '@/lib/i18n'

// ── Palette ──────────────────────────────────────────────────────────────────
const P = {
  ink:       '#1C1917',
  parchment: '#F9F8F5',
  card:      '#FFFFFF',
  stone:     '#78716C',
  muted:     '#A8A29E',
  green:     '#16A34A',
  greenDk:   '#15803D',
  greenBg:   'rgba(22,163,74,0.09)',
  amber:     '#CA8A04',
  amberBg:   'rgba(202,138,4,0.09)',
  red:       '#DC2626',
  redBg:     'rgba(220,38,38,0.09)',
  hair:      '#E5E1D8',
  dCanvas:   '#0C0A08',
  dCard:     '#161412',
  dCard2:    '#201D19',
  dHair:     'rgba(255,255,255,0.07)',
  dMuted:    'rgba(255,255,255,0.48)',
  dText:     '#F2EFE8',
  uzum:      '#494fdf',
  wb:        '#CB11AB',
  yandex:    '#E8A000',
}

function tx(lang: string, ru: string, uz: string, en: string) {
  return lang === 'ru' ? ru : lang === 'uz' ? uz : en
}

function useIsDark() { return useTheme().theme === 'dark' }

// ── Scroll-triggered fade-up ─────────────────────────────────────────────────
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

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ title, accent, sub, dark = false }: {
  title: string; accent?: string; sub?: string; dark?: boolean
}) {
  const parts = accent ? title.split(accent) : [title]
  return (
    <FadeUp>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, lineHeight: 1.1,
          color: dark ? P.dText : P.ink, letterSpacing: '-0.022em', marginBottom: sub ? 16 : 0 }}>
          {accent ? (
            <>{parts[0]}<span style={{ color: P.green }}>{accent}</span>{parts[1]}</>
          ) : title}
        </h2>
        {sub && <p style={{ fontSize: 17, color: dark ? P.dMuted : P.stone, maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>{sub}</p>}
      </div>
    </FadeUp>
  )
}

// ── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ lang }: { lang: string }) {
  const isDark = useIsDark()
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
  ]

  const lnk = scrolled ? (isDark ? P.dMuted : P.stone) : 'rgba(255,255,255,0.72)'
  const lnkH = scrolled ? (isDark ? P.dText : P.ink) : '#fff'

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? (isDark ? 'rgba(12,10,8,0.94)' : 'rgba(255,255,255,0.94)') : 'transparent',
      borderBottom: `1px solid ${scrolled ? (isDark ? P.dHair : P.hair) : 'transparent'}`,
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      transition: 'all 0.25s ease',
      fontFamily: 'var(--font-golos), sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
          <span style={{ fontWeight: 700, fontSize: 17, color: scrolled ? (isDark ? P.dText : P.ink) : '#fff' }}>
            Daromadchi
          </span>
        </Link>

        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: 24 }}>
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
                border: `1px solid ${scrolled ? (isDark ? P.dHair : P.hair) : 'rgba(255,255,255,0.18)'}`,
                borderRadius: 6, padding: '5px 10px', color: lnk }}>
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
                        background: lang === l ? P.greenBg : 'transparent',
                        color: lang === l ? P.green : (isDark ? P.dMuted : P.stone), cursor: 'pointer', border: 'none' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={toggle}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: `1px solid ${scrolled ? (isDark ? P.dHair : P.hair) : 'rgba(255,255,255,0.18)'}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 15, color: lnk }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <Link href="/login" className="hidden sm:block"
            style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '8px 12px', color: lnk }}>
            {tx(lang,'Войти','Kirish','Sign in')}
          </Link>

          <Link href="/login"
            style={{ fontSize: 14, fontWeight: 600, background: P.green, color: '#fff',
              padding: '10px 22px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = P.greenDk)}
            onMouseLeave={e => (e.currentTarget.style.background = P.green)}>
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
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {links.map(n => (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                  style={{ fontSize: 16, fontWeight: 500, color: isDark ? P.dText : P.ink, textDecoration: 'none' }}>
                  {n.label}
                </a>
              ))}
              <Link href="/login"
                style={{ marginTop: 8, fontSize: 15, fontWeight: 600, background: P.green, color: '#fff',
                  padding: '12px 24px', borderRadius: 8, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Floating stat card (hero) ─────────────────────────────────────────────────
function FloatCard({ mp, mpColor, metric, value, change, up, delay, style }: {
  mp: string; mpColor: string; metric: string; value: string
  change: string; up: boolean; delay: number; style: React.CSSProperties
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: 'absolute',
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 14, padding: '13px 17px', minWidth: 155,
        boxShadow: '0 10px 40px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.18)',
        fontFamily: 'var(--font-golos), sans-serif',
        border: '1px solid rgba(255,255,255,0.55)',
        ...style,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: mpColor }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: P.stone, letterSpacing: '0.02em' }}>{mp}</span>
      </div>
      <p style={{ fontSize: 10, color: P.muted, marginBottom: 2 }}>{metric}</p>
      <p style={{ fontSize: 21, fontWeight: 700, color: P.ink, fontFamily: 'var(--font-mono-landing), monospace', lineHeight: 1.1 }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}>
        {up ? <TrendingUp size={11} color={P.green}/> : <TrendingDown size={11} color={P.red}/>}
        <span style={{ fontSize: 11, fontWeight: 700, color: up ? P.green : P.red }}>{change}</span>
      </div>
    </motion.div>
  )
}

// ── Dashboard mockup — no browser chrome ─────────────────────────────────────
function DashMockup() {
  const c1 = P.uzum
  const border = '#E5E1D8'
  const bg2 = '#F5F4F1'
  const muted = '#A8A29E'
  const ink = '#1C1917'

  const kpis = [
    { l: 'Выручка',  v: '124 540 000', u: 'сум', d: '+12.4%', pos: true,  c: c1 },
    { l: 'Заказы',   v: '1 842',        u: '',    d: '+8.1%',  pos: true,  c: P.green },
    { l: 'ДРР',      v: '8.2%',         u: '',    d: '-1.4%',  pos: true,  c: P.yandex },
    { l: 'Прибыль',  v: '38 200 000',   u: 'сум', d: '+15.7%', pos: true,  c: P.wb },
  ]
  const bars = [28,44,36,62,48,74,56,82,66,52,76,90,62,78]
  const hi = bars.length - 4
  const rows = [
    { name: 'Куртка зимняя мужская L',  sku: 'UZ-00312', rev: '18 240 000', drr: 7.2,  ok: true,  mp: c1 },
    { name: 'Кроссовки Nike Air Force',  sku: 'WB-01847', rev: '12 590 000', drr: 11.4, ok: false, mp: P.wb },
    { name: 'Рюкзак туристический 40L',  sku: 'YM-00951', rev: '9 870 000',  drr: 9.8,  ok: true,  mp: P.yandex },
    { name: 'Наушники Sony WH-1000XM5',  sku: 'UZ-00488', rev: '8 340 000',  drr: 6.1,  ok: true,  mp: c1 },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${border}`,
      boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)' }}>

      {/* Tab bar */}
      <div style={{ background: bg2, borderBottom: `1px solid ${border}`, padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Все','Uzum','Wildberries','Yandex Market'].map((tab, i) => (
            <div key={tab} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              background: i === 0 ? c1 : 'transparent', color: i === 0 ? '#fff' : muted }}>
              {tab}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11, color: muted }}>17 мар — 30 мар 2026</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: `1px solid ${border}` }}>
        {kpis.map((k, i) => (
          <div key={k.l} style={{ padding: '11px 15px',
            borderRight: i < 3 ? `1px solid ${border}` : 'none',
            borderTop: `2px solid ${k.c}` }}>
            <p style={{ fontSize: 9, color: muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.l}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: ink, fontFamily: 'monospace', lineHeight: 1 }}>
              {k.v}<span style={{ fontSize: 9, fontWeight: 400, color: muted }}> {k.u}</span>
            </p>
            <p style={{ fontSize: 9, marginTop: 3, fontWeight: 700, color: k.pos ? P.green : P.red }}>{k.d}</p>
          </div>
        ))}
      </div>

      {/* Chart + breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', borderBottom: `1px solid ${border}` }}>
        <div style={{ padding: '12px 16px', borderRight: `1px solid ${border}` }}>
          <p style={{ fontSize: 9, color: muted, marginBottom: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Выручка по дням
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0',
                background: i >= hi ? c1 : 'rgba(73,79,223,0.16)', height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <p style={{ fontSize: 9, color: muted, marginBottom: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Площадки
          </p>
          {[{mp:'Uzum',c:c1,pct:'48%'},{mp:'WB',c:P.wb,pct:'32%'},{mp:'YM',c:P.yandex,pct:'20%'}].map(m => (
            <div key={m.mp} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.c }} />
              <span style={{ fontSize: 10, color: ink, flex: 1 }}>{m.mp}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: ink, fontFamily: 'monospace' }}>{m.pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 104px 48px 54px',
          padding: '5px 16px', background: bg2, borderBottom: `1px solid ${border}` }}>
          {['Товар','Артикул','Выручка, сум','ДРР%','Статус'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>
        {rows.map(r => (
          <div key={r.sku} style={{ display: 'grid', gridTemplateColumns: '1fr 88px 104px 48px 54px',
            padding: '7px 16px', borderBottom: `1px solid ${border}`, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.mp, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </div>
            <span style={{ fontSize: 9, color: muted, fontFamily: 'monospace' }}>{r.sku}</span>
            <span style={{ fontSize: 10, color: ink, fontFamily: 'monospace', fontWeight: 600 }}>{r.rev}</span>
            <span style={{ fontSize: 10, fontWeight: 700,
              color: r.drr > 10 ? P.red : r.drr > 8 ? P.amber : P.green }}>{r.drr}%</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.ok ? P.green : P.amber }} />
              <span style={{ fontSize: 9, color: muted }}>{r.ok ? 'Норма' : 'Мало'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 1. HERO ──────────────────────────────────────────────────────────────────
function HeroSection({ lang }: { lang: string }) {
  return (
    <section style={{ position: 'relative', background: P.dCanvas, overflow: 'hidden',
      fontFamily: 'var(--font-golos), sans-serif', paddingBottom: 0 }}>
      {/* Radial green glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(22,163,74,0.25) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 35% at 50% 0%, rgba(22,163,74,0.10) 0%, transparent 55%)' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '148px 120px 0',
        position: 'relative', zIndex: 10, textAlign: 'center' }}>

        {/* Floating stat cards — desktop only */}
        <div className="hidden lg:block">
          <FloatCard mp="Uzum" mpColor={P.uzum} metric="Выручка" value="24.5M" change="+12%" up delay={0.35}
            style={{ left: '-52px', top: '68px', transform: 'rotate(-4deg)', zIndex: 5 }} />
          <FloatCard mp="Wildberries" mpColor={P.wb} metric="Заказы" value="1 842" change="+8.1%" up delay={0.5}
            style={{ right: '-52px', top: '44px', transform: 'rotate(3.5deg)', zIndex: 15 }} />
          <FloatCard mp="Yandex Market" mpColor={P.yandex} metric="ДРР" value="8.2%" change="-1.4%" up={false} delay={0.65}
            style={{ left: '-72px', top: '240px', transform: 'rotate(-2deg)', zIndex: 15 }} />
          <FloatCard mp="Uzum" mpColor={P.uzum} metric="Прибыль" value="6.8M" change="+15%" up delay={0.8}
            style={{ right: '-72px', top: '228px', transform: 'rotate(4.5deg)', zIndex: 5 }} />
          <FloatCard mp="Wildberries" mpColor={P.wb} metric="Остатки" value="3 410 шт" change="-2%" up={false} delay={0.28}
            style={{ right: '52px', top: '-24px', transform: 'rotate(6deg)', zIndex: 3, opacity: 0.75 }} />
        </div>

        {/* Social proof pill */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 100, padding: '8px 20px' }}>
          <div style={{ display: 'flex' }}>
            {[P.uzum, P.wb, P.yandex].map((c, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c,
                border: '2px solid rgba(12,10,8,0.7)', marginLeft: i > 0 ? -7 : 0, position: 'relative', zIndex: 3 - i,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800 }}>
                {['U','W','Y'][i]}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', fontWeight: 500 }}>
            {tx(lang,'1 200+ продавцов уже используют','1 200+ sotuvchi allaqachon foydalanmoqda','1,200+ sellers already using')}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }}
          style={{ fontSize: 'clamp(34px, 5.5vw, 68px)', fontWeight: 800, lineHeight: 1.06,
            color: P.dText, marginBottom: 20, letterSpacing: '-0.024em' }}>
          {tx(lang,
            <>Аналитика трёх маркетплейсов —<br/>всё на одном экране</>,
            <>Uch marketpleysning analitikasi —<br/>hammasi bitta ekranda</>,
            <>Three marketplace analytics —<br/>all on one screen</>
          )}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.6 }}
          style={{ fontSize: 'clamp(16px, 1.8vw, 18px)', color: P.dMuted, marginBottom: 40,
            maxWidth: 530, margin: '0 auto 40px', lineHeight: 1.65 }}>
          {tx(lang,
            'Выручка, ДРР, остатки и юнит-экономика по Uzum, Wildberries и Yandex Market — в одной таблице, обновление каждые 15 минут',
            'Uzum, Wildberries va Yandex Market bo\'yicha daromad, DRR, qoldiqlar va birlik-iqtisod — bitta jadvalda, har 15 daqiqada yangilanadi',
            'Revenue, ad spend, stock and unit economics across Uzum, Wildberries and Yandex Market — one table, updated every 15 minutes'
          )}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.55 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 72 }}>
          <Link href="/login"
            style={{ fontSize: 16, fontWeight: 700, background: P.green, color: '#fff',
              padding: '15px 36px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s', display: 'inline-block' }}
            onMouseEnter={e => { e.currentTarget.style.background = P.greenDk; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = P.green; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start for free')}
          </Link>
          <a href="#how"
            style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.62)', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.62)')}>
            {tx(lang,'Как это работает','Qanday ishlaydi','How it works')} <ArrowRight size={15}/>
          </a>
        </motion.div>

        {/* Dashboard mockup below CTAs */}
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ position: 'relative', zIndex: 20 }}>
          <DashMockup />
        </motion.div>
      </div>

      {/* Fade into light section */}
      <div style={{ height: 64, background: 'linear-gradient(to bottom, transparent, #F9F8F5)', position: 'relative', zIndex: 5 }} />
    </section>
  )
}

// ── 2. COMPARISON TABLE ───────────────────────────────────────────────────────
function ComparisonSection({ lang }: { lang: string }) {
  const rows = [
    { feature: tx(lang,'Выручка по всем площадкам','Barcha saytlar bo\'yicha daromad','Revenue across all platforms'), without: false, with: true },
    { feature: tx(lang,'ДРР в реальном времени','Real vaqt DRR','Real-time ad spend ratio'), without: false, with: true },
    { feature: tx(lang,'Остатки по складам','Ombor qoldiqlari','Stock by warehouse'), without: false, with: true },
    { feature: tx(lang,'Юнит-экономика','Birlik-iqtisod','Unit economics'), without: false, with: true },
    { feature: tx(lang,'Уведомления в Telegram','Telegram bildirishnomalari','Telegram notifications'), without: false, with: true },
    { feature: tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export'), without: false, with: true },
  ]

  return (
    <section id="comparison" style={{ background: P.parchment, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Сейчас вы видите только половину данных','Hozir siz ma\'lumotlarning yarmini ko\'ryapsiz','You\'re only seeing half the data')}
          accent={tx(lang,'половину данных','yarmini','half the data')}
          sub={tx(lang,
            'Три отдельных кабинета не дают общей картины — приходится переключаться и складывать цифры вручную',
            'Uchta alohida kabinet umumiy rasmni bermaydi — raqamlarni qo\'lda hisoblashga to\'g\'ri keladi',
            'Three separate dashboards give no unified view — you switch tabs and add up numbers by hand'
          )}
        />

        {/* Table */}
        <FadeUp delay={0.1}>
          <div style={{ background: P.card, borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${P.hair}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              background: P.parchment, borderBottom: `1px solid ${P.hair}` }}>
              <div style={{ padding: '16px 24px' }}></div>
              <div style={{ padding: '16px 24px', textAlign: 'center', borderLeft: `1px solid ${P.hair}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.stone }}>
                  {tx(lang,'3 кабинета по отдельности','3 ta alohida kabinet','3 separate dashboards')}
                </p>
              </div>
              <div style={{ padding: '16px 24px', textAlign: 'center', background: P.greenBg,
                borderLeft: `1px solid ${P.hair}` }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: P.green }}>Daromadchi</p>
              </div>
            </div>

            {rows.map((r, i) => (
              <div key={r.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom: i < rows.length - 1 ? `1px solid ${P.hair}` : 'none' }}>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: P.ink }}>{r.feature}</span>
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderLeft: `1px solid ${P.hair}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: P.redBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={14} color={P.red}/>
                  </div>
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: P.greenBg, borderLeft: `1px solid ${P.hair}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(22,163,74,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={14} color={P.green}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={0.2} style={{ textAlign: 'center', marginTop: 36 }}>
          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 15, fontWeight: 700, background: P.green, color: '#fff',
              padding: '14px 36px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = P.greenDk; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = P.green; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Попробовать бесплатно','Bepul sinab ko\'ring','Try for free')}
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}

// ── 3. FEATURES — real UI fragments ──────────────────────────────────────────
function FeaturesSection({ lang }: { lang: string }) {
  const border = '#E5E1D8'
  const bg2 = '#F5F4F1'
  const muted = '#A8A29E'
  const ink = '#1C1917'

  return (
    <section id="features" style={{ background: P.card, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Главный инструмент для роста прибыли','Foyda o\'sishi uchun asosiy vosita','The main tool for profit growth')}
          accent={tx(lang,'роста прибыли','o\'sishi','profit growth')}
          sub={tx(lang,'Один экран вместо десяти вкладок','O\'nta yorliq o\'rniga bitta ekran','One screen instead of ten tabs')}
        />

        {/* Bento grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 16 }}>

          {/* Card 1 — Products table */}
          <FadeUp delay={0.05}>
            <div style={{ background: P.parchment, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, height: '100%', minHeight: 340 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.green, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Таблица товаров','Mahsulotlar jadvali','Products table')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'ДРР, расходы и остатки — всё в одном месте','DRR, xarajatlar va qoldiqlar — barchasi bir joyda','DRR, costs and stock — all in one place')}
              </p>
              {/* Mini products table */}
              <div style={{ background: P.card, borderRadius: 12, overflow: 'hidden', border: `1px solid ${border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 65px 42px',
                  padding: '6px 12px', background: bg2, borderBottom: `1px solid ${border}` }}>
                  {['Товар','Выручка','ДРР%','Склад'].map(h => (
                    <span key={h} style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                  ))}
                </div>
                {[
                  { n:'Куртка зимняя', mp: P.uzum,  rev:'18.2M', drr:7.2,  ok:true },
                  { n:'Кроссовки Nike', mp: P.wb,   rev:'12.6M', drr:11.4, ok:false },
                  { n:'Рюкзак 40L',    mp: P.yandex,rev:'9.9M',  drr:9.8,  ok:true },
                  { n:'Наушники Sony', mp: P.uzum,  rev:'8.3M',  drr:6.1,  ok:true },
                  { n:'Кроссовки Puma',mp: P.wb,    rev:'7.1M',  drr:13.2, ok:false },
                ].map((r,i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 65px 42px',
                    padding: '7px 12px', borderBottom: i < 4 ? `1px solid ${border}` : 'none', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.mp, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: ink }}>{r.rev}</span>
                    <span style={{ fontSize: 10, fontWeight: 700,
                      color: r.drr > 11 ? P.red : r.drr > 9 ? P.amber : P.green }}>{r.drr}%</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.ok ? P.green : P.amber }} />
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>

          {/* Card 2 — Dashboard KPIs */}
          <FadeUp delay={0.1}>
            <div style={{ background: P.parchment, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, height: '100%', minHeight: 340 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.green, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Дашборд','Dashboard','Dashboard')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'Выручка, заказы, расход и ДРР — за любой период','Daromad, buyurtmalar, xarajatlar va DRR — istalgan davr uchun','Revenue, orders, spend and DRR — for any period')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { l:'Выручка', v:'124.5M сум', d:'+12.4%', c: P.uzum },
                  { l:'Заказы',  v:'1 842',       d:'+8.1%',  c: P.green },
                  { l:'Расход',  v:'10.2M сум',   d:'+3.2%',  c: P.wb },
                  { l:'ДРР',     v:'8.2%',         d:'-1.4%',  c: P.yandex },
                ].map(k => (
                  <div key={k.l} style={{ background: P.card, borderRadius: 10, padding: '12px',
                    borderTop: `2px solid ${k.c}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{k.l}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: ink, fontFamily: 'monospace', lineHeight: 1.1 }}>{k.v}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.green, marginTop: 3 }}>{k.d}</p>
                  </div>
                ))}
              </div>
              {/* Sparkline */}
              <div style={{ background: P.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
                  {[30,48,38,65,52,78,60,82,70,55,75,92,66,80].map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`,
                      background: i >= 10 ? P.uzum : 'rgba(73,79,223,0.16)' }} />
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Card 3 — Unit economics */}
          <FadeUp delay={0.15}>
            <div style={{ background: P.parchment, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.green, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tx(lang,'Юнит-экономика','Birlik-iqtisod','Unit economics')}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 14 }}>
                  {tx(lang,'Рентабельность по каждому товару','Har bir mahsulot bo\'yicha rentabellik','Profitability per product')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { l: tx(lang,'Закупка','Sotib olish','Purchase'), v: '12 000 сум', c: muted },
                    { l: tx(lang,'Логистика','Logistika','Logistics'), v: '1 800 сум', c: muted },
                    { l: tx(lang,'Реклама (ДРР)','Reklama (DRR)','Ad spend (DRR)'), v: '2 350 сум', c: muted },
                    { l: tx(lang,'Цена продажи','Sotish narxi','Sale price'), v: '28 500 сум', c: ink },
                  ].map(row => (
                    <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: P.card, borderRadius: 8, border: `1px solid ${border}` }}>
                      <span style={{ fontSize: 11, color: row.c }}>{row.l}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: row.c, fontFamily: 'monospace' }}>{row.v}</span>
                    </div>
                  ))}
                  <div style={{ padding: '10px 12px', background: P.greenBg, borderRadius: 8, border: `1px solid rgba(22,163,74,0.2)`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: P.greenDk }}>
                      {tx(lang,'Маржа','Marja','Margin')}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: P.green, fontFamily: 'monospace' }}>52.6% ↑</span>
                  </div>
                </div>
              </div>

              {/* Telegram alerts */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.uzum, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tx(lang,'Уведомления','Bildirishnomalar','Notifications')}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 14 }}>
                  {tx(lang,'Алерты в Telegram каждые 15 мин','Har 15 daqiqada Telegram xabarlari','Telegram alerts every 15 min')}
                </p>
                <div style={{ background: '#F1F3F4', borderRadius: 12, padding: '12px',
                  border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '🔔', text: tx(lang,'Остатки «Куртка» — 12 шт, хватит на 3 дня','«Jacket» qoldiqlari — 12 ta, 3 kunga yetadi','«Jacket» stock — 12 pcs, 3 days left'), time: '09:15', color: P.amber },
                    { icon: '📈', text: tx(lang,'Uzum: ДРР превысил 15% по 3 товарам','Uzum: 3 ta mahsulot bo\'yicha DRR 15% dan oshdi','Uzum: DRR exceeded 15% on 3 products'), time: '09:15', color: P.red },
                    { icon: '✅', text: tx(lang,'WB: новый заказ #WB-48291 — 28 500 сум','WB: yangi buyurtma #WB-48291 — 28 500 so\'m','WB: new order #WB-48291 — 28,500 sum'), time: '09:16', color: P.green },
                  ].map((n, i) => (
                    <div key={i} style={{ background: P.card, borderRadius: 8, padding: '8px 10px',
                      borderLeft: `3px solid ${n.color}` }}>
                      <p style={{ fontSize: 10, color: ink, lineHeight: 1.4 }}>{n.icon} {n.text}</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3 }}>{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Card 4 — Excel export */}
          <FadeUp delay={0.2}>
            <div style={{ background: P.parchment, borderRadius: 20, padding: '24px',
              border: `1px solid ${border}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.green, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 16 }}>
                {tx(lang,'Скачайте отчёт в один клик — все данные как в таблице','Hisobotni bir marta bosish bilan yuklab oling','Download report in one click — all data as in the table')}
              </p>
              <div style={{ background: P.card, borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${border}`, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  background: '#217346', borderBottom: `1px solid ${border}` }}>
                  <div style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>X</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>daromadchi_report_2026.xlsx</span>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 40px', gap: 0 }}>
                    {['A','B','C','D'].map(h => (
                      <div key={h} style={{ background: '#217346', padding: '3px 6px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{h}</span>
                      </div>
                    ))}
                    {[
                      ['Куртка зимняя','18 240 000','7.2%','120'],
                      ['Кроссовки','12 590 000','11.4%','84'],
                      ['Рюкзак 40L','9 870 000','9.8%','67'],
                    ].map((row, ri) => row.map((cell, ci) => (
                      <div key={`${ri}-${ci}`} style={{ padding: '4px 6px', border: '1px solid #E2E8E0',
                        borderTop: 'none', borderLeft: ci > 0 ? 'none' : '1px solid #E2E8E0' }}>
                        <span style={{ fontSize: 9, color: ink, fontFamily: ci > 0 ? 'monospace' : 'inherit' }}>{cell}</span>
                      </div>
                    )))}
                  </div>
                </div>
              </div>
              <Link href="/login"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, background: P.green, color: '#fff',
                  padding: '10px 20px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = P.greenDk)}
                onMouseLeave={e => (e.currentTarget.style.background = P.green)}>
                {tx(lang,'Скачать отчёт','Hisobotni yuklab olish','Download report')} <ArrowRight size={14}/>
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ── 4. HOW IT WORKS — 3 steps ────────────────────────────────────────────────
function HowItWorksSection({ lang }: { lang: string }) {
  const steps = [
    {
      num: '01',
      icon: '👤',
      color: P.green,
      title: tx(lang,'Регистрация','Ro\'yxatdan o\'tish','Register'),
      desc: tx(lang,
        'Только email и пароль. Менее 30 секунд — и вы внутри',
        'Faqat email va parol. 30 soniyadan kam — va siz ichkaridasiz',
        'Just email and password. Under 30 seconds and you\'re in'
      ),
      ui: (
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '14px',
          border: `1px solid rgba(255,255,255,0.6)`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          {[
            { l: 'Email', v: 'seller@example.com' },
            { l: 'Пароль', v: '••••••••••' },
          ].map(f => (
            <div key={f.l} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 9, color: P.muted, marginBottom: 3 }}>{f.l}</p>
              <div style={{ background: '#fff', border: `1px solid ${P.hair}`, borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 11, color: P.ink }}>{f.v}</span>
              </div>
            </div>
          ))}
          <div style={{ background: P.green, borderRadius: 6, padding: '8px', textAlign: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {tx(lang,'Зарегистрироваться','Ro\'yxatdan o\'tish','Sign up')}
            </span>
          </div>
        </div>
      ),
    },
    {
      num: '02',
      icon: '🔗',
      color: P.amber,
      title: tx(lang,'Подключите магазин','Do\'koningizni ulang','Connect your store'),
      desc: tx(lang,
        'Вставьте API-ключ из кабинета Uzum, WB или Яндекс — мы не можем менять данные в вашем магазине, только читать',
        'Uzum, WB yoki Yandex kabinetidan API kalitini kiriting — biz faqat o\'qiy olamiz, o\'zgartira olmaymiz',
        'Paste API key from Uzum, WB or Yandex — we can only read data, never modify your store'
      ),
      ui: (
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '14px',
          border: `1px solid rgba(255,255,255,0.6)`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          {[
            { mp: 'Uzum', color: P.uzum, status: '✅' },
            { mp: 'Wildberries', color: P.wb, status: '✅' },
            { mp: 'Yandex Market', color: P.yandex, status: '⏳' },
          ].map(m => (
            <div key={m.mp} style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${P.hair}`, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: P.ink, flex: 1 }}>{m.mp}</span>
              <span style={{ fontSize: 12 }}>{m.status}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      num: '03',
      icon: '📊',
      color: P.green,
      title: tx(lang,'Данные готовы','Ma\'lumotlar tayyor','Data is ready'),
      desc: tx(lang,
        'Через 15 минут — полная аналитика за последние 7 дней. Далее обновление автоматически каждые 15 минут',
        '15 daqiqadan keyin — so\'nggi 7 kun uchun to\'liq tahlil. Keyin har 15 daqiqada avtomatik yangilanadi',
        'In 15 minutes — full analytics for the past 7 days. Then updates automatically every 15 minutes'
      ),
      ui: (
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '14px',
          border: `1px solid rgba(255,255,255,0.6)`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { l:'Заказы', v:'1 842', d:'+300%', c:P.green },
              { l:'ДРР',    v:'8.2%',  d:'-20.9%',c:P.green },
            ].map(k => (
              <div key={k.l} style={{ background: '#fff', borderRadius: 8, padding: '10px',
                border: `1px solid ${P.hair}`, borderTop: `2px solid ${k.c}` }}>
                <p style={{ fontSize: 9, color: P.muted, marginBottom: 2 }}>{k.l}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: 'monospace' }}>{k.v}</p>
                <p style={{ fontSize: 9, fontWeight: 700, color: k.c }}>{k.d}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, background: '#fff', borderRadius: 8, padding: '8px 10px',
            border: `1px solid ${P.hair}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 28 }}>
              {[40,55,48,70,62,80,72,90,76,60,84,96,70,88].map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '1px 1px 0 0', height: `${h}%`,
                  background: i >= 10 ? P.green : 'rgba(22,163,74,0.18)' }} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <section id="how" style={{ background: P.parchment, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Настройте магазин за 5 минут','Do\'koningizni 5 daqiqada sozlang','Set up your store in 5 minutes')}
          accent={tx(lang,'за 5 минут','5 daqiqada','in 5 minutes')}
          sub={tx(lang,'Три шага до полной аналитики','To\'liq tahlilgacha uch qadam','Three steps to full analytics')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {steps.map((s, i) => (
            <FadeUp key={s.num} delay={i * 0.12}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {/* UI illustration */}
                <div style={{ width: '100%', marginBottom: 20 }}>
                  {s.ui}
                </div>

                {/* Numbered badge */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 14,
                  boxShadow: `0 4px 16px ${s.color}50` }}>
                  {i + 1}
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 700, color: P.ink, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: P.stone, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.4} style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 15, fontWeight: 700, background: P.green, color: '#fff',
              padding: '14px 40px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = P.greenDk; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = P.green; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Подключить бесплатно','Bepul ulash','Connect for free')}
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}

// ── 5. WHO IS IT FOR ─────────────────────────────────────────────────────────
function WhoSection({ lang }: { lang: string }) {
  const cards = [
    {
      num: '01', color: P.uzum,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(73,79,223,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#494fdf" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#494fdf" opacity="0.65"/>
          <rect x="28" y="32" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/>
          <circle cx="44" cy="42" r="8" fill="rgba(73,79,223,0.9)"/>
          <text x="44" y="45.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">📦</text>
        </svg>
      ),
      title: tx(lang,'Начинающий продавец','Yangi sotuvchi','New seller'),
      desc: tx(lang,
        'Подбираете первый товар? UNIT-экономика покажет реальную маржу до закупки — без Excel и формул',
        'Birinchi mahsulotni tanlayapsizmi? UNIT-iqtisod sotib olishdan oldin haqiqiy marjani ko\'rsatadi',
        'Picking your first product? Unit economics shows real margin before purchase — no Excel needed'
      ),
      features: [
        tx(lang,'Калькулятор маржи','Marja kalkulyatori','Margin calculator'),
        tx(lang,'Анализ конкурентов','Raqobatchilarni tahlil qilish','Competitor analysis'),
        tx(lang,'Подбор ниши','Nishani tanlash','Niche selection'),
      ],
    },
    {
      num: '02', color: P.green,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(22,163,74,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#16A34A" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#16A34A" opacity="0.65"/>
          <circle cx="50" cy="26" r="10" fill="rgba(22,163,74,0.9)"/>
          <text x="50" y="29.5" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">📈</text>
        </svg>
      ),
      title: tx(lang,'Растущий магазин','O\'sib borayotgan do\'kon','Growing store'),
      desc: tx(lang,
        'Тратите на рекламу, но не понимаете, окупается ли? Таблица покажет ДРР по каждому товару в реальном времени',
        'Reklamaga xarajat qilyapsizmi, lekin to\'layaptimi yoqmi bilmayapsizmi? Jadval har bir mahsulot uchun DRR ni ko\'rsatadi',
        'Spending on ads but unsure of ROI? The table shows DRR per product in real time'
      ),
      features: [
        tx(lang,'ДРР по товарам','Mahsulotlar bo\'yicha DRR','DRR per product'),
        tx(lang,'Контроль остатков','Qoldiqlarni nazorat qilish','Stock control'),
        tx(lang,'Уведомления Telegram','Telegram bildirishnomalari','Telegram alerts'),
      ],
    },
    {
      num: '03', color: P.amber,
      avatar: (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="rgba(202,138,4,0.10)"/>
          <circle cx="36" cy="28" r="12" fill="#CA8A04" opacity="0.85"/>
          <ellipse cx="36" cy="56" rx="18" ry="12" fill="#CA8A04" opacity="0.65"/>
          <circle cx="52" cy="34" r="10" fill="rgba(202,138,4,0.9)"/>
          <text x="52" y="37.5" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">🏢</text>
        </svg>
      ),
      title: tx(lang,'Менеджер магазинов','Do\'konlar menejeri','Store manager'),
      desc: tx(lang,
        'Ведёте несколько магазинов клиентов? Настройте пресеты, каждое утро открывайте дашборд — и всё под контролем',
        'Bir nechta mijoz do\'konini boshqaryapsizmi? Presetlarni sozlang, har ertalab dashbordni oching',
        'Managing multiple client stores? Set presets, open the dashboard each morning — everything under control'
      ),
      features: [
        tx(lang,'Несколько магазинов','Bir nechta do\'kon','Multiple stores'),
        tx(lang,'Пресеты колонок','Ustunlar presetlari','Column presets'),
        tx(lang,'Сводный отчёт','Yig\'ma hisobot','Summary report'),
      ],
    },
  ]

  return (
    <section style={{ background: P.card, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Кому подходит Daromadchi','Daromadchi kimga mos keladi','Who is Daromadchi for')}
          accent={tx(lang,'подходит','mos keladi','for')}
          sub={tx(lang,'Для продавцов на Uzum, Wildberries и Yandex Market в Узбекистане',
            'O\'zbekistondagi Uzum, Wildberries va Yandex Market sotuvchilari uchun',
            'For sellers on Uzum, Wildberries and Yandex Market in Uzbekistan')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {cards.map((c, i) => (
            <FadeUp key={c.num} delay={i * 0.1}>
              <div style={{ background: P.parchment, borderRadius: 20, padding: '32px 28px',
                border: `1px solid ${P.hair}`, textAlign: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 36px rgba(0,0,0,0.10)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  {c.avatar}
                </div>

                <span style={{ fontSize: 32, fontWeight: 900, color: c.color, fontFamily: 'var(--font-mono-landing), monospace',
                  display: 'block', marginBottom: 10, letterSpacing: '-0.02em' }}>{c.num}</span>

                <h3 style={{ fontSize: 18, fontWeight: 700, color: P.ink, marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontSize: 14, color: P.stone, lineHeight: 1.65, marginBottom: 20 }}>{c.desc}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={13} color={c.color}/>
                      <span style={{ fontSize: 13, color: P.stone }}>{f}</span>
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

// ── 6. PRICING ───────────────────────────────────────────────────────────────
function PricingSection({ lang }: { lang: string }) {
  const tiers = [
    {
      name: tx(lang,'Бесплатно','Bepul','Free'),
      price: '0',
      sub: tx(lang,'Навсегда','Abadiy','Forever'),
      highlight: false,
      features: [
        tx(lang,'1 магазин','1 do\'kon','1 store'),
        tx(lang,'Топ-50 товаров','Top-50 mahsulot','Top 50 products'),
        tx(lang,'Обновление раз в сутки','Kunlik yangilanish','Daily updates'),
        tx(lang,'Базовая выручка и заказы','Asosiy daromad va buyurtmalar','Basic revenue & orders'),
      ],
      absent: [
        tx(lang,'ДРР и юнит-экономика','DRR va birlik-iqtisod','DRR & unit economics'),
        tx(lang,'Уведомления Telegram','Telegram bildirishnomalari','Telegram alerts'),
        tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export'),
      ],
      cta: tx(lang,'Начать бесплатно','Bepul boshlash','Start free'),
      ctaHref: '/login',
    },
    {
      name: 'Pro',
      price: '149 000',
      badge: tx(lang,'Популярный','Ommabop','Popular'),
      sub: tx(lang,'сум / месяц','so\'m / oy','sum / month'),
      highlight: true,
      features: [
        tx(lang,'До 3 магазинов','3 ta do\'kongacha','Up to 3 stores'),
        tx(lang,'Все товары без лимита','Limit yo\'q barcha mahsulotlar','Unlimited products'),
        tx(lang,'Обновление каждые 15 мин','Har 15 daqiqada yangilanish','Updates every 15 min'),
        tx(lang,'ДРР и юнит-экономика','DRR va birlik-iqtisod','DRR & unit economics'),
        tx(lang,'Уведомления в Telegram','Telegram bildirishnomalari','Telegram alerts'),
        tx(lang,'Экспорт в Excel','Excel ga eksport','Excel export'),
      ],
      absent: [],
      cta: tx(lang,'Попробовать Pro','Pro ni sinash','Try Pro'),
      ctaHref: '/login',
    },
    {
      name: 'Pro+',
      price: '349 000',
      sub: tx(lang,'сум / месяц','so\'m / oy','sum / month'),
      highlight: false,
      features: [
        tx(lang,'Неограниченно магазинов','Cheksiz do\'konlar','Unlimited stores'),
        tx(lang,'Всё из Pro','Pro dagi hammasi','Everything in Pro'),
        tx(lang,'API-доступ','API-kirish','API access'),
        tx(lang,'Приоритетная поддержка','Ustuvor yordam','Priority support'),
        tx(lang,'Настраиваемые пресеты','Moslashtirilgan presetlar','Custom presets'),
        tx(lang,'Белый лейбл для агентств','Agentliklar uchun oq yorliq','White label for agencies'),
      ],
      absent: [],
      cta: tx(lang,'Подключить Pro+','Pro+ ulash','Get Pro+'),
      ctaHref: '/login',
    },
  ]

  return (
    <section id="pricing" style={{ background: P.parchment, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Тарифы','Tariflar','Pricing')}
          sub={tx(lang,'Начните бесплатно, масштабируйтесь по мере роста','Bepul boshlang, o\'sish bilan kengaytiring','Start free, scale as you grow')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {tiers.map((t, i) => (
            <FadeUp key={t.name} delay={i * 0.1}>
              <div style={{ background: t.highlight ? P.green : P.card, borderRadius: 20, padding: '28px 24px',
                border: t.highlight ? 'none' : `1px solid ${P.hair}`,
                boxShadow: t.highlight ? '0 12px 40px rgba(22,163,74,0.25)' : '0 2px 12px rgba(0,0,0,0.05)',
                position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>

                {t.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: P.amber, borderRadius: 100, padding: '4px 16px',
                    fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>
                    {t.badge}
                  </div>
                )}

                <p style={{ fontSize: 14, fontWeight: 700, color: t.highlight ? 'rgba(255,255,255,0.7)' : P.stone, marginBottom: 8 }}>
                  {t.name}
                </p>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: t.highlight ? '#fff' : P.ink,
                    fontFamily: 'var(--font-mono-landing), monospace' }}>
                    {t.price}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: t.highlight ? 'rgba(255,255,255,0.6)' : P.muted, marginBottom: 24 }}>
                  {t.sub}
                </p>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {t.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Check size={14} color={t.highlight ? 'rgba(255,255,255,0.9)' : P.green} style={{ marginTop: 2, flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, color: t.highlight ? 'rgba(255,255,255,0.85)' : P.ink, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {t.absent.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <X size={14} color={P.muted} style={{ marginTop: 2, flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, color: P.muted, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <Link href={t.ctaHref}
                  style={{ display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 700,
                    background: t.highlight ? 'rgba(255,255,255,0.15)' : P.green, color: t.highlight ? '#fff' : '#fff',
                    padding: '13px 24px', borderRadius: 10, textDecoration: 'none',
                    border: t.highlight ? '1px solid rgba(255,255,255,0.25)' : 'none',
                    transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.highlight ? 'rgba(255,255,255,0.22)' : P.greenDk }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.highlight ? 'rgba(255,255,255,0.15)' : P.green }}>
                  {t.cta}
                </Link>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 7. RESOURCES STRIP ───────────────────────────────────────────────────────
function ResourcesSection({ lang }: { lang: string }) {
  const cards = [
    {
      icon: '📖',
      title: tx(lang,'Справка','Yordam markazi','Help center'),
      items: [
        { t: tx(lang,'Быстрый старт за 5 минут','5 daqiqada tez boshlash','Quick start in 5 minutes'), sub: tx(lang,'Пошаговое руководство от подключения до первого отчёта','Ulashdan birinchi hisobotgacha bosqichma-bosqich qo\'llanma','Step-by-step guide from connecting to first report') },
        { t: tx(lang,'Как работает ДРР','DRR qanday ishlaydi','How DRR works'), sub: tx(lang,'Формула расчёта и примеры интерпретации','Hisoblash formulasi va talqin misollari','Calculation formula and interpretation examples') },
        { t: tx(lang,'Настройка юнит-экономики','Birlik-iqtisodni sozlash','Setting up unit economics'), sub: tx(lang,'Укажите закупочные цены и логистику — Daromadchi сделает остальное','Xarid narxlari va logistikani kiriting — Daromadchi qolganini qiladi','Enter purchase prices and logistics — Daromadchi does the rest') },
      ],
      link: tx(lang,'Все статьи →','Barcha maqolalar →','All articles →'),
      linkColor: P.green,
    },
    {
      icon: '🗺️',
      title: tx(lang,'Дорожная карта','Yo\'l xaritasi','Roadmap'),
      items: [
        { t: tx(lang,'AI-прогноз остатков','AI-qoldiq bashorati','AI stock forecast'), sub: 'июль 2026', dot: P.amber },
        { t: tx(lang,'Мобильное приложение','Mobil ilova','Mobile app'), sub: 'август 2026', dot: P.amber },
        { t: tx(lang,'Сравнение по категориям','Toifalar bo\'yicha taqqoslash','Category comparison'), sub: tx(lang,'В разработке','Ishlanmoqda','In development'), dot: P.green },
      ],
      link: tx(lang,'Смотреть все →','Barchasini ko\'rish →','See all →'),
      linkColor: P.amber,
    },
    {
      icon: '🕐',
      title: tx(lang,'Обновления','Yangilanishlar','Changelog'),
      items: [
        { t: tx(lang,'Ускорена синхронизация Yandex Market','Yandex Market sinxronizatsiyasi tezlashtirildi','Yandex Market sync speed improved'), sub: '1.4.2 · 15 июня', dot: P.green },
        { t: tx(lang,'Добавлен экспорт по каждой площадке','Har bir sayt bo\'yicha eksport qo\'shildi','Added per-platform export'), sub: '1.4.1 · 2 июня', dot: P.green },
        { t: tx(lang,'Новый раздел юнит-экономики','Yangi birlik-iqtisod bo\'limi','New unit economics section'), sub: '1.4.0 · 20 мая', dot: P.uzum },
      ],
      link: tx(lang,'Все обновления →','Barcha yangilanishlar →','All updates →'),
      linkColor: P.uzum,
    },
  ]

  return (
    <section id="resources" style={{ background: P.card, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Ресурсы и развитие','Resurslar va rivojlanish','Resources & development')}
          accent={tx(lang,'развитие','rivojlanish','development')}
          sub={tx(lang,'Справочные материалы, планы развития и история обновлений',
            'Ma\'lumot materiallari, rivojlanish rejalari va yangilanishlar tarixi',
            'Reference materials, development plans and update history')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {cards.map((c, i) => (
            <FadeUp key={c.title} delay={i * 0.1}>
              <div style={{ background: P.parchment, borderRadius: 20, padding: '24px',
                border: `1px solid ${P.hair}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{c.title}</h3>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {c.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                      {('dot' in item) ? (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot as string,
                          marginTop: 5, flexShrink: 0 }} />
                      ) : null}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 2, lineHeight: 1.4 }}>{item.t}</p>
                        <p style={{ fontSize: 11, color: P.muted }}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="#" style={{ fontSize: 13, fontWeight: 700, color: c.linkColor, textDecoration: 'none', marginTop: 20,
                  display: 'block', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {c.link}
                </a>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 8. FAQ ───────────────────────────────────────────────────────────────────
function FaqSection({ lang }: { lang: string }) {
  const [open, setOpen] = useState<number | null>(null)

  const faqs = [
    {
      q: tx(lang,'Безопасно ли подключать API-ключ?','API kalitini ulash xavfsizmi?','Is it safe to connect my API key?'),
      a: tx(lang,
        'Да. Мы используем только Read Only ключи — мы можем читать данные из вашего магазина, но никогда не можем изменять цены, товары или заказы. Ключ хранится в зашифрованном виде.',
        'Ha. Biz faqat Read Only kalitlaridan foydalanamiz — biz do\'kongingizdagi ma\'lumotlarni o\'qiy olamiz, lekin narxlar, mahsulotlar yoki buyurtmalarni hech qachon o\'zgartira olmaymiz. Kalit shifrlanib saqlanadi.',
        'Yes. We only use Read Only keys — we can read data from your store but can never modify prices, products or orders. The key is stored encrypted.'
      ),
    },
    {
      q: tx(lang,'Как быстро появляются данные после подключения?','Ulanganidan keyin ma\'lumotlar qanchalik tez paydo bo\'ladi?','How quickly does data appear after connecting?'),
      a: tx(lang,
        'Первая синхронизация занимает 15–35 минут и подтягивает историю за последние 7 дней. Далее данные обновляются автоматически каждые 15 минут для заказов и каждые 4 часа для статистики.',
        'Birinchi sinxronizatsiya 15–35 daqiqa davom etadi va so\'nggi 7 kunlik tarixni tortib oladi. Keyin buyurtmalar uchun har 15 daqiqada, statistika uchun har 4 soatda avtomatik yangilanadi.',
        'First sync takes 15–35 minutes and pulls 7 days of history. After that, data updates automatically every 15 minutes for orders and every 4 hours for statistics.'
      ),
    },
    {
      q: tx(lang,'Поддерживаете ли все три маркетплейса?','Uchala marketpleysni ham qo\'llayapsizmi?','Do you support all three marketplaces?'),
      a: tx(lang,
        'Да — Uzum Market, Wildberries и Yandex Market полностью поддерживаются. Данные из всех трёх платформ объединяются в единую таблицу с разбивкой по площадкам.',
        'Ha — Uzum Market, Wildberries va Yandex Market to\'liq qo\'llaniladi. Uchala platformadagi ma\'lumotlar maydonlar bo\'yicha taqsimlangan holda bitta jadvalda birlashtiriladi.',
        'Yes — Uzum Market, Wildberries and Yandex Market are fully supported. Data from all three platforms is merged into one table with per-platform breakdown.'
      ),
    },
    {
      q: tx(lang,'Как работает юнит-экономика?','Birlik-iqtisod qanday ishlaydi?','How does unit economics work?'),
      a: tx(lang,
        'Вы вводите закупочную цену, логистику и прочие расходы по каждому товару. Daromadchi автоматически рассчитывает маржу, ROI и минимальную цену продажи для безубыточности.',
        'Har bir mahsulot uchun xarid narxi, logistika va boshqa xarajatlarni kiritasiz. Daromadchi avtomatik ravishda marja, ROI va zarardan chiqadigan minimal sotish narxini hisoblaydi.',
        'You enter purchase price, logistics and other costs per product. Daromadchi automatically calculates margin, ROI and minimum break-even price.'
      ),
    },
    {
      q: tx(lang,'Есть ли мобильная версия?','Mobil versiya bormi?','Is there a mobile version?'),
      a: tx(lang,
        'Веб-версия адаптирована для мобильных устройств и работает в любом браузере. Нативное мобильное приложение в дорожной карте на август 2026 года.',
        'Veb-versiya mobil qurilmalar uchun moslashtirilgan va istalgan brauzerda ishlaydi. Mahalliy mobil ilova avgust 2026 yo\'l xaritasida.',
        'The web version is mobile-responsive and works in any browser. A native mobile app is on the roadmap for August 2026.'
      ),
    },
    {
      q: tx(lang,'Можно ли попробовать перед оплатой?','To\'lovdan oldin sinab ko\'rsa bo\'ladimi?','Can I try before paying?'),
      a: tx(lang,
        'Да, есть бесплатный тариф без ограничения по времени: до 1 магазина, топ-50 товаров, ежедневные обновления. Для доступа ко всем функциям — Pro от 149 000 сум/мес.',
        'Ha, vaqt cheklovisiz bepul tarif mavjud: 1 do\'kongacha, top-50 mahsulot, kunlik yangilanishlar. Barcha funksiyalarga kirish uchun — oyiga 149 000 so\'mdan Pro.',
        'Yes, there\'s a free tier with no time limit: up to 1 store, top 50 products, daily updates. For all features — Pro from 149,000 sum/month.'
      ),
    },
  ]

  return (
    <section id="faq" style={{ background: P.parchment, padding: '88px 24px',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHead
          title={tx(lang,'Частые вопросы','Tez-tez so\'raladigan savollar','Frequently asked questions')}
          accent={tx(lang,'вопросы','savollar','questions')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {faqs.map((f, i) => (
            <FadeUp key={i} delay={i * 0.06}>
              <div style={{ borderBottom: `1px solid ${P.hair}` }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: P.green, fontFamily: 'var(--font-mono-landing), monospace',
                      minWidth: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: P.ink }}>{f.q}</span>
                  </div>
                  <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={18} color={P.muted}/>
                  </motion.div>
                </button>

                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: 15, color: P.stone, lineHeight: 1.7, paddingBottom: 20, paddingLeft: 34 }}>
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

// ── 9. CTA — dark mirror of hero ─────────────────────────────────────────────
function CtaSection({ lang }: { lang: string }) {
  return (
    <section style={{ position: 'relative', background: P.dCanvas, overflow: 'hidden',
      padding: '100px 24px', fontFamily: 'var(--font-golos), sans-serif' }}>
      {/* Green glow — mirrors hero */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% 120%, rgba(22,163,74,0.22) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(22,163,74,0.09) 0%, transparent 55%)' }} />

      {/* Floating cards (desktop) */}
      <div className="hidden lg:block">
        <FloatCard mp="Uzum" mpColor={P.uzum} metric="Выручка" value="24.5M" change="+12%" up delay={0}
          style={{ left: '4%', top: '20%', transform: 'rotate(-3.5deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Wildberries" mpColor={P.wb} metric="Заказы" value="1 842" change="+8%" up delay={0.1}
          style={{ right: '3%', top: '18%', transform: 'rotate(4deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Yandex Market" mpColor={P.yandex} metric="ДРР" value="8.2%" change="-1.4%" up={false} delay={0.15}
          style={{ left: '6%', bottom: '20%', transform: 'rotate(-2deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Uzum" mpColor={P.uzum} metric="Прибыль" value="6.8M" change="+15%" up delay={0.2}
          style={{ right: '5%', bottom: '22%', transform: 'rotate(3deg)', zIndex: 5, opacity: 0.9 }} />
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <FadeUp>
          <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', fontWeight: 800, color: P.dText,
            lineHeight: 1.08, letterSpacing: '-0.024em', marginBottom: 20 }}>
            {tx(lang,
              'Хватит работать вслепую — начните видеть цифры',
              'Ko\'r-ko\'rona ishlamayin — raqamlarni ko\'ra boshlang',
              'Stop flying blind — start seeing the numbers'
            )}
          </h2>
          <p style={{ fontSize: 17, color: P.dMuted, lineHeight: 1.65, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
            {tx(lang,
              'Подключите магазин за 5 минут. Бесплатный пробный период, без привязки карты',
              'Do\'koningizni 5 daqiqada ulang. Bepul sinov davri, karta bog\'lanmaydi',
              'Connect your store in 5 minutes. Free trial, no credit card required'
            )}
          </p>

          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 16, fontWeight: 700, background: P.green, color: '#fff',
              padding: '16px 44px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s', marginBottom: 20 }}
            onMouseEnter={e => { e.currentTarget.style.background = P.greenDk; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = P.green; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start for free')}
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {[
              tx(lang,'✓ 14 дней бесплатно','✓ 14 kun bepul','✓ 14 days free'),
              tx(lang,'✓ Без карты','✓ Kartasiz','✓ No card'),
              tx(lang,'✓ Настройка 5 минут','✓ Sozlash 5 daqiqa','✓ 5-min setup'),
            ].map(s => (
              <span key={s} style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ── FOOTER ───────────────────────────────────────────────────────────────────
function FooterSection({ lang }: { lang: string }) {
  const cols = [
    {
      head: tx(lang,'Продукт','Mahsulot','Product'),
      links: [
        { label: tx(lang,'Войти','Kirish','Sign in'), href: '/login' },
        { label: tx(lang,'Регистрация','Ro\'yxatdan o\'tish','Register'), href: '/login' },
        { label: tx(lang,'Тарифы','Tariflar','Pricing'), href: '#pricing' },
        { label: tx(lang,'Возможности','Imkoniyatlar','Features'), href: '#features' },
      ],
    },
    {
      head: tx(lang,'Маркетплейсы','Marketpleyslar','Marketplaces'),
      links: [
        { label: 'Uzum Market', href: '#' },
        { label: 'Wildberries', href: '#' },
        { label: 'Yandex Market', href: '#' },
      ],
    },
    {
      head: tx(lang,'Контакты','Aloqa','Contact'),
      links: [
        { label: 'Telegram', href: 'https://t.me/daromadchi' },
        { label: 'support@daromadchi.uz', href: 'mailto:support@daromadchi.uz' },
      ],
    },
  ]

  return (
    <footer style={{ background: P.dCanvas, padding: '64px 24px 32px',
      fontFamily: 'var(--font-golos), sans-serif', borderTop: `1px solid ${P.dHair}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, marginBottom: 56 }}>
          {/* Brand col */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: P.dText }}>Daromadchi</span>
            </div>
            <p style={{ fontSize: 13, color: P.dMuted, lineHeight: 1.65, maxWidth: 240 }}>
              {tx(lang,
                'Аналитика Uzum, Wildberries и Yandex Market для продавцов из Узбекистана',
                'O\'zbekistondagi sotuvchilar uchun Uzum, Wildberries va Yandex Market tahlili',
                'Analytics for Uzum, Wildberries and Yandex Market sellers in Uzbekistan'
              )}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {[{mp:'Uzum',c:P.uzum},{mp:'WB',c:P.wb},{mp:'YM',c:P.yandex}].map(m => (
                <div key={m.mp} style={{ fontSize: 10, fontWeight: 700, color: m.c,
                  background: `${m.c}18`, borderRadius: 4, padding: '3px 7px' }}>
                  {m.mp}
                </div>
              ))}
            </div>
          </div>

          {cols.map(col => (
            <div key={col.head}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                {col.head}
              </p>
              {col.links.map(l => (
                <a key={l.label} href={l.href}
                  style={{ display: 'block', fontSize: 14, color: P.dMuted, textDecoration: 'none',
                    marginBottom: 10, transition: 'color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = P.dText)}
                  onMouseLeave={e => (e.currentTarget.style.color = P.dMuted)}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: `1px solid ${P.dHair}`, paddingTop: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
            © 2025 Daromadchi. {tx(lang,
              'ООО «Daromadchi» · ИНН: 123456789 · г. Ташкент, Узбекистан',
              'MChJ «Daromadchi» · INN: 123456789 · Toshkent shahri, O\'zbekiston',
              'LLC «Daromadchi» · TIN: 123456789 · Tashkent, Uzbekistan'
            )}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              tx(lang,'Политика конфиденциальности','Maxfiylik siyosati','Privacy policy'),
              tx(lang,'Публичная оферта','Ommaviy oferta','Terms of service'),
            ].map(l => (
              <a key={l} href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none',
                transition: 'color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.color = P.dMuted)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── PAGE ROOT ────────────────────────────────────────────────────────────────
export default function Page() {
  const { lang } = useLang()
  return (
    <div style={{ fontFamily: 'var(--font-golos), sans-serif' }}>
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
