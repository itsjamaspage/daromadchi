'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'

const COMPANY_EMAIL = 'support@daromadchi.uz'

const T = {
  uz: {
    title: 'Maxfiylik siyosati va Foydalanish shartlari',
    subtitle: "Daromadchi platformasidan foydalanish orqali siz ushbu siyosatga rozilik bildirasiz.",
    updated: 'Oxirgi yangilanish: 2026-06-04',
    sections: [
      {
        heading: '1. Umumiy ma\'lumot',
        short: 'Umumiy',
        body: `Daromadchi — Uzbekiston bozorlarida (Uzum Market, Wildberries, Yandex Market) savdo qiluvchi sotuvchilar uchun mo\'ljallangan analitika platformasidir. Ushbu siyosat "Shaxsiy ma\'lumotlar to\'g\'risida"gi O\'zbekiston Respublikasi Qonuni (2019-yil 2-iyul, ZRU-547-son) va O\'zbekiston Respublikasining "Axborotlashtirish to\'g\'risida"gi Qonuniga (2003-yil 11-dekabr, 560-II-son) muvofiq tuzilgan.`,
      },
      {
        heading: '2. Qanday ma\'lumotlar to\'planadi',
        short: 'Ma\'lumotlar',
        body: `• Hisob ma\'lumotlari: elektron pochta manzili va shifrlangan parol (Supabase Auth orqali).\n• Do\'kon ma\'lumotlari: siz kiritgan marketplace API kaliti (AES-256 bilan shifrlangan holda saqlanadi).\n• Savdo ma\'lumotlari: marketplace API orqali olingan buyurtmalar, mahsulotlar, zaxira va reklama statistikasi.\n• Brauzer kengaytmasi ma\'lumotlari: kengaytma o\'rnatilsa, marketplace sahifalaridan (Uzum, Wildberries, Yandex Market) narx va mahsulot ma\'lumotlari to\'planadi — faqat siz kirgan hisob doirasida.\n• Telegram ma\'lumotlari: ogohlantirishlar yoqilganda foydalanuvchining Telegram chat ID si saqlanadi — faqat xabarnoma yuborish uchun.\n• Texnik ma\'lumotlar: brauzer turi, IP-manzil (xavfsizlik maqsadida), tizim jurnallari.\n\nBiz to\'lov kartasi ma\'lumotlari, hujjat nusxalari yoki boshqa maxsus kategoriyali shaxsiy ma\'lumotlarni to\'plamaymiz.`,
      },
      {
        heading: '3. Ma\'lumotlar qanday ishlatiladi',
        short: 'Ishlatilishi',
        body: `• Dashboard ko\'rsatkichlarini, hisobotlarni va ogohlantirishlarni yaratish.\n• Marketplace API bilan sinxronizatsiya (faqat o\'qish rejimi — biz sizning do\'koningizda hech narsa o\'zgartirmaymiz).\n• Xavfsizlik: ruxsatsiz kirishni aniqlash va oldini olish.\n• Xizmat yaxshilash: anonim foydalanish statistikasi.\n\nBiz sizning ma\'lumotlaringizni uchinchi shaxslarga sotmaymiz va reklama maqsadida foydalanmaymiz.`,
      },
      {
        heading: '4. Saqlash va xavfsizlik',
        short: 'Xavfsizlik',
        body: `Ma\'lumotlar Supabase Inc. (infrastruktura provayderi, AQSh) PostgreSQL ma\'lumotlar bazasida saqlanadi. API kalitlari AES-256-CBC algoritmi bilan shifrlangan holda saqlanadi. Barcha uzatmalar HTTPS orqali amalga oshiriladi.\n\nUchinchi shaxslar: Supabase (ma\'lumotlar bazasi infratuzilmasi) — ma\'lumotlarga faqat texnik xizmat ko\'rsatish doirasida kirish huquqiga ega. Boshqa uchinchi shaxslarga ma\'lumot uzatilmaydi.\n\nZRU-547 Qonuni talablariga ko\'ra, shaxsiy ma\'lumotlar faqat zarur muddat davomida, lekin eng ko\'pi bilan hisob o\'chirilgandan keyin 1 yil saqlanadi.`,
      },
      {
        heading: '5. Foydalanuvchi huquqlari',
        short: 'Huquqlar',
        body: `ZRU-547 Qonuniga asosan sizda quyidagi huquqlar mavjud:\n• Ma\'lumotlaringizni ko\'rish va nusxa olish huquqi.\n• Ma\'lumotlarni to\'g\'irlash yoki o\'chirish talabi.\n• Ma\'lumotlarni qayta ishlashga rozilikni qaytarib olish.\n• Ma\'lumotlaringizni boshqa xizmatga ko\'chirish (portativlik).\n\nHuquqlaringizni amalga oshirish uchun Telegram orqali murojaat qiling: @daromadchi_alerts_bot. So\'rovlar 15 ish kuni ichida ko\'rib chiqiladi.`,
      },
      {
        heading: '6. Cookie va kuzatuv',
        short: 'Cookie',
        body: `Biz faqat funktsional cookie-fayllardan foydalanamiz: sessiya autentifikatsiyasi va til sozlamalari. Uchinchi tomon reklama cookie-lari yoki keng qamrovli kuzatuv amalga oshirilmaydi.`,
      },
      {
        heading: '7. Foydalanish shartlari',
        short: 'Shartlar',
        body: `Platformadan foydalanish uchun:\n• Faqat o\'zingizga tegishli yoki vakolatli bo\'lgan marketplace hisobi API kalitlarini kiritishingiz mumkin.\n• Platformani buzish, qayta sotish yoki ruxsatsiz maqsadlarda foydalanish taqiqlanadi.\n• Hisob ma\'lumotlarini maxfiy saqlash va ularga ruxsatsiz kirishni darhol bizga xabar qilish majburiydir.`,
      },
      {
        heading: '8. Javobgarlilik chegarasi',
        short: 'Javobgarlik',
        body: `Daromadchi — ma\'lumot ko\'rsatish vositasi. Biz marketplace API\'laridan olingan ma\'lumotlarning to\'liqligi yoki dolzarbligi uchun javob bermaymiz. Platformadagi tahlillar asosida qabul qilingan tijorat qarorlar uchun javobgarlik foydalanuvchida qoladi.`,
      },
      {
        heading: '9. Rozilik',
        short: 'Rozilik',
        body: `Platformadan ro\'yxatdan o\'tish paytida siz ushbu maxfiylik siyosatini o\'qib chiqqaningiz va qabul qilganingizni tasdiqlaysiz — bu ZRU-547 Qonuni talab etgan elektron rozilik hisoblanadi.`,
      },
      {
        heading: 'Chrome Kengaytmasi',
        short: 'Kengaytma',
        body: `Daromadchi Chrome Kengaytmasi quyidagi maxfiylik tamoyillariga amal qiladi:\n\n• Shaxsiy ma\'lumot to\'planmaydi — ism, manzil, elektron pochta yoki boshqa identifikatsion ma\'lumotlar yig\'ilmaydi.\n• Mahalliy o\'qish — kengaytma bozor sahifalaridan mahsulot ma\'lumotlarini faqat brauzeringizda o\'qiydi. Bu ma\'lumotlar tashqi serverlarga yuborilmaydi.\n• chrome.storage — foydalanuvchi sozlamalari faqat qurilmangizda saqlanadi va hech qaerga uzatilmaydi.\n• Alarms — fon sinxronizatsiyasi faqat mahalliy ravishda amalga oshiriladi.\n• Notifications — bildirishnomalar faqat sizning qurilmangizda ko\'rsatiladi.`,
      },
      {
        heading: '10. Aloqa',
        short: 'Aloqa',
        body: `Savollar, shikoyatlar yoki huquqiy so\'rovlar uchun:\nTelegram: @daromadchi_alerts_bot\n\nO\'zbekiston Respublikasida shikoyat qilish uchun: Raqamli texnologiyalar vazirligi yoki sudga murojaat qilishingiz mumkin.`,
      },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности и Условия использования',
    subtitle: 'Используя платформу Daromadchi, вы соглашаетесь с данной политикой.',
    updated: 'Последнее обновление: 2026-06-04',
    sections: [
      { heading: '1. Общие сведения', short: 'Общее',
        body: `Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Wildberries, Yandex Market). Настоящая политика разработана в соответствии с Законом РУз «О персональных данных» (2 июля 2019 г., ЗРУ-547) и Законом «Об информатизации» (11 декабря 2003 г., № 560-II).` },
      { heading: '2. Какие данные собираются', short: 'Данные',
        body: `• Учётные данные: адрес электронной почты и зашифрованный пароль (через Supabase Auth).\n• Данные магазина: API-ключ маркетплейса, введённый вами (хранится в зашифрованном виде AES-256).\n• Торговые данные: заказы, товары, запасы и рекламная статистика, полученные через API маркетплейса.\n• Данные браузерного расширения: при установке расширения со страниц маркетплейсов собираются цены и данные о товарах — только в рамках вашей учётной записи.\n• Данные Telegram: при включении уведомлений сохраняется Telegram chat ID — исключительно для отправки уведомлений.\n• Технические данные: тип браузера, IP-адрес (в целях безопасности), системные журналы.\n\nМы не собираем данные платёжных карт, копии документов или иные специальные категории персональных данных.` },
      { heading: '3. Как используются данные', short: 'Использование',
        body: `• Формирование показателей панели управления, отчётов и уведомлений.\n• Синхронизация с API маркетплейса (только режим чтения — мы не изменяем ничего в вашем магазине).\n• Безопасность: обнаружение и предотвращение несанкционированного доступа.\n• Улучшение сервиса: анонимная статистика использования.\n\nМы не продаём ваши данные третьим лицам и не используем их в рекламных целях.` },
      { heading: '4. Хранение и безопасность', short: 'Безопасность',
        body: `Данные хранятся в базе данных Supabase Inc. (провайдер инфраструктуры, США), PostgreSQL. API-ключи шифруются алгоритмом AES-256-CBC. Все передачи осуществляются по протоколу HTTPS.\n\nТретьи лица: Supabase (инфраструктура базы данных) — доступ к данным только в рамках технического обслуживания. Данные не передаются иным третьим лицам.\n\nВ соответствии с Законом ЗРУ-547 персональные данные хранятся только в течение необходимого срока, но не более 1 года после удаления аккаунта.` },
      { heading: '5. Права пользователей', short: 'Права',
        body: `На основании Закона ЗРУ-547 вы имеете право:\n• Получить доступ к своим данным и их копию.\n• Потребовать исправления или удаления данных.\n• Отозвать согласие на обработку данных.\n• Перенести свои данные в другой сервис.\n\nДля реализации своих прав обращайтесь в Telegram: @daromadchi_alerts_bot. Запросы рассматриваются в течение 15 рабочих дней.` },
      { heading: '6. Куки и отслеживание', short: 'Куки',
        body: `Мы используем только функциональные куки: сессионная аутентификация и настройки языка. Сторонние рекламные куки и расширенное отслеживание не применяются.` },
      { heading: '7. Условия использования', short: 'Условия',
        body: `Для использования платформы:\n• Вы можете вводить только API-ключи аккаунтов маркетплейса, которые принадлежат вам или на использование которых вы уполномочены.\n• Запрещается взлом, перепродажа или использование платформы в несанкционированных целях.\n• Вы обязаны хранить учётные данные в тайне и незамедлительно сообщать нам о несанкционированном доступе.` },
      { heading: '8. Ограничение ответственности', short: 'Ответственность',
        body: `Daromadchi является инструментом отображения данных. Мы не несём ответственности за полноту или актуальность данных, полученных через API маркетплейсов. Ответственность за коммерческие решения, принятые на основе аналитики платформы, лежит на пользователе.` },
      { heading: '9. Согласие', short: 'Согласие',
        body: `При регистрации на платформе вы подтверждаете, что ознакомились с настоящей политикой и принимаете её — это является электронным согласием в соответствии с требованиями Закона ЗРУ-547.` },
      { heading: 'Расширение Chrome', short: 'Расширение',
        body: `Расширение Chrome Daromadchi придерживается следующих принципов конфиденциальности:\n\n• Личные данные не собираются — имена, адреса, электронная почта и иные идентификационные данные не собираются.\n• Локальное чтение — расширение считывает данные о товарах со страниц маркетплейсов только локально в вашем браузере. Эти данные не отправляются на внешние серверы.\n• chrome.storage — пользовательские настройки хранятся только на вашем устройстве и никуда не передаются.\n• Alarms — фоновая синхронизация выполняется только локально.\n• Notifications — уведомления отображаются только на вашем устройстве.` },
      { heading: '10. Контакты', short: 'Контакты',
        body: `По вопросам, жалобам или юридическим запросам:\nTelegram: @daromadchi_alerts_bot\n\nДля подачи жалобы в Республике Узбекистан: Министерство цифровых технологий или суд.` },
    ],
  },
  en: {
    title: 'Privacy Policy & Terms of Use',
    subtitle: 'By using the Daromadchi platform, you agree to this policy.',
    updated: 'Last updated: 2026-06-04',
    sections: [
      { heading: '1. About', short: 'About',
        body: `Daromadchi is an analytics platform for sellers on Uzbekistan marketplaces (Uzum Market, Wildberries, Yandex Market). This policy is prepared in compliance with the Law of the Republic of Uzbekistan "On Personal Data" (2 July 2019, ZRU-547) and the Law "On Informatization" (11 December 2003, No. 560-II).` },
      { heading: '2. What data we collect', short: 'Data',
        body: `• Account data: email address and encrypted password (via Supabase Auth).\n• Shop data: the marketplace API key you provide (stored encrypted with AES-256).\n• Trading data: orders, products, stock levels and ad statistics fetched via the marketplace API.\n• Browser extension data: if the extension is installed, price and product data is collected from marketplace pages — only within your logged-in account.\n• Telegram data: when alerts are enabled, your Telegram chat ID is stored solely for sending notifications.\n• Technical data: browser type, IP address (for security purposes), system logs.\n\nWe do not collect payment card details, identity document copies, or other special-category personal data.` },
      { heading: '3. How data is used', short: 'Usage',
        body: `• Generating dashboard metrics, reports and alerts.\n• Marketplace API synchronisation (read-only — we never modify anything in your store).\n• Security: detecting and preventing unauthorised access.\n• Service improvement: anonymous usage statistics.\n\nWe do not sell your data to third parties or use it for advertising purposes.` },
      { heading: '4. Storage & security', short: 'Security',
        body: `Data is stored with Supabase Inc. (infrastructure provider, USA) in a PostgreSQL database. API keys are encrypted with AES-256-CBC. All data in transit is protected by HTTPS.\n\nThird parties: Supabase (database infrastructure) — access limited to technical operations only. No data is sold or shared with any other third parties.\n\nUnder Law ZRU-547, personal data is retained only as long as necessary, and for no more than 1 year after account deletion.` },
      { heading: '5. User rights', short: 'Rights',
        body: `Under Law ZRU-547 you have the right to:\n• Access and receive a copy of your data.\n• Request correction or deletion of your data.\n• Withdraw consent to data processing.\n• Data portability — transfer your data to another service.\n\nTo exercise your rights, contact us on Telegram: @daromadchi_alerts_bot. Requests are processed within 15 working days.` },
      { heading: '6. Cookies & tracking', short: 'Cookies',
        body: `We use only functional cookies: session authentication and language preferences. No third-party advertising cookies or broad tracking are used.` },
      { heading: '7. Terms of use', short: 'Terms',
        body: `To use the platform:\n• You may only enter API keys for marketplace accounts you own or are authorised to use.\n• Hacking, reselling or using the platform for unauthorised purposes is prohibited.\n• You must keep your credentials confidential and immediately notify us of any unauthorised access.` },
      { heading: '8. Limitation of liability', short: 'Liability',
        body: `Daromadchi is a data display tool. We are not responsible for the completeness or accuracy of data obtained via marketplace APIs. Commercial decisions made based on platform analytics remain the user's responsibility.` },
      { heading: '9. Consent', short: 'Consent',
        body: `By registering on the platform you confirm you have read and accept this policy — this constitutes electronic consent as required by Law ZRU-547.` },
      { heading: 'Chrome Extension', short: 'Extension',
        body: `The Daromadchi Chrome Extension follows these privacy principles:\n\n• No personal data collected — no names, addresses, email addresses, or other identifying information are collected.\n• Local reading only — the extension reads product data from marketplace pages locally in your browser only. This data is never sent to any external server.\n• chrome.storage — user settings are saved only on your device and never transmitted anywhere.\n• Alarms — background sync runs locally only.\n• Notifications — alerts are displayed only on your own device.` },
      { heading: '10. Contact', short: 'Contact',
        body: `For questions, complaints or legal requests:\nTelegram: @daromadchi_alerts_bot\n\nTo file a complaint in the Republic of Uzbekistan: Ministry of Digital Technologies or the relevant court.` },
    ],
  },
}

const NAVBAR_H = 68

export default function PrivacyPage() {
  const { lang } = useLang()
  const { theme } = useTheme()
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
    const y = el.getBoundingClientRect().top + window.scrollY - NAVBAR_H - 16

    scrollLockRef.current = true
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current)
    scrollLockTimerRef.current = setTimeout(() => { scrollLockRef.current = false }, 1000)

    window.scrollTo({ top: y, behavior: 'smooth' })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(idx)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2000)
  }

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside
        className="sticky top-[68px] self-start h-[calc(100vh-68px)] flex-shrink-0 border-r transition-all duration-300 overflow-hidden"
        style={{
          width: open ? 280 : 60,
          borderColor: 'var(--border)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-end px-4 py-5 border-b transition-colors hover:text-[var(--c1)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {open
            ? <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
        </button>

        {/* Nav items */}
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
                className="rounded-2xl p-8 border neon-card scroll-mt-24 transition-all duration-300"
                style={{
                  background: flash === i
                    ? theme === 'dark'
                      ? 'rgba(0,212,255,0.15)'
                      : 'rgba(0,180,255,0.12)'
                    : 'var(--bg-card)',
                  borderColor: flash === i ? 'var(--c1)' : 'var(--border)',
                  boxShadow: flash === i ? '0 0 0 3px rgba(0,212,255,0.25)' : undefined,
                  transition: 'background 0.5s ease, border-color 0.4s ease, box-shadow 0.4s ease',
                }}
              >
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
