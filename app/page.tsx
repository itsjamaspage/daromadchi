'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  BarChart2, TrendingUp, TrendingDown, AlertTriangle,
  Package, Bell, Chrome, DollarSign,
  ArrowRight, Menu, X, Check, ChevronRight,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

// ─── PHOTO ──────────────────────────────────────────────────────────────────
// IMPORTANT: Verify this URL before launch.
// Source: unsplash.com/photos/w3VW5V3S-RA
// "Asian woman working at online store warehouse packing product to parcel boxes"
// If this 404s, replace with any images.unsplash.com URL showing a real person
// packing goods in a warehouse / home-office setting.
const HERO_PHOTO =
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80'
const CTA_PHOTO =
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1920&q=80'

// ─── PALETTE ────────────────────────────────────────────────────────────────
const P = {
  ink:        '#1C1917',
  parchment:  '#F9F8F5',
  card:       '#F0EEE8',
  stone:      '#78716C',
  green:      '#16A34A',
  greenDk:    '#15803D',
  greenBg:    'rgba(22,163,74,0.1)',
  amber:      '#CA8A04',
  amberBg:    'rgba(202,138,4,0.1)',
  red:        '#DC2626',
  redBg:      'rgba(220,38,38,0.1)',
  hair:       '#E5E1D8',
  // dark
  dCanvas:    '#141210',
  dCard:      '#1E1C18',
  dCard2:     '#252320',
  dHair:      'rgba(255,255,255,0.08)',
  dMuted:     'rgba(255,255,255,0.55)',
  dText:      '#F2EFE8',
  // marketplaces
  uzum:       '#494fdf',
  wb:         '#CB11AB',
  yandex:     '#E8A000',
}

function useIsDark() {
  const { theme } = useTheme()
  return theme === 'dark'
}

function tx(lang: string, ru: string, uz: string, en: string) {
  return lang === 'ru' ? ru : lang === 'uz' ? uz : en
}

// ─── NAVBAR ─────────────────────────────────────────────────────────────────
function Navbar({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const { toggle, theme } = useTheme()
  const { setLang } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const bg   = scrolled ? (isDark ? P.dCanvas : P.parchment) : 'transparent'
  const brd  = scrolled ? (isDark ? P.dHair : P.hair) : 'transparent'
  const lnk  = isDark ? P.dMuted : P.stone
  const lnkH = isDark ? P.dText : P.ink

  const navLinks = [
    { label: tx(lang,'Возможности','Imkoniyatlar','Features'), href: '#features' },
    { label: tx(lang,'Тарифы','Tariflar','Pricing'), href: '#pricing' },
    { label: tx(lang,'Как работает','Qanday ishlaydi','How it works'), href: '#how' },
    { label: tx(lang,'Отзывы','Fikrlar','Reviews'), href: '#reviews' },
  ]

  return (
    <header style={{ position:'fixed', top:0, left:0, right:0, zIndex:50,
      background: bg, borderBottom: `1px solid ${brd}`,
      transition: 'background 0.3s, border-color 0.3s',
      fontFamily: 'var(--font-golos), sans-serif' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px', height:64,
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <img src="/icon.svg" alt="Daromadchi" style={{ width:32, height:32, borderRadius:8 }} />
          <span style={{ fontWeight:700, fontSize:16, color: isDark ? P.dText : P.ink }}>
            Daromadchi
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex" style={{ alignItems:'center', gap:32 }}>
          {navLinks.map(n => (
            <a key={n.href} href={n.href}
              style={{ fontSize:15, fontWeight:500, color:lnk, textDecoration:'none', transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = lnkH)}
              onMouseLeave={e => (e.currentTarget.style.color = lnk)}>
              {n.label}
            </a>
          ))}
        </nav>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Lang picker */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setLangOpen(v => !v)}
              style={{ fontSize:12, fontWeight:600, color:lnk, background:'transparent', border:`1px solid ${isDark ? P.dHair : P.hair}`, borderRadius:6, padding:'5px 10px', cursor:'pointer' }}>
              {lang.toUpperCase()}
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                  style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background: isDark ? P.dCard : '#fff',
                    border:`1px solid ${isDark ? P.dHair : P.hair}`, borderRadius:8, overflow:'hidden', minWidth:56 }}>
                  {(['uz','ru','en'] as Lang[]).map(l => (
                    <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                      style={{ width:'100%', padding:'8px 12px', textAlign:'left', fontSize:13, fontWeight:600,
                        background: lang===l ? P.greenBg : 'transparent', color: lang===l ? P.green : (isDark ? P.dMuted : P.stone), cursor:'pointer', border:'none' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button onClick={toggle}
            style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
              background:'transparent', border:`1px solid ${isDark ? P.dHair : P.hair}`, borderRadius:6, cursor:'pointer', fontSize:16 }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <Link href="/login" className="hidden sm:flex"
            style={{ fontSize:14, fontWeight:500, color:lnk, textDecoration:'none', padding:'8px 12px' }}>
            {tx(lang,'Войти','Kirish','Sign in')}
          </Link>

          <Link href="/login"
            style={{ fontSize:14, fontWeight:600, background:P.green, color:'#fff',
              padding:'10px 20px', borderRadius:8, textDecoration:'none', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = P.greenDk)}
            onMouseLeave={e => (e.currentTarget.style.background = P.green)}>
            {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
          </Link>

          <button className="md:hidden" onClick={() => setMenuOpen(v => !v)}
            style={{ background:'none', border:'none', cursor:'pointer', color: isDark ? P.dText : P.ink, padding:4 }}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
            style={{ overflow:'hidden', background: isDark ? P.dCanvas : P.parchment, borderTop:`1px solid ${isDark ? P.dHair : P.hair}` }}>
            <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:4 }}>
              {navLinks.map(n => (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                  style={{ fontSize:16, fontWeight:500, color: isDark ? P.dMuted : P.stone, textDecoration:'none', padding:'12px 0',
                    borderBottom:`1px solid ${isDark ? P.dHair : P.hair}` }}>
                  {n.label}
                </a>
              ))}
              <Link href="/login" onClick={() => setMenuOpen(false)}
                style={{ marginTop:12, fontSize:15, fontWeight:600, background:P.green, color:'#fff',
                  padding:'14px', borderRadius:8, textDecoration:'none', textAlign:'center' }}>
                {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ─── HERO ALERT CARD ────────────────────────────────────────────────────────
function AlertCard({ marketplace, color, icon: Icon, title, sub, delay }:
  { marketplace:string; color:string; icon:React.ElementType; title:string; sub:string; delay:number }) {
  return (
    <motion.div
      initial={{ opacity:0, y:28 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.5, ease:[0.25,0.46,0.45,0.94] }}
      style={{
        background:'rgba(20,18,16,0.88)', backdropFilter:'blur(12px)',
        border:`1px solid rgba(255,255,255,0.1)`,
        borderLeft:`3px solid ${color}`,
        borderRadius:12,
        padding:'14px 18px',
        width:260,
        fontFamily:'var(--font-golos), sans-serif',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.45)', letterSpacing:'0.04em' }}>
          {marketplace}
        </span>
      </div>
      <p style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.92)', marginBottom:3 }}>{title}</p>
      <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{sub}</p>
    </motion.div>
  )
}

// ─── BENTO CARD ─────────────────────────────────────────────────────────────
function BentoCard({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  const isDark = useIsDark()
  const ref = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-60px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y:20 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}
      style={{
        background: isDark ? P.dCard : P.card,
        border:`1px solid ${isDark ? P.dHair : P.hair}`,
        borderRadius:16,
        padding:28,
        transition:'transform 0.2s, box-shadow 0.2s',
        cursor:'default',
        ...style,
      }}
      whileHover={{ y:-4, boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.1)' }}>
      {children}
    </motion.div>
  )
}

// ─── TESTIMONIAL CARD ───────────────────────────────────────────────────────
function TestCard({ quote, name, role, initials, avatarBg, accentColor }:
  { quote:string; name:string; role:string; initials:string; avatarBg:string; accentColor:string }) {
  const isDark = useIsDark()
  const ref = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-40px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y:18 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}
      style={{
        background: isDark ? P.dCard : '#fff',
        border:`1px solid ${isDark ? P.dHair : P.hair}`,
        borderLeft:`4px solid ${accentColor}`,
        borderRadius:12,
        padding:'28px 24px',
        display:'flex', flexDirection:'column', gap:20,
        fontFamily:'var(--font-golos), sans-serif',
      }}>
      {/* Stars */}
      <div style={{ display:'flex', gap:3 }}>
        {Array(5).fill(0).map((_,i) => (
          <svg key={i} width="14" height="14" fill={P.amber} viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        ))}
      </div>
      <p style={{ fontSize:15, lineHeight:1.65, color: isDark ? P.dMuted : P.stone, flex:1 }}>"{quote}"</p>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:avatarBg,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {initials}
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:700, color: isDark ? P.dText : P.ink }}>{name}</p>
          <p style={{ fontSize:12, color: isDark ? P.dMuted : P.stone, marginTop:2 }}>{role}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── PRICING CARD ───────────────────────────────────────────────────────────
function PriceCard({ name, price, priceLabel, features, cta, highlighted, badge, lang }:
  { name:string; price:string; priceLabel:string; features:string[]; cta:string;
    highlighted?:boolean; badge?:string; lang:string }) {
  const isDark = useIsDark()
  return (
    <div style={{
      position:'relative',
      background: highlighted
        ? (isDark ? '#1a2a1a' : '#f0f9f0')
        : (isDark ? P.dCard : '#fff'),
      border:`${highlighted ? '2px' : '1px'} solid ${highlighted ? P.green : (isDark ? P.dHair : P.hair)}`,
      borderRadius:16,
      padding: highlighted ? '32px 28px' : '28px 24px',
      display:'flex', flexDirection:'column', gap:20,
      transform: highlighted ? 'scale(1.04)' : 'scale(1)',
      fontFamily:'var(--font-golos), sans-serif',
    }}>
      {badge && (
        <span style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
          background:P.green, color:'#fff', fontSize:11, fontWeight:700,
          padding:'4px 14px', borderRadius:99, letterSpacing:'0.04em' }}>
          {badge}
        </span>
      )}
      <div>
        <p style={{ fontSize:13, fontWeight:600, color: isDark ? P.dMuted : P.stone, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>{name}</p>
        <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontSize:30, fontWeight:800, color: isDark ? P.dText : P.ink, fontFamily:'var(--font-mono-landing), monospace' }}>{price}</span>
          {priceLabel && <span style={{ fontSize:13, color: isDark ? P.dMuted : P.stone }}>{priceLabel}</span>}
        </div>
      </div>
      <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
        {features.map(f => (
          <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color: isDark ? P.dMuted : P.stone }}>
            <Check size={15} style={{ color:P.green, flexShrink:0, marginTop:2 }}/>
            {f}
          </li>
        ))}
      </ul>
      <Link href="/login"
        style={{ display:'block', textAlign:'center', fontSize:14, fontWeight:700,
          padding:'13px 20px', borderRadius:8, textDecoration:'none', transition:'all 0.15s',
          background: highlighted ? P.green : 'transparent',
          color: highlighted ? '#fff' : (isDark ? P.dText : P.ink),
          border: highlighted ? 'none' : `1.5px solid ${isDark ? P.dHair : P.hair}`,
          marginTop:'auto',
        }}>
        {cta}
      </Link>
    </div>
  )
}

// ─── SECTION HEADING ────────────────────────────────────────────────────────
function SectionHead({ badge, title, sub, isDark }: { badge:string; title:string; sub?:string; isDark:boolean }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-60px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y:16 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.5 }}
      style={{ marginBottom:48, fontFamily:'var(--font-golos), sans-serif' }}>
      <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase',
        color:P.green, display:'block', marginBottom:10 }}>{badge}</span>
      <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color: isDark ? P.dText : P.ink,
        lineHeight:1.12, letterSpacing:'-0.02em', margin:'0 0 12px' }}>
        {title}
      </h2>
      {sub && <p style={{ fontSize:16, color: isDark ? P.dMuted : P.stone, lineHeight:1.6, maxWidth:520 }}>{sub}</p>}
    </motion.div>
  )
}

// ─── MINI BAR CHART (for bento analytics card) ──────────────────────────────
function MiniBarChart({ isDark }: { isDark:boolean }) {
  const bars = [42,58,35,71,49,88,64,92,56,78,83,95]
  const hi = bars.length - 3
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:52 }}>
      {bars.map((h,i) => (
        <div key={i} style={{ flex:1, borderRadius:'3px 3px 0 0',
          height:`${h}%`,
          background: i >= hi ? P.green : (isDark ? 'rgba(22,163,74,0.2)' : 'rgba(22,163,74,0.18)'),
        }}/>
      ))}
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function Page() {
  const { theme } = useTheme()
  const { lang } = useLang()
  const isDark = theme === 'dark'

  const bg       = isDark ? P.dCanvas : P.parchment
  const text     = isDark ? P.dText   : P.ink
  const muted    = isDark ? P.dMuted  : P.stone
  const hair     = isDark ? P.dHair   : P.hair
  const cardBg   = isDark ? P.dCard   : '#fff'

  return (
    <div style={{ background:bg, color:text, fontFamily:'var(--font-golos), sans-serif', overflowX:'clip' }}>
      <Navbar lang={lang}/>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ position:'relative', minHeight:'100svh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', overflow:'hidden', paddingTop:64 }}>

        {/* Background photo */}
        <div style={{ position:'absolute', inset:0 }}>
          <Image
            src={HERO_PHOTO}
            alt="Warehouse worker packing orders"
            fill
            className="object-cover object-center"
            priority
            quality={90}
          />
          {/* Gradient overlay — ensures text readability over any photo */}
          <div style={{ position:'absolute', inset:0,
            background:'linear-gradient(to bottom, rgba(12,10,8,0.52) 0%, rgba(12,10,8,0.72) 55%, rgba(12,10,8,0.93) 100%)' }}/>
        </div>

        {/* Content */}
        <div style={{ position:'relative', zIndex:10, maxWidth:760, width:'100%', padding:'0 24px',
          display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:0 }}>

          {/* Marketplace chips */}
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}
            style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap', justifyContent:'center' }}>
            {[
              { label:'Uzum Market', color:P.uzum },
              { label:'Wildberries', color:P.wb },
              { label:'Yandex Market', color:P.yandex },
            ].map(mp => (
              <span key={mp.label} style={{ fontSize:11, fontWeight:600, letterSpacing:'0.03em',
                padding:'5px 12px', borderRadius:99,
                background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)',
                color:'rgba(255,255,255,0.85)' }}>
                <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%',
                  background:mp.color, marginRight:6, verticalAlign:'middle' }}/>
                {mp.label}
              </span>
            ))}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.55, delay:0.08 }}
            style={{ fontSize:'clamp(32px,6vw,64px)', fontWeight:900, color:'#fff', lineHeight:1.05,
              letterSpacing:'-0.03em', margin:'0 0 20px' }}>
            {tx(lang,
              'Продажи и аналитика —\nвсё на одном экране',
              'Savdo va analitika —\nhammasi bitta ekranda',
              'Sales & analytics —\nall on one screen'
            ).split('\n').map((line,i) => (
              <React.Fragment key={i}>{line}{i === 0 && <br/>}</React.Fragment>
            ))}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity:0, y:16 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.5, delay:0.2 }}
            style={{ fontSize:'clamp(15px,2vw,18px)', color:'rgba(255,255,255,0.7)',
              lineHeight:1.6, margin:'0 0 32px', maxWidth:560 }}>
            {tx(lang,
              'Управляйте Uzum, Wildberries и Yandex Market из одного кабинета. DRR, остатки, цены — всё в реальном времени.',
              "Uzum, Wildberries va Yandex Market'ni bitta kabinetan boshqaring.",
              'Manage Uzum, Wildberries and Yandex Market from one dashboard in real time.'
            )}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity:0, y:12 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.45, delay:0.32 }}
            style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginBottom:56 }}>
            <Link href="/login"
              style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700,
                background:P.green, color:'#fff', padding:'14px 28px', borderRadius:9, textDecoration:'none',
                transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = P.greenDk)}
              onMouseLeave={e => (e.currentTarget.style.background = P.green)}>
              {tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
              <ArrowRight size={16}/>
            </Link>
            <a href="#features"
              style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:15, fontWeight:500,
                color:'rgba(255,255,255,0.7)', textDecoration:'none', padding:'14px 4px',
                transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
              {tx(lang,'Посмотреть возможности','Imkoniyatlarni ko\'rish','See features')}
              <ChevronRight size={16}/>
            </a>
          </motion.div>

          {/* Alert cards */}
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
            <AlertCard
              marketplace="Uzum Market"
              color={P.uzum}
              icon={TrendingUp}
              title={tx(lang,'DRR вырос до 38%',"DRR 38% ga o'sdi",'DRR rose to 38%')}
              sub={tx(lang,'↑ на 6% за 24 часа','24 soat ichida +6%','+6% in 24 hours')}
              delay={0.55}
            />
            <AlertCard
              marketplace="Wildberries"
              color={P.wb}
              icon={AlertTriangle}
              title={tx(lang,'Остатки: 3 шт.','Qoldiq: 3 ta','Stock: 3 units')}
              sub={tx(lang,'Закончатся через ~2 дня','~2 kunda tugaydi','Runs out in ~2 days')}
              delay={0.7}
            />
            <AlertCard
              marketplace="Yandex Market"
              color={P.yandex}
              icon={DollarSign}
              title={tx(lang,'Прибыль: +12 400 сум','Foyda: +12 400 so\'m','Profit: +12,400 UZS')}
              sub={tx(lang,'Сегодня vs вчера','Bugun vs kecha','Today vs yesterday')}
              delay={0.85}
            />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <div style={{ borderTop:`1px solid ${hair}`, borderBottom:`1px solid ${hair}`,
        background: isDark ? P.dCard : P.card, padding:'14px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center',
          justifyContent:'center', gap:24, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:600, color:muted, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {tx(lang,'Работает с:','Quyidagilar bilan ishlaydi:','Integrates with:')}
          </span>
          <span style={{ color:muted, fontSize:13 }}>·</span>
          <span style={{ fontSize:15, fontWeight:800, color:P.uzum }}>Uzum Market</span>
          <span style={{ color:muted, fontSize:13 }}>·</span>
          <span style={{ fontSize:15, fontWeight:800, color:P.wb }}>Wildberries</span>
          <span style={{ color:muted, fontSize:13 }}>·</span>
          <span style={{ fontSize:15, fontWeight:800, color: isDark ? P.yandex : '#9A6B00' }}>Yandex Market</span>
          <span style={{ color:muted, fontSize:13, marginLeft:8 }}>·</span>
          <span style={{ fontSize:12, color:muted }}>
            {tx(lang,'Синхронизация в реальном времени','Real vaqtda sinxronlash','Real-time sync')}
          </span>
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" style={{ padding:'96px 24px', background: isDark ? P.dCanvas : P.parchment }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <SectionHead
            badge={tx(lang,'Как это работает','Qanday ishlaydi','How it works')}
            title={tx(lang,'Три шага — и вы видите всё',"Uch qadam — va hammasi ko'rinadi",'Three steps — see everything')}
            isDark={isDark}
          />

          {/* Steps */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, position:'relative' }}
            className="block sm:grid grid-cols-1 sm:grid-cols-3">

            {/* Connecting line (desktop) */}
            <div className="hidden sm:block" style={{ position:'absolute', top:36, left:'calc(16.66% + 16px)',
              right:'calc(16.66% + 16px)', height:2, background: isDark ? P.dHair : P.hair, zIndex:0 }}>
              <div style={{ position:'absolute', right:0, top:-4, width:0, height:0,
                borderLeft:`8px solid ${isDark ? P.dHair : P.hair}`,
                borderTop:'4px solid transparent', borderBottom:'4px solid transparent' }}/>
              <div style={{ position:'absolute', left:'50%', right:0, top:0, bottom:0,
                background: isDark ? P.dHair : P.hair }}/>
            </div>

            {[
              {
                n:'01', icon:Package,
                title: tx(lang,'Подключите магазины',"Do'konlarni ulang",'Connect your stores'),
                body: tx(lang,
                  'Добавьте API-ключи Uzum, Wildberries и Yandex Market. Занимает 5 минут. Ручной ввод не нужен.',
                  "Uzum, Wildberries va Yandex Market API kalitlarini qo'shing. 5 daqiqa vaqt oladi.",
                  'Add your API keys for all three marketplaces. Takes 5 minutes. No manual entry.')
              },
              {
                n:'02', icon:BarChart2,
                title: tx(lang,'Получайте аналитику',"Analitika oling",'Get analytics'),
                body: tx(lang,
                  'Все данные в одном дашборде: выручка, прибыль, DRR, средняя цена — обновляются каждый день.',
                  'Barcha ma\'lumotlar bitta joyda: daromad, foyda, DRR — har kuni yangilanib turadi.',
                  'All data in one dashboard: revenue, profit, DRR, average price — updated daily.')
              },
              {
                n:'03', icon:Bell,
                title: tx(lang,'Принимайте решения',"Qarorlar qabul qiling",'Make decisions'),
                body: tx(lang,
                  'Уведомления об изменении цен, предупреждения о низких остатках, анализ DRR — прямо в Telegram.',
                  "Narx o'zgarishlari, qoldiq ogohlantirishlari, DRR tahlili — to'g'ridan-to'g'ri Telegram'ga.",
                  'Price change alerts, low stock warnings, DRR analysis — sent directly to Telegram.')
              },
            ].map((step, i) => {
              const Icon = step.icon
              const ref = useRef(null)
              const inView = useInView(ref, { once:true, margin:'-40px' })
              return (
                <motion.div key={step.n} ref={ref}
                  initial={{ opacity:0, y:20 }}
                  animate={inView ? { opacity:1, y:0 } : {}}
                  transition={{ duration:0.45, delay:i * 0.1 }}
                  style={{ padding:'0 24px 0 0', position:'relative', zIndex:1 }}>
                  {/* Number badge */}
                  <div style={{ width:52, height:52, borderRadius:12,
                    background: P.greenBg, border:`1.5px solid rgba(22,163,74,0.2)`,
                    display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                    <Icon size={22} style={{ color:P.green }}/>
                  </div>
                  <p style={{ fontSize:11, fontWeight:700, color:P.green, letterSpacing:'0.1em',
                    textTransform:'uppercase', marginBottom:8 }}>{step.n}</p>
                  <h3 style={{ fontSize:18, fontWeight:800, color:text, marginBottom:10, letterSpacing:'-0.01em' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize:14, color:muted, lineHeight:1.65 }}>{step.body}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES BENTO ────────────────────────────────────────────────── */}
      <section id="features" style={{ padding:'96px 24px', background: isDark ? '#100e0c' : P.card }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <SectionHead
            badge={tx(lang,'Возможности','Imkoniyatlar','Features')}
            title={tx(lang,'Всё что нужно продавцу',"Sotuvchiga kerak bo'lgan hamma narsa",'Everything a seller needs')}
            isDark={isDark}
          />

          {/* Bento grid */}
          <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(12,1fr)' }}>

            {/* Card 1 — Unified Analytics (wide) */}
            <div style={{ gridColumn:'span 12', display:'grid', gridTemplateColumns:'7fr 5fr', gap:16 }}
              className="block sm:grid">
              <BentoCard>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:P.greenBg,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <BarChart2 size={18} style={{ color:P.green }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {tx(lang,'Единая аналитика',"Yagona analitika",'Unified analytics')}
                    </p>
                    <h3 style={{ fontSize:16, fontWeight:800, color:text, marginTop:2 }}>
                      {tx(lang,'Все 3 площадки — один экран',"3 ta platforma — bitta ekran",'All 3 platforms — one screen')}
                    </h3>
                  </div>
                </div>
                {/* Fake KPI row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                  {[
                    { l: tx(lang,'Выручка','Daromad','Revenue'), v:'124.5M', trend:'+12%', color:P.green },
                    { l: tx(lang,'Прибыль','Foyda','Profit'), v:'38.2M', trend:'+8%', color:P.uzum },
                    { l: tx(lang,'Заказы','Buyurtmalar','Orders'), v:'1 842', trend:'+5%', color:P.amber },
                  ].map(k => (
                    <div key={k.l} style={{ background: isDark ? P.dCanvas : P.parchment,
                      border:`1px solid ${hair}`, borderRadius:10, padding:'12px 14px' }}>
                      <p style={{ fontSize:10, color:muted, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.l}</p>
                      <p style={{ fontSize:18, fontWeight:800, color:text, fontFamily:'var(--font-mono-landing), monospace' }}>{k.v}</p>
                      <p style={{ fontSize:11, color:P.green, marginTop:3 }}>{k.trend}</p>
                    </div>
                  ))}
                </div>
                <MiniBarChart isDark={isDark}/>
                <p style={{ fontSize:11, color:muted, marginTop:8 }}>
                  {tx(lang,'Выручка за последние 12 дней (сум)',"So'nggi 12 kun daromadi (so'm)",'Revenue last 12 days (UZS)')}
                </p>
              </BentoCard>

              {/* Card 2 — Telegram */}
              <BentoCard>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:9,
                    background:'rgba(39,174,239,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Bell size={18} style={{ color:'#27AAEF' }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>Telegram</p>
                    <h3 style={{ fontSize:16, fontWeight:800, color:text, marginTop:2 }}>
                      {tx(lang,'Уведомления на телефон',"Telefonga bildirishnomalar",'Alerts on your phone')}
                    </h3>
                  </div>
                </div>
                {/* Telegram notification mockup */}
                <div style={{ background:'#17212B', borderRadius:12, padding:'12px 14px', fontFamily:'system-ui' }}>
                  <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#27AAEF',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:14 }}>📊</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:12, fontWeight:700, color:'#27AAEF', marginBottom:2 }}>Daromadchi</p>
                      <div style={{ background:'#1C2733', borderRadius:8, padding:'10px 12px' }}>
                        <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', lineHeight:1.5, margin:0 }}>
                          ⚠️ <b style={{ color:'#fff' }}>Wildberries</b><br/>
                          {tx(lang,'Остатки заканчиваются!',"Qoldiqlar tugayapti!",'Stock running low!')}<br/>
                          <span style={{ color:'#E8A000' }}>Арт. 18842 — 3 шт.</span>
                        </p>
                      </div>
                      <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4, textAlign:'right' }}>08:14 ✓✓</p>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>

            {/* Row 2 */}
            <div style={{ gridColumn:'span 12', display:'grid', gridTemplateColumns:'5fr 7fr', gap:16 }}
              className="block sm:grid">
              {/* Card 3 — Commissions */}
              <BentoCard>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:P.amberBg,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <DollarSign size={18} style={{ color:P.amber }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {tx(lang,'Юнит-экономика',"Yunit-iqtisod",'Unit economics')}
                    </p>
                    <h3 style={{ fontSize:16, fontWeight:800, color:text, marginTop:2 }}>
                      {tx(lang,'Комиссии и маржа',"Komissiya va marja",'Commissions & margin')}
                    </h3>
                  </div>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${hair}` }}>
                      <th style={{ textAlign:'left', color:muted, fontWeight:600, padding:'0 0 8px', fontSize:11, textTransform:'uppercase' }}>{tx(lang,'Категория','Kategoriya','Category')}</th>
                      <th style={{ textAlign:'right', color:muted, fontWeight:600, padding:'0 0 8px', fontSize:11, textTransform:'uppercase' }}>%</th>
                      <th style={{ textAlign:'right', color:muted, fontWeight:600, padding:'0 0 8px', fontSize:11, textTransform:'uppercase' }}>{tx(lang,'Маржа','Marja','Margin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat:'Электроника', pct:'18%', margin:'22%', mc:P.green },
                      { cat:'Одежда', pct:'23%', margin:'14%', mc:P.amber },
                      { cat:'Красота', pct:'15%', margin:'31%', mc:P.green },
                    ].map(r => (
                      <tr key={r.cat} style={{ borderBottom:`1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                        <td style={{ padding:'9px 0', color:text, fontSize:13 }}>{r.cat}</td>
                        <td style={{ padding:'9px 0', color:muted, textAlign:'right', fontFamily:'var(--font-mono-landing), monospace', fontSize:12 }}>{r.pct}</td>
                        <td style={{ padding:'9px 0', color:r.mc, textAlign:'right', fontWeight:700, fontFamily:'var(--font-mono-landing), monospace', fontSize:12 }}>{r.margin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </BentoCard>

              {/* Card 4 — Chrome Extension */}
              <BentoCard>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:P.greenBg,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Chrome size={18} style={{ color:P.green }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {tx(lang,'Расширение','Kengaytma','Extension')} Chrome
                    </p>
                    <h3 style={{ fontSize:16, fontWeight:800, color:text, marginTop:2 }}>
                      {tx(lang,'Данные прямо на сайте маркетплейса',"Ma'lumotlar to'g'ridan-to'g'ri saytda",'Data overlaid on marketplace pages')}
                    </h3>
                  </div>
                </div>
                {/* Browser mockup */}
                <div style={{ background: isDark ? '#0a0a0a' : '#f0f0f0', borderRadius:10, overflow:'hidden', border:`1px solid ${hair}` }}>
                  <div style={{ background: isDark ? '#1a1a1a' : '#e0e0e0', padding:'7px 10px', display:'flex', alignItems:'center', gap:6 }}>
                    {['#f87171','#fbbf24','#4ade80'].map(c => (
                      <div key={c} style={{ width:9, height:9, borderRadius:'50%', background:c }}/>
                    ))}
                    <div style={{ flex:1, background: isDark ? '#111' : '#d4d4d4', borderRadius:4, height:16, marginLeft:6, display:'flex', alignItems:'center', paddingLeft:8 }}>
                      <span style={{ fontSize:9, color:muted }}>uzum.uz/product/18842</span>
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px', position:'relative' }}>
                    <div style={{ display:'flex', gap:12 }}>
                      <div style={{ width:56, height:56, background: isDark ? '#2a2a2a' : '#e8e8e8', borderRadius:6, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ height:10, background: isDark ? '#2a2a2a' : '#ddd', borderRadius:4, marginBottom:6 }}/>
                        <div style={{ height:8, background: isDark ? '#222' : '#e8e8e8', borderRadius:4, width:'70%', marginBottom:6 }}/>
                        <div style={{ height:8, background: isDark ? '#222' : '#e8e8e8', borderRadius:4, width:'50%' }}/>
                      </div>
                      {/* Extension overlay widget */}
                      <div style={{ position:'absolute', right:10, top:10, background:P.green,
                        borderRadius:8, padding:'8px 10px', boxShadow:'0 4px 16px rgba(22,163,74,0.3)' }}>
                        <p style={{ fontSize:9, fontWeight:700, color:'#fff', lineHeight:1.3, whiteSpace:'nowrap' }}>
                          {tx(lang,'Ваша маржа','Marja','Your margin')}<br/>
                          <span style={{ fontSize:13, fontFamily:'var(--font-mono-landing), monospace' }}>31%</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>

            {/* Card 5 — Stock Alerts */}
            <div style={{ gridColumn:'span 12', display:'grid', gridTemplateColumns:'5fr 7fr', gap:16 }}
              className="block sm:grid">
              <BentoCard>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:P.redBg,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <AlertTriangle size={18} style={{ color:P.red }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {tx(lang,'Склад','Ombor','Warehouse')}
                    </p>
                    <h3 style={{ fontSize:16, fontWeight:800, color:text, marginTop:2 }}>
                      {tx(lang,'Остатки и предупреждения',"Qoldiqlar va ogohlantirishlar",'Stock & low-stock alerts')}
                    </h3>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { name: tx(lang,'Наушники BT-200','Quloqchin BT-200','Headphones BT-200'), stock:3, color:P.red },
                    { name: tx(lang,'Чехол iPhone 15','iPhone 15 qobig\'i','iPhone 15 case'), stock:7, color:P.amber },
                    { name: tx(lang,'Кабель USB-C','USB-C kabel','USB-C cable'), stock:22, color:P.green },
                  ].map(item => (
                    <div key={item.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 12px', background: isDark ? P.dCanvas : P.parchment,
                      border:`1px solid ${hair}`, borderRadius:8 }}>
                      <span style={{ fontSize:13, color:text, maxWidth:'60%' }}>{item.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:item.color,
                        fontFamily:'var(--font-mono-landing), monospace' }}>
                        {item.stock} {tx(lang,'шт.','ta','pcs.')}
                      </span>
                    </div>
                  ))}
                </div>
              </BentoCard>

              {/* Stats / empty bento space — filled with a trust stat block */}
              <BentoCard style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', gap:24 }}>
                <div>
                  <p style={{ fontSize:11, fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:16 }}>
                    {tx(lang,'Почему Daromadchi',"Nima uchun Daromadchi",'Why Daromadchi')}
                  </p>
                  <h3 style={{ fontSize:20, fontWeight:900, color:text, lineHeight:1.2, letterSpacing:'-0.02em' }}>
                    {tx(lang,
                      'Инструмент, сделанный для реальных продавцов',
                      "Haqiqiy sotuvchilar uchun yaratilgan vosita",
                      'A tool built for real sellers'
                    )}
                  </h3>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[
                    { v:'3+', l: tx(lang,'маркетплейса','marketplace','marketplaces') },
                    { v:'5 мин', l: tx(lang,'в день','kuniga','per day') },
                    { v:'100%', l: tx(lang,'автосинхронизация','avtosink','auto-sync') },
                    { v:'0', l: tx(lang,'ручного ввода','qo\'l kiritish','manual entry') },
                  ].map(s => (
                    <div key={s.l}>
                      <p style={{ fontSize:28, fontWeight:900, color:P.green, fontFamily:'var(--font-mono-landing), monospace', marginBottom:2 }}>{s.v}</p>
                      <p style={{ fontSize:12, color:muted }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </BentoCard>
            </div>

          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section id="reviews" style={{ padding:'96px 24px', background: isDark ? P.dCanvas : P.parchment }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <SectionHead
            badge={tx(lang,'Отзывы продавцов',"Sotuvchilar fikri",'Seller reviews')}
            title={tx(lang,'Что говорят продавцы',"Sotuvchilar nima deydi",'What sellers say')}
            isDark={isDark}
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}
            className="grid grid-cols-1 sm:grid-cols-3">
            <TestCard
              quote={tx(lang,
                'Раньше открывал три вкладки каждое утро. Теперь один экран — и я уже знаю, что делать сегодня.',
                "Avval har kuni ertalab uchta tabni ochrardim. Endi bitta ekran — va nima qilishni bilaman.",
                'Used to open three tabs every morning. Now one screen — and I already know what to do today.'
              )}
              name="Азиз Каримов" role={tx(lang,'Uzum и Wildberries, 3 года','Uzum va Wildberries, 3 yil','Uzum & Wildberries, 3 years')}
              initials="АК" avatarBg={P.uzum} accentColor={P.uzum}
            />
            <TestCard
              quote={tx(lang,
                'Уведомление о снижении цены конкурента пришло в 7 утра. К 8 утра я уже отреагировал. Это реально работает.',
                "Raqib narx pasayishi haqida bildirishnoma soat 7 da keldi. Soat 8 ga kelib javob berdim.",
                'Got a competitor price drop alert at 7am. By 8am I had already responded. This really works.'
              )}
              name="Нилуфар Рашидова" role={tx(lang,'Косметика и уход, Ташкент','Kosmetika, Toshkent','Cosmetics, Tashkent')}
              initials="НР" avatarBg={P.wb} accentColor={P.wb}
            />
            <TestCard
              quote={tx(lang,
                'Комиссии Yandex Market всегда путали. Теперь вижу маржу по каждому товару сразу.',
                "Yandex Market komissiyalari doim chalkashtirar edi. Endi har bir tovar bo'yicha marja ko'rinadi.",
                'Yandex Market commissions always confused me. Now I see the margin per SKU instantly.'
              )}
              name="Санжар Усмонов" role={tx(lang,'Электроника, Самарканд','Elektronika, Samarqand','Electronics, Samarkand')}
              initials="СУ" avatarBg="#9A6B00" accentColor={P.yandex}
            />
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding:'96px 24px', background: isDark ? '#100e0c' : P.card }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <SectionHead
            badge={tx(lang,'Тарифы','Tariflar','Pricing')}
            title={tx(lang,'Прозрачные цены','Shaffof narxlar','Transparent pricing')}
            isDark={isDark}
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, alignItems:'start' }}
            className="grid grid-cols-1 sm:grid-cols-3">
            <PriceCard
              name={tx(lang,'Бесплатно','Bepul','Free')}
              price={tx(lang,'0 сум','0 so\'m','0 UZS')}
              priceLabel=""
              features={[
                tx(lang,'1 маркетплейс','1 ta marketplace','1 marketplace'),
                tx(lang,'Базовая аналитика','Asosiy analitika','Basic analytics'),
                tx(lang,'До 100 заказов/мес','100 ta buyurtma/oy','Up to 100 orders/mo'),
                tx(lang,'Обновление раз в день','Kuniga bir marta yangilanish','Updates once per day'),
              ]}
              cta={tx(lang,'Начать бесплатно','Bepul boshlash','Start free')}
              lang={lang}
            />
            <PriceCard
              name="Pro"
              price="149 000"
              priceLabel={tx(lang,'сум/мес','so\'m/oy','UZS/mo')}
              features={[
                tx(lang,'Все 3 маркетплейса','Barcha 3 marketplace','All 3 marketplaces'),
                tx(lang,'Полная аналитика + DRR','To\'liq analitika + DRR','Full analytics + DRR'),
                tx(lang,'Безлимит заказов','Cheksiz buyurtmalar','Unlimited orders'),
                tx(lang,'Telegram-уведомления','Telegram bildirishnomalari','Telegram alerts'),
                tx(lang,'Обновление ежечасно','Har soatda yangilanish','Hourly updates'),
              ]}
              cta={tx(lang,'Попробовать Pro','Pro sinash','Try Pro')}
              highlighted
              badge={tx(lang,'Популярный','Mashhur','Popular')}
              lang={lang}
            />
            <PriceCard
              name="Pro+"
              price="349 000"
              priceLabel={tx(lang,'сум/мес','so\'m/oy','UZS/mo')}
              features={[
                tx(lang,'Всё из Pro','Pro\'dan hamma narsa','Everything in Pro'),
                tx(lang,'Chrome расширение','Chrome kengaytma','Chrome extension'),
                tx(lang,'Юнит-экономика по SKU','SKU bo\'yicha yunit-iqtisod','Unit economics per SKU'),
                tx(lang,'Приоритетная поддержка','Ustuvor qo\'llab-quvvatlash','Priority support'),
                tx(lang,'API доступ','API kirish','API access'),
              ]}
              cta={tx(lang,'Начать с Pro+','Pro+ boshlash','Start with Pro+')}
              lang={lang}
            />
          </div>
          <p style={{ textAlign:'center', fontSize:13, color:muted, marginTop:28 }}>
            {tx(lang,'Без скрытых комиссий. Отмена в любой момент.','Yashirin komissiyalar yo\'q. Istalgan vaqtda bekor qilish.','No hidden fees. Cancel anytime.')}
          </p>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section style={{ position:'relative', padding:'100px 24px', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0 }}>
          <Image
            src={CTA_PHOTO}
            alt=""
            fill
            className="object-cover object-center"
            quality={80}
          />
          <div style={{ position:'absolute', inset:0, background:'rgba(10,8,6,0.85)' }}/>
        </div>
        <div style={{ position:'relative', zIndex:10, maxWidth:640, margin:'0 auto', textAlign:'center' }}>
          <motion.h2
            initial={{ opacity:0, y:20 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.5 }}
            style={{ fontSize:'clamp(28px,5vw,48px)', fontWeight:900, color:'#fff',
              lineHeight:1.1, letterSpacing:'-0.03em', margin:'0 0 16px' }}>
            {tx(lang,
              'Начните управлять продажами уже сегодня',
              "Bugun sotuvlarni boshqarishni boshlang",
              'Start managing your sales today'
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity:0, y:12 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.45, delay:0.12 }}
            style={{ fontSize:17, color:'rgba(255,255,255,0.65)', lineHeight:1.6, margin:'0 0 36px' }}>
            {tx(lang,
              '3 дня бесплатно. Без карты. Без обязательств.',
              "3 kun bepul. Kartsiz. Majburiyatsiz.",
              '3 days free. No card. No commitment.'
            )}
          </motion.p>
          <motion.div
            initial={{ opacity:0, y:8 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.4, delay:0.22 }}>
            <Link href="/login"
              style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:16, fontWeight:700,
                background:P.green, color:'#fff', padding:'16px 36px', borderRadius:10, textDecoration:'none',
                transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = P.greenDk)}
              onMouseLeave={e => (e.currentTarget.style.background = P.green)}>
              {tx(lang,'Попробовать бесплатно','Bepul sinab ko\'rish','Try free')}
              <ArrowRight size={18}/>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background: isDark ? '#0a0806' : '#1C1917', padding:'64px 24px 32px', fontFamily:'var(--font-golos), sans-serif' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.5fr', gap:40, marginBottom:56 }}
            className="grid grid-cols-1 sm:grid-cols-4">
            {/* Col 1 — logo + tagline */}
            <div>
              <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginBottom:14 }}>
                <img src="/icon.svg" alt="Daromadchi" style={{ width:32, height:32, borderRadius:8 }}/>
                <span style={{ fontWeight:700, fontSize:16, color:'#F2EFE8' }}>Daromadchi</span>
              </Link>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.6 }}>
                {tx(lang,
                  'Аналитика для продавцов Uzum, Wildberries и Yandex Market.',
                  "Uzum, Wildberries va Yandex Market sotuvchilari uchun analitika.",
                  'Analytics for Uzum, Wildberries and Yandex Market sellers.'
                )}
              </p>
            </div>

            {/* Col 2 — Product */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase',
                letterSpacing:'0.1em', marginBottom:16 }}>
                {tx(lang,'Продукт','Mahsulot','Product')}
              </p>
              {[
                { label: tx(lang,'Возможности','Imkoniyatlar','Features'), href:'#features' },
                { label: tx(lang,'Тарифы','Tariflar','Pricing'), href:'#pricing' },
                { label: tx(lang,'Как работает','Qanday ishlaydi','How it works'), href:'#how' },
                { label: tx(lang,'Помощь','Yordam','Help'), href:'/help' },
              ].map(l => (
                <a key={l.href} href={l.href}
                  style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.5)', textDecoration:'none',
                    marginBottom:10, transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
                  {l.label}
                </a>
              ))}
            </div>

            {/* Col 3 — Company */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase',
                letterSpacing:'0.1em', marginBottom:16 }}>
                {tx(lang,'Компания','Kompaniya','Company')}
              </p>
              {[
                { label: tx(lang,'О нас','Biz haqimizda','About'), href:'/help' },
                { label: tx(lang,'Блог','Blog','Blog'), href:'/help' },
                { label: tx(lang,'Политика конфиденциальности','Maxfiylik siyosati','Privacy'), href:'/help' },
                { label: tx(lang,'Условия использования','Foydalanish shartlari','Terms'), href:'/help' },
              ].map(l => (
                <a key={l.label} href={l.href}
                  style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.5)', textDecoration:'none',
                    marginBottom:10, transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
                  {l.label}
                </a>
              ))}
            </div>

            {/* Col 4 — Contact */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase',
                letterSpacing:'0.1em', marginBottom:16 }}>
                {tx(lang,'Контакты','Aloqa','Contact')}
              </p>
              <a href="https://t.me/daromadchi" target="_blank" rel="noopener"
                style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, color:'rgba(255,255,255,0.5)',
                  textDecoration:'none', marginBottom:10, transition:'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#27AAEF')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
                <span style={{ fontSize:16 }}>✈</span> Telegram
              </a>
              <a href="mailto:support@daromadchi.uz"
                style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, color:'rgba(255,255,255,0.5)',
                  textDecoration:'none', marginBottom:10, transition:'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
                <span style={{ fontSize:16 }}>✉</span> support@daromadchi.uz
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24,
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>
              © 2025 Daromadchi. {tx(lang,'Все права защищены.','Barcha huquqlar himoyalangan.','All rights reserved.')}
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                {tx(lang,'Работает с:','Bilan ishlaydi:','Works with:')}
              </span>
              <span style={{ fontSize:13, fontWeight:700, color:P.uzum }}>Uzum</span>
              <span style={{ color:'rgba(255,255,255,0.2)', fontSize:11 }}>·</span>
              <span style={{ fontSize:13, fontWeight:700, color:P.wb }}>WB</span>
              <span style={{ color:'rgba(255,255,255,0.2)', fontSize:11 }}>·</span>
              <span style={{ fontSize:13, fontWeight:700, color:P.yandex }}>Yandex</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
