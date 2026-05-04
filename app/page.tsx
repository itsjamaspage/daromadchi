'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  TrendingUp, BarChart2, Package, Calculator, FileText,
  Zap, ArrowRight, RefreshCw, AlertTriangle, DollarSign,
  ShieldCheck, Sparkles, ChevronRight, Activity,
} from 'lucide-react'

/* ── helpers ──────────────────────────────────────────────────────────────── */

function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

/* ── animated counter stat ───────────────────────────────────────────────── */
function StatCard({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useCounter(value, 2000, inView)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      className="text-center"
    >
      <div className="text-4xl sm:text-5xl font-black text-white mb-2 tabular-nums">
        {count.toLocaleString()}<span className="shimmer-text">{suffix}</span>
      </div>
      <div className="text-slate-500 text-sm font-medium">{label}</div>
    </motion.div>
  )
}

/* ── neon grid background ─────────────────────────────────────────────────── */
function NeonGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg className="absolute inset-0 w-full h-full animate-grid-fade" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

/* ── floating orbs ───────────────────────────────────────────────────────── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="animate-float absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-violet-600/10 blur-3xl animate-pulse-glow" />
      <div className="animate-float2 absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-600/8 blur-3xl animate-pulse-glow2" />
      <div className="animate-float3 absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="animate-float absolute top-10 right-10 w-48 h-48 rounded-full bg-pink-500/5 blur-3xl" />
    </div>
  )
}

/* ── feature cards ───────────────────────────────────────────────────────── */
const features = [
  {
    icon: BarChart2,
    title: 'Reklama analitikasi',
    desc: 'DRR, CPC, CPO ko\'rsatkichlari. Savdosiz xarajat va ortiqcha sarflarni avtomatik aniqlash.',
    color: 'from-violet-500 to-purple-600',
    glow: 'hover:shadow-violet-500/20',
    border: 'hover:border-violet-500/40',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  {
    icon: Calculator,
    title: 'Unit-iqtisodiyot',
    desc: 'Har bir mahsulot uchun sof foyda, margin va zararlanmaslik narxini hisoblang.',
    color: 'from-cyan-500 to-blue-600',
    glow: 'hover:shadow-cyan-500/20',
    border: 'hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  {
    icon: AlertTriangle,
    title: 'Ombor ogohlantirishlari',
    desc: 'Savdo tezligiga asoslanib qancha kun zaxira qolganini ko\'ring va o\'z vaqtida buyurtma bering.',
    color: 'from-amber-500 to-orange-600',
    glow: 'hover:shadow-amber-500/20',
    border: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: FileText,
    title: 'Foyda va Zarar hisoboti',
    desc: 'Oylik daromad, tannarx, komissiya va reklama xarajatlarini bitta jadvalda ko\'ring.',
    color: 'from-emerald-500 to-green-600',
    glow: 'hover:shadow-emerald-500/20',
    border: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: RefreshCw,
    title: 'Auto-sinxronizatsiya',
    desc: 'Uzum Market API orqali buyurtmalar va mahsulotlar avtomatik yangilanib turadi.',
    color: 'from-pink-500 to-rose-600',
    glow: 'hover:shadow-pink-500/20',
    border: 'hover:border-pink-500/40',
    iconBg: 'bg-pink-500/10 border-pink-500/20',
    iconColor: 'text-pink-400',
  },
  {
    icon: DollarSign,
    title: 'Kategoriya tahlili',
    desc: 'Qaysi kategoriya ko\'proq foyda keltirayotganini donut grafik orqali bilib oling.',
    color: 'from-indigo-500 to-violet-600',
    glow: 'hover:shadow-indigo-500/20',
    border: 'hover:border-indigo-500/40',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-400',
  },
]

/* ── steps ───────────────────────────────────────────────────────────────── */
const steps = [
  { n: '01', title: 'Ro\'yxatdan o\'ting', desc: 'Email va parol bilan tezda hisob yarating.', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  { n: '02', title: 'Token kiriting', desc: 'seller.uzum.uz dan API tokeningizni sozlamalarga kiriting.', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  { n: '03', title: 'Sinxronlang', desc: 'Bir tugma bilan mahsulot va buyurtmalaringiz import qilinadi.', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  { n: '04', title: 'Tahlil qiling', desc: 'DRR, foyda, ombor va boshqa ko\'rsatkichlar tayyor.', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
]

/* ── mock dashboard preview ──────────────────────────────────────────────── */
function DashboardPreview() {
  return (
    <div className="relative">
      {/* Rotating ring decoration */}
      <div className="absolute -inset-4 rounded-3xl border border-violet-500/10 animate-spin-slow" />
      <div className="absolute -inset-8 rounded-3xl border border-indigo-500/5 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

      <div className="relative bg-[#0e0e1a] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/30">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#0a0a14]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 bg-white/[0.04] rounded-md h-5 mx-4 flex items-center px-2">
            <span className="text-[9px] text-slate-600">daromadchi.vercel.app/dashboard</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        </div>

        <div className="p-3 space-y-2.5">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'Daromad', v: '124.5M', c: 'text-violet-400', g: 'from-violet-500/20 to-transparent' },
              { l: 'Foyda',   v: '38.2M',  c: 'text-emerald-400', g: 'from-emerald-500/20 to-transparent' },
              { l: 'Buyurtma',v: '1,842',  c: 'text-blue-400', g: 'from-blue-500/20 to-transparent' },
              { l: 'Ombor',   v: '3,410',  c: 'text-amber-400', g: 'from-amber-500/20 to-transparent' },
            ].map(k => (
              <div key={k.l} className="bg-[#13131f] rounded-xl p-2.5 border border-white/[0.05] relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${k.g}`} />
                <p className="text-slate-600 text-[9px] mb-1">{k.l}</p>
                <p className={`font-bold text-sm ${k.c}`}>{k.v}</p>
                <p className="text-emerald-400 text-[9px] mt-0.5">↑ 12.4%</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Bar chart */}
            <div className="col-span-2 bg-[#13131f] rounded-xl p-3 border border-white/[0.05]">
              <p className="text-slate-500 text-[9px] mb-2">Kunlik daromad</p>
              <div className="flex items-end gap-1 h-16">
                {[30, 55, 40, 70, 45, 85, 65, 90, 75, 60, 80, 95, 70, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${h}%`,
                      background: `linear-gradient(to top, rgba(139,92,246,0.8), rgba(99,102,241,0.4))`,
                      boxShadow: h > 70 ? '0 0 8px rgba(139,92,246,0.6)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Donut */}
            <div className="bg-[#13131f] rounded-xl p-3 border border-white/[0.05] flex flex-col justify-center items-center gap-2">
              <p className="text-slate-500 text-[9px] self-start">Kategoriyalar</p>
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="4" strokeDasharray="37 51" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(34,211,238,0.7)" strokeWidth="4" strokeDasharray="24 64" strokeDashoffset="-37" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="4" strokeDasharray="15 73" strokeDashoffset="-61" strokeLinecap="round" />
                </svg>
              </div>
              <div className="space-y-1 w-full">
                {[['Kross.', 'text-violet-400'], ['Elektr.', 'text-cyan-400'], ['Soat', 'text-amber-400']].map(([l, c]) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.replace('text-', 'bg-')}`} />
                    <span className="text-slate-500 text-[8px]">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Orders mini-table */}
          <div className="bg-[#13131f] rounded-xl p-3 border border-white/[0.05]">
            <p className="text-slate-500 text-[9px] mb-2">So'nggi buyurtmalar</p>
            <div className="space-y-1.5">
              {[
                { name: 'Bobur T.', status: 'Yetkazildi', c: 'text-emerald-400 bg-emerald-500/10', amt: '890K' },
                { name: 'Malika Y.', status: 'Jarayonda', c: 'text-amber-400 bg-amber-500/10', amt: '3.2M' },
                { name: 'Jasur N.', status: 'Yuborildi', c: 'text-blue-400 bg-blue-500/10', amt: '2.8M' },
              ].map(o => (
                <div key={o.name} className="flex items-center justify-between text-[9px]">
                  <span className="text-slate-400">{o.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-md ${o.c}`}>{o.status}</span>
                  <span className="text-white font-medium">{o.amt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge decorations */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-6 top-1/3 bg-[#13131f] border border-emerald-500/30 rounded-xl px-3 py-2 shadow-lg shadow-emerald-500/10 hidden sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">+12.4% daromad</span>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -right-6 bottom-1/3 bg-[#13131f] border border-violet-500/30 rounded-xl px-3 py-2 shadow-lg shadow-violet-500/10 hidden sm:block"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-violet-400 text-xs font-medium">AI tahlil tayyor</span>
        </div>
      </motion.div>
    </div>
  )
}

/* ── main page ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -80])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])

  const featuresRef = useRef(null)
  const stepsRef = useRef(null)
  const statsRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })
  const stepsInView = useInView(stepsRef, { once: true, margin: '-100px' })
  const statsInView = useInView(statsRef, { once: true, margin: '-100px' })

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-200 overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto bg-[#0e0e1a]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl shadow-black/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 neon-border">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white tracking-tight">Daromadchi</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-medium">
                <Zap className="w-2.5 h-2.5" /> Beta
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Imkoniyatlar</a>
              <a href="#how" className="hover:text-white transition-colors">Qanday ishlaydi</a>
              <a href="#stats" className="hover:text-white transition-colors">Statistika</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">
                Kirish
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/25"
              >
                Boshlash <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 px-4 sm:px-6 overflow-hidden">
        <NeonGrid />
        <FloatingOrbs />

        {/* Beam effects */}
        <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent animate-beam" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-beam" style={{ animationDelay: '2s' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                Uzum + Yandex Market sotuvchilari uchun
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="text-4xl sm:text-5xl xl:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6"
              >
                Do&apos;koningiz<br />
                raqamlarini{' '}
                <span className="shimmer-text animate-neon-flicker">
                  to&apos;liq nazorat
                </span>{' '}
                qiling
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="text-lg text-slate-400 max-w-lg mb-8 leading-relaxed"
              >
                DRR tahlili, ombor ogohlantirishlari, foyda hisoboti va unit-iqtisodiyot kalkulyatori —
                hamma narsa bitta panelda.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link
                  href="/login"
                  className="group flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-violet-500/30 text-sm"
                >
                  Bepul boshlash
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] text-slate-300 font-medium px-7 py-3.5 rounded-2xl transition-all text-sm"
                >
                  Demo ko&apos;rish
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="flex items-center gap-6 mt-8"
              >
                {[
                  { icon: ShieldCheck, label: 'Xavfsiz' },
                  { icon: Zap, label: 'Tez ishlaydi' },
                  { icon: RefreshCw, label: 'Auto-sync' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon className="w-3.5 h-3.5 text-violet-400" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: dashboard preview */}
            <motion.div
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.9, ease: 'easeOut' }}
            >
              <DashboardPreview />
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#07070f] to-transparent pointer-events-none" />
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section id="stats" ref={statsRef} className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={statsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="relative bg-[#0e0e1a] border border-white/[0.06] rounded-3xl p-10 overflow-hidden"
          >
            {/* Neon top border */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <FloatingOrbs />

            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-8">
              <StatCard value={6}    suffix="+"   label="Analitika sahifasi" delay={0} />
              <StatCard value={30}   suffix="s"   label="O'rtacha yuklash vaqti" delay={0.1} />
              <StatCard value={100}  suffix="%"   label="Uzum Market uchun" delay={0.2} />
              <StatCard value={0}    suffix=" so'm" label="Boshlash narxi" delay={0.3} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="py-24 px-4 sm:px-6 relative">
        <NeonGrid />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Barcha imkoniyatlar
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Hamma narsa{' '}
              <span className="shimmer-text">bir joyda</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Uzum Market sotuvchisi kerak bo&apos;ladigan barcha analitika vositalari bitta platformada.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                className={`neon-card group bg-[#0e0e1a] border border-white/[0.06] ${f.border} rounded-2xl p-6 cursor-default hover:shadow-xl ${f.glow}`}
              >
                <div className={`w-11 h-11 rounded-xl ${f.iconBg} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="text-white font-bold mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>

                {/* Bottom gradient line on hover */}
                <div className={`mt-4 h-px bg-gradient-to-r ${f.color} opacity-0 group-hover:opacity-100 transition-opacity rounded-full`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how" ref={stepsRef} className="py-24 px-4 sm:px-6 bg-[#0a0a14] relative overflow-hidden">
        <FloatingOrbs />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={stepsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 text-xs text-cyan-400 font-medium mb-4">
              <Zap className="w-3.5 h-3.5" /> Tez ishga tushirish
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              4 qadamda{' '}
              <span className="shimmer-text">tayyor</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 40 }}
                animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="relative group"
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent z-0" />
                )}

                <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 transition-all group-hover:shadow-lg">
                  <div className={`w-11 h-11 rounded-xl ${s.bg} border flex items-center justify-center text-base font-black ${s.color} mb-5 group-hover:scale-110 transition-transform`}>
                    {s.n}
                  </div>
                  <h3 className="text-white font-bold mb-2 text-sm">{s.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <NeonGrid />
        <FloatingOrbs />

        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative bg-[#0e0e1a] rounded-3xl p-10 sm:p-14 text-center overflow-hidden"
          >
            {/* Neon border */}
            <div className="absolute inset-0 rounded-3xl border border-violet-500/20" />
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

            {/* Glow blobs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/10 blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5" /> Hoziroq bepul boshlang
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Savdolaringizni{' '}
                <span className="shimmer-text">o&apos;stiring</span>
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
                Ro&apos;yxatdan o&apos;ting va demo ma&apos;lumotlar bilan dashboardni sinab ko&apos;ring.
                Kredit karta talab qilinmaydi.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/login"
                  className="group flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-violet-500/30 text-sm"
                >
                  Bepul boshlash
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 border border-white/[0.1] hover:border-white/[0.2] text-slate-300 font-medium px-8 py-4 rounded-2xl transition-all text-sm"
                >
                  Demo ko&apos;rish
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Daromadchi</span>
          </div>
          <p className="text-slate-600 text-xs">© 2026 Daromadchi. Uzum Market sotuvchilari uchun.</p>
          <Link href="/dashboard" className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            Dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
