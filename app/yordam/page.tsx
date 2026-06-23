'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, MessageCircle, ArrowLeft, Menu, X, UserCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme, useLang } from '@/app/providers'
import type { Lang } from '@/lib/i18n'

// ── Palette (mirrors landing page) ───────────────────────────────────────────
const P = {
  ink:    '#0E2233',
  stone:  '#334155',
  card:   '#FFFFFF',
  hair:   '#93C5FD',
  dCanvas:'#161616',
  dCard:  '#1e1e1e',
  dCard2: '#252525',
  dHair:  'rgba(197,232,254,0.18)',
  dMuted: 'rgba(197,232,254,0.55)',
  dText:  '#E8FFF8',
}
const A = {
  light:  '#a0d4fc',
  dark:   '#83c0f9',
  darkBg: 'rgba(160,212,252,0.12)',
  lightBg:'rgba(160,212,252,0.15)',
}

function useIsDark() { return useTheme().theme === 'dark' }
function useAccent() {
  const isDark = useIsDark()
  return {
    color:  isDark ? A.dark  : A.light,
    bg:     isDark ? A.darkBg : A.lightBg,
    tint:   isDark ? A.dark  : '#0E2233',
    btn:    isDark ? A.dark  : '#ffffff',
    btnTxt: isDark ? '#131321' : '#0e1b2e',
    btnHov: isDark ? '#7bbaf7' : '#f0f6ff',
    btnBdr: isDark ? 'transparent' : 'rgba(14,27,46,0.18)',
  }
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const acc = useAccent()
  const { toggle, theme } = useTheme()
  const { setLang } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrolledBg   = isDark ? 'rgba(22,22,22,0.96)' : 'rgba(255,255,255,0.95)'
  const lnk          = isDark ? P.dMuted : P.stone
  const lnkH         = isDark ? P.dText  : P.ink
  const borderCol    = isDark ? P.dHair  : P.hair

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? scrolledBg : (isDark ? 'rgba(22,22,22,0.96)' : 'rgba(255,255,255,0.97)'),
      borderBottom: `1px solid ${isDark ? P.dHair : P.hair}`,
      backdropFilter: 'blur(16px)',
      transition: 'all 0.25s ease',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 76,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            fontSize: 13, fontWeight: 600, color: lnk, transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = lnkH)}
            onMouseLeave={e => (e.currentTarget.style.color = lnk)}>
            <ArrowLeft size={15} />
            {lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : 'Bosh sahifa'}
          </Link>
          <div style={{ width: 1, height: 20, background: isDark ? P.dHair : P.hair }} />
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
            <span style={{ fontWeight: 800, fontSize: 17, color: isDark ? P.dText : P.ink }}>Daromadchi</span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Lang dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setLangOpen(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent',
                border: `1px solid ${borderCol}`, borderRadius: 6, padding: '6px 10px',
                color: lnk, transition: 'all 0.12s', fontFamily: 'inherit' }}>
              {lang.toUpperCase()}
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 56, zIndex: 200,
                    background: isDark ? P.dCard2 : '#fff',
                    border: `1px solid ${isDark ? P.dHair : P.hair}`, borderRadius: 8, overflow: 'hidden' }}>
                  {(['uz','ru','en'] as Lang[]).map(l => (
                    <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600,
                        background: lang === l ? acc.bg : 'transparent',
                        color: lang === l ? acc.tint : (isDark ? P.dMuted : P.stone),
                        cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={toggle}
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: `1px solid ${borderCol}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 15, color: lnk, transition: 'all 0.12s' }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <Link href="/login" className="hidden md:flex items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: 6, border: `1px solid ${borderCol}`, color: lnk, transition: 'all 0.12s' }}>
            <UserCircle size={18} />
          </Link>

          <Link href="/login" className="hidden sm:block"
            style={{ fontSize: 14, fontWeight: 700, background: acc.btn, color: acc.btnTxt,
              padding: '10px 22px', borderRadius: 8, textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
              border: `1.5px solid ${acc.btnBdr}`, boxShadow: isDark ? 'none' : '0 1px 6px rgba(14,27,46,0.10)' }}
            onMouseEnter={e => (e.currentTarget.style.background = acc.btnHov)}
            onMouseLeave={e => (e.currentTarget.style.background = acc.btn)}>
            {lang === 'ru' ? 'Начать бесплатно' : lang === 'en' ? 'Start free' : 'Bepul boshlash'}
          </Link>

          <button className="md:hidden" onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: lnk, padding: 4 }}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: isDark ? P.dCanvas : '#fff', borderTop: `1px solid ${isDark ? P.dHair : P.hair}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Link href="/login" style={{ fontSize: 15, fontWeight: 700, background: '#83c0f9', color: '#131321',
                padding: '12px 20px', borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}>
                {lang === 'ru' ? 'Начать бесплатно' : lang === 'en' ? 'Start free' : 'Bepul boshlash'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── FAQ accordion item ────────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle, isDark, acc }: {
  q: string; a: string | React.ReactNode; open: boolean; onToggle: () => void
  isDark: boolean; acc: ReturnType<typeof useAccent>
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${open ? acc.color : (isDark ? P.dHair : P.hair)}`,
      background: isDark ? P.dCard : '#fff',
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: open ? `0 4px 24px ${isDark ? 'rgba(131,192,249,0.08)' : 'rgba(131,192,249,0.18)'}` : 'none',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'Space Grotesk', system-ui, sans-serif", textAlign: 'left', gap: 16,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? P.dText : P.ink, lineHeight: 1.4 }}>{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
          <ChevronDown size={20} color={isDark ? P.dMuted : P.stone} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 24px 20px', borderTop: `1px solid ${isDark ? P.dHair : P.hair}` }}>
              <div style={{ paddingTop: 16, fontSize: 15, color: isDark ? P.dMuted : P.stone,
                lineHeight: 1.75, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                {a}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ lang }: { lang: string }) {
  const isDark = useIsDark()
  const footBg = isDark ? '#1e1e1e' : '#e8f0fd'
  const bdr    = isDark ? P.dHair   : 'rgba(14,34,51,0.2)'
  const txt    = isDark ? P.dText   : P.ink
  const muted  = isDark ? P.dMuted  : P.ink
  const subtle = isDark ? 'rgba(255,255,255,0.28)' : P.ink

  const cols = [
    { head: lang === 'ru' ? 'Продукт' : lang === 'en' ? 'Product' : 'Mahsulot', links: [
      { label: lang === 'ru' ? 'Войти' : lang === 'en' ? 'Sign in' : 'Kirish', href: '/login' },
      { label: lang === 'ru' ? 'Регистрация' : lang === 'en' ? 'Register' : "Ro'yxatdan o'tish", href: '/login' },
      { label: lang === 'ru' ? 'Тарифы' : lang === 'en' ? 'Pricing' : 'Tariflar', href: '/#pricing' },
    ]},
    { head: lang === 'ru' ? 'Маркетплейсы' : lang === 'en' ? 'Marketplaces' : 'Marketpleyslar', links: [
      { label: 'Uzum Market', href: '#' }, { label: 'Wildberries', href: '#' }, { label: 'Yandex Market', href: '#' },
    ]},
    { head: lang === 'ru' ? 'Контакты' : lang === 'en' ? 'Contact' : 'Aloqa', links: [
      { label: 'Telegram', href: 'tg://user?id=6884517020' },
    ]},
  ]

  return (
    <footer style={{ background: footBg, padding: '64px 24px 32px',
      fontFamily: "'Space Grotesk', system-ui, sans-serif", borderTop: `1px solid ${bdr}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: txt }}>Daromadchi</span>
            </div>
            <p style={{ fontSize: 13, color: muted, lineHeight: 1.65, maxWidth: 240 }}>
              {lang === 'ru'
                ? 'Аналитика Uzum, Wildberries и Yandex Market для продавцов из Узбекистана'
                : lang === 'en'
                ? 'Analytics for Uzum, Wildberries and Yandex Market sellers in Uzbekistan'
                : "O'zbekistondagi sotuvchilar uchun Uzum, Wildberries va Yandex Market tahlili"}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {['Uzum','WB','YM'].map(mp => (
                <div key={mp} style={{ fontSize: 10, fontWeight: 700, color: isDark ? A.dark : P.ink,
                  background: isDark ? A.darkBg : 'rgba(14,34,51,0.12)', borderRadius: 4, padding: '3px 7px' }}>
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
            © 2025 Daromadchi.{' '}
            {lang === 'ru' ? 'г. Ташкент, Узбекистан' : lang === 'en' ? 'Tashkent, Uzbekistan' : "Toshkent shahri, O'zbekiston"}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: lang === 'ru' ? 'Политика конфиденциальности' : lang === 'en' ? 'Privacy policy' : 'Maxfiylik siyosati', href: '/privacy' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: 12, color: subtle, textDecoration: 'none', transition: 'color 0.12s' }}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function YordamPage() {
  const { lang } = useLang()
  const isDark = useIsDark()
  const acc = useAccent()
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const bg   = isDark ? P.dCanvas : '#e8f4fe'
  const ink  = isDark ? P.dText   : P.ink

  // Contact info — link to user by ID (no public username)
  const TG_HREF = 'tg://user?id=6884517020'

  type FaqEntry = { q: string; a: string | React.ReactNode }

  const faqs: FaqEntry[] = lang === 'ru' ? [
    {
      q: 'Что такое Daromadchi?',
      a: 'Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана. Объединяет данные с Uzum Market, Wildberries и Yandex Market в одном дашборде: выручка, прибыль, ДРР, остатки, юнит-экономика и рекламная статистика — всё в реальном времени.',
    },
    {
      q: 'Как начать работу?',
      a: (
        <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Зарегистрируйтесь на <a href="/login" style={{ color: acc.tint, fontWeight: 600 }}>daromadchi.uz/login</a></li>
          <li>Перейдите в Настройки → добавьте API-ключ вашего маркетплейса</li>
          <li>Нажмите «Синхронизировать» — данные загрузятся автоматически</li>
          <li>Готово! Дашборд покажет все показатели</li>
        </ol>
      ),
    },
    {
      q: 'Какие маркетплейсы поддерживаются?',
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf' },
            { name: 'Wildberries', color: '#CB11AB' },
            { name: 'Yandex Market', color: '#E8A000' },
          ].map(mp => (
            <div key={mp.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: mp.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{mp.name}</span>
            </div>
          ))}
          <p style={{ marginTop: 4 }}>Поддержка дополнительных маркетплейсов в разработке.</p>
        </div>
      ),
    },
    {
      q: 'Браузерное расширение бесплатно?',
      a: 'Да, расширение Chrome полностью бесплатно и всегда таким остаётся. Устанавливается из Chrome Web Store одним кликом. Расширение показывает юнит-экономику прямо на страницах Uzum, Wildberries и Yandex Market без переключения вкладок.',
    },
    {
      q: 'Как часто обновляются данные?',
      a: 'Данные синхронизируются каждые 15 минут автоматически. При критических изменениях (низкие остатки, превышение ДРР) вы получаете мгновенное уведомление в Telegram.',
    },
    {
      q: 'Где взять API-ключ?',
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf', steps: 'Личный кабинет продавца → Настройки → API → Создать токен' },
            { name: 'Wildberries', color: '#CB11AB', steps: 'Seller Center → Настройки → Доступ к API → Создать новый ключ (выбрать нужные права)' },
            { name: 'Yandex Market', color: '#E8A000', steps: 'partner.market.yandex.ru → Настройки → API → Создать токен. Также понадобится Campaign ID из URL кабинета.' },
          ].map(mp => (
            <div key={mp.name} style={{ padding: '12px 16px', borderRadius: 10,
              background: isDark ? P.dCard2 : '#f0f6ff',
              border: `1px solid ${isDark ? P.dHair : P.hair}` }}>
              <p style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: mp.color, display: 'inline-block', flexShrink: 0 }} />
                {mp.name}
              </p>
              <p style={{ fontSize: 14, color: isDark ? P.dMuted : P.stone, margin: 0 }}>{mp.steps}</p>
            </div>
          ))}
        </div>
      ),
    },
  ] : lang === 'en' ? [
    {
      q: 'What is Daromadchi?',
      a: "Daromadchi is an analytics platform for marketplace sellers in Uzbekistan. It combines data from Uzum Market, Wildberries and Yandex Market in one dashboard: revenue, profit, ad spend ratio, stock levels, unit economics and advertising stats — all in real time.",
    },
    {
      q: 'How do I get started?',
      a: (
        <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Sign up at <a href="/login" style={{ color: acc.tint, fontWeight: 600 }}>daromadchi.uz/login</a></li>
          <li>Go to Settings → add your marketplace API key</li>
          <li>Click "Sync" — data loads automatically</li>
          <li>Done! The dashboard will show all your metrics</li>
        </ol>
      ),
    },
    {
      q: 'Which marketplaces are supported?',
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf' },
            { name: 'Wildberries', color: '#CB11AB' },
            { name: 'Yandex Market', color: '#E8A000' },
          ].map(mp => (
            <div key={mp.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: mp.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{mp.name}</span>
            </div>
          ))}
          <p style={{ marginTop: 4 }}>Support for additional marketplaces is in development.</p>
        </div>
      ),
    },
    {
      q: 'Is the Chrome extension free?',
      a: 'Yes, the Chrome extension is completely free and always will be. Install it from the Chrome Web Store in one click. It shows unit economics directly on Uzum, Wildberries and Yandex Market pages without switching tabs.',
    },
    {
      q: 'How often is data updated?',
      a: 'Data syncs every 15 minutes automatically. For critical changes (low stock, DRR exceeded) you get an instant Telegram notification.',
    },
    {
      q: 'Where do I get an API key?',
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf', steps: 'Seller cabinet → Settings → API → Create token' },
            { name: 'Wildberries', color: '#CB11AB', steps: 'Seller Center → Settings → API Access → Create new key (select required permissions)' },
            { name: 'Yandex Market', color: '#E8A000', steps: 'partner.market.yandex.ru → Settings → API → Create token. You will also need the Campaign ID from the cabinet URL.' },
          ].map(mp => (
            <div key={mp.name} style={{ padding: '12px 16px', borderRadius: 10,
              background: isDark ? P.dCard2 : '#f0f6ff',
              border: `1px solid ${isDark ? P.dHair : P.hair}` }}>
              <p style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: mp.color, display: 'inline-block', flexShrink: 0 }} />
                {mp.name}
              </p>
              <p style={{ fontSize: 14, color: isDark ? P.dMuted : P.stone, margin: 0 }}>{mp.steps}</p>
            </div>
          ))}
        </div>
      ),
    },
  ] : [
    {
      q: "Daromadchi nima?",
      a: "Daromadchi — O'zbekistondagi marketplace sotuvchilari uchun analitika platformasi. Uzum Market, Wildberries va Yandex Market ma'lumotlarini bitta dashboardda birlashtiradi: tushum, foyda, DRR, qoldiqlar, birlik iqtisodiyoti va reklama statistikasi — barchasi real vaqtda.",
    },
    {
      q: "Qanday boshlash mumkin?",
      a: (
        <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><a href="/login" style={{ color: acc.tint, fontWeight: 600 }}>daromadchi.uz/login</a> saytida ro'yxatdan o'ting</li>
          <li>Sozlamalar bo'limiga o'ting → marketplace API kalitingizni qo'shing</li>
          <li>"Sinxronlashtirish" tugmasini bosing — ma'lumotlar avtomatik yuklanadi</li>
          <li>Tayyor! Dashboard barcha ko'rsatkichlarni ko'rsatadi</li>
        </ol>
      ),
    },
    {
      q: "Qaysi marketpleyslar qo'llab-quvvatlanadi?",
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf' },
            { name: 'Wildberries', color: '#CB11AB' },
            { name: 'Yandex Market', color: '#E8A000' },
          ].map(mp => (
            <div key={mp.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: mp.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{mp.name}</span>
            </div>
          ))}
          <p style={{ marginTop: 4 }}>Qo'shimcha marketpleyslarni qo'llab-quvvatlash ishlab chiqilmoqda.</p>
        </div>
      ),
    },
    {
      q: "Chrome kengaytmasi bepulmi?",
      a: "Ha, Chrome kengaytmasi to'liq bepul va doim shunday bo'lib qoladi. Chrome Web Store dan bir marta bosib o'rnating. Kengaytma Uzum, Wildberries va Yandex Market sahifalarida to'g'ridan-to'g'ri birlik iqtisodiyotini ko'rsatadi — boshqa tab ochish shart emas.",
    },
    {
      q: "Ma'lumotlar qanchalik tez-tez yangilanadi?",
      a: `Ma'lumotlar har 15 daqiqada avtomatik sinxronlanadi. Kritik o'zgarishlar (qoldiq kamayishi, DRR oshishi) bo'lganda Telegram'ga darhol xabar keladi.`,
    },
    {
      q: "API kalitini qayerdan olaman?",
      a: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { name: 'Uzum Market', color: '#494fdf', steps: "Sotuvchi kabineti → Sozlamalar → API → Token yaratish" },
            { name: 'Wildberries', color: '#CB11AB', steps: "Seller Center → Sozlamalar → API ga kirish → Yangi kalit yaratish (kerakli huquqlarni tanlang)" },
            { name: 'Yandex Market', color: '#E8A000', steps: "partner.market.yandex.ru → Sozlamalar → API → Token yaratish. Shuningdek, kabinet URL manzilidan Campaign ID kerak bo'ladi." },
          ].map(mp => (
            <div key={mp.name} style={{ padding: '12px 16px', borderRadius: 10,
              background: isDark ? P.dCard2 : '#f0f6ff',
              border: `1px solid ${isDark ? P.dHair : P.hair}` }}>
              <p style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: mp.color, display: 'inline-block', flexShrink: 0 }} />
                {mp.name}
              </p>
              <p style={{ fontSize: 14, color: isDark ? P.dMuted : P.stone, margin: 0 }}>{mp.steps}</p>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Space Grotesk', system-ui, sans-serif",
      transition: 'background 0.3s' }}>
      <Navbar lang={lang} />

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 80, paddingLeft: 24, paddingRight: 24,
        background: isDark
          ? 'linear-gradient(180deg, rgba(131,192,249,0.06) 0%, transparent 60%)'
          : 'linear-gradient(180deg, rgba(131,192,249,0.22) 0%, transparent 60%)',
        textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
            background: isDark ? 'rgba(131,192,249,0.12)' : 'rgba(131,192,249,0.22)',
            border: `1px solid ${isDark ? 'rgba(131,192,249,0.25)' : 'rgba(131,192,249,0.5)'}`,
            borderRadius: 100, padding: '6px 16px' }}>
            <MessageCircle size={14} color={acc.tint} />
            <span style={{ fontSize: 12, fontWeight: 700, color: acc.tint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {lang === 'ru' ? 'Центр поддержки' : lang === 'en' ? 'Support Center' : 'Yordam markazi'}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 58px)', fontWeight: 800, lineHeight: 1.1,
            color: ink, letterSpacing: '-0.024em', marginBottom: 18, maxWidth: 640, margin: '0 auto 18px' }}>
            {lang === 'ru' ? 'Центр помощи' : lang === 'en' ? 'Help Center' : 'Yordam markazi'}
          </h1>
          <p style={{ fontSize: 18, color: isDark ? P.dMuted : P.stone, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            {lang === 'ru' ? 'Найдите ответы на ваши вопросы'
              : lang === 'en' ? 'Find answers to your questions'
              : 'Savollaringizga javob toping'}
          </p>
        </motion.div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 96px', maxWidth: 760, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: acc.tint, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 24, textAlign: 'center' }}>
            {lang === 'ru' ? 'ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ' : lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : "KO'P SO'RALADIGAN SAVOLLAR"}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((faq, i) => (
              <FaqItem
                key={i}
                q={faq.q}
                a={faq.a}
                open={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                isDark={isDark}
                acc={acc}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 96px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          style={{ maxWidth: 760, margin: '0 auto', borderRadius: 20,
            background: isDark ? P.dCard : '#ffffff',
            border: `1px solid ${isDark ? P.dHair : P.hair}`,
            padding: 'clamp(32px, 5vw, 52px)',
            boxShadow: isDark ? 'none' : '0 8px 40px rgba(131,192,249,0.15)',
            textAlign: 'center' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14, marginBottom: 20,
            background: isDark ? 'rgba(131,192,249,0.12)' : 'rgba(131,192,249,0.2)',
            border: `1px solid ${isDark ? 'rgba(131,192,249,0.25)' : 'rgba(131,192,249,0.45)'}` }}>
            <MessageCircle size={24} color={acc.tint} />
          </div>

          <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: ink, marginBottom: 12 }}>
            {lang === 'ru' ? 'Не нашли ответ?' : lang === 'en' ? "Didn't find an answer?" : 'Javob topa olmadingizmi?'}
          </h2>
          <p style={{ fontSize: 16, color: isDark ? P.dMuted : P.stone, marginBottom: 36, lineHeight: 1.65 }}>
            {lang === 'ru' ? 'Мы поможем вам. Свяжитесь с нами удобным способом.'
              : lang === 'en' ? "We're here to help. Reach us through any channel below."
              : 'Biz yordam beramiz. Qulay usulda biz bilan bog\'laning.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Telegram — opens by user ID */}
            <a href={TG_HREF}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 32px',
                background: '#2AABEE', borderRadius: 14, textDecoration: 'none',
                transition: 'all 0.15s', color: '#fff' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1a9bd8'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2AABEE'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.09l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.469z"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {lang === 'ru' ? 'Написать в Telegram' : lang === 'en' ? 'Message on Telegram' : 'Telegram orqali yozish'}
              </span>
            </a>
          </div>
        </motion.div>
      </section>

      <Footer lang={lang} />
    </div>
  )
}
