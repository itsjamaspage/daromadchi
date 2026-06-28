'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import BorderGlow from '@/app/components/BorderGlow'
import SectionHoverAnim from '@/app/components/SectionHoverAnim'

const COMPANY_EMAIL = 'support@daromadchi.uz'

const T = {
  uz: {
    title: 'Foydalanish shartlari',
    subtitle: "Daromadchi platformasidan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.",
    updated: 'Oxirgi yangilanish: 2026-06-08',
    sections: [
      {
        heading: '1. Platformadan foydalanish',
        short: 'Foydalanish',
        body: `Daromadchi — Uzbekiston bozorlarida (Uzum Market, Wildberries, Yandex Market) savdo qiluvchi sotuvchilar uchun mo'ljallangan analitika platformasidir.\n\nPlatformadan foydalanish uchun:\n• Faqat o'zingizga tegishli yoki vakolatli bo'lgan marketplace hisobi API kalitlarini kiritishingiz mumkin.\n• Platformani buzish, qayta sotish yoki ruxsatsiz maqsadlarda foydalanish taqiqlanadi.\n• Hisob ma'lumotlarini maxfiy saqlash va ularga ruxsatsiz kirishni darhol bizga xabar qilish majburiydir.`,
      },
      {
        heading: '2. Hisob va xavfsizlik',
        short: 'Xavfsizlik',
        body: `Siz o'z hisobingiz xavfsizligi uchun javobgarsiz. Uchinchi shaxslarga hisob ma'lumotlarini berish taqiqlanadi. Hisob sizga shaxsiy va uzatilmas tarzda beriladi.`,
      },
      {
        heading: '3. Xizmat mavjudligi',
        short: 'Mavjudlik',
        body: `Biz xizmatni uzluksiz ta'minlashga harakat qilamiz, ammo texnik ta'mirlash, yangilanish yoki boshqa sabablarga ko'ra vaqtincha to'xtashlar bo'lishi mumkin. Biz ma'lum muddat ichida xizmat ko'rsatilishini kafolatlamaymiz.`,
      },
      {
        heading: '4. Intellektual mulk',
        short: 'Mulk',
        body: `Platformadagi barcha kontent, dizayn va dasturiy ta'minot Daromadchi'ga tegishli. Ruxsatsiz nusxa ko'chirish, tarqatish yoki qayta foydalanish taqiqlanadi.`,
      },
      {
        heading: '5. Javobgarlilik chegarasi',
        short: 'Javobgarlik',
        body: `Daromadchi — ma'lumot ko'rsatish vositasi. Biz marketplace API'laridan olingan ma'lumotlarning to'liqligi yoki dolzarbligi uchun javob bermaymiz. Platformadagi tahlillar asosida qabul qilingan tijorat qarorlar uchun javobgarlik foydalanuvchida qoladi.`,
      },
      {
        heading: "6. Shartlarning o'zgarishi",
        short: "O'zgarish",
        body: `Biz ushbu shartlarni istalgan vaqtda o'zgartirish huquqini saqlaymiz. Muhim o'zgarishlar haqida elektron pochta orqali xabar beramiz. Platformadan foydalanishni davom ettirish yangilangan shartlarni qabul qilish deb hisoblanadi.`,
      },
      {
        heading: "7. Hisob o'chirish",
        short: "O'chirish",
        body: `Siz istalgan vaqtda hisobingizni o'chirishingiz mumkin. O'chirish so'rovi uchun ${COMPANY_EMAIL} manziliga murojaat qiling. Hisobingiz o'chirilganidan so'ng 30 kun ichida ma'lumotlaringiz to'liq o'chiriladi.`,
      },
      {
        heading: "8. Qo'llaniladigan qonun",
        short: 'Qonun',
        body: `Ushbu shartlar O'zbekiston Respublikasi qonunlariga muvofiq boshqariladi. Nizolar O'zbekiston Respublikasining vakolatli sudlari orqali hal etiladi.`,
      },
      {
        heading: '9. Aloqa',
        short: 'Aloqa',
        body: `Savollar yoki shikoyatlar uchun:\nElektron pochta: ${COMPANY_EMAIL}`,
      },
    ],
  },
  ru: {
    title: 'Условия использования',
    subtitle: 'Используя платформу Daromadchi, вы соглашаетесь с данными условиями.',
    updated: 'Последнее обновление: 2026-06-08',
    sections: [
      {
        heading: '1. Использование платформы',
        short: 'Использование',
        body: `Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Wildberries, Yandex Market).\n\nДля использования платформы:\n• Вы можете вводить только API-ключи аккаунтов маркетплейса, которые принадлежат вам или на использование которых вы уполномочены.\n• Запрещается взлом, перепродажа или использование платформы в несанкционированных целях.\n• Вы обязаны хранить учётные данные в тайне и незамедлительно сообщать нам о несанкционированном доступе.`,
      },
      {
        heading: '2. Аккаунт и безопасность',
        short: 'Безопасность',
        body: `Вы несёте ответственность за безопасность своего аккаунта. Передача учётных данных третьим лицам запрещена. Аккаунт предоставляется вам лично и не подлежит передаче.`,
      },
      {
        heading: '3. Доступность сервиса',
        short: 'Доступность',
        body: `Мы стремимся обеспечить бесперебойную работу сервиса, однако возможны временные перерывы в связи с техническим обслуживанием, обновлениями или иными причинами. Мы не гарантируем доступность сервиса в течение определённого времени.`,
      },
      {
        heading: '4. Интеллектуальная собственность',
        short: 'Собственность',
        body: `Всё содержимое, дизайн и программное обеспечение платформы принадлежат Daromadchi. Несанкционированное копирование, распространение или повторное использование запрещены.`,
      },
      {
        heading: '5. Ограничение ответственности',
        short: 'Ответственность',
        body: `Daromadchi является инструментом отображения данных. Мы не несём ответственности за полноту или актуальность данных, полученных через API маркетплейсов. Ответственность за коммерческие решения, принятые на основе аналитики платформы, лежит на пользователе.`,
      },
      {
        heading: '6. Изменение условий',
        short: 'Изменения',
        body: `Мы оставляем за собой право изменять настоящие условия в любое время. О существенных изменениях мы уведомим вас по электронной почте. Продолжение использования платформы означает согласие с обновлёнными условиями.`,
      },
      {
        heading: '7. Удаление аккаунта',
        short: 'Удаление',
        body: `Вы можете удалить свой аккаунт в любое время. Для этого обратитесь на ${COMPANY_EMAIL}. После удаления аккаунта ваши данные будут полностью удалены в течение 30 дней.`,
      },
      {
        heading: '8. Применимое право',
        short: 'Право',
        body: `Настоящие условия регулируются законодательством Республики Узбекистан. Споры разрешаются через компетентные суды Республики Узбекистан.`,
      },
      {
        heading: '9. Контакты',
        short: 'Контакты',
        body: `По вопросам или жалобам:\nЭлектронная почта: ${COMPANY_EMAIL}`,
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    subtitle: 'By using the Daromadchi platform, you agree to these terms.',
    updated: 'Last updated: 2026-06-08',
    sections: [
      {
        heading: '1. Use of the platform',
        short: 'Usage',
        body: `Daromadchi is an analytics platform for sellers on Uzbekistan marketplaces (Uzum Market, Wildberries, Yandex Market).\n\nTo use the platform:\n• You may only enter API keys for marketplace accounts you own or are authorised to use.\n• Hacking, reselling or using the platform for unauthorised purposes is prohibited.\n• You must keep your credentials confidential and immediately notify us of any unauthorised access.`,
      },
      {
        heading: '2. Account and security',
        short: 'Security',
        body: `You are responsible for the security of your account. Sharing credentials with third parties is prohibited. Your account is personal and non-transferable.`,
      },
      {
        heading: '3. Service availability',
        short: 'Availability',
        body: `We strive to provide uninterrupted service, but temporary outages may occur due to maintenance, updates, or other reasons. We do not guarantee uptime for any specific period.`,
      },
      {
        heading: '4. Intellectual property',
        short: 'Property',
        body: `All content, design and software on the platform belongs to Daromadchi. Unauthorised copying, distribution or reuse is prohibited.`,
      },
      {
        heading: '5. Limitation of liability',
        short: 'Liability',
        body: `Daromadchi is a data display tool. We are not responsible for the completeness or accuracy of data obtained via marketplace APIs. Commercial decisions made based on platform analytics remain the user's responsibility.`,
      },
      {
        heading: '6. Changes to terms',
        short: 'Changes',
        body: `We reserve the right to update these terms at any time. We will notify you of material changes by email. Continued use of the platform constitutes acceptance of the updated terms.`,
      },
      {
        heading: '7. Account deletion',
        short: 'Deletion',
        body: `You may delete your account at any time by contacting ${COMPANY_EMAIL}. Your data will be permanently deleted within 30 days of account deletion.`,
      },
      {
        heading: '8. Governing law',
        short: 'Law',
        body: `These terms are governed by the laws of the Republic of Uzbekistan. Disputes shall be resolved through the competent courts of the Republic of Uzbekistan.`,
      },
      {
        heading: '9. Contact',
        short: 'Contact',
        body: `For questions or complaints:\nEmail: ${COMPANY_EMAIL}`,
      },
    ],
  },
}

const NAVBAR_H = 68

export default function TermsPage() {
  const { lang } = useLang()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = T[lang] ?? T.uz
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollLockRef = useRef(false)
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-idx'))
            setActive(idx)
          }
        })
      },
      { rootMargin: `-${NAVBAR_H + 32}px 0px -55% 0px`, threshold: 0 }
    )
    const els = document.querySelectorAll('[data-idx]')
    els.forEach((el) => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [lang])

  const scrollTo = (idx: number) => {
    const el = document.getElementById(`section-${idx}`)
    if (!el) return
    setActive(idx)
    const y = el.getBoundingClientRect().top + window.scrollY - NAVBAR_H - 36

    scrollLockRef.current = true
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current)
    scrollLockTimerRef.current = setTimeout(() => { scrollLockRef.current = false }, 1000)

    window.scrollTo({ top: y, behavior: 'smooth' })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(idx)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2000)
  }

  return (
    <div className="flex relative overflow-hidden">
      <SectionHoverAnim
        colors={isDark ? ['#ffffff', '#f5f5f5', '#ebebeb', '#dcdcdc', '#cdcdcd'] : ['#ffffff', '#ffffff', '#f8fafc', '#f0f0f0', '#e8e8e8']}
        opacity={0.5}
      />
      {/* Sidebar */}
      <aside
        className="sticky top-[68px] self-start h-[calc(100vh-68px)] flex-shrink-0 border-r transition-all duration-300 overflow-hidden"
        style={{
          width: open ? 280 : 60,
          borderColor: 'var(--border)',
          background: 'var(--bg-card)',
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-end px-4 py-5 border-b transition-colors hover:text-[var(--c1)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {open
            ? <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
        </button>

        <nav className="flex flex-col gap-1.5 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 68px - 58px)' }}>
          {t.sections.map((s, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              title={s.heading}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap overflow-hidden border"
              style={{
                color: active === i ? 'var(--c1)' : 'var(--text-base)',
                background: active === i ? 'rgba(0,212,255,0.10)' : 'transparent',
                borderColor: active === i ? 'var(--c1)' : 'transparent',
              }}
            >
              {open && <>
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: active === i ? 'rgba(0,212,255,0.20)' : 'rgba(0,212,255,0.10)',
                    color: 'var(--c1)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="truncate">{s.short}</span>
              </>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h1
              className="text-4xl sm:text-5xl font-extrabold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
            >
              {t.title}
            </h1>
            <p className="text-base mb-2" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.updated}</p>
          </div>

          <div className="space-y-5">
            {t.sections.map((s, i) => (
              <div
                key={i}
                id={`section-${i}`}
                data-idx={i}
                className="scroll-mt-24"
                style={{
                  borderRadius: 16,
                  boxShadow: flash === i ? '0 0 0 2px rgba(0,212,255,0.8), 0 0 28px rgba(0,212,255,0.3)' : 'none',
                  transition: 'box-shadow 0.5s ease',
                }}
              >
                <BorderGlow
                  borderRadius={16}
                  glowColor={isDark ? "190 100 55" : "207 90 55"}
                  glowIntensity={isDark ? 1.5 : 1.0}
                  backgroundColor="var(--bg-card)"
                  colors={isDark
                    ? ['rgba(0,212,255,0.3)', 'rgba(0,150,220,0.2)', 'rgba(80,180,255,0.15)']
                    : ['rgba(14,100,180,0.18)', 'rgba(0,140,200,0.12)', 'rgba(80,160,220,0.10)']}
                  className="w-full"
                >
                  <div className="p-8">
                    <h2
                      className="font-bold text-base mb-3"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
                    >
                      {s.heading}
                    </h2>
                    <p
                      className="text-base leading-relaxed whitespace-pre-line"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {s.body}
                    </p>
                  </div>
                </BorderGlow>
              </div>
            ))}
          </div>

          <p className="text-center text-sm mt-12" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Daromadchi.{' '}
            {lang === 'uz' ? 'Barcha huquqlar himoyalangan.' : lang === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
          </p>
        </div>
      </main>
    </div>
  )
}
