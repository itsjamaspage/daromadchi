'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Check, X, Zap, Shield, Star,
  TrendingUp, ChevronRight, MessageCircle, ChevronDown,
  Lock, Users, FileText, Clock, Mail,
} from 'lucide-react'
import { useLang } from '@/app/providers'

// UZS prices derived server-side from the USD source of truth (lib/billing) at
// the live USD→UZS rate. `monthly`/`yearly` are clean so'm figures; `usd` is the
// underlying dollar price shown as secondary text.
export interface PricingData {
  pro:      { usd: number; monthly: number; yearly: number }
  pro_plus: { usd: number; monthly: number; yearly: number }
}

type Lang = 'uz' | 'en' | 'ru'
interface Feature { label: string; free: boolean | string; pro: boolean | string; pro_plus: boolean | string }
interface FaqItem  { q: string; a: string }

// ── i18n ─────────────────────────────────────────────────────────────────────
// Whole-page translations so the RU/UZ/EN switcher in the navbar actually changes
// the content (the switcher writes the shared lang via useLang, same as the
// homepage). Plan offerings themselves are unchanged — only their language.
const T = {
  uz: {
    nav: { home: 'Bosh sahifa', compare: 'Taqqoslash', faq: 'Savollar', login: 'Kirish', start: 'Boshlash' },
    heroTitle1: 'Barcha imkoniyatlar.', heroTitle2: 'Bir joyda.',
    trust: ['3 kun bepul sinov', "Bir nechta do'kon", 'Istalgan vaqt bekor qilish'],
    monthly: 'Oylik', yearly: 'Yillik',
    perMonth: "so'm/oy", usdMonth: '/oy', alwaysFree: 'Hamisha bepul', yearlyLine: 'Yillik',
    onlyProPlus: 'Faqat Pro+ da',
    freeName: 'Bepul', freeDesc: "Boshlash uchun ideal — hech qanday to'lov talab etilmaydi", freeCta: 'Boshlash',
    proName: 'Pro', proDesc: "O'sib kelayotgan biznes uchun to'liq analitika vositalari", proBadge: 'Eng mashhur', proCta: "Sinab ko'ring",
    proPlusName: 'Pro+', proPlusDesc: "Yirik biznes uchun — Pro imkoniyatlari + eksklyuziv funksiyalar", proPlusBadge: 'Maksimal', proPlusCta: 'Pro+ ni boshlash',
    freeFeatures: ["1 ta do'kon", '100 ta mahsulot', '30 kunlik tarix', 'Uzum integratsiya', 'Kengaytma (extension)'],
    proFeatures: [
      "Unlimited do'konlar", 'Unlimited mahsulotlar', '12 oylik tarix', 'Uzum + Yandex Market', 'Unit-ekonomika',
      'Reklama tahlili', 'Qidiruv iboralari', 'Eksport Excel / PDF', 'F&Z (P&L) hisobot', 'Mavsumiylik tahlili',
      'Narx kuzatuvi', 'Maxsus hisobotlar', 'API kirish',
    ],
    proPlusExtras: [
      { label: 'Jamoa (5 foydalanuvchi)', desc: 'Rol va ruxsat boshqaruvi' },
      { label: 'Avtomatik hisobot emailga', desc: 'Kunlik/haftalik yetkazib berish' },
      { label: "Prioritet qo'llab-quvvatlash", desc: '15 daqiqa ichida javob' },
      { label: 'White-label PDF (brend logosi bilan)', desc: "Hisobotlarda o'z logoyingiz" },
    ],
    calloutTitle: "Pro+ nima qo'shadi?",
    calloutBody: "Pro dagi hamma narsa bor. Pro+ faqat katta jamoalar va agentliklar uchun qo'shimcha beradi:",
    calloutHighlight: "5 foydalanuvchi jamoa, avtomatik email hisobot, prioritet qo'llab-quvvatlash va white-label PDF",
    calloutCta: "Pro+ ni ko'rish →",
    cmpBadge: 'Batafsil taqqoslash', cmpHeading: 'Taqqoslash', cmpSub: 'Qaysi tarif sizga mos ekanini aniqlang',
    cmpCore: 'Asosiy imkoniyatlar', unlimited: 'Cheksiz', days30: '30 kun', months12: '12 oy', maksimal: 'MAKSIMAL', freePrice: "0 so'm",
    cmpFeatures: [
      "Do'konlar soni", 'Mahsulotlar soni', 'Tarix chuqurligi', 'Uzum integratsiya', 'Yandex Market',
      'Kengaytma (extension)', 'Unit-ekonomika', 'Reklama tahlili', 'Qidiruv iboralari', 'Eksport Excel / PDF',
      'F&Z (P&L) hisobot', 'Mavsumiylik tahlili', 'Narx kuzatuvi', 'Maxsus hisobotlar', 'API kirish',
      'Jamoa (5 foydalanuvchi)', 'Avtomatik hisobot emailga', "Prioritet qo'llab-quvvatlash", 'White-label PDF',
    ],
    faqBadge: "Ko'p so'raladigan savollar", faqHeading: 'Savollar & Javoblar', faqSub: "Qo'shimcha savolingiz bo'lsa Telegram orqali bog'laning",
    faq: [
      { q: 'Bepul tarifda kredit karta kerakmi?', a: "Yo'q. Bepul tarifni boshlash uchun hech qanday to'lov ma'lumoti talab etilmaydi." },
      { q: 'Pro va Pro+ orasidagi asosiy farq nima?', a: "Pro tarifi o'sib kelayotgan biznes uchun barcha asosiy analitika vositalarini beradi. Pro+ esa qo'shimcha ravishda API kirish, 5 ta jamoa a'zosi, maxsus hisobotlar va 15 daqiqali prioritet qo'llab-quvvatlashni taqdim etadi." },
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
    trust: ['3 дня бесплатно', 'Несколько магазинов', 'Отмена в любой момент'],
    monthly: 'Помесячно', yearly: 'Ежегодно',
    perMonth: 'сум/мес', usdMonth: '/мес', alwaysFree: 'Всегда бесплатно', yearlyLine: 'За год',
    onlyProPlus: 'Только в Pro+',
    freeName: 'Бесплатно', freeDesc: 'Идеально для старта — оплата не требуется', freeCta: 'Начать',
    proName: 'Pro', proDesc: 'Полный набор аналитики для растущего бизнеса', proBadge: 'Популярный', proCta: 'Попробовать',
    proPlusName: 'Pro+', proPlusDesc: 'Для крупного бизнеса — возможности Pro + эксклюзивные функции', proPlusBadge: 'Максимум', proPlusCta: 'Подключить Pro+',
    freeFeatures: ['1 магазин', '100 товаров', 'История 30 дней', 'Интеграция Uzum', 'Расширение (extension)'],
    proFeatures: [
      'Безлимит магазинов', 'Безлимит товаров', 'История 12 месяцев', 'Uzum + Yandex Market', 'Юнит-экономика',
      'Аналитика рекламы', 'Поисковые запросы', 'Экспорт Excel / PDF', 'Отчёт P&L', 'Анализ сезонности',
      'Отслеживание цен', 'Кастомные отчёты', 'Доступ к API',
    ],
    proPlusExtras: [
      { label: 'Команда (5 пользователей)', desc: 'Управление ролями и доступом' },
      { label: 'Автоотчёты на email', desc: 'Ежедневная/еженедельная доставка' },
      { label: 'Приоритетная поддержка', desc: 'Ответ в течение 15 минут' },
      { label: 'White-label PDF (с вашим логотипом)', desc: 'Ваш логотип в отчётах' },
    ],
    calloutTitle: 'Что добавляет Pro+?',
    calloutBody: 'Всё из Pro включено. Pro+ добавляет только для крупных команд и агентств:',
    calloutHighlight: 'команда на 5 пользователей, автоотчёты на email, приоритетная поддержка и white-label PDF',
    calloutCta: 'Смотреть Pro+ →',
    cmpBadge: 'Подробное сравнение', cmpHeading: 'Сравнение', cmpSub: 'Определите, какой тариф вам подходит',
    cmpCore: 'Основные возможности', unlimited: 'Безлимит', days30: '30 дней', months12: '12 месяцев', maksimal: 'МАКСИМУМ', freePrice: '0 сум',
    cmpFeatures: [
      'Количество магазинов', 'Количество товаров', 'Глубина истории', 'Интеграция Uzum', 'Yandex Market',
      'Расширение (extension)', 'Юнит-экономика', 'Аналитика рекламы', 'Поисковые запросы', 'Экспорт Excel / PDF',
      'Отчёт P&L', 'Анализ сезонности', 'Отслеживание цен', 'Кастомные отчёты', 'Доступ к API',
      'Команда (5 пользователей)', 'Автоотчёты на email', 'Приоритетная поддержка', 'White-label PDF',
    ],
    faqBadge: 'Частые вопросы', faqHeading: 'Вопросы и ответы', faqSub: 'Есть ещё вопрос? Напишите нам в Telegram',
    faq: [
      { q: 'Нужна ли карта для бесплатного тарифа?', a: 'Нет. Для старта на бесплатном тарифе платёжные данные не нужны.' },
      { q: 'В чём основная разница между Pro и Pro+?', a: 'Pro даёт все основные инструменты аналитики для растущего бизнеса. Pro+ дополнительно включает доступ к API, команду из 5 пользователей, кастомные отчёты и приоритетную поддержку с ответом за 15 минут.' },
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
    trust: ['3-day free trial', 'Multiple stores', 'Cancel anytime'],
    monthly: 'Monthly', yearly: 'Yearly',
    perMonth: "so'm/mo", usdMonth: '/mo', alwaysFree: 'Free forever', yearlyLine: 'Yearly',
    onlyProPlus: 'Pro+ only',
    freeName: 'Free', freeDesc: 'Perfect to start — no payment required', freeCta: 'Get started',
    proName: 'Pro', proDesc: 'Full analytics toolkit for a growing business', proBadge: 'Most popular', proCta: 'Try it',
    proPlusName: 'Pro+', proPlusDesc: 'For large business — Pro features + exclusive tools', proPlusBadge: 'Maximum', proPlusCta: 'Get Pro+',
    freeFeatures: ['1 store', '100 products', '30-day history', 'Uzum integration', 'Extension'],
    proFeatures: [
      'Unlimited stores', 'Unlimited products', '12-month history', 'Uzum + Yandex Market', 'Unit economics',
      'Ad analytics', 'Search terms', 'Export Excel / PDF', 'P&L report', 'Seasonality analysis',
      'Price tracking', 'Custom reports', 'API access',
    ],
    proPlusExtras: [
      { label: 'Team (5 users)', desc: 'Roles & permissions' },
      { label: 'Automated email reports', desc: 'Daily/weekly delivery' },
      { label: 'Priority support', desc: 'Reply within 15 minutes' },
      { label: 'White-label PDF (your logo)', desc: 'Your logo on reports' },
    ],
    calloutTitle: 'What does Pro+ add?',
    calloutBody: 'Everything in Pro is included. Pro+ adds, just for large teams and agencies:',
    calloutHighlight: 'a 5-user team, automated email reports, priority support and white-label PDF',
    calloutCta: 'See Pro+ →',
    cmpBadge: 'Detailed comparison', cmpHeading: 'Comparison', cmpSub: 'Find the plan that fits you',
    cmpCore: 'Core features', unlimited: 'Unlimited', days30: '30 days', months12: '12 months', maksimal: 'MAXIMUM', freePrice: "0 so'm",
    cmpFeatures: [
      'Number of stores', 'Number of products', 'History depth', 'Uzum integration', 'Yandex Market',
      'Extension', 'Unit economics', 'Ad analytics', 'Search terms', 'Export Excel / PDF',
      'P&L report', 'Seasonality analysis', 'Price tracking', 'Custom reports', 'API access',
      'Team (5 users)', 'Automated email reports', 'Priority support', 'White-label PDF',
    ],
    faqBadge: 'FAQ', faqHeading: 'Questions & Answers', faqSub: 'Have another question? Reach us on Telegram',
    faq: [
      { q: 'Do I need a credit card for the free plan?', a: 'No. Starting the free plan requires no payment details.' },
      { q: "What's the main difference between Pro and Pro+?", a: 'Pro gives every core analytics tool for a growing business. Pro+ additionally provides API access, a 5-member team, custom reports and 15-minute priority support.' },
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

function FeatureValue({ value, col }: { value: boolean | string; col: 'free' | 'pro' | 'pro_plus' }) {
  const isProplus = col === 'pro_plus'
  if (typeof value === 'string') {
    return <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{value}</span>
  }
  if (value) {
    // Brand-blue check for Pro, gold for Pro+ — both readable in light + dark.
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{
          background: isProplus ? 'rgba(234,179,8,0.18)' : 'rgba(47,109,246,0.16)',
          border: `1px solid ${isProplus ? 'rgba(202,138,4,0.55)' : 'rgba(47,109,246,0.55)'}`,
        }}>
        <Check className="w-3.5 h-3.5" style={{ color: isProplus ? '#b45309' : '#2F6DF6' }} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
      <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
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

  const PROPLUS_EXTRAS = useMemo(() => {
    const icons = [Users, Mail, Clock, FileText]
    return t.proPlusExtras.map((e, i) => ({ icon: icons[i], label: e.label, desc: e.desc }))
  }, [t])

  // Plan cards, built from the server-computed UZS prices. Free stays at 0.
  const plans = useMemo(() => ([
    {
      key: 'free',
      name: t.freeName,
      usd: 0,
      monthlyPrice: 0,
      yearlyPrice: 0,
      desc: t.freeDesc,
      icon: Zap,
      highlighted: false,
      badge: null as string | null,
      cta: t.freeCta,
      href: '/login',
      features: t.freeFeatures as readonly string[],
      extras: [] as typeof PROPLUS_EXTRAS,
    },
    {
      key: 'pro',
      name: t.proName,
      usd: prices.pro.usd,
      monthlyPrice: prices.pro.monthly,
      yearlyPrice: prices.pro.yearly,
      desc: t.proDesc,
      icon: Shield,
      highlighted: true,
      badge: t.proBadge as string | null,
      cta: t.proCta,
      href: '/login?plan=pro',
      features: t.proFeatures as readonly string[],
      extras: [] as typeof PROPLUS_EXTRAS,
    },
    {
      key: 'pro_plus',
      name: t.proPlusName,
      usd: prices.pro_plus.usd,
      monthlyPrice: prices.pro_plus.monthly,
      yearlyPrice: prices.pro_plus.yearly,
      desc: t.proPlusDesc,
      icon: Star,
      highlighted: false,
      badge: t.proPlusBadge as string | null,
      cta: t.proPlusCta,
      href: '/login?plan=pro_plus',
      features: t.proFeatures as readonly string[],
      extras: PROPLUS_EXTRAS,
    },
  ]), [prices, t, PROPLUS_EXTRAS])

  const comparisonFeatures: Feature[] = useMemo(() => {
    const f = t.cmpFeatures
    return [
      { label: f[0],  free: '1',         pro: t.unlimited, pro_plus: t.unlimited },
      { label: f[1],  free: '100',       pro: t.unlimited, pro_plus: t.unlimited },
      { label: f[2],  free: t.days30,    pro: t.months12,  pro_plus: t.months12  },
      { label: f[3],  free: true,        pro: true,        pro_plus: true        },
      { label: f[4],  free: false,       pro: true,        pro_plus: true        },
      { label: f[5],  free: true,        pro: true,        pro_plus: true        },
      { label: f[6],  free: false,       pro: true,        pro_plus: true        },
      { label: f[7],  free: false,       pro: true,        pro_plus: true        },
      { label: f[8],  free: false,       pro: true,        pro_plus: true        },
      { label: f[9],  free: false,       pro: true,        pro_plus: true        },
      { label: f[10], free: false,       pro: true,        pro_plus: true        },
      { label: f[11], free: false,       pro: true,        pro_plus: true        },
      { label: f[12], free: false,       pro: true,        pro_plus: true        },
      { label: f[13], free: false,       pro: true,        pro_plus: true        },
      { label: f[14], free: false,       pro: true,        pro_plus: true        },
      { label: f[15], free: false,       pro: false,       pro_plus: true        },
      { label: f[16], free: false,       pro: false,       pro_plus: true        },
      { label: f[17], free: false,       pro: false,       pro_plus: true        },
      { label: f[18], free: false,       pro: false,       pro_plus: true        },
    ]
  }, [t])

  const faqs: FaqItem[] = useMemo(() => (
    t.faq.map(item => ('aTemplate' in item && item.aTemplate)
      ? { q: item.q, a: item.aTemplate(somFmt.format(prices.pro.yearly), somFmt.format(prices.pro_plus.yearly)) }
      : { q: item.q, a: (item as { a: string }).a })
  ), [t, prices])

  const cardsGridRef                        = useRef<HTMLDivElement>(null)
  const firedRef                            = useRef(false)
  const [hasAnimated,    setHasAnimated]    = useState(false)
  const [counts,         setCounts]         = useState([0, 0, 0])
  const [isYearly,       setIsYearly]       = useState(false)

  useEffect(() => {
    const el = cardsGridRef.current
    if (!el) return

    const startAnimation = () => {
      if (firedRef.current) return
      firedRef.current = true
      setTimeout(() => {
        setHasAnimated(true)
        const duration = 1500
        const targets = plans.map(p => isYearly ? p.yearlyPrice : p.monthlyPrice)
        const start = performance.now()
        const tick = (now: number) => {
          const t2 = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - t2, 3)
          setCounts(targets.map(v => Math.round(v * ease)))
          if (t2 < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }, 400)
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { obs.disconnect(); startAnimation() }
      },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hasAnimated) return
    const targets = plans.map(p => isYearly ? p.yearlyPrice : p.monthlyPrice)
    const duration = 600
    const start = performance.now()
    const startCounts = [...counts]
    const tick = (now: number) => {
      const t2 = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t2, 3)
      setCounts(targets.map((v, i) => Math.round(startCounts[i] + (v - startCounts[i]) * ease)))
      if (t2 < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYearly])

  function fmtCount(n: number) {
    return new Intl.NumberFormat('uz-UZ').format(n)
  }

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

      {/* Pricing cards */}
      <section className="pb-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div ref={cardsGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan, cardIdx) => {
              const Icon = plan.icon
              const isProplus = plan.key === 'pro_plus'
              const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice
              const displayPrice = currentPrice === 0 ? '0' : fmtCount(counts[cardIdx])

              return (
                <div
                  key={plan.key}
                  className="relative flex flex-col rounded-3xl border overflow-hidden"
                  style={{
                    background: plan.highlighted
                      ? 'linear-gradient(160deg, #0e1b2e 0%, #17335c 100%)'
                      : 'var(--bg-card2)',
                    borderColor: plan.highlighted
                      ? 'rgba(47,109,246,0.6)'
                      : isProplus
                      ? 'rgba(202,138,4,0.4)'
                      : 'var(--border)',
                    boxShadow: plan.highlighted
                      ? '0 8px 48px rgba(23,51,92,0.35), 0 2px 12px rgba(0,0,0,0.25)'
                      : undefined,
                    opacity: hasAnimated ? undefined : 0,
                    animation: hasAnimated
                      ? `drm-drop 1s cubic-bezier(0.22,0.61,0.36,1) ${cardIdx * 180}ms both`
                      : undefined,
                    transform: plan.highlighted ? 'scale(1.02)' : undefined,
                  }}
                >
                  {/* Top accent line */}
                  {plan.highlighted && (
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, #2F6DF6, #60a5fa, #2F6DF6)' }} />
                  )}
                  {isProplus && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                  )}

                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-white"
                        style={{
                          background: isProplus
                            ? 'linear-gradient(to right, #b45309, #d97706)'
                            : '#2F6DF6',
                          boxShadow: isProplus ? '0 4px 12px rgba(180,83,9,0.3)' : '0 4px 12px rgba(47,109,246,0.35)',
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1 gap-5">
                    {/* Plan name + icon */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0" style={{
                        background: plan.highlighted ? 'rgba(47,109,246,0.22)' : isProplus ? 'rgba(234,179,8,0.12)' : 'var(--bg-input)',
                        borderColor: plan.highlighted ? 'rgba(47,109,246,0.5)' : isProplus ? 'rgba(202,138,4,0.35)' : 'var(--border2)',
                      }}>
                        <Icon className="w-5 h-5" style={{ color: plan.highlighted ? '#7bb0ff' : isProplus ? '#b45309' : 'var(--text-muted)' }} />
                      </div>
                      <h3 className="font-bold text-xl" style={{ color: plan.highlighted ? '#ffffff' : 'var(--text-base)' }}>{plan.name}</h3>
                    </div>

                    {/* Price */}
                    <div>
                      <div className="flex items-end gap-1.5">
                        <span className="text-5xl font-black tabular-nums leading-none" style={{
                          color: plan.highlighted ? '#ffffff' : isProplus ? '#b45309' : 'var(--text-base)',
                        }}>
                          {displayPrice}
                        </span>
                        {currentPrice > 0 && (
                          <span className="text-sm font-medium pb-1" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                            {t.perMonth}
                          </span>
                        )}
                      </div>
                      {/* USD source-of-truth reference */}
                      {currentPrice > 0 && (
                        <p className="text-xs mt-1" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
                          ≈ ${plan.usd}{t.usdMonth}
                        </p>
                      )}
                      {currentPrice === 0 && (
                        <p className="text-sm mt-1" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                          {t.alwaysFree}
                        </p>
                      )}
                      {isYearly && currentPrice > 0 && (
                        <p className="text-xs mt-1 font-medium" style={{ color: plan.highlighted ? '#7bb0ff' : '#2F6DF6' }}>
                          {t.yearlyLine}: {fmtCount(currentPrice * 12)} so&rsquo;m
                        </p>
                      )}
                    </div>

                    {/* Desc */}
                    <p className="text-sm leading-relaxed -mt-1" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      {plan.desc}
                    </p>

                    {/* CTA */}
                    <Link href={plan.href}
                      className="flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-sm"
                      style={
                        plan.highlighted
                          ? { background: '#ffffff', color: '#0e1b2e', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }
                          : isProplus
                          ? { background: 'linear-gradient(to right, #b45309, #d97706)', color: '#ffffff', boxShadow: '0 4px 20px rgba(180,83,9,0.25)' }
                          : { background: 'var(--bg-input)', color: 'var(--text-base)', border: '1px solid var(--border2)' }
                      }>
                      {plan.cta} <ChevronRight className="w-4 h-4" />
                    </Link>

                    {/* Divider */}
                    <div className="h-px" style={{ background: plan.highlighted ? 'rgba(255,255,255,0.12)' : 'var(--border)' }} />

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{
                            background: plan.highlighted ? 'rgba(123,176,255,0.22)' : isProplus ? 'rgba(234,179,8,0.14)' : 'rgba(47,109,246,0.12)',
                            border: `1px solid ${plan.highlighted ? 'rgba(123,176,255,0.4)' : isProplus ? 'rgba(202,138,4,0.4)' : 'rgba(47,109,246,0.35)'}`,
                          }}>
                            <Check className="w-3 h-3" style={{ color: plan.highlighted ? '#7bb0ff' : isProplus ? '#b45309' : '#2F6DF6' }} />
                          </span>
                          <span className="text-sm leading-relaxed" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.82)' : 'var(--text-base)' }}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Pro+ exclusives */}
                    {isProplus && plan.extras.length > 0 && (
                      <div className="rounded-2xl p-4 border" style={{ background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(202,138,4,0.3)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="w-3.5 h-3.5" style={{ color: '#b45309' }} />
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#b45309' }}>{t.onlyProPlus}</span>
                        </div>
                        <ul className="space-y-2.5">
                          {plan.extras.map(({ icon: ExtraIcon, label, desc }) => (
                            <li key={label} className="flex items-start gap-2.5">
                              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center border" style={{ background: 'rgba(234,179,8,0.18)', borderColor: 'rgba(202,138,4,0.4)' }}>
                                <ExtraIcon className="w-3 h-3" style={{ color: '#b45309' }} />
                              </span>
                              <div>
                                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-base)' }}>{label}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Callout — brand-blue accent + solid text so it reads on the light canvas. */}
          <div className="mt-6 rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: 'rgba(47,109,246,0.08)', borderColor: 'rgba(47,109,246,0.3)' }}>
            <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(47,109,246,0.16)', border: '1px solid rgba(47,109,246,0.4)' }}>
              <Star className="w-5 h-5" style={{ color: '#2F6DF6' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>{t.calloutTitle}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t.calloutBody}{' '}
                <span className="font-semibold" style={{ color: '#2F6DF6' }}>{t.calloutHighlight}</span>.
              </p>
            </div>
            <Link href="/login?plan=pro_plus" className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
              style={{ background: '#2F6DF6' }}>
              {t.calloutCta}
            </Link>
          </div>
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
            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="p-5 col-span-1" />
              {[t.freeName, t.proName, t.proPlusName].map((name, idx) => (
                <div key={name} className="p-5 text-center border-l" style={{
                  borderColor: 'var(--border)',
                  background: idx === 1 ? 'rgba(47,109,246,0.08)' : idx === 2 ? 'rgba(234,179,8,0.07)' : undefined,
                }}>
                  <div className="font-bold text-sm sm:text-base" style={{ color: idx === 1 ? '#2F6DF6' : idx === 2 ? '#b45309' : 'var(--text-base)' }}>{name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {idx === 0 ? t.freePrice : idx === 1 ? `${somFmt.format(prices.pro.monthly)} ${t.perMonth.split('/')[0]}` : `${somFmt.format(prices.pro_plus.monthly)} ${t.perMonth.split('/')[0]}`}
                  </div>
                  {idx === 2 && (
                    <div className="mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.18)', color: '#b45309' }}>{t.maksimal}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <div className="px-5 py-2 col-span-4">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.cmpCore}</span>
              </div>
            </div>

            {comparisonFeatures.map((feat, i) => {
              const isProplusOnly = !feat.pro && feat.pro_plus
              return (
                <div key={feat.label}
                  className="grid grid-cols-4 border-b last:border-b-0"
                  style={{
                    borderColor: 'var(--border)',
                    background: isProplusOnly ? 'rgba(234,179,8,0.05)' : i % 2 === 0 ? 'transparent' : 'var(--bg-card2)',
                  }}>
                  <div className="px-5 py-4 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                    {isProplusOnly && <Lock className="w-3 h-3 shrink-0" style={{ color: '#b45309' }} />}
                    {feat.label}
                  </div>
                  {(['free', 'pro', 'pro_plus'] as const).map((col, idx) => (
                    <div key={col} className="px-5 py-4 flex items-center justify-center border-l" style={{
                      borderColor: 'var(--border)',
                      background: idx === 1 ? 'rgba(47,109,246,0.05)' : idx === 2 ? 'rgba(234,179,8,0.05)' : undefined,
                    }}>
                      <FeatureValue value={feat[col]} col={col} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
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
                <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
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
