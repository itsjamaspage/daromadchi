'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BarChart2, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  Sparkles, Sun, Moon, Globe, X, Menu,
  Star, CheckCircle, Activity,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

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
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useCounter(value, 2000, inView)
  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}<span style={{ color: 'var(--c1)' }}>{suffix}</span>
    </span>
  )
}

function DashboardMockup({ p }: { p: typeof translations.en.preview }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const bg = isDark ? '#071425' : '#ffffff'
  const bg2 = isDark ? '#0b1c34' : '#f0f4ff'
  const border = isDark ? 'rgba(0,210,255,0.14)' : 'rgba(100,100,200,0.18)'
  const muted = isDark ? '#4a7a9b' : '#6b7a9b'
  const c1 = isDark ? '#00d4ff' : '#7c3aed'
  const c2 = isDark ? '#ff2d9b' : '#db2777'

  const kpis = [
    { l: p.revenue, v: '124.5M', color: c1 },
    { l: p.profit, v: '38.2M', color: '#22c55e' },
    { l: p.orders, v: '1,842', color: c2 },
    { l: p.stock, v: '3,410', color: '#f59e0b' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: bg2, borderColor: border }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/80" />
          <div className="w-3 h-3 rounded-full bg-amber-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 h-5 mx-3 rounded-md border flex items-center px-3"
          style={{ background: isDark ? '#0f2040' : '#e8eeff', borderColor: border }}>
          <span className="text-[10px]" style={{ color: muted }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-3 h-3 text-green-400" />
      </div>
      {/* Content */}
      <div className="p-5 space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.l} className="rounded-xl p-3 border" style={{ background: bg2, borderColor: border }}>
              <p className="text-[9px] mb-1" style={{ color: muted }}>{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.color }}>{k.v}</p>
              <p className="text-green-400 text-[9px] mt-0.5">↑ 12.4%</p>
            </div>
          ))}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded-xl p-4 border" style={{ background: bg2, borderColor: border }}>
            <p className="text-[10px] mb-3 font-medium" style={{ color: muted }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-1 h-20">
              {[30,50,38,70,45,82,60,88,72,55,78,92,65,80].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{
                  height: `${h}%`,
                  background: isDark ? 'linear-gradient(to top,#00d4ffcc,#00d4ff22)' : 'linear-gradient(to top,#7c3aedcc,#7c3aed22)'
                }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-4 border flex flex-col" style={{ background: bg2, borderColor: border }}>
            <p className="text-[10px] mb-3 font-medium" style={{ color: muted }}>{p.categories}</p>
            <div className="relative w-16 h-16 mx-auto">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke={isDark ? 'rgba(0,210,255,0.15)' : 'rgba(124,58,237,0.15)'} strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c1} strokeWidth="4" strokeDasharray="38 50" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c2} strokeWidth="4" strokeDasharray="22 66" strokeDashoffset="-38" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="14 74" strokeDashoffset="-60" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
        {/* Mini table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
          <div className="flex items-center justify-between px-4 py-2 border-b text-[9px] font-semibold" style={{ background: bg2, borderColor: border, color: muted }}>
            <span>Recent Orders</span><span>Status</span>
          </div>
          {[['DEMO-183','Delivered','#22c55e'],['DEMO-184','Processing','#f59e0b'],['DEMO-185','Delivered','#22c55e']].map(([id, st, col]) => (
            <div key={id} className="flex items-center justify-between px-4 py-2 border-b text-[9px]" style={{ borderColor: border, color: muted }}>
              <span style={{ color: isDark ? '#a8c8e0' : '#3b3f6e' }}>{id}</span>
              <span style={{ color: col as string }}>{st}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockupInteractive({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 180, damping: 22 })
  const springY = useSpring(rotateY, { stiffness: 180, damping: 22 })

  useEffect(() => {
    if (hovering) return
    let frame: number
    let t = 0
    const loop = () => {
      t += 0.007
      rotateY.set(Math.sin(t) * 13)
      rotateX.set(Math.cos(t * 1.5) * 7)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [hovering, rotateX, rotateY])

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    rotateY.set(((e.clientX - cx) / (rect.width / 2)) * 22)
    rotateX.set(-((e.clientY - cy) / (rect.height / 2)) * 16)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 900, cursor: 'crosshair' }}
    >
      {children}
    </motion.div>
  )
}

type FeatureItem = { id: string; title: string; desc: string; iconIndex: number }

function SortableFeatureCard({
  item, isDark, card, overlay = false
}: { item: FeatureItem; isDark: boolean; card: string; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const icons = [BarChart2, Calculator, AlertTriangle, FileText, RefreshCw, DollarSign]
  const Icon = icons[item.iconIndex]

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="feature-card group relative rounded-2xl p-9 border overflow-hidden select-none"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !overlay ? 0.35 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        background: card,
        borderColor: isDragging ? 'var(--c1)' : 'var(--border)',
        boxShadow: isDragging ? '0 20px 60px rgba(0,0,0,0.4)' : undefined,
      }}
    >
      {/* shimmer sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: 'shimmerSweep 0.6s ease forwards',
        }}
      />
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
        style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(124,58,237,0.08)', border: '1px solid var(--border2)' }}>
        <Icon className="w-5 h-5" style={{ color: 'var(--c1)' }} />
      </div>
      <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-base)' }}>{item.title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
    </div>
  )
}

export default function LandingPage() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const t = translations[lang]
  const isDark = theme === 'dark'

  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })
  const howRef = useRef(null)
  const howInView = useInView(howRef, { once: true, margin: '-80px' })
  const pricingRef = useRef(null)
  const pricingInView = useInView(pricingRef, { once: true, margin: '-80px' })
  const ctaRef = useRef(null)
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' })

  const langs: Lang[] = ['uz', 'ru', 'en']
  const card = isDark ? 'var(--bg-card)' : '#ffffff'

  const [featureItems, setFeatureItems] = useState<FeatureItem[]>(() =>
    t.features.map((f: { title: string; desc: string }, i: number) => ({ id: `feat-${i}`, title: f.title, desc: f.desc, iconIndex: i }))
  )
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(e.active.id as string)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = e
    if (over && active.id !== over.id) {
      setFeatureItems(items => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const wordAnim = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
    })
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/icon.svg" alt="Daromadchi" className="w-8 h-8 rounded-xl" />
            <span className="font-bold text-base" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: '#features', label: t.nav.features },
              { href: '#how', label: t.nav.how },
              { href: '#pricing', label: t.nav.pricing },
              { href: '/help', label: t.nav.help },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="text-sm font-medium transition-opacity opacity-60 hover:opacity-100"
                style={{ color: 'var(--text-base)' }}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div ref={langRef} className="relative">
              <button onClick={() => setLangOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                <Globe className="w-3 h-3" /> {lang.toUpperCase()}
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden border shadow-lg z-50"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', minWidth: '4rem' }}>
                    {langs.map(l => (
                      <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                        className="w-full px-3 py-2 text-xs font-semibold uppercase text-left"
                        style={{ background: lang === l ? 'rgba(0,212,255,0.08)' : 'transparent', color: lang === l ? 'var(--c1)' : 'var(--text-muted)' }}>
                        {l}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-500" />}
            </button>
            <Link href="/login" className="hidden sm:block text-sm font-medium px-4 py-1.5 opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-base)' }}>
              {t.nav.login}
            </Link>
            <Link href="/login" className="text-sm font-bold px-5 py-2 rounded-xl text-white"
              style={{ background: 'var(--c1)' }}>
              {t.nav.start}
            </Link>
            <button className="md:hidden p-1.5 rounded-lg" onClick={() => setMenuOpen(v => !v)}
              style={{ color: 'var(--text-muted)' }}>
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }} className="md:hidden border-t overflow-hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--nav-bg)' }}>
              <div className="px-6 py-4 flex flex-col gap-1">
                {[
                  { label: t.nav.features, href: '#features' },
                  { label: t.nav.how, href: '#how' },
                  { label: t.nav.pricing, href: '#pricing' },
                  { label: t.nav.help, href: '/help' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} onClick={() => setMenuOpen(false)}
                    className="text-sm py-2.5 font-medium opacity-70" style={{ color: 'var(--text-base)' }}>
                    {label}
                  </a>
                ))}
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="mt-3 text-sm font-bold py-3 text-center rounded-xl text-white"
                  style={{ background: 'var(--c1)' }}>
                  {t.nav.start}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO: mockup LEFT (bigger), text RIGHT */}
      <section className="relative min-h-screen flex items-center pt-16 pb-0 overflow-hidden">
        {/* BG gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: isDark
            ? 'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(0,212,255,0.10) 0%, transparent 60%), radial-gradient(ellipse 40% 50% at 100% 80%, rgba(255,45,155,0.07) 0%, transparent 55%)'
            : 'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(124,58,237,0.08) 0%, transparent 60%)'
        }} />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center py-12">
          {/* LEFT: Dashboard (bigger) */}
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative order-2 lg:order-1"
          >
            {/* Glow blob behind */}
            <div className="absolute -inset-8 rounded-3xl blur-3xl opacity-30 pointer-events-none animate-pulse-glow"
              style={{ background: isDark ? 'radial-gradient(ellipse at 40% 50%, #00d4ff, transparent 65%)' : 'radial-gradient(ellipse at 40% 50%, #7c3aed, transparent 65%)' }} />
            {/* Interactive 3D mockup */}
            <MockupInteractive>
              <DashboardMockup p={t.preview} />
            </MockupInteractive>
            {/* Floating stat badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -bottom-4 -right-4 rounded-2xl px-4 py-3 border shadow-xl hidden md:block"
              style={{ background: isDark ? '#0b1c34' : '#fff', borderColor: isDark ? 'rgba(0,212,255,0.2)' : 'rgba(124,58,237,0.2)' }}>
              <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Monthly revenue</p>
              <p className="font-extrabold text-lg" style={{ color: 'var(--c1)' }}>↑ 38.4%</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute -top-4 -right-2 rounded-2xl px-3 py-2 border shadow-xl hidden md:block"
              style={{ background: isDark ? '#0b1c34' : '#fff', borderColor: isDark ? 'rgba(0,212,255,0.2)' : 'rgba(124,58,237,0.2)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[10px] font-semibold" style={{ color: 'var(--text-base)' }}>Live sync</p>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT: Copy */}
          <div className="flex flex-col gap-6 order-1 lg:order-2">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-5 border"
                  style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(124,58,237,0.07)', borderColor: 'var(--border2)', color: 'var(--c1)' }}>
                  <Sparkles className="w-3 h-3" /> Uzum · Yandex Market · Wildberries
                </span>
              </motion.div>

              {/* Animated headline word-by-word */}
              <div className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-5 overflow-hidden"
                style={{ color: 'var(--text-base)' }}>
                {t.hero.landingTitle.split(' ').map((word, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={wordAnim}
                    initial="hidden"
                    animate="visible"
                    className="inline-block mr-[0.25em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>

              <motion.p
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.4 } } }}
                className="text-base sm:text-lg leading-relaxed mb-2"
                style={{ color: 'var(--text-muted)' }}>
                {t.hero.landingSubtitle}
              </motion.p>
              <motion.p
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.5 } } }}
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                {lang === 'uz'
                  ? "Har kuni 5 daqiqada sotuvlaringizni nazorat qiling. Raqiblar narxini kuzating, DRR hisobini avtomatlashtiring va foydani oshiring."
                  : lang === 'ru'
                  ? "5 минут в день — и вы контролируете все продажи. Следите за ценами конкурентов, автоматизируйте DRR и увеличивайте прибыль."
                  : "5 minutes a day keeps you in full control. Monitor competitor prices, automate DRR calculations and grow your margins."}
              </motion.p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3">
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 font-bold px-8 py-3.5 rounded-xl text-sm text-white"
                style={{ background: 'var(--c1)', boxShadow: isDark ? '0 6px 28px rgba(0,212,255,0.4)' : '0 6px 28px rgba(124,58,237,0.35)' }}>
                {t.trialFreeStart} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/help"
                className="inline-flex items-center justify-center gap-2 font-medium px-8 py-3.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                {t.nav.explorePlatform}
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
              className="flex items-center gap-10 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {[
                { value: 6, suffix: '+', label: t.stats[0].label },
                { value: 30, suffix: 's', label: t.stats[1].label },
                { value: 100, suffix: '%', label: t.stats[2].label },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.1, type: 'spring', stiffness: 200 }}>
                  <div className="text-2xl font-extrabold" style={{ color: 'var(--text-base)' }}>
                    <StatNum value={s.value} suffix={s.suffix} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="py-3 overflow-hidden border-y"
        style={{ borderColor: 'var(--border)', background: isDark ? 'rgba(0,212,255,0.02)' : 'rgba(124,58,237,0.02)' }}>
        <div className="animate-ticker flex gap-12 whitespace-nowrap text-xs font-medium">
          {Array(4).fill(null).flatMap((_, gi) => [
            <span key={`${gi}a`} style={{ color: 'var(--c1)' }}>● Uzum Market API</span>,
            <span key={`${gi}b`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;{t.tickerItems[0]}&nbsp;·&nbsp;</span>,
            <span key={`${gi}c`} style={{ color: 'var(--c2)' }}>● Wildberries</span>,
            <span key={`${gi}d`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;{t.tickerItems[1]}&nbsp;·&nbsp;</span>,
            <span key={`${gi}e`} style={{ color: 'var(--c1)' }}>● Yandex Market</span>,
            <span key={`${gi}f`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;{t.tickerItems[2]}&nbsp;·&nbsp;</span>,
          ])}
        </div>
      </div>

      {/* VALUE PROP */}
      <section className="py-24 px-6" style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--c1)' }}>{t.valuePropBadge}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text-base)' }}>{t.valuePropTitle}</h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.valuePropSubtitle}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {t.valueProps.map((c, i) => (
              <motion.div key={c.title}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl p-7 border cursor-default" style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="text-4xl mb-4">{c.icon}</div>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-base)' }}>{c.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" ref={featuresRef} className="py-24 px-6" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold mb-4 border"
              style={{ background: isDark ? 'rgba(0,212,255,0.06)' : 'rgba(124,58,237,0.06)', borderColor: 'var(--border2)', color: 'var(--c1)' }}>
              <Sparkles className="w-3 h-3" /> {t.featuresBadge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text-base)' }}>{t.featuresTitle}</h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>{t.featuresSubtitle}</p>
          </motion.div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={featureItems.map(i => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featureItems.map(item => (
                  <SortableFeatureCard key={item.id} item={item} isDark={isDark} card={card} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragId ? (
                <SortableFeatureCard
                  item={featureItems.find(i => i.id === activeDragId)!}
                  isDark={isDark}
                  card={card}
                  overlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" ref={howRef} className="py-24 px-6" style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={howInView ? { opacity: 1, y: 0 } : {}}
            className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold mb-4 border"
              style={{ background: isDark ? 'rgba(255,45,155,0.06)' : 'rgba(219,39,119,0.06)', borderColor: 'var(--c2)', color: 'var(--c2)' }}>
              <Zap className="w-3 h-3" /> {t.howBadge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="grad-text">{t.howTitle2}</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -60 : 60 }} animate={howInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.5, ease: 'easeOut' }}
                whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
                className="rounded-2xl p-9 border cursor-default" style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold mb-5 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                  0{i + 1}
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-base)' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" ref={pricingRef} className="py-24 px-6" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--text-base)' }}>{t.nav.pricing}</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {([
              { name: t.pricingFree, price: '0', highlight: false, features: t.pricingFreeFeatures },
              { name: 'Pro', price: '300 000', highlight: true, features: t.pricingProFeatures },
              { name: 'Pro+', price: '600 000', highlight: false, features: t.pricingProPlusFeatures },
            ] as const).map((plan, i) => (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: 20 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="rounded-2xl p-7 border relative cursor-default"
                style={{ background: plan.highlight ? (isDark ? 'rgba(0,212,255,0.05)' : 'rgba(124,58,237,0.05)') : card, borderColor: plan.highlight ? 'var(--c1)' : 'var(--border)' }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                    {t.pricingPopular}
                  </div>
                )}
                <h3 className="font-extrabold text-lg mb-1" style={{ color: 'var(--text-base)' }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold" style={{ color: 'var(--text-base)' }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>so&apos;m/oy</span>
                </div>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--c1)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full text-center py-3 rounded-xl text-sm font-bold"
                  style={plan.highlight
                    ? { background: 'linear-gradient(135deg, var(--c1), var(--c2))', color: '#fff' }
                    : { background: 'var(--bg-input)', color: 'var(--text-dim)', border: '1px solid var(--border2)' }}>
                  {t.nav.start}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24" style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12 px-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--text-base)' }}>{t.testimonialsTitle}</h2>
        </motion.div>
        <div className="overflow-hidden">
          <div className="animate-ticker-cards flex gap-5 w-max px-6">
            {[...(t.testimonialsList ?? []), ...(t.testimonialsList ?? [])].map((review, i) => (
              <div key={i} className="flex-shrink-0 w-80 rounded-2xl p-7 border" style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-0.5 mb-4">
                  {Array(5).fill(0).map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>&ldquo;{review.text}&rdquo;</p>
                <p className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>{review.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{review.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section ref={ctaRef} className="py-24 px-6 border-t" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={ctaInView ? { opacity: 1, y: 0 } : {}}>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5" style={{ color: 'var(--text-base)' }}>
              {t.ctaTitle1} <span className="grad-text">{t.ctaTitle2}</span>
            </h2>
            <p className="text-base mb-9 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.ctaSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 text-white font-bold px-9 py-3.5 rounded-xl text-sm"
                style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                {t.hero.cta} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/help"
                className="inline-flex items-center justify-center font-medium px-9 py-3.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                {t.hero.demo}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PRE-FOOTER FREE TRIAL BANNER */}
      <div className="py-12 px-6 border-t" style={{ background: isDark ? '#020c1a' : '#1a1a2e', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xl font-extrabold text-white mb-1">{t.trialFree}</p>
            <p className="text-sm" style={{ color: '#6b8199' }}>
              {lang === 'uz' ? "Hech qanday kredit karta talab qilinmaydi." : lang === 'ru' ? "Кредитная карта не требуется." : "No credit card required."}
            </p>
          </div>
          <Link href="/login"
            className="shrink-0 inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-xl text-sm text-white"
            style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
            {t.nav.start} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#0a0a14' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <img src="/icon.svg" alt="Daromadchi" className="w-10 h-10 rounded-xl" />
                <span className="font-extrabold text-lg text-white">Daromadchi</span>
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: '#4a6275' }}>
                {lang === 'uz' ? "Uzum Market, Yandex Market va Wildberries sotuvchilari uchun analitika platformasi." :
                  lang === 'ru' ? "Платформа аналитики для продавцов Uzum Market, Yandex Market и Wildberries." :
                    "Analytics platform for Uzum Market, Yandex Market and Wildberries sellers."}
              </p>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest mb-5 text-white">
                {lang === 'uz' ? 'Platforma' : lang === 'ru' ? 'Платформа' : 'Platform'}
              </p>
              <div className="space-y-3">
                {[
                  { href: '#features', label: t.nav.features },
                  { href: '#how', label: t.nav.how },
                  { href: '#pricing', label: t.nav.pricing },
                  { href: '/login', label: t.nav.start },
                ].map(l => (
                  <a key={l.href} href={l.href} className="block text-sm hover:text-white transition-colors" style={{ color: '#6b8299' }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest mb-5 text-white">
                {lang === 'uz' ? 'Resurslar' : lang === 'ru' ? 'Ресурсы' : 'Resources'}
              </p>
              <div className="space-y-3">
                {[
                  { href: '/help', label: t.nav.help },
                  { href: '/pricing', label: lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Тарифы' : 'Pricing' },
                  { href: '/privacy', label: t.nav.privacy ?? 'Privacy Policy' },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="block text-sm hover:text-white transition-colors" style={{ color: '#6b8299' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest mb-5 text-white">
                {lang === 'uz' ? 'Bozorlar' : lang === 'ru' ? 'Маркетплейсы' : 'Marketplaces'}
              </p>
              <div className="space-y-3">
                {['Uzum Market', 'Yandex Market', 'Wildberries'].map(m => (
                  <span key={m} className="block text-sm" style={{ color: '#6b8299' }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-sm" style={{ color: '#4a6275' }}>© 2026 Daromadchi. {t.footer}</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm hover:text-white transition-colors" style={{ color: '#4a6275' }}>
                {t.nav.privacy ?? 'Privacy Policy'}
              </Link>
              <div className="flex items-center gap-3">
                {langs.map(l => (
                  <button key={l} onClick={() => setLang(l)} className="text-xs font-bold uppercase transition-colors"
                    style={{ color: lang === l ? '#ffffff' : '#4a6275' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
