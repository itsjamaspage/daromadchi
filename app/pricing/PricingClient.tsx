'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  Check, X, Clock, TrendingUp, ChevronRight, MessageCircle, ChevronDown,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import TierTabs from '@/components/pricing/TierTabs'
import { tiersT } from '@/lib/tiersT'
import { TRIAL_D as D, TRIAL_RU as RU_D } from '@/lib/trial-copy'
import { telegramContactUrl } from '@/lib/contact'

// The Free card's bullets are the FREE_FOREVER set in lib/billing/features.ts,
// worded for a seller. They used to promise "1 store / 100 products / 30-day
// history / Uzum only" — none of which any code enforced, and the last of which
// contradicted `marketplaces` being free forever. A price page may not advertise
// a limit the product does not have, in either direction.
//
// UZS prices derived server-side from the USD source of truth (lib/billing) at
// the live USD→UZS rate. `monthly`/`yearly` are clean so'm figures; `usd` is the
// underlying dollar price shown as secondary text.
export interface PricingData {
  pro:      { usd: number; monthly: number; yearly: number }
  pro_plus: { usd: number; monthly: number; yearly: number }
}

type Lang = 'uz' | 'en' | 'ru'
// Under the turnover model every PAID tier has the same features — they differ
// by turnover and price, not capability. So the matrix is Free vs Paid, not five
// columns of which four would be identical. 'trial' is a third cell state: free
// accounts get these for the trial window, then they gate off.
type Cell = boolean | 'trial'
interface Feature { label: string; free: Cell; paid: Cell }
interface FaqItem  { q: string; a: string }

// ── i18n ─────────────────────────────────────────────────────────────────────
// Whole-page translations so the RU/UZ/EN switcher in the navbar actually changes
// the content (the switcher writes the shared lang via useLang, same as the
// homepage). Plan offerings themselves are unchanged — only their language.
// Trial copy is interpolated from TRIAL_DAYS. Hardcoding it is how this page
// spent weeks advertising a 3-day trial after the code had moved on.
const T = {
  uz: {
    nav: { home: 'Bosh sahifa', compare: 'Taqqoslash', faq: 'Savollar', login: 'Kirish', start: 'Boshlash' },
    heroTitle1: 'Barcha imkoniyatlar.', heroTitle2: 'Bir joyda.',
    trust: [`${D} kun bepul sinov`, "Bir nechta do'kon", 'Istalgan vaqt bekor qilish'],
    monthly: 'Oylik', yearly: 'Yillik',
    perMonth: "so'm/oy", usdMonth: '/oy', alwaysFree: 'Hamisha bepul', yearlyLine: 'Yillik',
    onlyProPlus: 'Faqat Pro+ da',
    freeName: 'Bepul', freeDesc: "Boshlash uchun ideal — hech qanday to'lov talab etilmaydi", freeCta: 'Boshlash',
    proName: 'Pro', proDesc: "O'sib kelayotgan biznes uchun to'liq analitika vositalari", proBadge: 'Eng mashhur', proCta: "Sinab ko'ring",
    proPlusName: 'Pro+', proPlusDesc: "Yirik biznes uchun — Pro imkoniyatlari + eksklyuziv funksiyalar", proPlusBadge: 'Maksimal', proPlusCta: 'Pro+ ni boshlash',
    freeFeatures: ['Aqlli boshqaruv paneli', 'Mahsulotlar', 'Buyurtmalar va ogohlantirishlar', 'Uzum + Yandex Market', 'Kengaytma (extension)'],
    proFeatures: [
      "Unlimited do'konlar", 'Unlimited mahsulotlar', '12 oylik tarix', 'Uzum + Yandex Market', 'Unit-ekonomika',
      'Eksport Excel / PDF', 'F&Z (P&L) hisobot', 'Maxsus hisobotlar',
    ],
    proPlusExtras: [
      { label: "Prioritet qo'llab-quvvatlash", desc: '15 daqiqa ichida javob' },
    ],
    calloutTitle: "Pro+ nima qo'shadi?",
    calloutBody: "Pro dagi hamma narsa bor. Pro+ faqat katta jamoalar va agentliklar uchun qo'shimcha beradi:",
    calloutHighlight: "prioritet qo'llab-quvvatlash — 15 daqiqa ichida javob",
    calloutCta: "Pro+ ni ko'rish →",
    cmpBadge: 'Batafsil taqqoslash', cmpHeading: 'Taqqoslash', cmpSub: 'Qaysi tarif sizga mos ekanini aniqlang',
    paidColumn: 'Pullik tariflar', paidColumnSub: 'Pro · Pro+ · Biznes · Enterprise',
    trialCell: `${D} kun`, trialFootnote: `${D} kundan keyin bu imkoniyatlar yopiladi — qolganlari doimo bepul.`,
    cmpCore: 'Asosiy imkoniyatlar', unlimited: 'Cheksiz', days30: '30 kun', months12: '12 oy', maksimal: 'MAKSIMAL', freePrice: "0 so'm",
    cmpFeatures: [
      'Aqlli boshqaruv paneli', 'Mahsulotlar', 'Buyurtmalar va ogohlantirishlar',
      'Uzum + Yandex Market', 'Tahlil', 'Ombor sinxronizatsiyasi',
      'Moliya va to\'lovlar', 'Unit-iqtisod',
    ],
    faqBadge: "Ko'p so'raladigan savollar", faqHeading: 'Savollar & Javoblar', faqSub: "Qo'shimcha savolingiz bo'lsa Telegram orqali bog'laning",
    faq: [
      { q: 'Bepul tarifda kredit karta kerakmi?', a: "Yo'q. Bepul tarifni boshlash uchun hech qanday to'lov ma'lumoti talab etilmaydi." },
      { q: 'Pro va Pro+ orasidagi asosiy farq nima?', a: "Pro tarifi o'sib kelayotgan biznes uchun barcha asosiy analitika vositalarini beradi. Pro+ esa qo'shimcha ravishda 15 daqiqa ichida javob beradigan prioritet qo'llab-quvvatlashni taqdim etadi." },
      { q: "Tarifni istalgan vaqt o'zgartirish mumkinmi?", a: "Ha. Bepuldan Pro ga yoki Pro dan Pro+ ga istalgan vaqt o'tishingiz mumkin. O'zgarish darhol kuchga kiradi." },
      { q: "Ma'lumotlarim xavfsizmi?", a: "Ha. Barcha ma'lumotlar shifrlangan holda saqlanadi va faqat sizga tegishli. Hech qachon uchinchi shaxslarga ma'lumot berilmaydi." },
      { q: "Yillik tarifda qanday chegirma bo'ladi?", aTemplate: (p: string, pp: string) => `Yillik tarif oylikdan arzonroq: Pro — ${p} so'm/oy, Pro+ — ${pp} so'm/oy (yillik to'lovda).` },
    ],
    bottomTitle: 'Hali ham savol bormi?', bottomSub: 'Bizning jamoa sizga yordam berishga tayyor. Odatda 15 daqiqa ichida javob beramiz.',
    bottomTelegram: 'Telegram orqali yozing', bottomStart: 'Bepul boshlash',
    rights: '© 2026 Daromadchi. Barcha huquqlar himoyalangan.',
  },
  ru: {
    nav: { home: 'Главная', compare: 'Сравнение', faq: 'Вопросы', login: 'Войти', start: 'Начать' },
    heroTitle1: 'Все возможности.', heroTitle2: 'В одном месте.',
    trust: [`${RU_D} бесплатно`, 'Несколько магазинов', 'Отмена в любой момент'],
    monthly: 'Помесячно', yearly: 'Ежегодно',
    perMonth: 'сум/мес', usdMonth: '/мес', alwaysFree: 'Всегда бесплатно', yearlyLine: 'За год',
    onlyProPlus: 'Только в Pro+',
    freeName: 'Бесплатно', freeDesc: 'Идеально для старта — оплата не требуется', freeCta: 'Начать',
    proName: 'Pro', proDesc: 'Полный набор аналитики для растущего бизнеса', proBadge: 'Популярный', proCta: 'Попробовать',
    proPlusName: 'Pro+', proPlusDesc: 'Для крупного бизнеса — возможности Pro + эксклюзивные функции', proPlusBadge: 'Максимум', proPlusCta: 'Подключить Pro+',
    freeFeatures: ['Умный дашборд', 'Товары', 'Заказы и уведомления', 'Uzum + Yandex Market', 'Расширение (extension)'],
    proFeatures: [
      'Безлимит магазинов', 'Безлимит товаров', 'История 12 месяцев', 'Uzum + Yandex Market', 'Юнит-экономика',
      'Экспорт Excel / PDF', 'Отчёт P&L', 'Кастомные отчёты',
    ],
    proPlusExtras: [
      { label: 'Приоритетная поддержка', desc: 'Ответ в течение 15 минут' },
    ],
    calloutTitle: 'Что добавляет Pro+?',
    calloutBody: 'Всё из Pro включено. Pro+ добавляет только для крупных команд и агентств:',
    calloutHighlight: 'приоритетная поддержка — ответ в течение 15 минут',
    calloutCta: 'Смотреть Pro+ →',
    cmpBadge: 'Подробное сравнение', cmpHeading: 'Сравнение', cmpSub: 'Определите, какой тариф вам подходит',
    paidColumn: 'Платные тарифы', paidColumnSub: 'Pro · Pro+ · Бизнес · Enterprise',
    trialCell: `${D} дн.`, trialFootnote: `Через ${RU_D} эти функции закрываются — остальные остаются бесплатными навсегда.`,
    cmpCore: 'Основные возможности', unlimited: 'Безлимит', days30: '30 дней', months12: '12 месяцев', maksimal: 'МАКСИМУМ', freePrice: '0 сум',
    cmpFeatures: [
      'Умный дашборд', 'Товары', 'Заказы и уведомления',
      'Uzum + Yandex Market', 'Аналитика', 'Синхронизация склада',
      'Финансы и выплаты', 'Юнит-экономика',
    ],
    faqBadge: 'Частые вопросы', faqHeading: 'Вопросы и ответы', faqSub: 'Есть ещё вопрос? Напишите нам в Telegram',
    faq: [
      { q: 'Нужна ли карта для бесплатного тарифа?', a: 'Нет. Для старта на бесплатном тарифе платёжные данные не нужны.' },
      { q: 'В чём основная разница между Pro и Pro+?', a: 'Pro даёт все основные инструменты аналитики для растущего бизнеса. Pro+ дополнительно включает приоритетную поддержку с ответом за 15 минут.' },
      { q: 'Можно ли менять тариф в любое время?', a: 'Да. Вы можете перейти с бесплатного на Pro или с Pro на Pro+ в любой момент. Изменение вступает в силу сразу.' },
      { q: 'Мои данные в безопасности?', a: 'Да. Все данные хранятся в зашифрованном виде и принадлежат только вам. Мы никогда не передаём их третьим лицам.' },
      { q: 'Какая скидка на годовом тарифе?', aTemplate: (p: string, pp: string) => `Годовой тариф выгоднее помесячного: Pro — ${p} сум/мес, Pro+ — ${pp} сум/мес (при оплате за год).` },
    ],
    bottomTitle: 'Остались вопросы?', bottomSub: 'Наша команда готова помочь. Обычно отвечаем в течение 15 минут.',
    bottomTelegram: 'Написать в Telegram', bottomStart: 'Начать бесплатно',
    rights: '© 2026 Daromadchi. Все права защищены.',
  },
  en: {
    nav: { home: 'Home', compare: 'Compare', faq: 'FAQ', login: 'Log in', start: 'Get started' },
    heroTitle1: 'Every feature.', heroTitle2: 'In one place.',
    trust: [`${D}-day free trial`, 'Multiple stores', 'Cancel anytime'],
    monthly: 'Monthly', yearly: 'Yearly',
    perMonth: "so'm/mo", usdMonth: '/mo', alwaysFree: 'Free forever', yearlyLine: 'Yearly',
    onlyProPlus: 'Pro+ only',
    freeName: 'Free', freeDesc: 'Perfect to start — no payment required', freeCta: 'Get started',
    proName: 'Pro', proDesc: 'Full analytics toolkit for a growing business', proBadge: 'Most popular', proCta: 'Try it',
    proPlusName: 'Pro+', proPlusDesc: 'For large business — Pro features + exclusive tools', proPlusBadge: 'Maximum', proPlusCta: 'Get Pro+',
    freeFeatures: ['Smart dashboard', 'Products', 'Orders & alerts', 'Uzum + Yandex Market', 'Extension'],
    proFeatures: [
      'Unlimited stores', 'Unlimited products', '12-month history', 'Uzum + Yandex Market', 'Unit economics',
      'Export Excel / PDF', 'P&L report', 'Custom reports',
    ],
    proPlusExtras: [
      { label: 'Priority support', desc: 'Reply within 15 minutes' },
    ],
    calloutTitle: 'What does Pro+ add?',
    calloutBody: 'Everything in Pro is included. Pro+ adds, just for large teams and agencies:',
    calloutHighlight: 'priority support — a reply within 15 minutes',
    calloutCta: 'See Pro+ →',
    cmpBadge: 'Detailed comparison', cmpHeading: 'Comparison', cmpSub: 'Find the plan that fits you',
    paidColumn: 'Paid tiers', paidColumnSub: 'Pro · Pro+ · Biznes · Enterprise',
    trialCell: `${D} days`, trialFootnote: `After ${D} days these lock; everything else stays free for good.`,
    cmpCore: 'Core features', unlimited: 'Unlimited', days30: '30 days', months12: '12 months', maksimal: 'MAXIMUM', freePrice: "0 so'm",
    cmpFeatures: [
      'Smart dashboard', 'Products', 'Orders & alerts',
      'Uzum + Yandex Market', 'Analytics', 'Stock sync',
      'Finances & payouts', 'Unit economics',
    ],
    faqBadge: 'FAQ', faqHeading: 'Questions & Answers', faqSub: 'Have another question? Reach us on Telegram',
    faq: [
      { q: 'Do I need a credit card for the free plan?', a: 'No. Starting the free plan requires no payment details.' },
      { q: "What's the main difference between Pro and Pro+?", a: 'Pro gives every core analytics tool for a growing business. Pro+ additionally provides 15-minute priority support.' },
      { q: 'Can I change plan anytime?', a: 'Yes. You can move from Free to Pro or Pro to Pro+ anytime. The change takes effect immediately.' },
      { q: 'Is my data safe?', a: "Yes. All data is stored encrypted and belongs only to you. It's never shared with third parties." },
      { q: 'What discount does the yearly plan give?', aTemplate: (p: string, pp: string) => `The yearly plan is cheaper than monthly: Pro — ${p} so'm/mo, Pro+ — ${pp} so'm/mo (billed yearly).` },
    ],
    bottomTitle: 'Still have a question?', bottomSub: 'Our team is ready to help. We usually reply within 15 minutes.',
    bottomTelegram: 'Message us on Telegram', bottomStart: 'Start free',
    rights: '© 2026 Daromadchi. All rights reserved.',
  },
} as const

const somFmt = new Intl.NumberFormat('uz-UZ')

function FeatureValue({ value, trialLabel }: { value: Cell; trialLabel: string }) {
  // Three states, not two. 'trial' is the whole point of the free tier: the
  // feature is there for the trial window and then it is not, which neither a tick nor a
  // cross tells the truth about.
  if (value === 'trial') {
    return (
      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
        style={{ background: 'rgba(47,109,246,0.12)', color: 'var(--c1)', border: '1px solid rgba(47,109,246,0.35)' }}>
        {trialLabel}
      </span>
    )
  }
  if (value) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: 'rgba(47,109,246,0.16)', border: '1px solid rgba(47,109,246,0.55)' }}>
        <Check className="h-3.5 w-3.5" style={{ color: '#2F6DF6' }} />
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full"
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
      <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
    </span>
  )
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-2xl overflow-hidden transition-all"
      style={{ borderColor: open ? 'rgba(47,109,246,0.4)' : 'var(--border)', background: 'var(--bg-card2)' }}>
      <button className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen(o => !o)}>
        <span className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text-base)' }}>{item.q}</span>
        <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform"
          style={{ color: '#2F6DF6', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
        </div>
      )}
    </div>
  )
}

export default function PricingClient({ prices }: { prices: PricingData }) {
  const { lang, setLang } = useLang()
  const t = T[(lang in T ? lang : 'uz') as Lang]
  const [langOpen, setLangOpen] = useState(false)

  const comparisonFeatures: Feature[] = useMemo(() => {
    const f = t.cmpFeatures
    return [
      { label: f[0], free: true,    paid: true }, // dashboard
      { label: f[1], free: true,    paid: true }, // products
      { label: f[2], free: true,    paid: true }, // orders + alerts
      { label: f[3], free: true,    paid: true }, // both marketplaces
      { label: f[4], free: 'trial', paid: true }, // analytics
      { label: f[5], free: 'trial', paid: true }, // stock sync
      { label: f[6], free: 'trial', paid: true }, // finances / payouts
      { label: f[7], free: 'trial', paid: true }, // unit economics
    ]
  }, [t])

  const faqs: FaqItem[] = useMemo(() => (
    t.faq.map(item => ('aTemplate' in item && item.aTemplate)
      ? { q: item.q, a: item.aTemplate(somFmt.format(prices.pro.yearly), somFmt.format(prices.pro_plus.yearly)) }
      : { q: item.q, a: (item as { a: string }).a })
  ), [t, prices])

  // Only the yearly/monthly toggle survives from the old card block: the price
  // count-up animation drove digits that no longer exist, so its observer, both
  // requestAnimationFrame loops and the counter state went with the cards.
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>
      <style>{`
        @keyframes drm-drop {
          0%   { opacity: 0; transform: translateY(-140px) scale(0.9); }
          50%  { opacity: 1; transform: translateY(18px) scale(1.02); }
          65%  { transform: translateY(-12px) scale(1); }
          80%  { transform: translateY(8px); }
          90%  { transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Nav — theme-aware background + text so links stay readable in light AND dark. */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto backdrop-blur-xl rounded-2xl px-5 h-14 flex items-center justify-between shadow-xl border"
            style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#2F6DF6', boxShadow: '0 4px 14px rgba(47,109,246,0.35)' }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight transition-colors" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Link href="/" className="transition-colors hover:opacity-70">{t.nav.home}</Link>
              <Link href="#compare" className="transition-colors hover:opacity-70">{t.nav.compare}</Link>
              <Link href="#faq" className="transition-colors hover:opacity-70">{t.nav.faq}</Link>
            </nav>
            <div className="flex items-center gap-2">
              {/* Language switcher — writes the shared lang (same store as the homepage). */}
              <div className="relative">
                <button onClick={() => setLangOpen(v => !v)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={{ color: 'var(--text-base)', borderColor: 'var(--border)' }}>
                  {lang.toUpperCase()}
                </button>
                {langOpen && (
                  <div className="absolute right-0 mt-1.5 rounded-xl border shadow-xl overflow-hidden z-50"
                    style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
                    {(['uz', 'ru', 'en'] as Lang[]).map(l => (
                      <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                        className="block w-full text-left text-xs font-bold px-4 py-2 transition-colors"
                        style={{ background: lang === l ? 'rgba(47,109,246,0.14)' : 'transparent', color: lang === l ? '#2F6DF6' : 'var(--text-base)' }}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Link href="/login" className="hidden sm:block text-sm px-3 py-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}>{t.nav.login}</Link>
              <Link href="/login" className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all"
                style={{ background: '#2F6DF6', boxShadow: '0 4px 14px rgba(47,109,246,0.3)' }}>
                {t.nav.start} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-12 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(47,109,246,0.08)" strokeWidth="0.5" />
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-6"
            style={{ color: 'var(--text-base)' }}>
            {t.heroTitle1}<br />
            <span style={{ color: '#2F6DF6' }}>{t.heroTitle2}</span>
          </h1>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-10">
            {t.trust.map(b => (
              <span key={b} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#2F6DF6' }} />
                {b}
              </span>
            ))}
          </div>

          {/* Yearly / Monthly toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-medium" style={{ color: isYearly ? 'var(--text-muted)' : 'var(--text-base)' }}>
              {t.monthly}
            </span>
            <button
              onClick={() => setIsYearly(y => !y)}
              className="relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0"
              style={{ background: isYearly ? '#2F6DF6' : 'var(--border2)' }}
            >
              <span
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                style={{ left: isYearly ? '30px' : '4px' }}
              />
            </button>
            <span className="text-sm font-medium" style={{ color: isYearly ? 'var(--text-base)' : 'var(--text-muted)' }}>
              {t.yearly}
            </span>
          </div>
        </div>
      </section>

      {/* Turnover ladder — the tier follows the seller's own turnover, so
          turnover is the left-hand column and the plan name is the consequence.
          Every price is visible before any input; the field only highlights. */}
      <section className="pb-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <TierTabs lang={lang} interval={isYearly ? 'annual' : 'monthly'} />
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            {tiersT.trialNote[lang]}
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section id="compare" className="py-20 px-4 sm:px-6" style={{ background: 'var(--bg-card)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-4"
              style={{ background: 'rgba(47,109,246,0.12)', border: '1px solid rgba(47,109,246,0.3)', color: '#2F6DF6' }}>
              <Check className="w-3.5 h-3.5" /> {t.cmpBadge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text-base)' }}>{t.cmpHeading}</h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>{t.cmpSub}</p>
          </div>

          <div className="rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
            {/* Two columns, not five: every paid tier carries the same features,
                so four identical columns would only invite a hunt for a
                difference that is not there. */}
            <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="p-5" />
              <div className="border-l p-5 text-center" style={{ borderColor: 'var(--border)' }}>
                <div className="text-sm font-bold sm:text-base" style={{ color: 'var(--text-base)' }}>{t.freeName}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t.freePrice}</div>
              </div>
              <div className="border-l p-5 text-center" style={{ borderColor: 'var(--border)', background: 'rgba(47,109,246,0.08)' }}>
                <div className="text-sm font-bold sm:text-base" style={{ color: '#2F6DF6' }}>{t.paidColumn}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t.paidColumnSub}</div>
              </div>
            </div>

            <div className="grid border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <div className="px-5 py-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.cmpCore}</span>
              </div>
            </div>

            {comparisonFeatures.map((feat, i) => (
              <div key={feat.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] border-b last:border-b-0"
                style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-card2)' }}>
                <div className="flex items-center gap-2 px-5 py-4 text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                  {feat.free === 'trial' && <Clock className="w-3 h-3 shrink-0" style={{ color: 'var(--c1)' }} />}
                  {feat.label}
                </div>
                <div className="flex items-center justify-center border-l px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                  <FeatureValue value={feat.free} trialLabel={t.trialCell} />
                </div>
                <div className="flex items-center justify-center border-l px-5 py-4"
                  style={{ borderColor: 'var(--border)', background: 'rgba(47,109,246,0.05)' }}>
                  <FeatureValue value={feat.paid} trialLabel={t.trialCell} />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>{t.trialFootnote}</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-4"
              style={{ background: 'rgba(47,109,246,0.12)', border: '1px solid rgba(47,109,246,0.3)', color: '#2F6DF6' }}>
              <MessageCircle className="w-3.5 h-3.5" /> {t.faqBadge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text-base)' }}>{t.faqHeading}</h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>{t.faqSub}</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => <FaqRow key={i} item={faq} />)}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-3xl p-10 sm:p-14 text-center overflow-hidden border"
            style={{ background: 'var(--bg-card2)', borderColor: 'rgba(47,109,246,0.25)' }}>
            <div className="absolute top-0 left-1/4 right-1/4 h-px" style={{ background: 'linear-gradient(to right, transparent, #2F6DF6, transparent)' }} />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 mx-auto" style={{ background: 'rgba(47,109,246,0.12)', border: '1px solid rgba(47,109,246,0.3)' }}>
                <MessageCircle className="w-7 h-7" style={{ color: '#2F6DF6' }} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: 'var(--text-base)' }}>{t.bottomTitle}</h2>
              <p className="mb-8 leading-relaxed text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
                {t.bottomSub}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={telegramContactUrl('pricing')} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all text-sm border"
                  style={{ background: '#ffffff', color: '#0e1b2e', borderColor: 'var(--border2)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#2F6DF6">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.892z"/>
                  </svg>
                  {t.bottomTelegram}
                </a>
                <Link href="/login" className="flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-2xl transition-all text-sm border"
                  style={{ borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
                  {t.bottomStart} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#2F6DF6', boxShadow: '0 2px 8px rgba(47,109,246,0.3)' }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.rights}</p>
          <Link href="/" className="text-xs transition-colors flex items-center gap-1" style={{ color: '#2F6DF6' }}>
            {t.nav.home} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
