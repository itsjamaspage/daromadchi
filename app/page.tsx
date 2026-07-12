'use client'
// v3
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowRight, X, Check,
  ChevronDown, BarChart2, Package, Bell,
  LayoutDashboard, ShoppingCart, Megaphone, Layers,
  BookOpen, MessageCircle, Plug2, UserCircle,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import type { Lang } from '@/lib/i18n'
import { T } from '@/lib/landing-t'

import PillNav from './components/PillNav'
import BorderGlow from './components/BorderGlow'


// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  ink:       '#0E2233',
  parchment: '#83c0f9',
  card:      '#FFFFFF',
  stone:     '#0E2233',
  muted:     '#334155',
  green:     '#0E7490',
  greenDk:   '#155E75',
  greenBg:   'rgba(14,116,144,0.09)',
  amber:     '#CA8A04',
  amberBg:   'rgba(202,138,4,0.09)',
  red:       '#DC2626',
  redBg:     'rgba(220,38,38,0.09)',
  hair:      '#93C5FD',
  // dark surfaces
  dCanvas:   '#161616',
  dCard:     '#1e1e1e',
  dCard2:    '#252525',
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
  dark:     '#83c0f9',   // sky blue for dark mode — stable button color
  darkDk:   '#7bbaf7',
  darkBg:   'rgba(160,212,252,0.12)',
}

function useIsDark() { return useTheme().theme === 'dark' }

function useAccent() {
  const isDark = useIsDark()
  return {
    color:  isDark ? A.dark   : A.light,
    dk:     isDark ? A.darkDk : A.lightDk,
    bg:     isDark ? A.darkBg : A.lightBg,
    tint:   isDark ? A.dark   : '#0E2233',
    btn:    '#ffffff',
    btnTxt: '#131321',
    btnHov: '#f0f0f0',
    btnBdr: isDark ? 'transparent' : 'rgba(14,27,46,0.18)',
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

// ── Navbar (PillNav) ──────────────────────────────────────────────────────────
function LandingNav({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const { toggle, theme } = useTheme()
  const { setLang } = useLang()
  const [langOpen, setLangOpen] = useState(false)

  const navItems = [
    { label: T.nav.howItWorks[lang], href: '#how' },
    { label: T.nav.pricing[lang], href: '#pricing' },
    { label: T.nav.extension[lang], href: '#extension' },
    { label: T.nav.help[lang], href: '#faq' },
  ]

  const borderCol = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(14,34,51,0.15)'
  const iconCol   = isDark ? '#ffffff' : P.stone
  const baseColor = isDark ? P.dCard2 : '#ffffff'
  const pillColor = isDark ? 'rgba(255,255,255,0.08)' : '#ffffff'
  const hoverCircle = isDark ? '#e2e8f0' : '#83c0f9'

  const rightContent = (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setLangOpen(v => !v)}
          className="pill-ctrl-btn"
          style={{ color: iconCol, border: `1px solid ${borderCol}`, background: 'transparent' }}
        >
          {lang.toUpperCase()}
        </button>
        {langOpen && (
          <div className="pill-lang-dropdown"
            style={{ background: isDark ? P.dCard2 : '#fff', borderColor: isDark ? P.dHair : P.hair }}>
            {(['uz', 'ru', 'en'] as Lang[]).map(l => (
              <button key={l} className="pill-lang-option"
                onClick={() => { setLang(l); setLangOpen(false) }}
                style={{ background: lang === l ? acc.bg : 'transparent', color: lang === l ? acc.tint : iconCol }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={toggle} className="pill-ctrl-btn"
        style={{ color: iconCol, border: `1px solid ${borderCol}`, background: 'transparent' }}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <Link href="/login"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: 9999, border: `1px solid ${borderCol}`,
          color: iconCol, textDecoration: 'none', flexShrink: 0 }}>
        <UserCircle size={18} />
      </Link>
    </>
  )

  return (
    <PillNav
      logo="/icon.svg"
      logoAlt="Daromadchi"
      logoHref="/"
      items={navItems}
      baseColor={baseColor}
      pillColor={pillColor}
      pillTextColor={isDark ? '#e2e8f0' : P.ink}
      hoveredPillTextColor={isDark ? P.dCard2 : P.ink}
      hoverCircleColor={hoverCircle}
      rightContent={rightContent}
      initialLoadAnimation={false}
      activeHref=""
      onMobileMenuClick={undefined}
    />
  )
}

// ── Floating stat card — with continuous bob animation ────────────────────────
function FloatCard({ mp, metric, value, change, up, delay, floatDur = 3.5, style }: {
  mp: string; metric: string; value: string
  change: string; up: boolean; delay: number; floatDur?: number
  style: React.CSSProperties
}) {
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
          background: '#ffffff',
          borderRadius: 14, padding: '12px 16px', minWidth: 162,
          boxShadow: '0 10px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14)',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          border: '1px solid rgba(14,27,46,0.14)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: P.ink }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: P.stone, letterSpacing: '0.02em' }}>{mp}</span>
          </div>
          <p style={{ fontSize: 10, color: P.muted, marginBottom: 2 }}>{metric}</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: P.ink, fontFamily: "'Space Grotesk', system-ui, sans-serif", lineHeight: 1.1 }}>
            {value}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}>
            {up ? <TrendingUp size={11} color={P.green}/> : <TrendingDown size={11} color={P.red}/>}
            <span style={{ fontSize: 11, fontWeight: 700, color: up ? P.green : P.red }}>{change}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Dashboard mockup — matches real app ───────────────────────────────────────
function DashMockup({ lang }: { lang: Lang }) {
  const isDark = useIsDark()

  const mainBg = isDark ? '#0c1120' : '#ffffff'
  const border = isDark ? '#1e2a42' : '#E2E8F0'
  const bg2    = isDark ? '#0f1627' : '#F8FAFD'
  const muted  = isDark ? '#6b7a99' : '#94A3B8'
  const ink    = isDark ? '#e2e8f0' : '#0F172A'

  const teal    = isDark ? '#ffffff' : '#3b82f6'
  const tealBg  = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(59,130,246,0.12)'
  const tealDim = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(59,130,246,0.15)'
  const kpis = [
    { l: T.mockup.revenue[lang],   v: '124 540 000', u: T.mockup.sum[lang], d: '+12.4%', pos: true,  c: teal },
    { l: T.mockup.orders[lang],  v: '1 842',        u: '',    d: '+8.1%',  pos: true,  c: teal },
    { l: T.mockup.expenses[lang],    v: '10 200 000',   u: T.mockup.sum[lang], d: '+3.2%',  pos: false, c: teal },
    { l: T.mockup.profit[lang],       v: '38 200 000',   u: T.mockup.sum[lang], d: '+15.7%', pos: true,  c: teal },
  ]

  const sideIcons = [LayoutDashboard, Package, ShoppingCart, BarChart2, Megaphone, Layers, Bell]
  const bars = [28,44,36,62,48,74,56,82,66,52,76,90,62,78]
  const hi   = bars.length - 4

  const rows = [
    { name: T.mockup.winterJacket[lang],  sku: 'UZ-00312', rev: '18 240 000', drr: 7.2,  ok: true,  mp: teal },
    { name: T.mockup.nikeAir[lang],      sku: 'WB-01847', rev: '12 590 000', drr: 11.4, ok: false, mp: teal },
    { name: T.mockup.hikingBackpack[lang],    sku: 'YM-00951', rev: '9 870 000',  drr: 9.8,  ok: true,  mp: teal },
    { name: T.mockup.sonyHeadphones[lang],   sku: 'UZ-00488', rev: '8 340 000',  drr: 6.1,  ok: true,  mp: teal },
  ]

  return (
    <div style={{ background: mainBg, borderRadius: 16, overflow: 'hidden', display: 'flex',
      border: `1px solid ${border}`,
      boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.35)' : '0 24px 64px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.08)' }}>

      {/* Mini sidebar */}
      <div style={{ width: 42, background: bg2, borderRight: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, flexShrink: 0 }}>
        <img src="/icon.svg" alt="" style={{ width: 22, height: 22, borderRadius: 5, marginBottom: 8 }} />
        <div style={{ width: '70%', height: 1, background: border, marginBottom: 6 }} />
        {sideIcons.map((Icon, i) => (
          <div key={i} style={{ width: 30, height: 30, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i === 0 ? tealBg : 'transparent', marginBottom: 2 }}>
            <Icon size={13} color={i === 0 ? teal : muted} />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: bg2, borderBottom: `1px solid ${border}`, padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[T.mockup.all[lang],'Uzum','Wildberries','Yandex Market'].map((tab, i) => (
              <div key={tab} style={{ fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
                background: i === 0 ? teal : 'transparent', color: i === 0 ? '#fff' : muted }}>
                {tab}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: muted }}>{T.mockup.dateRange[lang]}</span>
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
              {T.mockup.dailyRevenue[lang]}
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0',
                  background: i >= hi ? teal : tealDim, height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <p style={{ fontSize: 8, color: muted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {T.mockup.platforms[lang]}
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
            {[T.mockup.product[lang],T.mockup.sku[lang],T.mockup.revenueSum[lang],T.mockup.drrPct[lang],T.mockup.status[lang]].map(h => (
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
                <span style={{ fontSize: 8, color: muted }}>{r.ok ? T.mockup.ok[lang] : T.mockup.low[lang]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Hero decorative shapes ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HeroDecorShapes(_props: { isDark: boolean }) {
  return null
}

// ── 1. HERO ───────────────────────────────────────────────────────────────────
function HeroSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()

  // Light mode: light blue gradient hero  /  Dark mode: deep purple-navy hero
  const heroBg    = isDark ? P.dCanvas : 'linear-gradient(160deg, #a0d4fc 0%, #7bbaf7 45%, #7bbaf7 80%)'
  const glowColor = isDark ? 'rgba(197,232,254,0.12)' : 'rgba(144,213,255,0.55)'
  const headCol   = isDark ? P.dText   : P.ink
  const subCol    = isDark ? P.dMuted  : P.ink
  const secLinkCol = isDark ? 'rgba(255,255,255,0.62)' : P.ink
  const fadeTarget = isDark ? P.dCanvas : P.parchment

  return (
    <section style={{ position: 'relative', background: heroBg, overflow: 'hidden',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", paddingBottom: 0 }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: `radial-gradient(ellipse 90% 55% at 50% -5%, ${glowColor} 0%, transparent 65%)` }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: `radial-gradient(ellipse 45% 30% at 50% 0%, ${isDark ? 'rgba(197,232,254,0.06)' : 'rgba(14,116,144,0.08)'} 0%, transparent 55%)` }} />

      <HeroDecorShapes isDark={isDark} />

      <div className="px-5 sm:px-12 lg:px-[100px]" style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 100,
        position: 'relative', zIndex: 10, textAlign: 'center' }}>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.6 }}
          style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, lineHeight: 1.08,
            color: headCol, marginBottom: 18, letterSpacing: '-0.024em' }}>
          {T.hero.headingLine1[lang]}<br/>{T.hero.headingLine2[lang]}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6 }}
          style={{ fontSize: 'clamp(14px, 1.6vw, 17px)', color: subCol, marginBottom: 36,
            maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.65 }}>
          {T.hero.subtitle[lang]}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30, duration: 0.55 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 56 }}>
          <Link href="/login"
            style={{ fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '14px 34px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s', display: 'inline-block' }}
            onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
            {T.hero.startFree[lang]}
          </Link>
          <a href="#how"
            style={{ fontSize: 14, fontWeight: 600, color: secLinkCol, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : P.ink)}
            onMouseLeave={e => (e.currentTarget.style.color = secLinkCol)}>
            {T.hero.howItWorks[lang]} <ArrowRight size={14}/>
          </a>
        </motion.div>

        {/* Dashboard mockup — hidden on mobile to avoid overflow */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.40, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="hidden sm:block"
          style={{ width: '100%', position: 'relative', zIndex: 20, marginBottom: 0 }}>
          <BorderGlow
            backgroundColor={isDark ? '#0c1120' : '#ffffff'}
            glowColor={isDark ? "0 0 85" : "207 90 74"}
            colors={isDark ? ['#c5d8fe','#a8c5fd','#dbeafe'] : ['#83c0f9','#60a5fa','#a5f3fc']}
            borderRadius={16}
            glowIntensity={isDark ? 1.8 : 1.2}
          >
            <DashMockup lang={lang} />
          </BorderGlow>
        </motion.div>
      </div>

      <div style={{ height: 64, background: `linear-gradient(to bottom, transparent, ${fadeTarget})`,
        position: 'relative', zIndex: 5 }} />
    </section>
  )
}

// ── 2. COMPARISON TABLE ───────────────────────────────────────────────────────
function ComparisonSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg  = isDark ? '#1e1e1e' : '#e8f0fd'
  const cardBg = isDark ? P.dCard   : P.card
  const headBg = isDark ? P.dCard : P.parchment
  const bdr    = isDark ? P.dHair   : P.hair
  const txt    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone

  const rows = [
    T.comparison.row1[lang],
    T.comparison.row2[lang],
    T.comparison.row3[lang],
    T.comparison.row4[lang],
    T.comparison.row5[lang],
    T.comparison.row6[lang],
  ]

  return (
    <section id="comparison" style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.comparison.title[lang]}
          accent={T.comparison.accent[lang]}
          sub={T.comparison.sub[lang]}
        />
        <FadeUp delay={0.1}>
          <BorderGlow
            backgroundColor={isDark ? P.dCard : P.card}
            glowColor={isDark ? "0 0 85" : "207 90 74"}
            colors={['#83c0f9','#60a5fa','#a5f3fc']}
            borderRadius={20}
            glowIntensity={isDark ? 1.8 : 1.2}
          >
          <div style={{ background: cardBg, borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${bdr}`, boxShadow: isDark ? '0 4px 24px rgba(197,232,254,0.06)' : '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              background: headBg, borderBottom: `1px solid ${bdr}` }}>
              <div style={{ padding: '16px 24px' }}/>
              <div style={{ padding: '16px 24px', textAlign: 'center', borderLeft: `1px solid ${bdr}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: sub }}>
                  {T.comparison.separateDashboards[lang]}
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
          </BorderGlow>
        </FadeUp>
        <FadeUp delay={0.2} style={{ textAlign: 'center', marginTop: 36 }}>
          <Link href="/login"
            style={{ display: 'inline-block', fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '14px 36px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
            {T.comparison.tryFree[lang]}
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}

// ── 3. MARQUEE ────────────────────────────────────────────────────────────────
function MarqueeSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const bg       = isDark ? '#1e1e1e' : '#ffffff'
  const bdr      = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,27,46,0.08)'
  const divider  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(14,27,46,0.12)'
  const labelCol = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(14,27,46,0.45)'
  const itemCol  = isDark ? '#ffffff'                : '#0e1b2e'
  const dotCol   = isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(14,27,46,0.2)'
  const items = [
    'Wildberries',
    T.marquee.salesAnalytics[lang],
    'P&L hisobot',
    'Yandex Market',
    T.marquee.unitEconomics[lang],
    'Uzum Market',
    T.marquee.drrControl[lang],
    T.marquee.excelExport[lang],
  ]
  return (
    <div style={{
      position: 'relative', background: bg, overflow: 'hidden', display: 'flex', alignItems: 'stretch',
      borderTop: `1px solid ${bdr}`,
      borderBottom: `1px solid ${bdr}`,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <div style={{
        padding: '14px 24px', borderRight: `1px solid ${divider}`,
        flexShrink: 0, display: 'flex', alignItems: 'center',
      }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: labelCol,
          letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.5, whiteSpace: 'nowrap',
        }}>
          {T.marquee.labelLine1[lang]}<br />{T.marquee.labelLine2[lang]}
        </p>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="animate-ticker" style={{ display: 'flex', width: 'max-content' }}>
          {[...items, ...items].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ padding: '14px 28px', fontSize: 13, fontWeight: 600, color: itemCol, whiteSpace: 'nowrap' }}>
                {item}
              </span>
              <span style={{ color: dotCol, fontSize: 18, lineHeight: 1 }}>·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 4. FEATURES ───────────────────────────────────────────────────────────────
function FeaturesSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const secBg = isDark ? P.dCanvas : P.parchment
  const bdr   = isDark ? P.dHair   : P.hair

  // Dashboard palette — adapts to site theme
  const dBg    = isDark ? '#0c1120'  : '#83c0f7'
  const dCard  = isDark ? '#151c2e'  : '#e8f0fd'
  const dBdr   = isDark ? '#1e2a42'  : '#d4e2ef'
  const dMuted = isDark ? '#6b7a99'  : '#7a90a8'
  const dText  = isDark ? '#e2e8f0'  : '#1e293b'
  const chrBar = isDark ? '#1c1c1e'  : '#e8eef5'
  const chrUrl = isDark ? '#2c2c2e'  : '#d0dce8'
  const chrTxt = isDark ? '#6b7a99'  : '#7a90a8'

  const kpis = [
    { l: T.features.revenue[lang],      v: '124.5M', d: '+12.4%', col: '#22c4b8' },
    { l: T.features.profit[lang],         v: '38.2M',  d: '+12.4%', col: '#22c55e' },
    { l: T.features.orders[lang],    v: '1,842',  d: '+12.4%', col: '#60a5fa' },
    { l: T.features.stock[lang],         v: '3,410',  d: '+12.4%', col: '#f59e0b' },
  ]


  const bars  = [18,26,22,38,30,44,35,52,40,32,46,60,38,50]
  const hiIdx = bars.length - 4
  const orders = [
    { id: 'DEMO-183', status: T.features.delivered[lang],    col: '#22c55e' },
    { id: 'DEMO-184', status: T.features.processing[lang],  col: '#f59e0b' },
    { id: 'DEMO-185', status: T.features.delivered[lang],    col: '#22c55e' },
  ]



  return (
    <section id="features" ref={ref} style={{ position: 'relative', background: secBg, padding: '96px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s', overflow: 'hidden' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16" style={{ maxWidth: 1200, margin: '0 auto', alignItems: 'center' }}>

        {/* Left: dark dashboard mockup — matches photo 1 */}
        <motion.div
          initial={{ opacity: 0, y: 44 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ position: 'relative' }}>

          {/* 3D tilt on hover wrapper */}
          <motion.div
            animate={{ rotateY: [0, 6, 0, -6, 0], rotateX: [0, 3, 0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
            style={{ transformPerspective: 900 }}>

          {/* Browser chrome */}
          <BorderGlow
            backgroundColor={isDark ? '#0c1120' : '#83c0f7'}
            glowColor={isDark ? "0 0 85" : "207 90 74"}
            colors={isDark ? ['#c5d8fe','#a8c5fd','#7bb8f9'] : ['#83c0f9','#60a5fa','#a5f3fc']}
            borderRadius={14}
            glowIntensity={isDark ? 1.8 : 1.2}
          >
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${bdr}`,
            boxShadow: isDark
              ? '0 32px 80px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)'
              : '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)' }}>

            {/* Chrome bar */}
            <div style={{ padding: '10px 14px', background: chrBar,
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div style={{ flex: 1, background: chrUrl, borderRadius: 5,
                padding: '4px 10px', fontSize: 10, color: chrTxt, textAlign: 'center',
                maxWidth: 240, margin: '0 auto' }}>
                daromadchi.uz/dashboard
              </div>
              <span style={{ fontSize: 12, color: '#22c4b8', flexShrink: 0 }}>↗</span>
            </div>

            {/* Dark dashboard */}
            <div style={{ background: dBg, padding: '14px' }}>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                {kpis.map(k => (
                  <div key={k.l} style={{ background: dCard, borderRadius: 10, padding: '10px 10px 8px',
                    border: `1px solid ${dBdr}` }}>
                    <p style={{ fontSize: 9, color: dMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.l}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: k.col, fontFamily: 'monospace', lineHeight: 1 }}>{k.v}</p>
                    <p style={{ fontSize: 9, color: k.col, marginTop: 3 }}>↑ {k.d}</p>
                  </div>
                ))}
              </div>

              {/* Chart row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 12 }}>
                {/* Bar chart */}
                <div style={{ background: dCard, borderRadius: 10, padding: '10px 12px',
                  border: `1px solid ${dBdr}` }}>
                  <p style={{ fontSize: 9, color: dMuted, marginBottom: 8, fontWeight: 600 }}>
                    {T.features.dailyRevenue[lang]}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52 }}>
                    {bars.map((h, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`,
                        background: i >= hiIdx
                          ? `linear-gradient(to top, #494fdf, #7c83f0)`
                          : isDark ? 'rgba(73,79,223,0.2)' : 'rgba(73,79,223,0.12)' }} />
                    ))}
                  </div>
                </div>
                {/* Donut */}
                <div style={{ background: dCard, borderRadius: 10, padding: '10px 12px',
                  border: `1px solid ${dBdr}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <p style={{ fontSize: 9, color: dMuted, fontWeight: 600, alignSelf: 'flex-start' }}>
                    {T.features.categories[lang]}
                  </p>
                  <svg width={52} height={52} viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="18" fill="none" stroke={isDark ? dBdr : '#d4e2ef'} strokeWidth="8"/>
                    <circle cx="26" cy="26" r="18" fill="none" stroke="#494fdf" strokeWidth="8"
                      strokeDasharray="68 45" strokeLinecap="round" strokeDashoffset="-14" transform="rotate(-90 26 26)"/>
                    <circle cx="26" cy="26" r="18" fill="none" stroke="#f59e0b" strokeWidth="8"
                      strokeDasharray="28 85" strokeLinecap="round" strokeDashoffset="-82" transform="rotate(-90 26 26)"/>
                    <circle cx="26" cy="26" r="18" fill="none" stroke="#22c55e" strokeWidth="8"
                      strokeDasharray="17 96" strokeLinecap="round" strokeDashoffset="-110" transform="rotate(-90 26 26)"/>
                  </svg>
                </div>
              </div>

              {/* Orders table */}
              <div style={{ background: dCard, borderRadius: 10, overflow: 'hidden', border: `1px solid ${dBdr}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                  borderBottom: `1px solid ${dBdr}` }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: dMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {T.features.recentOrders[lang]}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: dMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{T.features.status[lang]}</span>
                </div>
                {orders.map((o, i) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 12px', borderBottom: i < orders.length - 1 ? `1px solid ${dBdr}` : 'none' }}>
                    <span style={{ fontSize: 10, color: dText, fontFamily: 'monospace' }}>{o.id}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: o.col }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </BorderGlow>
          </motion.div>
        </motion.div>

        {/* Right: text content */}
        <div>
          <FadeUp delay={0.15}>
            <p style={{ fontSize: 11, fontWeight: 700, color: acc.tint, marginBottom: 10,
              textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {T.features.badge[lang]}
            </p>
            <h2 style={{ fontSize: 'clamp(26px, 3vw, 42px)', fontWeight: 800, lineHeight: 1.1,
              color: isDark ? P.dText : P.ink, letterSpacing: '-0.022em', marginBottom: 18 }}>
              {T.features.headingLine1[lang]}<br/><span style={{ color: acc.tint }}>{T.features.headingAccentLine[lang]}</span>
            </h2>
          </FadeUp>

          <FadeUp delay={0.23}>
            <p style={{ fontSize: 16, color: isDark ? P.dMuted : P.stone, lineHeight: 1.65, marginBottom: 32 }}>
              {T.features.description[lang]}
            </p>
          </FadeUp>

          <FadeUp delay={0.31}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
              {[
                { title: T.features.feature1Title[lang],
                  desc: T.features.feature1Desc[lang] },
                { title: T.features.feature2Title[lang],
                  desc: T.features.feature2Desc[lang] },
                { title: T.features.feature3Title[lang],
                  desc: T.features.feature3Desc[lang] },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px',
                  background: isDark ? P.dCard : P.card, borderRadius: 14,
                  border: `1px solid ${isDark ? P.dHair : P.hair}`,
                  transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = acc.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = isDark ? P.dHair : P.hair)}>
                  <div style={{ width: 3, borderRadius: 2, background: acc.tint,
                    flexShrink: 0, alignSelf: 'stretch', minHeight: 36 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? P.dText : P.ink, marginBottom: 3 }}>{f.title}</p>
                    <p style={{ fontSize: 12, color: isDark ? P.dMuted : P.stone, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={0.39}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/login"
                style={{ fontSize: 13, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
                  padding: '11px 22px', borderRadius: 10, textDecoration: 'none',
                  transition: 'all 0.15s', display: 'inline-block' }}
                onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
                {T.features.startFree3Days[lang]}
              </Link>
              <a href="#how"
                style={{ fontSize: 14, fontWeight: 600, color: isDark ? P.dMuted : P.stone, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.15s', padding: '13px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : P.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = isDark ? P.dMuted : P.stone)}>
                {T.features.explorePlatform[lang]}
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ── 4. HOW IT WORKS — interactive accordion ───────────────────────────────────
function HowItWorksSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const [active, setActive] = useState(0)

  const secBg  = isDark ? P.dCard : '#e8f0fd'
  const ink    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone
  const uiBg   = isDark ? 'rgba(28,28,46,0.95)' : P.parchment
  const uiBdr  = isDark ? P.dHair   : P.hair
  const fldBg  = isDark ? P.dCard2 : '#fff'
  const stepColor = '#ffffff'

  const steps = [
    {
      color: stepColor,
      title: T.howItWorks.step1Title[lang],
      desc: T.howItWorks.step1Desc[lang],
      ui: (
        <div style={{ background: uiBg, borderRadius: 16, padding: '20px',
          border: `1px solid ${uiBdr}`, boxShadow: isDark ? '0 8px 32px rgba(197,232,254,0.08)' : '0 8px 32px rgba(0,0,0,0.10)' }}>
          {[{l:'Email',v:'seller@example.com'},{l:T.howItWorks.password[lang],v:'••••••••••'}].map(f => (
            <div key={f.l} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: sub, marginBottom: 5 }}>{f.l}</p>
              <div style={{ background: fldBg, border: `1px solid ${uiBdr}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, color: ink }}>{f.v}</span>
              </div>
            </div>
          ))}
          <div style={{ background: '#ffffff', borderRadius: 8, padding: '11px', textAlign: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#131321' }}>{T.howItWorks.signUp[lang]}</span>
          </div>
        </div>
      ),
    },
    {
      color: stepColor,
      title: T.howItWorks.step2Title[lang],
      desc: T.howItWorks.step2Desc[lang],
      ui: (
        <div style={{ background: uiBg, borderRadius: 16, padding: '20px',
          border: `1px solid ${uiBdr}`, boxShadow: isDark ? '0 8px 32px rgba(197,232,254,0.08)' : '0 8px 32px rgba(0,0,0,0.10)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: sub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {T.howItWorks.yourStores[lang]}
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
      color: stepColor,
      title: T.howItWorks.step3Title[lang],
      desc: T.howItWorks.step3Desc[lang],
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
              {T.howItWorks.dailyRevenue[lang]}
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
    <section id="how" style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.howItWorks.title[lang]}
          accent={T.howItWorks.accent[lang]}
          sub={T.howItWorks.sub[lang]}
        />

        {/* Two-column: accordion tabs left, active UI right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12" style={{ alignItems: 'start' }}>

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
                      background: isActive ? s.color : (isDark ? 'rgba(197,232,254,0.10)' : '#ffffff'),
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
                {T.howItWorks.connectFree[lang]}
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
              <BorderGlow
                backgroundColor={isDark ? 'rgba(28,28,46,0.95)' : P.parchment}
                glowColor={isDark ? "0 0 85" : "207 90 74"}
                colors={['#83c0f9','#60a5fa','#a5f3fc']}
                borderRadius={16}
                glowIntensity={isDark ? 1.8 : 1.2}
              >
                {steps[active].ui}
              </BorderGlow>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// ── 5. BENTO ──────────────────────────────────────────────────────────────────
function BentoSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg  = isDark ? P.dCanvas : P.parchment
  const ink    = isDark ? P.dText   : P.ink
  const sub    = isDark ? P.dMuted  : P.stone
  const muted  = isDark ? P.dMuted  : P.stone
  const bg2    = isDark ? P.dCanvas : '#F8FAFD'
  const bdr    = isDark ? P.dHair   : P.hair

  return (
    <section style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.bento.title[lang]}
          accent={T.bento.accent[lang]}
          sub={T.bento.sub[lang]}
        />
        {/* Top: 4 KPI stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { l: T.bento.revenue[lang], v: '124.5M', d: '+12%', col: '#22c4b8', hsl: '174 67 45', cols: ['#22c4b8','#0d9488','#5eead4'] },
            { l: T.bento.orders[lang], v: '1 842', d: '+8%', col: '#60a5fa', hsl: '213 94 68', cols: ['#60a5fa','#3b82f6','#93c5fd'] },
            { l: T.bento.drr[lang], v: '8.2%', d: '-1.4%', col: '#f59e0b', hsl: '38 92 50', cols: ['#f59e0b','#d97706','#fcd34d'] },
            { l: T.bento.profit[lang], v: '38.2M', d: '+15%', col: '#22c55e', hsl: '142 71 45', cols: ['#22c55e','#16a34a','#86efac'] },
          ].map((k, i) => (
            <FadeUp key={k.l} delay={i * 0.07} style={{ height: '100%' }}>
              <BorderGlow
                backgroundColor={isDark ? P.dCard : '#ffffff'}
                glowColor={isDark ? "0 0 85" : k.hsl}
                colors={k.cols}
                borderRadius={18}
                glowIntensity={isDark ? 1.5 : 1.2}
                style={{ height: '100%' }}
              >
                <div style={{ padding: '20px 22px', border: `1.5px solid ${k.col}40`, borderRadius: 18 }}>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.l}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: k.col, fontFamily: 'monospace', lineHeight: 1, marginBottom: 4 }}>{k.v}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: k.col }}>{k.d} {T.bento.thisMonth[lang]}</p>
                </div>
              </BorderGlow>
            </FadeUp>
          ))}
        </div>

        {/* Bottom: 3 equal feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Analytics card */}
          <FadeUp delay={0.12} style={{ height: '100%' }}>
            <BorderGlow
              backgroundColor={isDark ? P.dCard : '#ffffff'}
              glowColor={isDark ? "0 0 85" : "207 90 74"}
              colors={['#83c0f9', '#60a5fa', '#a5f3fc']}
              borderRadius={24}
              glowIntensity={isDark ? 1.5 : 1.2}
              style={{ height: '100%', border: `1.5px solid ${isDark ? '#83c0f960' : '#83c0f940'}` }}
            >
              <div style={{ padding: '28px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: acc.tint, marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {T.bento.analyticsLabel[lang]}
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: ink, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {T.bento.analyticsTitle[lang]}
                </h3>
                <p style={{ fontSize: 13, color: sub, lineHeight: 1.6, marginBottom: 18 }}>
                  {T.bento.analyticsDesc[lang]}
                </p>
                <div style={{ background: bg2, borderRadius: 12, padding: '12px', border: `1px solid ${bdr}` }}>
                  <p style={{ fontSize: 9, color: muted, marginBottom: 8, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {T.bento.dailyRevenue[lang]}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
                    {[32,45,38,62,55,78,65,85,72,58,80,95,68,82].map((h, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`,
                        background: i >= 10 ? acc.color : `${acc.color}28` }} />
                    ))}
                  </div>
                </div>
              </div>
            </BorderGlow>
          </FadeUp>

          {/* Inventory card */}
          <FadeUp delay={0.2} style={{ height: '100%' }}>
            <BorderGlow
              backgroundColor={isDark ? P.dCard : '#ffffff'}
              glowColor={isDark ? "0 0 85" : "38 92 50"}
              colors={['#f59e0b', '#d97706', '#fcd34d']}
              borderRadius={24}
              glowIntensity={isDark ? 1.5 : 1.2}
              style={{ height: '100%', border: `1.5px solid ${isDark ? '#f59e0b60' : '#f59e0b40'}` }}
            >
              <div style={{ padding: '28px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {T.bento.inventoryLabel[lang]}
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: ink, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {T.bento.inventoryTitle[lang]}
                </h3>
                <p style={{ fontSize: 13, color: sub, lineHeight: 1.6, marginBottom: 18 }}>
                  {T.bento.inventoryDesc[lang]}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { name: T.bento.jacket[lang], stock: 120, low: false },
                    { name: T.bento.sneakers[lang], stock: 8, low: true },
                    { name: T.bento.backpack[lang], stock: 45, low: false },
                  ].map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: bg2, borderRadius: 10, border: `1px solid ${bdr}` }}>
                      <span style={{ fontSize: 12, color: ink, fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700,
                        color: item.low ? '#f87171' : '#10b981',
                        background: item.low ? 'rgba(248,113,113,0.1)' : 'rgba(16,185,129,0.1)',
                        padding: '3px 10px', borderRadius: 100 }}>
                        {item.stock} {T.bento.pcs[lang]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </BorderGlow>
          </FadeUp>

          {/* P&L card */}
          <FadeUp delay={0.28} style={{ height: '100%' }}>
            <BorderGlow
              backgroundColor={isDark ? P.dCard : '#ffffff'}
              glowColor={isDark ? "0 0 85" : "158 84 40"}
              colors={['#10b981', '#059669', '#6ee7b7']}
              borderRadius={24}
              glowIntensity={isDark ? 1.5 : 1.2}
              style={{ height: '100%', border: `1.5px solid ${isDark ? '#10b98160' : '#10b98140'}` }}
            >
              <div style={{ padding: '28px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {T.bento.financeLabel[lang]}
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: ink, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {T.bento.financeTitle[lang]}
                </h3>
                <p style={{ fontSize: 13, color: sub, lineHeight: 1.6, marginBottom: 18 }}>
                  {T.bento.financeDesc[lang]}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { l: T.bento.revenueRow[lang], v: '124.5M', col: ink },
                    { l: T.bento.commission[lang], v: '-12.2M', col: '#f87171' },
                    { l: T.bento.delivery[lang], v: '-3.8M', col: '#f59e0b' },
                    { l: T.bento.profitRow[lang], v: '108.5M', col: '#10b981' },
                  ].map((row, i, arr) => (
                    <div key={row.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${bdr}` : 'none' }}>
                      <span style={{ fontSize: 12, color: sub }}>{row.l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.col, fontFamily: 'monospace' }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BorderGlow>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ── 6. EXTENSION SHOWCASE ────────────────────────────────────────────────────
function ExtensionSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg = isDark ? P.dCard  : '#e8f0fd'
  const ink   = isDark ? P.dText  : P.ink
  const sub   = isDark ? P.dMuted : P.stone

  const cards = [
    {
      name: 'Uzum Market', color: '#494fdf', bg: 'rgba(73,79,223,0.1)',
      icon: 'UZ',
      headline: T.extension.uzumHeadline[lang],
      points: [
        T.extension.uzumPoint1[lang],
        T.extension.uzumPoint2[lang],
        T.extension.uzumPoint3[lang],
      ],
    },
    {
      name: 'Wildberries', color: '#CB11AB', bg: 'rgba(203,17,171,0.1)',
      icon: 'WB',
      headline: T.extension.wbHeadline[lang],
      points: [
        T.extension.wbPoint1[lang],
        T.extension.wbPoint2[lang],
        T.extension.wbPoint3[lang],
      ],
    },
    {
      name: 'Yandex Market', color: '#E8A000', bg: 'rgba(232,160,0,0.1)',
      icon: 'YM',
      headline: T.extension.ymHeadline[lang],
      points: [
        T.extension.ymPoint1[lang],
        T.extension.ymPoint2[lang],
        T.extension.ymPoint3[lang],
      ],
    },
    {
      name: T.extension.freeName[lang],
      color: acc.tint, bg: isDark ? 'rgba(131,192,249,0.1)' : 'rgba(131,192,249,0.15)',
      icon: 'FR',
      headline: T.extension.freeHeadline[lang],
      points: [
        T.extension.freePoint1[lang],
        T.extension.freePoint2[lang],
        T.extension.freePoint3[lang],
      ],
    },
  ]

  return (
    <section id="extension" style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.extension.title[lang]}
          accent={T.extension.accent[lang]}
          sub={T.extension.sub[lang]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {(() => {
            const glowHsl = ['234 67 57', '307 84 43', '39 100 45', '207 90 74']
            const glowCols = [
              ['#494fdf', '#6366f1', '#818cf8'],
              ['#CB11AB', '#ec4899', '#f0abfc'],
              ['#E8A000', '#f59e0b', '#fcd34d'],
              ['#83c0f9', '#60a5fa', '#a5f3fc'],
            ]
            return cards.map((c, i) => (
              <FadeUp key={i} delay={i * 0.1} style={{ height: '100%' }}>
                <BorderGlow
                  backgroundColor={isDark ? P.dCard : '#ffffff'}
                  glowColor={isDark ? "0 0 85" : glowHsl[i]}
                  colors={glowCols[i]}
                  borderRadius={24}
                  glowIntensity={isDark ? 1.5 : 1.2}
                  style={{ height: '100%', border: `1.5px solid ${c.color}${isDark ? '60' : '40'}` }}
                >
                  <div style={{ padding: '32px 28px', cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${c.color}20`,
                        border: `1.5px solid ${c.color}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: c.color, letterSpacing: '0.02em' }}>
                        {c.icon}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: isDark ? P.dText : P.ink,
                        letterSpacing: '-0.01em' }}>{c.name}</span>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: ink, lineHeight: 1.4, marginBottom: 20 }}>
                      {c.headline}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {c.points.map((pt, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color,
                            marginTop: 7, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: ink, lineHeight: 1.6 }}>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </BorderGlow>
              </FadeUp>
            ))
          })()}
        </div>

        <FadeUp delay={0.2}>
          <div style={{ textAlign: 'center' }}>
            <Link href="/extension"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
                padding: '14px 36px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
              {T.extension.installBtn[lang]} <ArrowRight size={16}/>
            </Link>
            <p style={{ marginTop: 10, fontSize: 12, color: sub }}>
              {T.extension.browserNote[lang]}
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ── 7. PRICING — theme-aware ──────────────────────────────────────────────────
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

function PricingSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const sectionRef = useRef(null)
  const inView = useInView(sectionRef, { once: true, amount: 0.3 })

  const secBg  = isDark ? '#1e1e1e' : P.parchment
  const ink    = isDark ? P.dText   : P.ink
  const muted  = isDark ? P.dMuted  : P.stone

  const tiers = [
    {
      name: T.pricing.freeName[lang], price: '0',
      sub: T.pricing.freeSub[lang], highlight: false,
      features: [
        T.pricing.freeFeature1[lang],
        T.pricing.freeFeature2[lang],
        T.pricing.freeFeature3[lang],
      ],
      cta: T.pricing.freeCta[lang], ctaHref: '/login',
    },
    {
      name: 'Pro', price: '300 000', badge: T.pricing.proBadge[lang],
      sub: T.pricing.proSub[lang], highlight: true,
      features: [
        T.pricing.proFeature1[lang],
        T.pricing.proFeature2[lang],
        T.pricing.proFeature3[lang],
        T.pricing.proFeature4[lang],
        T.pricing.proFeature5[lang],
      ],
      cta: T.pricing.proCta[lang], ctaHref: '/login',
    },
    {
      name: 'Pro+', price: '600 000',
      sub: T.pricing.proPlusSub[lang], highlight: false,
      features: [
        T.pricing.proPlusFeature1[lang],
        T.pricing.proPlusFeature2[lang],
        T.pricing.proPlusFeature3[lang],
        T.pricing.proPlusFeature4[lang],
      ],
      cta: T.pricing.proPlusCta[lang], ctaHref: '/login',
    },
  ]

  return (
    <section id="pricing" ref={sectionRef} style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: acc.tint, marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {T.pricing.label[lang]}
          </p>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: ink,
            letterSpacing: '-0.022em', marginBottom: 16 }}>
            {T.pricing.title[lang]}
          </h2>
          <p style={{ fontSize: 16, color: muted, maxWidth: 400, margin: '0 auto' }}>
            {T.pricing.sub[lang]}
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: -140, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: t.highlight ? 1.02 : 1 } : {}}
              transition={{ delay: i * 0.18, type: 'spring', stiffness: 160, damping: 18 }}>
              <BorderGlow
                backgroundColor={t.highlight ? (isDark ? '#ffffff' : '#0e1b2e') : (isDark ? P.dCard : P.card)}
                glowColor={isDark ? "0 0 85" : "207 100 55"}
                colors={t.highlight ? ['#83c0f9', '#60a5fa', '#bfdbfe'] : ['#83c0f9', '#60a5fa', '#a5f3fc']}
                borderRadius={20}
                glowIntensity={t.highlight ? (isDark ? 1.5 : 1.2) : (isDark ? 1.2 : 0.9)}
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.highlight ? (isDark ? P.green : acc.dk) : muted }}>
                      {t.name}
                    </p>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(t as any).badge && (
                      <span style={{ background: '#ffffff', borderRadius: 100, padding: '3px 12px',
                        fontSize: 10, fontWeight: 800, color: '#0e1b2e', letterSpacing: '0.04em' }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(t as any).badge}
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 800,
                      color: t.highlight ? (isDark ? P.ink : '#E8FFF8') : ink,
                      fontFamily: 'var(--font-mono-landing), monospace' }}>
                      {t.price === '0' ? '0' : <SlotPrice value={t.price} trigger={inView} delay={i * 0.18 + 0.4} />}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: t.highlight ? (isDark ? P.muted : P.dMuted) : muted, marginBottom: 24 }}>{t.sub}</p>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                    {t.features.map((f, fi) => (
                      <motion.div key={f}
                        initial={{ opacity: 0, x: -8 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: i * 0.18 + 0.7 + fi * 0.05, duration: 0.25 }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Check size={14} color={t.highlight ? (isDark ? P.green : '#7bbaf7') : acc.tint} style={{ marginTop: 2, flexShrink: 0 }}/>
                        <span style={{ fontSize: 13, color: t.highlight ? (isDark ? P.ink : '#E8FFF8') : ink, lineHeight: 1.4 }}>{f}</span>
                      </motion.div>
                    ))}
                  </div>

                  <Link href={t.ctaHref}
                    style={{ display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 700,
                      background: t.highlight ? '#ffffff' : '#0e1b2e',
                      color: t.highlight ? '#0e1b2e' : '#ffffff',
                      padding: '13px 24px', borderRadius: 10,
                      textDecoration: 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.highlight ? '#f0f0f0' : '#1a2a3e' }}
                    onMouseLeave={e => { e.currentTarget.style.background = t.highlight ? '#ffffff' : '#0e1b2e' }}>
                    {t.cta}
                  </Link>
                </div>
              </BorderGlow>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 7. RESOURCES ──────────────────────────────────────────────────────────────
function ResourcesSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const [expanded, setExpanded] = useState<number | null>(0)
  const secBg  = isDark ? P.dCanvas : '#e8f0fd'
  const bdr    = isDark ? P.dHair   : P.hair
  const ink    = isDark ? P.dText   : P.ink
  const bg2    = isDark ? P.dCanvas : '#F8FAFD'

  const rightItems = [
    {
      num: '02',
      title: 'Telegram',
      icon: <MessageCircle size={18} color={acc.tint} />,
      items: [
        { t: T.resources.tgItem1Title[lang], d: T.resources.tgItem1Desc[lang] },
        { t: T.resources.tgItem2Title[lang], d: T.resources.tgItem2Desc[lang] },
        { t: T.resources.tgItem3Title[lang], d: T.resources.tgItem3Desc[lang] },
      ],
      link: T.resources.tgLink[lang],
      href: 'https://t.me/daromadchi',
    },
    {
      num: '03',
      title: T.resources.integrationsTitle[lang],
      icon: <Plug2 size={18} color={acc.tint} />,
      items: [
        { t: 'Uzum Market',   d: T.resources.intUzumDesc[lang] },
        { t: 'Wildberries',   d: T.resources.intWbDesc[lang] },
        { t: 'Yandex Market', d: T.resources.intYmDesc[lang] },
      ],
      link: T.resources.intLink[lang],
      href: '/help',
    },
  ]

  return (
    <section id="resources" style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.resources.title[lang]}
          accent={T.resources.accent[lang]}
          sub={T.resources.sub[lang]}
        />
        {/* All 3 items as full-width vertical accordion */}
        {(() => {
          const allItems = [
            {
              num: '01',
              title: T.resources.helpTitle[lang],
              icon: <BookOpen size={20} color={acc.tint} />,
              desc: T.resources.helpDesc[lang],
              items: [
                { t: T.resources.helpItem1Title[lang], d: T.resources.helpItem1Desc[lang] },
                { t: T.resources.helpItem2Title[lang], d: T.resources.helpItem2Desc[lang] },
                { t: T.resources.helpItem3Title[lang], d: T.resources.helpItem3Desc[lang] },
              ],
              link: T.resources.helpLink[lang],
              href: '/help',
            },
            ...rightItems.map(r => ({ ...r, desc: undefined as string | undefined })),
          ]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allItems.map((item, idx) => (
                <FadeUp key={item.num} delay={0.05 + idx * 0.07}>
                  <BorderGlow
                    backgroundColor={isDark ? P.dCard : P.card}
                    glowColor={isDark ? "0 0 85" : "207 70 74"}
                    colors={['#83c0f9', '#60a5fa', '#a5f3fc']}
                    borderRadius={24}
                    glowIntensity={isDark ? 1.5 : 1.2}
                  >
                  <div
                    onClick={() => setExpanded(idx)}
                    style={{ overflow: 'hidden', borderRadius: 24,
                      outline: expanded === idx ? `1.5px solid ${acc.color}` : 'none',
                      cursor: 'pointer', transition: 'outline-color 0.2s' }}>
                    {/* Header row */}
                    <div style={{ padding: '26px 32px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', right: 16, top: -8, fontSize: 100, fontWeight: 900,
                        color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', lineHeight: 1,
                        userSelect: 'none', fontFamily: 'monospace', pointerEvents: 'none' }}>{item.num}</div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: acc.tint, marginBottom: 6,
                          textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.num}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.icon}
                          <h3 style={{ fontSize: 20, fontWeight: 800, color: ink, letterSpacing: '-0.01em' }}>{item.title}</h3>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: expanded === idx ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ width: 32, height: 32, borderRadius: 10, background: bg2,
                          border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0, fontSize: 20, color: ink,
                          fontWeight: 500, lineHeight: 1 }}>
                        +
                      </motion.div>
                    </div>
                    {/* Expandable body */}
                    <AnimatePresence initial={false}>
                      {expanded === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}>
                          <div style={{ padding: '0 32px 28px' }}>
                            {item.desc && (
                              <p style={{ fontSize: 14, color: ink, lineHeight: 1.65, marginBottom: 20, maxWidth: 600 }}>
                                {item.desc}
                              </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                              {item.items.map((it, j) => (
                                <div key={j}
                                  style={{ padding: '14px 16px', background: bg2, borderRadius: 14,
                                    border: `1px solid ${bdr}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                                  onMouseEnter={e => (e.currentTarget.style.borderColor = acc.color)}
                                  onMouseLeave={e => (e.currentTarget.style.borderColor = bdr)}>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: ink, marginBottom: 4 }}>{it.t}</p>
                                  <p style={{ fontSize: 11, color: ink }}>{it.d}</p>
                                </div>
                              ))}
                            </div>
                            <Link href={item.href}
                              style={{ fontSize: 13, fontWeight: 700, color: acc.tint, textDecoration: 'none', display: 'inline-block' }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                              onClick={e => e.stopPropagation()}>
                              {item.link}
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  </BorderGlow>
                </FadeUp>
              ))}
            </div>
          )
        })()}
      </div>
    </section>
  )
}

// ── 8. FAQ ────────────────────────────────────────────────────────────────────
function FaqSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const [open, setOpen] = useState<number | null>(0)
  const secBg = isDark ? P.dCard : P.parchment
  const bdr   = isDark ? P.dHair   : P.hair
  const ink   = isDark ? P.dText   : P.ink

  const faqs = [
    { q: T.faq.q1[lang],
      a: T.faq.a1[lang] },
    { q: T.faq.q2[lang],
      a: T.faq.a2[lang] },
    { q: T.faq.q3[lang],
      a: T.faq.a3[lang] },
    { q: T.faq.q4[lang],
      a: T.faq.a4[lang] },
    { q: T.faq.q5[lang],
      a: T.faq.a5[lang] },
    { q: T.faq.q6[lang],
      a: T.faq.a6[lang] },
  ]

  return (
    <section id="faq" style={{ position: 'relative', background: secBg, padding: '88px 24px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHead dark={isDark}
          title={T.faq.title[lang]}
          accent={T.faq.accent[lang]}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {faqs.map((f, i) => (
            <FadeUp key={i} delay={i * 0.06}>
              <div style={{ background: isDark ? P.dCard : '#ffffff', borderRadius: 16,
                marginBottom: 10, border: `1px solid ${bdr}`, overflow: 'hidden' }}>
                <button onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: acc.tint,
                      fontFamily: 'var(--font-mono-landing), monospace', minWidth: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: ink }}>{f.q}</span>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: open === i ? (isDark ? 'rgba(131,192,249,0.18)' : '#ffffff') : 'transparent',
                    border: `1.5px solid ${bdr}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.22s ease, background 0.22s ease' }}>
                    <ChevronDown size={16} color={ink}/>
                  </div>
                </button>
                <div style={{
                  display: 'grid',
                  gridTemplateRows: open === i ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.25s ease-in-out, opacity 0.2s ease-in-out',
                  opacity: open === i ? 1 : 0,
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 14, color: ink, lineHeight: 1.7, padding: '0 24px 20px 24px' }}>
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 9. CTA ────────────────────────────────────────────────────────────────────
function CtaSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const secBg    = isDark ? P.dCanvas : '#e8f0fd'
  const headCol  = isDark ? P.dText   : P.ink
  const subCol   = isDark ? P.dMuted  : P.ink
  const badgeCol = isDark ? 'rgba(255,255,255,0.45)' : P.ink

  const phrases = [
    T.cta.heading[lang],
    T.cta.thenLetsGo[lang],
  ]

  return (
    <section style={{ position: 'relative', background: secBg, overflow: 'hidden',
      padding: '100px 24px', fontFamily: "'Space Grotesk', system-ui, sans-serif", transition: 'background 0.3s' }}>
      <div className="hidden lg:block">
        <FloatCard mp="Uzum"metric={T.cta.revenue[lang]} value={T.cta.revenueValue[lang]} change="+12%" up delay={0} floatDur={3.8}
          style={{ left: '4%', top: '20%', transform: 'rotate(-3.5deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Wildberries"metric={T.cta.orders[lang]} value="1 842" change="+8%" up delay={0.1} floatDur={4.3}
          style={{ right: '3%', top: '18%', transform: 'rotate(4deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Yandex Market"metric={T.cta.drr[lang]} value="8.2%" change="-1.4%" up={false} delay={0.15} floatDur={3.6}
          style={{ left: '6%', bottom: '20%', transform: 'rotate(-2deg)', zIndex: 5, opacity: 0.9 }} />
        <FloatCard mp="Uzum"metric={T.cta.profit[lang]} value={T.cta.profitValue[lang]} change="+15%" up delay={0.2} floatDur={4.1}
          style={{ right: '5%', bottom: '22%', transform: 'rotate(3deg)', zIndex: 5, opacity: 0.9 }} />
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <FadeUp>
          <div style={{ minHeight: 'clamp(100px, 12vw, 160px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800,
                color: headCol,
                lineHeight: 1.08, letterSpacing: '-0.024em' }}>
                {phrases[0]}
              </h2>
          </div>
          <p style={{ fontSize: 16, color: subCol, lineHeight: 1.65, maxWidth: 500, margin: '0 auto 40px' }}>
            {T.cta.subtext[lang]}
          </p>
          <div style={{ display: 'inline-block', marginBottom: 20 }}>
            <Link href="/login"
              style={{ display: 'inline-block', fontSize: 16, fontWeight: 700,
                background: acc.btn, color: acc.btnTxt,
                padding: '16px 44px', borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = acc.btnHov; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = acc.btn; e.currentTarget.style.transform = 'translateY(0)' }}>
              {T.cta.ctaBtn[lang]}
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {[T.cta.badge1[lang],
              T.cta.badge2[lang],
              T.cta.badge3[lang]].map(s => (
              <span key={s} style={{ fontSize: 13, color: badgeCol, fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function FooterSection({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const footBg  = isDark ? '#1e1e1e'  : P.parchment
  const bdr     = isDark ? P.dHair    : 'rgba(14,34,51,0.2)'
  const txt     = isDark ? P.dText    : P.ink
  const muted   = isDark ? P.dMuted   : P.ink
  const subtle  = isDark ? 'rgba(255,255,255,0.28)' : P.ink

  const cols = [
    { head: T.footer.productHead[lang], links: [
      { label: T.footer.signIn[lang], href: '/login' },
      { label: T.footer.register[lang], href: '/login' },
      { label: T.footer.pricing[lang], href: '/pricing' },
      { label: T.footer.features[lang], href: '#features' },
      { label: T.footer.about[lang], href: '/about' },
    ]},
    { head: T.footer.marketplacesHead[lang], links: [
      { label: 'Uzum Market', href: '#' }, { label: 'Wildberries', href: '#' }, { label: 'Yandex Market', href: '#' },
    ]},
    { head: T.footer.contactHead[lang], links: [
      { label: 'Telegram', href: 'https://t.me/daromadchi_alerts_bot' },
    ]},
  ]

  return (
    <footer style={{ position: 'relative', background: footBg, padding: '64px 24px 32px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", borderTop: `1px solid ${bdr}`,
      transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: txt }}>Daromadchi</span>
            </div>
            <p style={{ fontSize: 13, color: muted, lineHeight: 1.65, maxWidth: 240 }}>
              {T.footer.description[lang]}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {['Uzum','WB','YM'].map(mp => (
                <div key={mp} style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#ffffff' : P.ink, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(14,34,51,0.12)', borderRadius: 4, padding: '3px 7px' }}>
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
            © 2025 Daromadchi. {T.footer.location[lang]}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: T.footer.privacy[lang], href: '/privacy' },
              { label: T.footer.terms[lang], href: '/terms' },
              { label: T.footer.compliance[lang], href: '/compliance' },
            ].map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 12, color: subtle, textDecoration: 'none', transition: 'color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.color = muted)}
                onMouseLeave={e => (e.currentTarget.style.color = subtle)}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Mobile Bottom Navigation ──────────────────────────────────────────────────
function MobileBottomNav({ lang }: { lang: Lang }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const navBg   = isDark ? '#161616'                 : '#ffffff'
  const border   = isDark ? P.dHair                 : P.hair
  const iconCol  = isDark ? 'rgba(197,232,254,0.45)': P.stone
  const activeCol = isDark ? acc.color              : '#0369a1'

  const items = [
    { label: T.mobileNav.home[lang],       href: '#top',      Icon: LayoutDashboard },
    { label: T.mobileNav.features[lang],  href: '#features', Icon: Layers },
    { label: T.mobileNav.pricing[lang],        href: '#pricing',  Icon: Package },
    { label: T.mobileNav.faq[lang],           href: '#faq',      Icon: MessageCircle },
    { label: T.mobileNav.profile[lang],           href: '/login',    Icon: UserCircle },
  ]

  return (
    <nav
      className="md:hidden"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: navBg, borderTop: `1px solid ${border}`,
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: 60 }}>
        {items.map(({ label, href, Icon }) => {
          const isActive = href === '#top'
          return (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, textDecoration: 'none', padding: '6px 12px',
                color: isActive ? activeCol : iconCol,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = activeCol)}
              onMouseLeave={e => (e.currentTarget.style.color = isActive ? activeCol : iconCol)}
            >
              <Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}


export default function Page() {
  const { lang } = useLang()
  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <LandingNav lang={lang} />
      <div id="top" />
      <HeroSection lang={lang} />
      <MarqueeSection lang={lang} />
      <ComparisonSection lang={lang} />
      <FeaturesSection lang={lang} />
      <HowItWorksSection lang={lang} />
      <BentoSection lang={lang} />
      <ExtensionSection lang={lang} />
      <PricingSection lang={lang} />
      <ResourcesSection lang={lang} />
      <FaqSection lang={lang} />
      <CtaSection lang={lang} />
      <div className="md:hidden" style={{ height: 60 }} />
      <FooterSection lang={lang} />
      <MobileBottomNav lang={lang} />
    </div>
  )
}
