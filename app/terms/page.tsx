'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import BorderGlow from '@/app/components/BorderGlow'

const COMPANY_EMAIL = 'support@daromadchi.uz'

const T = {
  uz: {
    title: 'Foydalanish shartlari',
    subtitle: "Daromadchi platformasidan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.",
    updated: 'Oxirgi yangilanish: 2026-08-09',
    sections: [
      {
        heading: '1. Platformadan foydalanish',
        short: 'Foydalanish',
        body: `Daromadchi — Uzbekiston bozorlarida (Uzum Market, Yandex Market) savdo qiluvchi sotuvchilar uchun mo'ljallangan analitika platformasidir.\n\nPlatformadan foydalanish uchun:\n• Faqat o'zingizga tegishli yoki vakolatli bo'lgan marketplace hisobi API kalitlarini kiritishingiz mumkin.\n• Platformani buzish, qayta sotish yoki ruxsatsiz maqsadlarda foydalanish taqiqlanadi.\n• Hisob ma'lumotlarini maxfiy saqlash va ularga ruxsatsiz kirishni darhol bizga xabar qilish majburiydir.\n\nXizmat operatori (huquqiy shaxs): YATT Xakimjonov Jamshid (yakka tartibdagi tadbirkor), INN 51608028660035, O'zbekiston Respublikasi. «Daromadchi» — xizmat nomi.`,
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
        heading: "6. Tarif va aylanma bo'yicha narx",
        short: 'Tarif',
        body: `Daromadchi tariflari ulangan do'konlaringiz bo'yicha so'nggi 30 kunlik sof aylanmangizga qarab belgilanadi. Aylanma bekor qilingan va qaytarilgan buyurtmalarsiz hisoblanadi.\n\n• Ro'yxatdan o'tganingizda aylanma bo'lmaydi — tarifni o'zingiz tanlaysiz.\n• Biz aylanmangizni ulangan do'konlar buyurtmalari asosida muntazam qayta hisoblaymiz.\n• Agar aylanma joriy tarif chegarasidan chiqsa, biz OLDINDAN ilova ichida va Telegram orqali xabar beramiz hamda mos tarifni taklif qilamiz.\n• Yangi summa roziligingizsiz avtomatik yechilmaydi. Amaldagi obuna siz kelishgan narxda davom etadi.\n• Xabarnomadan so'ng tarifni o'zgartirishingiz yoki obunani bekor qilishingiz mumkin.\n\nAylanma ma'lumotlari faqat tarifni aniqlash va sizga tahlil ko'rsatish uchun ishlatiladi; uchinchi shaxslarga berilmaydi.\n\nObunani bekor qilish: tarifni istalgan vaqtda hisobingizdagi «Tarif va to'lov» bo'limidan bekor qilishingiz mumkin. Bekor qilinganda keyingi to'lov olinmaydi, ammo siz to'lagan davr oxirigacha barcha imkoniyatlar ochiq qoladi; shundan so'ng hisobingiz Bepul tarifga o'tadi. Bekor qilish to'langan davr uchun pulni qaytarishni anglatmaydi. To'langan davr tugagunicha bekor qilishni qaytarib olishingiz mumkin.`,
      },
      {
        heading: "7. Shartlarning o'zgarishi",
        short: "O'zgarish",
        body: `Biz ushbu shartlarni istalgan vaqtda o'zgartirish huquqini saqlaymiz. Muhim o'zgarishlar haqida elektron pochta orqali xabar beramiz. Platformadan foydalanishni davom ettirish yangilangan shartlarni qabul qilish deb hisoblanadi.`,
      },
      {
        heading: "8. Hisob o'chirish",
        short: "O'chirish",
        body: `Siz istalgan vaqtda hisobingizni o'chirishingiz mumkin. O'chirish so'rovi uchun ${COMPANY_EMAIL} manziliga murojaat qiling. Hisobingiz o'chirilganidan so'ng shaxsiy ma'lumotlaringiz 30 kun ichida to'liq o'chiriladi. Moliyaviy va hisob-kitob hujjatlari (hisob-fakturalar, to'lovlar) O'zbekiston Respublikasining soliq va buxgalteriya qonunchiligi talab qilgan hollarda uzoqroq saqlanishi mumkin.`,
      },
      {
        heading: "9. Qo'llaniladigan qonun",
        short: 'Qonun',
        body: `Ushbu shartlar O'zbekiston Respublikasi qonunlariga muvofiq boshqariladi. Nizolar O'zbekiston Respublikasining vakolatli sudlari orqali hal etiladi.\n\nShaxsiy ma'lumotlar «Shaxsiy ma'lumotlar to'g'risida»gi Qonun (2019-yil 2-iyul, ZRU-547-son, 1125-son Qonun bilan o'zgartirilgan, 2026-yil 27-martdan kuchga kirgan) asosida qayta ishlanadi. Nazorat organlari — Adliya vazirligi huzuridagi Shaxsiylashtirish agentligi va «Uzkomnazorat» davlat inspeksiyasi.`,
      },
      {
        heading: '10. Aloqa',
        short: 'Aloqa',
        body: `Umumiy savollar yoki shikoyatlar uchun:\nElektron pochta: ${COMPANY_EMAIL}\n\nShaxsiy ma'lumotlar bilan bog'liq so'rovlar uchun: privacy@daromadchi.uz`,
      },
    ],
  },
  ru: {
    title: 'Условия использования',
    subtitle: 'Используя платформу Daromadchi, вы соглашаетесь с данными условиями.',
    updated: 'Последнее обновление: 2026-08-09',
    sections: [
      {
        heading: '1. Использование платформы',
        short: 'Использование',
        body: `Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Yandex Market).\n\nДля использования платформы:\n• Вы можете вводить только API-ключи аккаунтов маркетплейса, которые принадлежат вам или на использование которых вы уполномочены.\n• Запрещается взлом, перепродажа или использование платформы в несанкционированных целях.\n• Вы обязаны хранить учётные данные в тайне и незамедлительно сообщать нам о несанкционированном доступе.\n\nОператор сервиса (юридическое лицо): ЯТТ Хакимжонов Жамшид (индивидуальный предприниматель), ИНН 51608028660035, Республика Узбекистан. «Daromadchi» — наименование сервиса.`,
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
        heading: '6. Тариф и цена по обороту',
        short: 'Тариф',
        body: `Тариф Daromadchi определяется вашим чистым оборотом за последние 30 дней по данным подключённых магазинов. Оборот считается без отменённых и возвращённых заказов.\n\n• При регистрации оборота ещё нет — тариф вы выбираете сами.\n• Мы регулярно пересчитываем оборот по заказам подключённых магазинов.\n• Если оборот выходит за рамки текущего тарифа, мы ЗАРАНЕЕ уведомляем вас в приложении и в Telegram и предлагаем подходящий тариф.\n• Новая сумма не списывается автоматически без вашего согласия. Действующая подписка продолжается по согласованной цене.\n• После уведомления вы можете сменить тариф или отменить подписку.\n\nДанные об обороте используются только для определения тарифа и показа вашей аналитики; третьим лицам они не передаются.\n\nОтмена подписки: вы можете отменить тариф в любой момент в разделе «Тариф и оплата» вашего аккаунта. После отмены списаний больше не будет, но все возможности останутся открытыми до конца оплаченного периода; затем аккаунт переходит на Бесплатный тариф. Отмена не является возвратом средств за уже оплаченный период. Пока оплаченный период не закончился, отмену можно возобновить.`,
      },
      {
        heading: '7. Изменение условий',
        short: 'Изменения',
        body: `Мы оставляем за собой право изменять настоящие условия в любое время. О существенных изменениях мы уведомим вас по электронной почте. Продолжение использования платформы означает согласие с обновлёнными условиями.`,
      },
      {
        heading: '8. Удаление аккаунта',
        short: 'Удаление',
        body: `Вы можете удалить свой аккаунт в любое время. Для этого обратитесь на ${COMPANY_EMAIL}. После удаления аккаунта ваши персональные данные будут полностью удалены в течение 30 дней. Финансовые и расчётные документы (счета, платежи) могут храниться дольше, если этого требует налоговое и бухгалтерское законодательство Республики Узбекистан.`,
      },
      {
        heading: '9. Применимое право',
        short: 'Право',
        body: `Настоящие условия регулируются законодательством Республики Узбекистан. Споры разрешаются через компетентные суды Республики Узбекистан.\n\nПерсональные данные обрабатываются в соответствии с Законом «О персональных данных» (2 июля 2019 г., № ЗРУ-547, с изменениями по Закону № 1125, вступившими в силу 27 марта 2026 г.). Надзорные органы — Агентство персонализации при Министерстве юстиции и государственная инспекция «Узкомназорат».`,
      },
      {
        heading: '10. Контакты',
        short: 'Контакты',
        body: `По общим вопросам или жалобам:\nЭлектронная почта: ${COMPANY_EMAIL}\n\nПо вопросам, связанным с персональными данными: privacy@daromadchi.uz`,
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    subtitle: 'By using the Daromadchi platform, you agree to these terms.',
    updated: 'Last updated: 2026-08-09',
    sections: [
      {
        heading: '1. Use of the platform',
        short: 'Usage',
        body: `Daromadchi is an analytics platform for sellers on Uzbekistan marketplaces (Uzum Market, Yandex Market).\n\nTo use the platform:\n• You may only enter API keys for marketplace accounts you own or are authorised to use.\n• Hacking, reselling or using the platform for unauthorised purposes is prohibited.\n• You must keep your credentials confidential and immediately notify us of any unauthorised access.\n\nService operator (legal person): YATT Xakimjonov Jamshid (individual entrepreneur), INN 51608028660035, Republic of Uzbekistan. "Daromadchi" is the name of the service.`,
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
        heading: '6. Tiers and turnover-based pricing',
        short: 'Tiers',
        body: `Your Daromadchi tier is determined by your net turnover over the last 30 days, measured from the stores you have connected. Turnover excludes cancelled and returned orders.\n\n• When you sign up you have no turnover yet — you choose your own plan.\n• We recalculate your turnover regularly from the orders of your connected stores.\n• If your turnover outgrows your current tier we notify you IN ADVANCE, in the app and via Telegram, and suggest the matching tier.\n• No new amount is charged automatically without your agreement. Your active subscription continues at the price you agreed to.\n• After that notice you may change tier or cancel your subscription.\n\nTurnover data is used only to determine your tier and to show you your own analytics; it is never shared with third parties.\n\nCancellation: you may cancel your plan at any time from the \u201CBilling\u201D section of your account. After cancelling you are not charged again, but everything stays unlocked until the end of the period you have already paid for; the account then moves to the Free tier. Cancelling is not a refund of the period already paid. While that period is still running, you can undo the cancellation.`,
      },
      {
        heading: '7. Changes to terms',
        short: 'Changes',
        body: `We reserve the right to update these terms at any time. We will notify you of material changes by email. Continued use of the platform constitutes acceptance of the updated terms.`,
      },
      {
        heading: '8. Account deletion',
        short: 'Deletion',
        body: `You may delete your account at any time by contacting ${COMPANY_EMAIL}. Your personal data will be permanently deleted within 30 days of account deletion. Financial and accounting records (invoices, payments) may be retained longer where the tax and accounting laws of the Republic of Uzbekistan require.`,
      },
      {
        heading: '9. Governing law',
        short: 'Law',
        body: `These terms are governed by the laws of the Republic of Uzbekistan. Disputes shall be resolved through the competent courts of the Republic of Uzbekistan.\n\nPersonal data is processed under the Law "On Personal Data" (2 July 2019, No. ZRU-547, as amended by Law No. 1125, in force 27 March 2026). The supervisory authorities are the Personalization Agency under the Ministry of Justice and the state inspectorate Uzkomnazorat.`,
      },
      {
        heading: '10. Contact',
        short: 'Contact',
        body: `For general questions or complaints:\nEmail: ${COMPANY_EMAIL}\n\nFor personal-data requests: privacy@daromadchi.uz`,
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
                background: active === i ? (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)') : 'transparent',
                borderColor: active === i ? 'var(--c1)' : 'transparent',
              }}
            >
              {open && <>
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: active === i ? (isDark ? 'rgba(131,192,249,0.22)' : 'rgba(2,132,199,0.18)') : (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)'),
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
      <main className="flex-1 min-w-0 px-8 py-16 relative">
        <div className="max-w-3xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
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
                  boxShadow: flash === i
                    ? '0 0 0 2px rgba(131,192,249,0.9), 0 0 28px rgba(131,192,249,0.35)'
                    : active === i
                      ? '0 0 0 1.5px rgba(131,192,249,0.5)'
                      : 'none',
                  transition: 'box-shadow 0.4s ease',
                }}
              >
                <BorderGlow
                  borderRadius={16}
                  glowColor={isDark ? "210 84 75" : "201 97 39"}
                  glowIntensity={isDark ? 1.5 : 1.0}
                  backgroundColor={active === i ? (isDark ? 'rgba(15,28,48,1)' : 'rgba(230,241,255,1)') : 'var(--bg-card)'}
                  colors={isDark
                    ? ['rgba(131,192,249,0.25)', 'rgba(100,171,240,0.18)', 'rgba(80,150,220,0.12)']
                    : ['rgba(2,132,199,0.15)', 'rgba(3,105,161,0.10)', 'rgba(14,116,200,0.08)']}
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
