import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BarChart2, Package, ShoppingCart, TrendingUp,
  Layers, Shield, Target, Users,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Biz haqimizda',
  description: 'Daromadchi — O\'zbekistondagi marketplace sotuvchilari uchun analitika platformasi. Uzum, Wildberries va Yandex Market sotuvchilari uchun sotuv tahlili va daromad hisoblash.',
  openGraph: {
    title: 'Daromadchi haqida — Marketplace analitika platformasi',
    description: 'O\'zbekistondagi Uzum, Wildberries va Yandex Market sotuvchilari uchun analitika platformasi.',
    url: 'https://www.daromadchi.uz/about',
  },
  alternates: { canonical: 'https://www.daromadchi.uz/about' },
}

const VALUES = [
  { icon: Target, title: 'Aniqlik', desc: 'Haqiqiy vaqtda sinxronlangan, barcha ma\'lumotlar to\'g\'ridan-to\'g\'ri marketplace API orqali olinadi.' },
  { icon: Shield, title: 'Xavfsizlik', desc: 'API kalitlaringiz shifrlangan holda saqlanadi. Biz hech qachon sizning do\'koningizga yozmaymiz — faqat o\'qiymiz.' },
  { icon: Layers, title: 'Soddalik', desc: '3 ta marketpleysni bitta ekranda ko\'ring. Murakkab tahlilni oddiy qilib ko\'rsatamiz.' },
  { icon: Users, title: 'Sotuvchilar uchun', desc: 'O\'zbekistondagi sotuvchilar ehtiyojiga moslashtirilgan. O\'zbek, rus va ingliz tillarida.' },
]

const FEATURES = [
  { icon: TrendingUp, title: 'Daromad va foyda tahlili', desc: 'Sotuv, daromad, foyda va unit-ekonomika — barchasi haqiqiy vaqtda.' },
  { icon: Package, title: 'Tovar analitikasi', desc: 'Har bir mahsulotning sotilishi, zaxirasi, narxi va rentabelligini kuzating.' },
  { icon: ShoppingCart, title: 'Buyurtmalar boshqaruvi', desc: 'Barcha buyurtmalarni bir joyda ko\'ring, filtrlang va tahlil qiling.' },
  { icon: BarChart2, title: 'Reklama samaradorligi', desc: 'Reklama xarajatlari va daromadini solishtiring, ROI ni hisoblang.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-base)]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--nav-bg)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <img src="/icon.svg" alt="" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-[var(--text-base)] text-base">Daromadchi</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors no-underline">Tariflar</Link>
            <Link href="/login" className="btn-primary text-sm no-underline">Kirish</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Marketplace sotuvchilari uchun{' '}
            <span className="grad-text">analitika platformasi</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
            Daromadchi — O&apos;zbekistondagi Uzum, Wildberries va Yandex Market sotuvchilariga
            sotuv tahlili, daromad va foyda hisoblash, tovar analitikasi va boshqa ko&apos;plab
            imkoniyatlarni taqdim etuvchi platforma.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="neon-card rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Bizning maqsadimiz</h2>
            <p className="text-[var(--text-muted)] text-lg leading-relaxed">
              O&apos;zbekistondagi marketplace sotuvchilari ko&apos;pincha har bir platforma uchun
              alohida tahlil qilishga majbur. Biz buni o&apos;zgartirmoqdamiz — Uzum, Wildberries
              va Yandex Market ma&apos;lumotlarini bitta platformaga jamlash orqali sotuvchilarga
              to&apos;g&apos;ri qarorlar qabul qilishda yordam beramiz.
            </p>
            <p className="text-[var(--text-muted)] text-lg leading-relaxed mt-4">
              Biz faqat ma&apos;lumotlarni o&apos;qiymiz — hech qachon sizning do&apos;koningizga
              narx, zaxira yoki boshqa o&apos;zgartirishlar kiritmaymiz. Xavfsizlik va
              ishonchlilik — bizning ustuvor maqsadimiz.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Bizning qadriyatlarimiz</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map(v => (
              <div key={v.title} className="feature-card rounded-2xl p-6 bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--c1)]/15 flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-[var(--c1)]" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Nimalar qila olamiz</h2>
          <p className="text-[var(--text-muted)] text-center mb-12 max-w-2xl mx-auto">
            Marketplace analitika va sotuv tahlili uchun zarur bo&apos;lgan barcha vositalar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card rounded-2xl p-6 bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--c1)]/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[var(--c1)]" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported marketplaces */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Qo&apos;llab-quvvatlanadigan marketpleyslar</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'Uzum Market', color: '#494fdf' },
              { name: 'Wildberries', color: '#CB11AB' },
              { name: 'Yandex Market', color: '#E8A000' },
            ].map(mp => (
              <div key={mp.name} className="px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: mp.color }} />
                <span className="font-semibold">{mp.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Hoziroq boshlang</h2>
          <p className="text-[var(--text-muted)] text-lg mb-8">
            Bepul ro&apos;yxatdan o&apos;ting va marketplace analitikangizni bir joyda ko&apos;ring.
          </p>
          <Link href="/login" className="btn-primary text-base px-8 py-3 no-underline inline-block">
            Bepul boshlash
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="w-6 h-6 rounded-md" />
            <span className="font-semibold text-sm">Daromadchi</span>
          </div>
          <div className="flex gap-6 text-sm text-[var(--text-muted)]">
            <Link href="/pricing" className="hover:text-[var(--text-base)] transition-colors no-underline">Tariflar</Link>
            <Link href="/privacy" className="hover:text-[var(--text-base)] transition-colors no-underline">Maxfiylik</Link>
            <Link href="/terms" className="hover:text-[var(--text-base)] transition-colors no-underline">Oferta</Link>
          </div>
          <p className="text-xs text-[var(--text-dim)]">© 2025 Daromadchi. Toshkent, O&apos;zbekiston</p>
        </div>
      </footer>
    </div>
  )
}
