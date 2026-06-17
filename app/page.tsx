'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import {
  BarChart2, Calculator, TrendingUp,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  Sparkles, Sun, Moon, Globe, X, Menu,
  CheckCircle, Activity, ChevronRight,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import { PageBgDecor } from '@/components/PageBgDecor'

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
  const bg = isDark ? '#0C2640' : '#ffffff'
  const bg2 = isDark ? '#0F3050' : '#F3EBFF'
  const border = isDark ? 'rgba(0,200,232,0.14)' : 'rgba(124,58,237,0.14)'
  const muted = isDark ? '#7BB8D4' : '#6b7a9b'
  const c1 = isDark ? '#00C8E8' : '#7c3aed'
  const c2 = isDark ? '#7B61FF' : '#ec4899'

  const kpis = [
    { l: p.revenue, v: '124.5M', color: c1 },
    { l: p.profit, v: '38.2M', color: '#22c55e' },
    { l: p.orders, v: '1,842', color: c2 },
    { l: p.stock, v: '3,410', color: '#f59e0b' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
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
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.l} className="rounded-xl p-3 border" style={{ background: bg2, borderColor: border }}>
              <p className="text-[9px] mb-1" style={{ color: muted }}>{k.l}</p>
              <p className="font-bold text-sm" style={{ color: k.color }}>{k.v}</p>
              <p className="text-green-400 text-[9px] mt-0.5">↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded-xl p-4 border" style={{ background: bg2, borderColor: border }}>
            <p className="text-[10px] mb-3 font-medium" style={{ color: muted }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-1 h-20">
              {[30,50,38,70,45,82,60,88,72,55,78,92,65,80].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{
                  height: `${h}%`,
                  background: isDark ? 'linear-gradient(to top,#00C8E8cc,#00C8E822)' : 'linear-gradient(to top,#7c3aedcc,#7c3aed22)'
                }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-4 border flex flex-col" style={{ background: bg2, borderColor: border }}>
            <p className="text-[10px] mb-3 font-medium" style={{ color: muted }}>{p.categories}</p>
            <div className="relative w-16 h-16 mx-auto">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke={isDark ? 'rgba(0,200,232,0.15)' : 'rgba(124,58,237,0.15)'} strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c1} strokeWidth="4" strokeDasharray="38 50" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c2} strokeWidth="4" strokeDasharray="22 66" strokeDashoffset="-38" strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="14 74" strokeDashoffset="-60" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
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

function FeaturesScrollSection({
  features, isDark, badge, title, subtitle,
}: {
  features: Array<{ title: string; desc: string }>
  isDark: boolean
  card: string
  badge: string
  title: string
  subtitle: string
}) {
  const sectionRef = useRef(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)
  const dirRef = useRef(1)

  const goTo = (i: number) => {
    if (i === activeStep) return
    dirRef.current = i > activeStep ? 1 : -1
    setActiveStep(i)
  }

  useEffect(() => {
    if (progressBarRef.current) {
      const pct = features.length > 1 ? (activeStep / (features.length - 1)) * 100 : 100
      progressBarRef.current.style.height = `${pct}%`
    }
  }, [activeStep, features.length])

  useEffect(() => {
    const timer = setInterval(() => {
      dirRef.current = 1
      setActiveStep(prev => (prev + 1) % features.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [features.length])

  const ICONS = [BarChart2, Calculator, AlertTriangle, TrendingUp, RefreshCw, DollarSign]
  const ActiveIcon = ICONS[activeStep]

  return (
    <section id="features" ref={sectionRef} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45 }}
          className="mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--c1)' }}>{badge}</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="text-3xl sm:text-4xl font-black leading-tight" style={{ color: 'var(--text-base)' }}>{title}</h2>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
          </div>
          <div className="mt-6 h-px" style={{ background: 'var(--border)' }} />
        </motion.div>

        {/* Desktop layout */}
        <div className="hidden md:grid gap-16 items-center" style={{ gridTemplateColumns: '1.15fr 44px 1fr' }}>

          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, scale: 0.68, rotateY: dirRef.current * -80 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.68, rotateY: dirRef.current * 80 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="w-72 h-72 rounded-3xl flex items-center justify-center border"
                style={{
                  background: isDark ? 'rgba(0,200,232,0.04)' : 'rgba(124,58,237,0.04)',
                  borderColor: 'var(--border)',
                }}
              >
                <ActiveIcon className="w-28 h-28" style={{ color: 'var(--c1)', opacity: 0.85 }} />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Timeline */}
          <div className="flex justify-center py-8">
            <div className="relative flex flex-col items-center justify-between w-4 h-full">
              <div className="absolute inset-x-1/2 top-0 bottom-0 w-px -translate-x-1/2" style={{ background: 'var(--border)' }} />
              <div
                ref={progressBarRef}
                className="absolute inset-x-1/2 top-0 w-px -translate-x-1/2 origin-top"
                style={{ background: 'linear-gradient(to bottom, var(--c1), var(--c2))', height: '0%' }}
              />
              {features.map((f, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  title={f.title}
                  className="relative z-10 rounded-full border-2 transition-all duration-300 hover:scale-125 focus:outline-none"
                  style={{
                    width: i === activeStep ? '16px' : '11px',
                    height: i === activeStep ? '16px' : '11px',
                    background: i <= activeStep ? 'var(--c1)' : 'var(--bg-base)',
                    borderColor: i <= activeStep ? 'var(--c1)' : 'var(--border)',
                    cursor: 'pointer',
                    boxShadow: i === activeStep ? (isDark ? '0 0 14px rgba(0,200,232,0.85)' : '0 0 14px rgba(124,58,237,0.85)') : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.25 }}
            className="flex flex-col gap-7 justify-center py-8"
          >
            <div style={{ minHeight: '170px' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: dirRef.current * 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dirRef.current * -28 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--c1)' }}>
                    {String(activeStep + 1).padStart(2, '0')}&nbsp;/&nbsp;{String(features.length).padStart(2, '0')}
                  </p>
                  <h3 className="text-4xl font-extrabold mb-4 leading-tight" style={{ color: 'var(--text-base)' }}>
                    {features[activeStep].title}
                  </h3>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {features[activeStep].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-0.5">
              {features.map((f, i) => {
                const Li = ICONS[i]
                const isActive = i === activeStep
                return (
                  <motion.button
                    key={i}
                    onClick={() => goTo(i)}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-left w-full focus:outline-none"
                    animate={{
                      opacity: isDark ? (isActive ? 1 : 0.38) : 1,
                      background: isActive ? (isDark ? 'rgba(0,200,232,0.09)' : 'rgba(124,58,237,0.07)') : 'rgba(0,0,0,0)',
                    }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors duration-200"
                      style={{ background: isActive ? (isDark ? 'rgba(0,200,232,0.14)' : 'rgba(124,58,237,0.14)') : 'transparent' }}>
                      <Li className="w-3.5 h-3.5" style={{ color: isActive ? 'var(--c1)' : 'var(--text-dim)' }} />
                    </div>
                    <span className="text-sm font-medium transition-colors duration-200"
                      style={{ color: isActive ? 'var(--text-base)' : 'var(--text-muted)' }}>
                      {f.title}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="feature-active-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--c1)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex flex-col items-center gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.78 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-36 h-36 rounded-2xl flex items-center justify-center border"
              style={{ borderColor: 'var(--border)', background: isDark ? 'rgba(0,200,232,0.05)' : 'rgba(124,58,237,0.05)' }}
            >
              <ActiveIcon className="w-18 h-18" style={{ color: 'var(--c1)', width: '4.5rem', height: '4.5rem' }} />
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key={activeStep}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.32 }} className="text-center px-4"
            >
              <h3 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-base)' }}>{features[activeStep].title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{features[activeStep].desc}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-2 items-center flex-wrap justify-center">
            {features.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="focus:outline-none">
                <motion.div
                  animate={{ width: i === activeStep ? '28px' : '9px', background: i <= activeStep ? 'var(--c1)' : 'var(--border)' }}
                  transition={{ duration: 0.3 }}
                  className="h-2 rounded-full"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}


export default function LandingPage() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const t = translations[lang]
  const isDark = theme === 'dark'

  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [activePanel, setActivePanel] = useState(0)
  const [isLandingYearly, setIsLandingYearly] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const tttSectionRef = useRef<HTMLDivElement>(null)
  const [tttSectionVisible, setTttSectionVisible] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Tic-tac-toe "How It Works" game state
  const [tttBoard, setTttBoard] = useState<(null | 'O' | 'X')[]>(Array(9).fill(null))
  const [tttOCount, setTttOCount] = useState(0)
  const [tttPopup, setTttPopup] = useState<number | null>(null)
  const [tttWon, setTttWon] = useState(false)
  const [tttDead, setTttDead] = useState(false)
  const [tttXBusy, setTttXBusy] = useState(false)
  const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  const tttCheckWin = (b: (null|'O'|'X')[]) => TTT_LINES.some(l => l.every(i => b[i]==='O'))
  const tttCheckDead = (b: (null|'O'|'X')[]) => TTT_LINES.every(l => l.some(i => b[i]==='X'))

  // Scroll lock — fire only when section top reaches viewport top (fully visible)
  useEffect(() => {
    const checkVisible = () => {
      const el = tttSectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTttSectionVisible(rect.top <= 5 && rect.bottom > 0)
    }
    window.addEventListener('scroll', checkVisible, { passive: true })
    checkVisible()
    return () => window.removeEventListener('scroll', checkVisible)
  }, [])

  useEffect(() => {
    if (tttSectionVisible && !tttWon && !tttDead) {
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
    return () => { document.documentElement.style.overflow = '' }
  }, [tttSectionVisible, tttWon, tttDead])

  const pricingRef = useRef(null)
  const pricingInView = useInView(pricingRef, { once: true, amount: 0.4, margin: '0px 0px -20% 0px' })
  const ctaRef = useRef(null)
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' })

  const langs: Lang[] = ['uz', 'ru', 'en']
  const card = isDark ? 'var(--bg-card)' : '#ffffff'



  // Auto-dismiss ttt rule popup after 2.5s
  useEffect(() => {
    if (tttPopup === null || tttWon) return
    const timer = setTimeout(() => setTttPopup(null), 2500)
    return () => clearTimeout(timer)
  }, [tttPopup, tttWon])


  const handleTttClick = (idx: number) => {
    if (tttBoard[idx] || tttWon || tttDead) return
    const newBoard = [...tttBoard]
    newBoard[idx] = 'O'
    const newCount = tttOCount + 1
    setTttBoard(newBoard)
    setTttOCount(newCount)
    // Show step popup for first 3 O placements
    if (newCount <= 3) setTttPopup(newCount)
    // Real win: 3 O's in a line
    if (tttCheckWin(newBoard)) { setTttWon(true); return }
    setTttXBusy(true)
    setTimeout(() => {
      setTttBoard(prev => {
        if (tttCheckWin(prev)) return prev // already won between timer and now
        const empty = prev.map((v, i) => v === null ? i : -1).filter(i => i >= 0)
        if (!empty.length) { setTttDead(true); return prev }
        const pick = empty[Math.floor(Math.random() * empty.length)]
        const b = [...prev]; b[pick] = 'X'
        if (tttCheckDead(b)) setTttDead(true)
        return b
      })
      setTttXBusy(false)
    }, 600)
  }

  const [ctaPhase, setCtaPhase] = useState<0 | 1>(0)
  const ctaStarted = useRef(false)
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!ctaInView || ctaStarted.current) return
    ctaStarted.current = true
    const schedule = (nextPhase: 0 | 1, delay: number) => {
      ctaTimerRef.current = setTimeout(() => {
        setCtaPhase(nextPhase)
        schedule(nextPhase === 0 ? 1 : 0, nextPhase === 1 ? 3800 : 2800)
      }, delay)
    }
    schedule(1, 2800)
    return () => { if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current) }
  }, [ctaInView])

  const ctaTexts = {
    question: {
      uz: 'Biz bilan savdolaringizni oshirmoqchimisiz?',
      ru: 'Готовы увеличить свои продажи вместе с нами?',
      en: 'Are you ready to grow your sales with us?',
    },
    answer: {
      uz: "Unda kettik",
      ru: "Тогда давайте начнём",
      en: "Then let's get started",
    },
  }

  const wordAnim = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
    })
  }

  return (
    <div className="min-h-screen" style={{ overflowX: 'clip', color: 'var(--text-base)' }}>
      <PageBgDecor isDark={isDark} />

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-3">
        <div className="max-w-6xl mx-auto rounded-2xl px-7 h-[72px] flex items-center justify-between"
          style={{
            background: isDark ? 'rgba(5,20,44,0.92)' : '#ffffff',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? 'rgba(0,200,232,0.12)' : 'rgba(124,58,237,0.12)'}`,
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 4px 24px rgba(0,0,0,0.08)',
          }}>
          <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 shrink-0">
            <img src="/icon.svg" alt="Daromadchi" className="w-8 h-8 rounded-xl" />
            <span className="font-bold text-base" style={{ color: isDark ? '#fff' : '#0f172a' }}>Daromadchi</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: '#features', label: t.nav.features },
              { href: '#how', label: t.nav.how },
              { href: '#pricing', label: t.nav.pricing },
              { href: '/help', label: t.nav.help },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="text-[15px] font-medium transition-colors"
                style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#64748b' }}
                onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : '#0f172a')}
                onMouseLeave={e => (e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.55)' : '#64748b')}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div ref={langRef} className="relative">
              <button onClick={() => setLangOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
                  color: isDark ? 'rgba(255,255,255,0.65)' : '#475569',
                }}>
                <Globe className="w-3.5 h-3.5" /> {lang.toUpperCase()}
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
                        style={{ background: lang === l ? 'rgba(0,200,232,0.08)' : 'transparent', color: lang === l ? 'var(--c1)' : 'var(--text-muted)' }}>
                        {l}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={toggle}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
              }}>
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
            </button>
            <Link href="/login" className="hidden sm:block text-[15px] font-medium px-4 py-2 transition-colors"
              style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#475569' }}
              onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : '#0f172a')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.6)' : '#475569')}>
              {t.nav.login}
            </Link>
            <Link href="/login" className="text-[15px] font-bold px-6 py-2.5 rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--c1)' }}>
              {t.nav.start}
            </Link>
            <button className="md:hidden p-2 rounded-lg" onClick={() => setMenuOpen(v => !v)}
              style={{ color: isDark ? 'rgba(255,255,255,0.65)' : '#475569' }}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="md:hidden max-w-6xl mx-auto mt-1.5 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? 'rgba(5,20,44,0.96)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(0,200,232,0.12)' : 'rgba(124,58,237,0.12)'}`,
                boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
              }}>
              <div className="px-6 py-4 flex flex-col gap-1">
                {[
                  { label: t.nav.features, href: '#features' },
                  { label: t.nav.how, href: '#how' },
                  { label: t.nav.pricing, href: '#pricing' },
                  { label: t.nav.help, href: '/help' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} onClick={() => setMenuOpen(false)}
                    className="text-sm py-2.5 font-medium"
                    style={{ color: isDark ? 'rgba(255,255,255,0.65)' : '#475569' }}>
                    {label}
                  </a>
                ))}
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="mt-3 text-sm font-bold py-3 text-center rounded-full text-white"
                  style={{ background: 'var(--c1)' }}>
                  {t.nav.start}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex items-center pt-24 overflow-hidden" style={{ minHeight: '100svh' }}>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center py-16">

          {/* LEFT: mockup */}
          <motion.div
            initial={{ opacity: 0, x: -40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative order-2 lg:order-1"
          >
            <MockupInteractive>
              <DashboardMockup p={t.preview} />
            </MockupInteractive>
          </motion.div>

          {/* RIGHT: copy */}
          <div className="flex flex-col gap-7 order-1 lg:order-2">

            {/* Marketplace chips — small, factual */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 flex-wrap"
            >
              {['Uzum', 'Yandex Market', 'Wildberries'].map(mp => (
                <span key={mp} className="text-[11px] font-semibold px-2.5 py-1 rounded-md border"
                  style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)', background: 'var(--bg-input)' }}>
                  {mp}
                </span>
              ))}
            </motion.div>

            {/* Headline */}
            <div className="text-5xl sm:text-6xl xl:text-7xl font-black leading-[1.0] tracking-tighter"
              style={{ color: 'var(--text-base)' }}>
              {t.hero.landingTitle.split(' ').map((word, i) => (
                <motion.span
                  key={i}
                  custom={i}
                  variants={wordAnim}
                  initial="hidden"
                  animate="visible"
                  className="inline-block mr-[0.2em]"
                >
                  {word}
                </motion.span>
              ))}
            </div>

            {/* Subtext */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="space-y-2"
            >
              <p className="text-lg leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>
                {t.hero.landingSubtitle}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                {lang === 'uz'
                  ? "Har kuni 5 daqiqada sotuvlaringizni nazorat qiling. Raqiblar narxini kuzating, DRR hisobini avtomatlashtiring va foydani oshiring."
                  : lang === 'ru'
                  ? "5 минут в день — и вы контролируете все продажи. Следите за ценами конкурентов, автоматизируйте DRR и увеличивайте прибыль."
                  : "5 minutes a day keeps you in full control. Monitor competitor prices, automate DRR calculations and grow your margins."}
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 font-bold px-7 py-3.5 rounded-xl text-sm text-white"
                style={{ background: 'var(--c1)' }}>
                {t.trialFreeStart} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/help"
                className="inline-flex items-center justify-center gap-2 font-medium px-7 py-3.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                {t.nav.explorePlatform}
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="pt-5 border-t grid grid-cols-3 gap-0"
              style={{ borderColor: 'var(--border)' }}
            >
              {[
                { value: 3, suffix: '+', label: t.stats[0].label },
                { value: 5, suffix: '', label: t.stats[1].label },
                { value: 100, suffix: '%', label: t.stats[2].label },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85 + i * 0.08 }}
                  className={`pr-6 ${i > 0 ? 'pl-6 border-l' : ''}`}
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="text-3xl font-black" style={{ color: 'var(--text-base)' }}>
                    <StatNum value={s.value} suffix={s.suffix} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                </motion.div>
              ))}
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────────── */}
      <div className="flex items-stretch border-y overflow-hidden" style={{ borderColor: 'var(--border)', minHeight: '100px' }}>

        {/* Fixed left label */}
        <div className="hidden sm:flex flex-shrink-0 items-center px-8 border-r" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-loose"
            style={{ color: 'var(--text-muted)', whiteSpace: 'pre-line', maxWidth: '110px' }}>
            {lang === 'uz' ? 'Integratsiya\nqilingan\nbozorlar\nva funksiyalar' : lang === 'ru' ? 'Подключённые\nмаркетплейсы\nи функции' : 'Integrated\nMarketplaces\nand Features'}
          </p>
        </div>

        {/* Scrolling logos */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, var(--bg-base), transparent)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, var(--bg-base), transparent)' }} />

          <div className="animate-ticker flex items-center gap-16 whitespace-nowrap py-8"
            style={{ animationDuration: '48s' }}>
            {Array(4).fill(null).flatMap((_, gi) => [
              <span key={`${gi}a`} className="text-2xl font-black tracking-tight"
                style={{ color: '#7C3AED' }}>Uzum Market</span>,
              <span key={`${gi}s1`} className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--text-muted)', opacity: 0.55 }}>{t.tickerItems[0]}</span>,
              <span key={`${gi}b`} className="text-2xl font-black tracking-tight"
                style={{ color: '#FF3C78' }}>Wildberries</span>,
              <span key={`${gi}s2`} className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--text-muted)', opacity: 0.55 }}>{t.tickerItems[1]}</span>,
              <span key={`${gi}c`} className="text-2xl font-black tracking-tight"
                style={{ color: '#fc3f1d' }}>Yandex Market</span>,
              <span key={`${gi}s3`} className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--text-muted)', opacity: 0.55 }}>{t.tickerItems[2]}</span>,
            ])}
          </div>
        </div>
      </div>

      {/* ── VALUE PROPS ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-b" style={{ background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)', borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--c1)' }}>{t.valuePropBadge}</p>
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--text-base)' }}>{t.valuePropTitle}</h2>
          </motion.div>

          {/* Interactive accordion panels */}
          {(() => {
            // Each panel gets a truly distinct RGB so inactive tints are clearly different
            const panelMeta = [
              {
                // Card 1: Uzum — purple
                accentBg: '#7C3AED',
                rgb: [124, 58, 237] as [number,number,number],
                textColor: '#ffffff',
                contentInit: { x: -60, opacity: 0 },
                contentAnimate: { x: 0, opacity: 1 },
                contentTransition: { type: 'spring' as const, stiffness: 300, damping: 28 },
                contentExit: { x: -40, opacity: 0, transition: { duration: 0.18 } },
              },
              {
                // Card 2: Yandex Market — orange
                accentBg: '#f97316',
                rgb: [249, 115, 22] as [number,number,number],
                textColor: '#ffffff',
                contentInit: { y: 50, scale: 0.84, opacity: 0 },
                contentAnimate: { y: 0, scale: 1, opacity: 1 },
                contentTransition: { type: 'spring' as const, stiffness: 320, damping: 24 },
                contentExit: { y: 30, scale: 0.92, opacity: 0, transition: { duration: 0.16 } },
              },
              {
                // Card 3: Wildberries — fuchsia/purple
                accentBg: '#d946ef',
                rgb: [217, 70, 239] as [number,number,number],
                textColor: '#ffffff',
                contentInit: { rotate: 6, y: -30, opacity: 0 },
                contentAnimate: { rotate: 0, y: 0, opacity: 1 },
                contentTransition: { type: 'spring' as const, stiffness: 260, damping: 22 },
                contentExit: { rotate: -4, y: -20, opacity: 0, transition: { duration: 0.18 } },
              },
            ].map(m => ({
              ...m,
              inactiveBg:     `rgba(${m.rgb.join(',')},${isDark ? 0.14 : 0.11})`,
              inactiveBorder: `rgba(${m.rgb.join(',')},${isDark ? 0.32 : 0.26})`,
              hoverBg:        `rgba(${m.rgb.join(',')},${isDark ? 0.22 : 0.18})`,
              hoverBorder:    `rgba(${m.rgb.join(',')},${isDark ? 0.50 : 0.42})`,
              numColor:       `rgba(${m.rgb.join(',')},0.75)`,
              hoverScale: m.rgb[0] === 249 ? 1.03 : 1.0,
              hoverY: m.rgb[0] === 124 ? -3 : m.rgb[0] === 249 ? 0 : 3,
            }))

            return (
              <div className="flex flex-col sm:flex-row gap-3" style={{ minHeight: 340 }}>
                {t.valueProps.map((c, i) => {
                  const meta = panelMeta[i]
                  const isActive = activePanel === i
                  return (
                    <motion.div
                      key={c.title}
                      layout
                      onClick={() => setActivePanel(i)}
                      className="relative overflow-hidden rounded-3xl cursor-pointer select-none"
                      animate={{ flex: isActive ? 3 : 0.85 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                      whileHover={!isActive ? {
                        background: meta.hoverBg,
                        borderColor: meta.hoverBorder,
                        scale: meta.hoverScale,
                        y: meta.hoverY,
                        transition: { duration: 0.2 },
                      } : {}}
                      style={{
                        background: isActive ? meta.accentBg : meta.inactiveBg,
                        border: `1px solid ${isActive ? 'transparent' : meta.inactiveBorder}`,
                        minWidth: 72,
                        minHeight: 200,
                      }}
                    >
                      {/* Active content */}
                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.div
                            key={`active-${i}`}
                            initial={meta.contentInit}
                            animate={meta.contentAnimate}
                            exit={meta.contentExit}
                            transition={meta.contentTransition}
                            className="absolute inset-0 p-8 flex flex-col justify-end"
                          >
                            <span className="absolute top-5 right-7 text-[7rem] font-black leading-none pointer-events-none select-none"
                              style={{ color: meta.textColor, opacity: 0.08 }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
                              style={{ color: meta.textColor, opacity: 0.6 }}>
                              {String(i + 1).padStart(2, '0')}
                            </p>
                            <h3 className="text-2xl font-black mb-2 leading-tight" style={{ color: meta.textColor }}>
                              {c.title}
                            </h3>
                            <p className="text-sm font-semibold mb-3 leading-relaxed"
                              style={{ color: meta.textColor, opacity: 0.85 }}>
                              {c.desc}
                            </p>
                            <p className="text-sm leading-relaxed"
                              style={{ color: meta.textColor, opacity: 0.65 }}>
                              {(c as typeof c & { body?: string }).body}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Inactive label */}
                      <AnimatePresence>
                        {!isActive && (
                          <motion.div
                            key={`inactive-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 p-6 flex flex-col justify-between"
                          >
                            <p className="text-3xl font-black" style={{ color: meta.numColor }}>
                              {String(i + 1).padStart(2, '0')}
                            </p>
                            <div>
                              <h3 className="font-bold text-sm leading-snug mb-2" style={{ color: 'var(--text-base)' }}>
                                {c.title}
                              </h3>
                              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>+</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <FeaturesScrollSection
        features={t.features}
        isDark={isDark}
        card={card}
        badge={t.featuresBadge}
        title={t.featuresTitle}
        subtitle={t.featuresSubtitle}
      />

      {/* ── HOW IT WORKS — tic-tac-toe tutorial ─────────────────────────────── */}
      <div ref={tttSectionRef} style={{ height: '100svh' }}>
      <section id="how" className="sticky top-0 flex flex-col items-center justify-center border-t overflow-hidden"
        style={{ height: '100svh', borderColor: 'var(--border)', paddingTop: 'calc(72px + 12px)' }}>
          <div className="w-full max-w-lg px-4 flex flex-col items-center gap-4">
            {/* Header */}
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--c1)' }}>{t.howBadge}</p>
              <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--text-base)' }}>
                {t.howTitle1} <span style={{ color: 'var(--c1)' }}>{t.howTitle2}</span>
              </h2>
              {!tttWon && !tttDead && (
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'uz' ? "3 ta O ni bir qatorga qo'ying va yuting" : lang === 'ru' ? "Поставьте 3 O в ряд — и победите" : "Get 3 O's in a row to win"}
                </p>
              )}
            </div>

            {/* Rule popup — fixed centered overlay */}
            <AnimatePresence>
              {tttPopup !== null && !tttWon && (
                <motion.div
                  key={`backdrop-${tttPopup}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center px-6"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                  onClick={() => setTttPopup(null)}
                >
                  <motion.div
                    key={`card-${tttPopup}`}
                    initial={{ opacity: 0, scale: 0.88, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 12 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-sm rounded-3xl p-7 shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                        style={{ background: 'var(--c1)', color: isDark ? '#001828' : '#fff' }}>
                        {String(tttPopup).padStart(2,'0')}
                      </div>
                      <h3 className="font-black text-lg leading-tight" style={{ color: 'var(--text-base)' }}>
                        {t.steps[tttPopup-1]?.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                      {t.steps[tttPopup-1]?.desc}
                    </p>
                    <button
                      onClick={() => setTttPopup(null)}
                      className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer"
                      style={{ background: 'var(--c1)', color: isDark ? '#001828' : '#fff' }}
                    >
                      {lang === 'uz' ? "Tushunarli" : lang === 'ru' ? "Понятно" : "Got it"}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tic-tac-toe grid */}
            {!tttWon ? (
              <div className="grid grid-cols-3 gap-3 w-full" style={{ maxWidth: 'min(90vw, 420px)' }}>
                {tttBoard.map((cell, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={!cell && !tttDead ? { scale: 1.04 } : {}}
                    whileTap={!cell && !tttDead ? { scale: 0.96 } : {}}
                    onClick={() => handleTttClick(idx)}
                    className="aspect-square rounded-2xl flex items-center justify-center text-4xl font-black select-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: `2px solid ${cell === 'O' ? 'var(--c1)' : cell === 'X' ? 'var(--border)' : 'var(--border)'}`,
                      cursor: cell || tttDead ? 'default' : 'pointer',
                      color: cell === 'O' ? 'var(--c1)' : 'var(--text-muted)',
                      boxShadow: cell === 'O' ? `0 0 18px ${isDark ? 'rgba(0,200,232,0.25)' : 'rgba(124,58,237,0.2)'}` : 'none',
                    }}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.span
                          initial={{ scale: 0, rotate: -15 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        >
                          {cell}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                ))}
              </div>
            ) : tttDead ? (
              /* Dead state — no winning line possible */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="rounded-3xl p-8 text-center w-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}
              >
                <div className="text-5xl mb-4">😅</div>
                <h3 className="text-xl font-black mb-2" style={{ color: 'var(--text-base)' }}>
                  {lang === 'uz' ? "Yutib bo'lmaydi!" : lang === 'ru' ? "Выиграть невозможно!" : "No winning move left!"}
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'uz' ? "Barcha qatorlar X bilan to'sib qo'yildi. Qayta urinib ko'ring." : lang === 'ru' ? "Все линии заблокированы крестиками. Попробуйте снова." : "All lines are blocked by X. Give it another shot."}
                </p>
                <button
                  onClick={() => { setTttBoard(Array(9).fill(null)); setTttOCount(0); setTttWon(false); setTttDead(false); setTttPopup(null) }}
                  className="text-sm font-bold px-8 py-3 rounded-full"
                  style={{ background: 'var(--c1)', color: isDark ? '#001828' : '#fff' }}
                >
                  {lang === 'uz' ? "Qayta o'ynash →" : lang === 'ru' ? "Попробовать снова →" : "Try again →"}
                </button>
              </motion.div>
            ) : (
              /* Win state with 4th rule — scroll lock releases automatically */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="rounded-3xl p-8 text-center w-full"
                style={{ background: isDark ? 'rgba(0,200,232,0.09)' : 'rgba(124,58,237,0.06)', border: '1px solid var(--c1)' }}
              >
                <motion.div
                  animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-6xl mb-5"
                >🎉</motion.div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--c1)' }}>
                  {lang === 'uz' ? "Siz yutdingiz! Va nihoyat..." : lang === 'ru' ? "Вы победили! И наконец..." : "You won! And finally..."}
                </p>
                <h3 className="text-2xl font-black mb-3" style={{ color: 'var(--text-base)' }}>
                  {t.steps[3]?.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {t.steps[3]?.desc}
                </p>
              </motion.div>
            )}

            {/* Step counter dots */}
            {!tttWon && !tttDead && (
              <div className="flex justify-center gap-2 mt-2">
                {[1,2,3,4].map(n => (
                  <div key={n} className="rounded-full transition-all duration-300"
                    style={{
                      width: n <= Math.min(tttOCount, 4) ? 24 : 8, height: 8,
                      background: n <= Math.min(tttOCount, 4) ? 'var(--c1)' : 'var(--border)',
                    }} />
                ))}
              </div>
            )}
          </div>
      </section>
      </div>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" ref={pricingRef} className="py-24 px-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--c1)' }}>{t.nav.pricing}</p>
            <h2 className="text-3xl sm:text-4xl font-black mb-8" style={{ color: 'var(--text-base)' }}>
              {lang === 'uz' ? "Sizning biznesingizga mos tarif" : lang === 'ru' ? "Тариф под ваш бизнес" : "A plan that fits your business"}
            </h2>

            {/* Yearly / Monthly toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-medium" style={{ color: isLandingYearly ? 'var(--text-muted)' : 'var(--text-base)' }}>
                {lang === 'uz' ? 'Oylik' : lang === 'ru' ? 'Ежемесячно' : 'Monthly'}
              </span>
              <button
                onClick={() => setIsLandingYearly(y => !y)}
                className="relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0"
                style={{ background: isLandingYearly ? 'var(--c1)' : 'var(--border2)' }}
              >
                <span
                  className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                  style={{ left: isLandingYearly ? '30px' : '4px' }}
                />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: isLandingYearly ? 'var(--text-base)' : 'var(--text-muted)' }}>
                  {lang === 'uz' ? 'Yillik' : lang === 'ru' ? 'Ежегодно' : 'Yearly'}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                  {lang === 'uz' ? '3 oy bepul' : '-25%'}
                </span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
            {([
              { name: t.pricingFree,  monthlyPrice: '0',       yearlyPrice: '0',       highlight: false, badge: null,           features: t.pricingFreeFeatures    },
              { name: 'Pro',          monthlyPrice: '300 000', yearlyPrice: '225 000', highlight: true,  badge: t.pricingPopular, features: t.pricingProFeatures     },
              { name: 'Pro+',         monthlyPrice: '600 000', yearlyPrice: '450 000', highlight: false, badge: null,           features: t.pricingProPlusFeatures },
            ]).map((plan, i) => (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: -160, scale: 0.88 }}
                animate={pricingInView ? { opacity: 1, y: 0, scale: plan.highlight ? 1.02 : 1 } : {}}
                transition={{ delay: i * 0.22, type: 'spring', stiffness: 160, damping: 18 }}
                className="relative flex flex-col rounded-3xl border overflow-hidden"
                style={{
                  background: plan.highlight ? 'linear-gradient(160deg, #5b21b6 0%, #4338ca 100%)' : 'var(--bg-card)',
                  borderColor: plan.highlight ? 'rgba(139,92,246,0.6)' : 'var(--border)',
                  boxShadow: plan.highlight ? '0 8px 48px rgba(91,33,182,0.45), 0 2px 12px rgba(0,0,0,0.3)' : undefined,
                }}
              >
                {plan.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500" />
                )}
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-white"
                      style={{ background: 'linear-gradient(to right, #7c3aed, #4f46e5)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="p-7 flex flex-col flex-1 gap-5">
                  <h3 className="font-bold text-xl" style={{ color: plan.highlight ? '#ffffff' : 'var(--text-base)' }}>{plan.name}</h3>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black tabular-nums leading-none"
                      style={{ color: plan.highlight ? '#c4b5fd' : 'var(--text-base)' }}>
                      <SlotPrice
                        value={isLandingYearly ? plan.yearlyPrice : plan.monthlyPrice}
                        trigger={pricingInView}
                        delay={i * 0.22 + 0.5}
                      />
                    </span>
                    {plan.monthlyPrice !== '0' && (
                      <span className="text-sm font-medium pb-1"
                        style={{ color: plan.highlight ? 'rgba(196,181,253,0.7)' : 'var(--text-muted)' }}>
                        so&apos;m/oy
                      </span>
                    )}
                  </div>

                  <Link href="/login"
                    className="flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition-all"
                    style={plan.highlight
                      ? { background: 'linear-gradient(to right, #7c3aed, #4f46e5)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }
                      : { background: 'var(--bg-input)', color: 'var(--text-base)', border: '1px solid var(--border2)' }}>
                    {t.nav.start} <ChevronRight className="w-4 h-4" />
                  </Link>

                  <div className="h-px" style={{ background: plan.highlight ? 'rgba(255,255,255,0.1)' : 'var(--border)' }} />

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f, fi) => (
                      <motion.li key={f}
                        initial={{ opacity: 0, x: -10 }}
                        animate={pricingInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: i * 0.22 + 0.8 + fi * 0.04, duration: 0.28 }}
                        className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            background: plan.highlight ? 'rgba(167,139,250,0.2)' : 'var(--bg-input)',
                            border: `1px solid ${plan.highlight ? 'rgba(167,139,250,0.35)' : 'var(--border2)'}`,
                          }}>
                          <CheckCircle className="w-3 h-3" style={{ color: plan.highlight ? '#c4b5fd' : 'var(--c1)' }} />
                        </span>
                        <span className="text-sm leading-relaxed"
                          style={{ color: plan.highlight ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                          {f}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={pricingInView ? { opacity: 1 } : {}}
            transition={{ delay: 1.4 }}
            className="mt-8 text-center">
            <Link href="/pricing" className="text-sm font-semibold" style={{ color: 'var(--c1)' }}>
              {lang === 'uz' ? "Tariflarni batafsil ko'rish →" : lang === 'ru' ? "Подробнее о тарифах →" : "See full pricing details →"}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section className="py-20 border-t overflow-hidden" style={{ borderColor: 'var(--border)', background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10 px-6">
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--text-base)' }}>{t.testimonialsTitle}</h2>
        </motion.div>
        <div className="overflow-hidden">
          <div className="animate-ticker-cards flex gap-5 w-max px-6">
            {[...(t.testimonialsList ?? []), ...(t.testimonialsList ?? [])].map((review, i) => {
              const role = review.role.toLowerCase()
              const hasWB = role.includes('wildberr')
              const hasYM = role.includes('yandex')
              const hasUM = role.includes('uzum')
              const badges: { label: string; bg: string }[] = []
              if (hasUM) badges.push({ label: 'UM', bg: '#7C3AED' })
              if (hasYM) badges.push({ label: 'YM', bg: '#f97316' })
              if (hasWB) badges.push({ label: 'WB', bg: '#d946ef' })
              if (badges.length === 0) badges.push({ label: 'UM', bg: '#7C3AED' })

              const cleanRole = review.role
                .replace(/Wildberries\s*&\s*Uzum(\s*Market)?/gi, '')
                .replace(/Uzum Market/gi, '').replace(/Yandex Market/gi, '').replace(/Wildberries/gi, '')
                .replace(/\bUzum\b/gi, '').replace(/^\s*,\s*/, '').replace(/,\s*$/, '').trim()

              const quoteColors = ['#7C3AED','#f97316','#d946ef','#0ea5e9','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6']
              const quoteColor = quoteColors[i % quoteColors.length]

              return (
                <div key={i} className="flex-shrink-0 w-72 rounded-3xl p-6 flex flex-col gap-4"
                  style={{
                    background: isDark ? 'var(--bg-card)' : '#ffffff',
                    border: `1px solid ${isDark ? 'var(--border)' : 'rgba(99,102,241,0.08)'}`,
                    boxShadow: isDark ? undefined : '0 4px 20px rgba(67,97,238,0.07), 0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                  {/* Quote icon */}
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black shrink-0 select-none"
                    style={{ background: quoteColor, fontSize: '1.6rem', lineHeight: 1 }}>
                    &ldquo;
                  </div>
                  {/* Review text */}
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-muted)' }}>
                    {review.text}
                  </p>
                  {/* Divider */}
                  <div className="h-px" style={{ background: 'var(--border)' }} />
                  {/* Client info + marketplace badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text-base)' }}>{review.name}</p>
                      {cleanRole && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{cleanRole}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {badges.map(b => (
                        <div key={b.label}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                          style={{ background: b.bg }}>
                          {b.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section ref={ctaRef} className="relative py-32 px-6 border-t border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
            style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {t.trialFree}
            <span style={{ color: 'var(--border2)' }}>·</span>
            {lang === 'uz' ? 'Karta shart emas' : lang === 'ru' ? 'Карта не нужна' : 'No card required'}
          </motion.div>

          <div className="min-h-[120px] flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {ctaPhase === 0 ? (
                <motion.div key="question" className="flex flex-wrap justify-center gap-x-2.5 gap-y-1">
                  {ctaTexts.question[lang].split(' ').map((word, i) => (
                    <motion.span
                      key={i}
                      className="text-3xl sm:text-4xl font-black"
                      style={{ color: 'var(--text-base)' }}
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="answer" className="flex flex-col items-center gap-7">
                  <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1">
                    {ctaTexts.answer[lang].split(' ').map((word, i) => (
                      <motion.span
                        key={i}
                        className="text-3xl sm:text-5xl font-black grad-text"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ delay: i * 0.1, duration: 0.45, ease: 'easeOut' }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </div>
                  <motion.div
                    className="flex flex-col sm:flex-row gap-3 justify-center"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
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
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <img src="/icon.svg" alt="Daromadchi" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {lang === 'uz' ? "Uzum Market, Yandex Market va Wildberries sotuvchilari uchun analitika platformasi." :
                  lang === 'ru' ? "Платформа аналитики для продавцов Uzum Market, Yandex Market и Wildberries." :
                    "Analytics platform for Uzum Market, Yandex Market and Wildberries sellers."}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>
                {lang === 'uz' ? 'Platforma' : lang === 'ru' ? 'Платформа' : 'Platform'}
              </p>
              <div className="space-y-3">
                {[
                  { href: '#features', label: t.nav.features },
                  { href: '#how', label: t.nav.how },
                  { href: '#pricing', label: t.nav.pricing },
                  { href: '/login', label: t.nav.start },
                ].map(l => (
                  <a key={l.href} href={l.href} className="block text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>
                {lang === 'uz' ? 'Resurslar' : lang === 'ru' ? 'Ресурсы' : 'Resources'}
              </p>
              <div className="space-y-3">
                {[
                  { href: '/help', label: t.nav.help },
                  { href: '/pricing', label: lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Тарифы' : 'Pricing' },
                  { href: '/privacy', label: t.nav.privacy ?? 'Privacy Policy' },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="block text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>
                {lang === 'uz' ? 'Bozorlar' : lang === 'ru' ? 'Маркетплейсы' : 'Marketplaces'}
              </p>
              <div className="space-y-3">
                {['Uzum Market', 'Yandex Market', 'Wildberries'].map(m => (
                  <span key={m} className="block text-sm" style={{ color: 'var(--text-muted)' }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi. {t.footer}</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                {t.nav.privacy ?? 'Privacy Policy'}
              </Link>
              <div className="flex items-center gap-3">
                {langs.map(l => (
                  <button key={l} onClick={() => setLang(l)} className="text-xs font-bold uppercase transition-colors"
                    style={{ color: lang === l ? 'var(--text-base)' : 'var(--text-muted)' }}>
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
