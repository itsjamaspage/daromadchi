import Link from 'next/link'
import {
  TrendingUp, BarChart2, Package, ShoppingCart, Calculator,
  FileText, Zap, ArrowRight, CheckCircle, Star, RefreshCw,
  AlertTriangle, DollarSign,
} from 'lucide-react'

const features = [
  {
    icon: BarChart2,
    title: 'Reklama analitikasi',
    desc: 'DRR, CPC, CPO ko\'rsatkichlari. Savdosiz xarajat va ortiqcha sarflarni avtomatik aniqlash.',
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/10',
  },
  {
    icon: Calculator,
    title: 'Unit-iqtisodiyot',
    desc: 'Har bir mahsulot uchun sof foyda, margin va zararlanmaslik narxini hisoblang.',
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/10',
  },
  {
    icon: AlertTriangle,
    title: 'Ombor ogohlantirishlari',
    desc: 'Savdo tezligiga asoslanib qancha kun zaxira qolganini ko\'ring va o\'z vaqtida buyurtma bering.',
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/10',
  },
  {
    icon: FileText,
    title: 'F & Z hisoboti',
    desc: 'Oylik daromad, tannarx, komissiya va reklama xarajatlarini bitta jadvalda ko\'ring.',
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/10',
  },
  {
    icon: RefreshCw,
    title: 'Uzum Market sinxronizatsiya',
    desc: 'API token orqali buyurtmalar va mahsulotlar avtomatik yangilanib turadi.',
    color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/10',
  },
  {
    icon: DollarSign,
    title: 'Kategoriya tahlili',
    desc: 'Qaysi kategoriya ko\'proq foyda keltirayotganini donut grafik orqali bilib oling.',
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/10',
  },
]

const stats = [
  { value: '6+', label: 'Analitika sahifasi' },
  { value: '30s', label: 'O\'rtacha yuklash vaqti' },
  { value: '100%', label: 'Uzum Market uchun' },
  { value: 'Bepul', label: 'Sinab ko\'rish' },
]

const steps = [
  { n: '01', title: 'Ro\'yxatdan o\'ting', desc: 'Email va parol bilan tezda hisob yarating.' },
  { n: '02', title: 'Uzum tokenini kiriting', desc: 'seller.uzum.uz dan API tokeningizni sozlamalarga kiriting.' },
  { n: '03', title: 'Sinxronlang', desc: 'Bir tugma bilan mahsulot va buyurtmalaringiz import qilinadi.' },
  { n: '04', title: 'Tahlil qiling', desc: 'DRR, foyda, ombor va ko\'p boshqa ko\'rsatkichlar tayyor.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/30">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">Daromadchi</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Kirish
            </Link>
            <Link href="/login" className="text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition-colors shadow shadow-violet-500/20">
              Boshlash
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Uzum Market sotuvchilari uchun
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            Do&apos;koningiz raqamlarini{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              to&apos;liq nazorat qiling
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            DRR tahlili, ombor ogohlantirishlari, foyda hisoboti va unit-iqtisodiyot kalkulyatori —
            hamma narsa bitta panelda, Uzum Market uchun maxsus.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/25 text-sm"
            >
              Bepul boshlash
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-medium px-6 py-3 rounded-xl transition-all text-sm"
            >
              Demo ko&apos;rish
            </Link>
          </div>
        </div>

        {/* Dashboard preview card */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-4 shadow-2xl">
            {/* Fake browser bar */}
            <div className="flex items-center gap-1.5 mb-4 px-1">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <div className="flex-1 bg-white/[0.04] rounded-lg h-5 mx-3" />
            </div>
            {/* Mock dashboard grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {[
                { label: 'Daromad', value: '124.5M', color: 'text-violet-400' },
                { label: 'Foyda',   value: '38.2M',  color: 'text-emerald-400' },
                { label: 'Buyurtma',value: '1,842',  color: 'text-blue-400' },
                { label: 'Ombor',   value: '3,410',  color: 'text-amber-400' },
              ].map(k => (
                <div key={k.label} className="bg-[#1c1c2e] rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-slate-500 text-xs mb-1">{k.label}</p>
                  <p className={`font-bold text-lg ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-[#1c1c2e] rounded-xl h-28 border border-white/[0.04] flex items-end px-4 pb-3 gap-2">
                {[40, 55, 35, 70, 60, 80, 72].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-indigo-500 opacity-80" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="bg-[#1c1c2e] rounded-xl h-28 border border-white/[0.04] p-3 space-y-2">
                {['Krossovkalar', 'Elektronika', 'Soatlar'].map((c, i) => (
                  <div key={c}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{c}</span>
                      <span className="text-slate-400">{[42, 35, 23][i]}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${[42, 35, 23][i]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow under card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-violet-600/20 blur-2xl rounded-full" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 sm:px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-white mb-1">{s.value}</p>
              <p className="text-slate-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Hamma narsa bir joyda</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Uzum Market sotuvchisi kerak bo&apos;ladigan barcha analitika vositalari.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className={`bg-[#13131f] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-6 transition-all group`}>
                <div className={`w-10 h-10 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 bg-[#0d0d1a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Qanday ishlaydi?</h2>
            <p className="text-slate-400">4 qadamda ishga tushiring</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-violet-500/30 to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm mb-4">
                    {s.n}
                  </div>
                  <h3 className="text-white font-semibold mb-1.5 text-sm">{s.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/20 rounded-3xl p-10">
            <h2 className="text-3xl font-bold text-white mb-3">Hoziroq boshlang</h2>
            <p className="text-slate-400 mb-6">Ro&apos;yxatdan o&apos;ting va demo ma&apos;lumotlar bilan dashboardni sinab ko&apos;ring.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/25 text-sm"
              >
                Bepul boshlash <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 border border-white/[0.1] hover:border-white/[0.2] text-slate-300 font-medium px-8 py-3 rounded-xl transition-all text-sm"
              >
                Demo ko&apos;rish
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Daromadchi</span>
          </div>
          <p className="text-slate-500 text-xs">© 2026 Daromadchi. Uzum Market sotuvchilari uchun.</p>
          <Link href="/dashboard" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Dashboard &rarr;
          </Link>
        </div>
      </footer>
    </div>
  )
}
