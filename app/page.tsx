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

/* ── Theme toggle ───────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-500" />}
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
        <Globe className="w-3 h-3" /> {lang.toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden border shadow-lg z-50"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', minWidth: '4rem' }}>
            {langs.map(l => (
              <button key={l} onClick={() => { setLang(l); setOpen(false) }}
                className="w-full px-3 py-1.5 text-xs font-medium uppercase text-left transition-all"
                style={{ background: lang === l ? 'rgba(0,212,255,0.08)' : 'transparent', color: lang === l ? 'var(--c1)' : 'var(--text-muted)' }}>
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
    <div className="rounded-xl overflow-hidden shadow-2xl border" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: bg2, borderColor: border }}>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400/70" />
          <div className="w-2 h-2 rounded-full bg-amber-400/70" />
          <div className="w-2 h-2 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 h-4 mx-2 rounded border flex items-center px-2"
          style={{ background: isDark ? '#0f2040' : '#dceefa', borderColor: border }}>
          <span className="text-[8px]" style={{ color: muted }}>daromadchi.uz/dashboard</span>
        </div>
        <Activity className="w-2.5 h-2.5 text-green-400" />
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          {kpis.map(k => (
            <div key={k.l} className="rounded-lg p-2 border" style={{ background: bg2, borderColor: border }}>
              <p className="text-[7px] mb-0.5" style={{ color: muted }}>{k.l}</p>
              <p className="font-semibold text-[10px]" style={{ color: k.color }}>{k.v}</p>
              <p className="text-green-400 text-[7px]">↑ 12.4%</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="col-span-2 rounded-lg p-2 border" style={{ background: bg2, borderColor: border }}>
            <p className="text-[7px] mb-1.5" style={{ color: muted }}>{p.dailyRevenue}</p>
            <div className="flex items-end gap-0.5 h-12">
              {[30,50,38,70,45,82,60,88,72,55,78,92,65,80].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm"
                  style={{ height: `${h}%`, background: isDark ? 'linear-gradient(to top,#00d4ff88,#00d4ff22)' : 'linear-gradient(to top,#0284c788,#0284c722)' }} />
              ))}
            </div>
          </div>
          <div className="rounded-lg p-2 border flex flex-col" style={{ background: bg2, borderColor: border }}>
            <p className="text-[7px] mb-1" style={{ color: muted }}>{p.categories}</p>
            <div className="relative w-10 h-10 mx-auto mt-1">
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

/* ── Testimonials ───────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: 'Jasur Toshmatov',   role: 'Uzum Market sotuvchisi',   text: "Daromadchi bizning savdoni 40% oshirishimizga yordam berdi. DRR tahlili juda qulay.", stars: 5 },
  { name: 'Malika Rahimova',   role: 'Yandex Market',            text: "Qoldiq ogohlantirishlari tufayli endi birortam mahsulot tamom bo'lmaydi. Ajoyib!", stars: 5 },
  { name: 'Otabek Xasanov',    role: 'Wildberries sotuvchisi',   text: "P&L hisobot birinchi oyda 3 soatni tejadi. Barcha raqamlar bir joyda.", stars: 5 },
  { name: 'Dilnoza Yusupova',  role: 'Uzum Market sotuvchisi',   text: "Birlik iqtisodiyoti bo'limi har bir mahsulotning haqiqiy foydasini ko'rsatdi. Endi zarar qilmayapman.", stars: 5 },
  { name: 'Sardor Nazarov',    role: 'Uzum Market, 3 yil',       text: "Reklama xarajatlarini nazorat qilish endi juda oson. DRR ko'rsatkichi menga juda kerak edi.", stars: 5 },
  { name: 'Kamola Mirzayeva',  role: 'Yandex Market sotuvchi',   text: "Narx kuzatuvi orqali raqobatchilardan doim xabardor bo'lib turaman. Zo'r funksiya!", stars: 5 },
  { name: 'Bobur Tursunov',    role: 'Wildberries & Uzum',       text: "Ikki marketpleysni bir joydan boshqarish imkoniyati — bu juda qulay. Vaqtni 2 barobarga tejadim.", stars: 5 },
  { name: 'Nargiza Ergasheva', role: 'Uzum Market sotuvchisi',   text: "Avto-sinxronizatsiya tufayli har kuni qo'lda ma'lumot kiritishdan qutuldim. Ajoyib!", stars: 5 },
  { name: 'Firdavs Aliyev',    role: 'Yandex Market, 2 yil',     text: "Kategoriya tahlili orqali eng foydali mahsulotlarimni aniqladim. Daromad 25% oshdi!", stars: 5 },
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

  const featuresRef    = useRef(null)
  const howRef         = useRef(null)
  const pricingRef     = useRef(null)
  const ctaRef         = useRef(null)
  const featuresInView    = useInView(featuresRef,    { once: true, margin: '-80px' })
  const howInView         = useInView(howRef,         { once: true, margin: '-80px' })
  const pricingInView     = useInView(pricingRef,     { once: true, margin: '-80px' })
  const ctaInView         = useInView(ctaRef,         { once: true, margin: '-80px' })

  const card  = isDark ? 'var(--bg-card)'  : '#ffffff'
  const helpLabel = lang === 'uz' ? 'Yordam' : lang === 'ru' ? 'Помощь' : 'Help'

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay },
  })

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* ── NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm">
            {[
              { href: '#features', label: lang === 'uz' ? 'Imkoniyatlar' : t.nav.features },
              { href: '#how',      label: lang === 'uz' ? 'Qanday ishlaydi' : t.nav.how },
              { href: '#pricing',  label: lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing' },
              { href: '/help',     label: helpLabel },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="text-sm transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-base)' }}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-sm px-3 py-1.5 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-base)' }}>
              {t.nav.login}
            </Link>
            <Link href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg transition-all"
              style={{ background: 'var(--c1)', color: '#fff' }}>
              {lang === 'uz' ? 'Boshlash' : t.nav.start}
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
              transition={{ duration: 0.18 }}
              className="md:hidden border-t overflow-hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--nav-bg)' }}>
              <div className="px-5 py-3 flex flex-col gap-1">
                {[
                  lang === 'uz' ? 'Imkoniyatlar' : t.nav.features,
                  lang === 'uz' ? 'Qanday ishlaydi' : t.nav.how,
                  lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing',
                  helpLabel,
                ].map(label => (
                  <a key={label} href="#" onClick={() => setMenuOpen(false)}
                    className="text-sm py-2 opacity-70" style={{ color: 'var(--text-base)' }}>
                    {label}
                  </a>
                ))}
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="mt-2 text-sm font-semibold py-2.5 text-center rounded-lg"
                  style={{ background: 'var(--c1)', color: '#fff' }}>
                  {lang === 'uz' ? 'Boshlash' : t.nav.start}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center pt-28 pb-20 px-5 text-center overflow-hidden"
        style={{ background: isDark ? '#0d0e14' : 'var(--bg-base)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: isDark
            ? 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,212,255,0.10) 0%, transparent 65%)'
            : 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.07) 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-2xl mx-auto">
          <motion.div {...fade(0.1)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 border text-xs"
            style={{ background: 'rgba(0,212,255,0.06)', borderColor: 'var(--border2)', color: 'var(--text-muted)' }}>
            <div className="flex items-center -space-x-1.5">
              {['#f97316','#06b6d4','#22c55e','#a78bfa'].map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold text-white"
                  style={{ background: c, borderColor: isDark ? '#0d0e14' : 'var(--bg-base)' }}>
                  {['J','M','O','A'][i]}
                </div>
              ))}
            </div>
            500+ sotuvchilar Uzum Market&apos;da
          </motion.div>

          <motion.h1 {...fade(0.2)}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4 text-white">
            {lang === 'uz' ? (
              <>Savdo va analitika —<br />
                <span style={{ color: 'var(--c1)' }}>hammasi bitta ekranda</span>
              </>
            ) : lang === 'ru' ? (
              <>Продажи и аналитика —<br />
                <span style={{ color: 'var(--c1)' }}>всё на одном экране</span>
              </>
            ) : (
              <>Sales &amp; analytics —<br />
                <span style={{ color: 'var(--c1)' }}>all on one screen</span>
              </>
            )}
          </motion.h1>

          <motion.p {...fade(0.3)}
            className="text-sm sm:text-base mb-8 max-w-md mx-auto leading-relaxed"
            style={{ color: 'var(--text-muted)' }}>
            {lang === 'uz'
              ? 'DRR, qoldiq, narx va birlik iqtisodiyoti. Savdoni kuniga 5 daqiqada boshqaring.'
              : lang === 'ru'
              ? 'DRR, остатки, цены и юнит-экономика. Управляйте продажами за 5 минут в день.'
              : 'DRR, stock, pricing & unit economics. Manage your sales in 5 minutes a day.'}
          </motion.p>

          <motion.div {...fade(0.4)} className="flex flex-col sm:flex-row gap-2.5 justify-center mb-3">
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'var(--c1)', color: '#0d0e14', boxShadow: '0 4px 20px rgba(0,212,255,0.25)' }}>
              {lang === 'uz' ? '3 kun bepul boshlash' : lang === 'ru' ? '3 дня бесплатно' : 'Start 3 days free'}
            </Link>
            <Link href="/dashboard"
              className="inline-flex items-center justify-center gap-2 font-medium px-6 py-2.5 rounded-xl text-sm border transition-all"
              style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
              {lang === 'uz' ? "Platformani o'rganish →" : lang === 'ru' ? 'Изучить платформу →' : 'Explore platform →'}
            </Link>
          </motion.div>

          <motion.p {...fade(0.5)} className="text-xs mb-10" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            {lang === 'uz' ? "3 kun bepul sinab ko'ring" : lang === 'ru' ? '3 дня бесплатно' : '3 days free trial'}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7 }}
            className="relative">
            <div className="absolute -inset-3 rounded-2xl blur-2xl opacity-15 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, var(--c1), transparent 70%)' }} />
            <DashboardMockup p={t.preview} />
          </motion.div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="py-3 overflow-hidden border-y"
        style={{ borderColor: 'var(--border)', background: isDark ? 'rgba(0,212,255,0.02)' : 'rgba(2,132,199,0.02)' }}>
        <div className="animate-ticker flex gap-12 whitespace-nowrap text-xs font-medium">
          {Array(4).fill(null).flatMap((_, gi) => [
            <span key={`${gi}a`} style={{ color: 'var(--c1)' }}>● Uzum Market API</span>,
            <span key={`${gi}b`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;Savdo tahlili&nbsp;·&nbsp;</span>,
            <span key={`${gi}c`} style={{ color: 'var(--c2)' }}>● Wildberries</span>,
            <span key={`${gi}d`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;P&amp;L hisobot&nbsp;·&nbsp;</span>,
            <span key={`${gi}e`} style={{ color: 'var(--c1)' }}>● Yandex Market</span>,
            <span key={`${gi}f`} style={{ color: 'var(--text-muted)' }}>&nbsp;·&nbsp;Birlik iqtisodiyoti&nbsp;·&nbsp;</span>,
          ])}
        </div>
      </div>

      {/* ── VALUE PROP ── */}
      <section className="py-16 px-5"
        style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-center mb-10">
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--c1)' }}>
              Nima uchun Daromadchi
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mb-3" style={{ color: 'var(--text-base)' }}>
              Marketplace savdosini boshqarish — endi oson.
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>
              Uzum, Yandex Market va Wildberries sotuvchilari uchun — bitta platformada barcha raqamlar.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '📊', title: 'Analitika markazi', desc: "Real vaqtda savdo ko'rsatkichlari va hisobotlar." },
              { icon: '🔔', title: 'Zaxira nazorati',   desc: 'Avtomatik ogohlantirishlar va buyurtma tavsiyalari.' },
              { icon: '💰', title: 'Foyda hisobi',      desc: 'Har bir mahsulot uchun aniq foyda va zarar hisobi.' },
            ].map((c, i) => (
              <motion.div key={c.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.45 }}
                className="rounded-xl p-5 border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="text-2xl mb-2">{c.icon}</div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-base)' }}>{c.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 px-5" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: 6,   suffix: '+',     label: t.stats[0].label },
            { value: 30,  suffix: 's',     label: t.stats[1].label },
            { value: 100, suffix: '%',     label: t.stats[2].label },
            { value: 0,   suffix: " so'm", label: t.stats[3].label },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--text-base)' }}>
                <StatNum value={s.value} suffix={s.suffix} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" ref={featuresRef} className="py-20 px-5"
        style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium mb-3 border"
              style={{ background: isDark ? 'rgba(0,212,255,0.06)' : 'rgba(2,132,199,0.06)', borderColor: 'var(--border2)', color: 'var(--c1)' }}>
              <Sparkles className="w-3 h-3" /> {t.featuresBadge}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--text-base)' }}>
              {t.featuresTitle}
            </h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>{t.featuresSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {t.features.map((f, i) => {
              const icons = [BarChart2, Calculator, AlertTriangle, FileText, RefreshCw, DollarSign]
              const Icon = icons[i]
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 24 }} animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="neon-card rounded-xl p-5 border"
                  style={{ background: card, borderColor: 'var(--border)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(2,132,199,0.08)', border: '1px solid var(--border2)' }}>
                    <Icon className="w-4 h-4" style={{ color: 'var(--c1)' }} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5" style={{ color: 'var(--text-base)' }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" ref={howRef} className="py-20 px-5" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={howInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium mb-3 border"
              style={{ background: isDark ? 'rgba(255,45,155,0.06)' : 'rgba(219,39,119,0.06)', borderColor: 'var(--c2)', color: 'var(--c2)' }}>
              <Zap className="w-3 h-3" /> {t.howBadge}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
              {t.howTitle1} <span className="grad-text">{t.howTitle2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {t.steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 20 }} animate={howInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="rounded-xl p-5 border"
                style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-4 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                  0{i + 1}
                </div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-base)' }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" ref={pricingRef} className="py-20 px-5"
        style={{ background: isDark ? '#041020' : 'var(--bg-card2)' }}>
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} className="text-center mb-10">
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
              {lang === 'uz' ? 'Narxlar' : lang === 'ru' ? 'Цены' : 'Pricing'}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                features: lang === 'uz' ? ["5+ do'konlar", 'Barcha Pro imkoniyatlar', 'API kirish', 'Ustuvor yordam']
                  : lang === 'ru' ? ['5+ магазинов', 'Все Pro возможности', 'API доступ', 'Приоритетная поддержка']
                  : ['5+ stores', 'All Pro features', 'API access', 'Priority support'],
              },
            ] as const).map((plan, i) => (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: 20 }} animate={pricingInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded-xl p-5 border relative"
                style={{ background: plan.highlight ? (isDark ? 'rgba(0,212,255,0.05)' : 'rgba(2,132,199,0.05)') : card, borderColor: plan.highlight ? 'var(--c1)' : 'var(--border)' }}>
                {plan.highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                    {lang === 'uz' ? 'OMMABOP' : lang === 'ru' ? 'ПОПУЛЯРНЫЙ' : 'POPULAR'}
                  </div>
                )}
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-base)' }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{plan.price}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>so&apos;m/oy</span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--c1)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full text-center py-2 rounded-lg text-xs font-semibold transition-all"
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

      {/* ── TESTIMONIALS ── */}
      <section className="py-20" style={{ background: 'var(--bg-base)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center mb-10 px-5">
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
            {lang === 'uz' ? 'Sotuvchilar nima deydi' : lang === 'ru' ? 'Что говорят продавцы' : 'What sellers say'}
          </h2>
        </motion.div>

        <div className="overflow-hidden">
          <div className="animate-ticker-cards flex gap-4 w-max px-4">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((review, i) => (
              <div key={i}
                className="flex-shrink-0 w-72 rounded-xl p-5 border"
                style={{ background: card, borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array(review.stars).fill(0).map((_, j) => (
                    <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                  &ldquo;{review.text}&rdquo;
                </p>
                <p className="font-semibold text-xs" style={{ color: 'var(--text-base)' }}>{review.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{review.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section ref={ctaRef} className="py-20 px-5 border-t" style={{ background: isDark ? '#041020' : 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={ctaInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-3" style={{ color: 'var(--text-base)' }}>
              {t.ctaTitle1} <span className="grad-text">{t.ctaTitle2}</span>
            </h2>
            <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>{t.ctaSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 text-white font-semibold px-7 py-2.5 rounded-xl text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
                {t.hero.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/dashboard"
                className="inline-flex items-center justify-center font-medium px-7 py-2.5 rounded-xl text-sm border transition-all"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
                {t.hero.demo}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-8 px-5" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--c1), var(--c2))' }}>
              <TrendingUp className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </Link>
          <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <a href="#features" className="opacity-60 hover:opacity-100 transition-opacity">{t.nav.features}</a>
            <a href="#how"      className="opacity-60 hover:opacity-100 transition-opacity">{t.nav.how}</a>
            <Link href="/help"  className="opacity-60 hover:opacity-100 transition-opacity">{helpLabel}</Link>
            <Link href="/login" className="opacity-60 hover:opacity-100 transition-opacity">{t.nav.login}</Link>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Daromadchi. {t.footer}</p>
        </div>
      </footer>

      {/* ── STICKY BAR ── */}
      <AnimatePresence>
        {showBar && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t"
            style={{ background: isDark ? 'rgba(2,12,26,0.97)' : 'rgba(240,248,255,0.97)', borderColor: 'var(--border)', backdropFilter: 'blur(16px)' }}>
            <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium" style={{ color: 'var(--text-base)' }}>
                {lang === 'uz' ? "3 kun bepul sinab ko'ring."
                 : lang === 'ru' ? '3 дня бесплатно.'
                 : '3 days free trial.'}
              </p>
              <Link href="/login"
                className="shrink-0 text-xs font-semibold px-5 py-2 rounded-lg text-white"
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
