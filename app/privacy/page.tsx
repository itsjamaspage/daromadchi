'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe } from 'lucide-react'

type Lang = 'uz' | 'ru' | 'en'

const LAST_UPDATED = '2026-06-04'
const COMPANY_EMAIL = 'support@daromadchi.uz'
const COMPANY_NAME = 'Daromadchi'

const t: Record<Lang, {
  title: string
  subtitle: string
  lastUpdated: string
  back: string
  sections: { heading: string; body: string }[]
}> = {
  uz: {
    title: 'Maxfiylik siyosati va Foydalanish shartlari',
    subtitle: "Daromadchi platformasidan foydalanish orqali siz ushbu siyosatga rozilik bildirasiz.",
    lastUpdated: `Oxirgi yangilanish: ${LAST_UPDATED}`,
    back: 'Bosh sahifaga',
    sections: [
      {
        heading: '1. Umumiy ma\'lumot',
        body: `Daromadchi — Uzbekiston bozorlarida (Uzum Market, Wildberries, Yandex Market) savdo qiluvchi sotuvchilar uchun mo\'ljallangan analitika platformasidir. Ushbu siyosat "Shaxsiy ma\'lumotlar to\'g\'risida"gi O\'zbekiston Respublikasi Qonuni (2019-yil 2-iyul, ZRU-547-son) va O\'zbekiston Respublikasining "Axborotlashtirish to\'g\'risida"gi Qonuniga (2003-yil 11-dekabr, 560-II-son) muvofiq tuzilgan.`,
      },
      {
        heading: '2. Qanday ma\'lumotlar to\'planadi',
        body: `• Hisob ma\'lumotlari: elektron pochta manzili va shifrlangan parol (Supabase Auth orqali).\n• Do\'kon ma\'lumotlari: siz kiritgan marketplace API kaliti (AES-256 bilan shifrlangan holda saqlanadi).\n• Savdo ma\'lumotlari: marketplace API orqali olingan buyurtmalar, mahsulotlar, zaxira va reklama statistikasi.\n• Texnik ma\'lumotlar: brauzer turi, IP-manzil (xavfsizlik maqsadida), tizim jurnallari.\n\nBiz to\'lov kartasi ma\'lumotlari, hujjat nusxalari yoki boshqa maxsus kategoriyali shaxsiy ma\'lumotlarni to\'plamaymiz.`,
      },
      {
        heading: '3. Ma\'lumotlar qanday ishlatiladi',
        body: `• Dashboard ko\'rsatkichlarini, hisobotlarni va ogohlantirishlarni yaratish.\n• Marketplace API bilan sinxronizatsiya (faqat o\'qish rejimi — biz sizning do\'koningizda hech narsa o\'zgartirmaymiz).\n• Xavfsizlik: ruxsatsiz kirishni aniqlash va oldini olish.\n• Xizmat yaxshilash: anonim foydalanish statistikasi.\n\nBiz sizning ma\'lumotlaringizni uchinchi shaxslarga sotmaymiz va reklama maqsadida foydalanmaymiz.`,
      },
      {
        heading: '4. Ma\'lumotlar saqlash, xavfsizlik va uchinchi shaxslarga uzatish',
        body: `Ma\'lumotlar Supabase Inc. (infrastruktura provayderi, AQSh) PostgreSQL ma\'lumotlar bazasida saqlanadi. API kalitlari AES-256-CBC algoritmi bilan shifrlangan holda saqlanadi. Barcha uzatmalar HTTPS orqali amalga oshiriladi.\n\nXalqaro uzatish: ZRU-547 Qonuniga 2026-yil 26-martda kiritilgan o\'zgarishlarga muvofiq, xorijiy bulut xizmatlaridan foydalanish axborot xavfsizligi talablariga rioya etilgan taqdirda ruxsat etiladi. Biz Supabase'ning SOC 2 sertifikatiga asoslanib ushbu talabga muvofiq ekanligini e'lon qilamiz.\n\nUchinchi shaxslar: Supabase (ma\'lumotlar bazasi infratuzilmasi) — ma\'lumotlarga faqat texnik xizmat ko\'rsatish doirasida kirish huquqiga ega. Boshqa uchinchi shaxslarga ma\'lumot uzatilmaydi.\n\nZRU-547 Qonuni talablariga ko\'ra, shaxsiy ma\'lumotlar faqat zarur muddat davomida, lekin eng ko\'pi bilan hisob o\'chirilgandan keyin 1 yil saqlanadi.`,
      },
      {
        heading: '5. Foydalanuvchi huquqlari',
        body: `ZRU-547 Qonuniga asosan sizda quyidagi huquqlar mavjud:\n• Ma\'lumotlaringizni ko\'rish va nusxa olish huquqi.\n• Ma\'lumotlarni to\'g\'irlash yoki o\'chirish talabi.\n• Ma\'lumotlarni qayta ishlashga rozilikni qaytarib olish.\n• Ma\'lumotlaringizni boshqa xizmatga ko\'chirish (portativlik).\n\nHuquqlaringizni amalga oshirish uchun ${COMPANY_EMAIL} manziliga murojaat qiling. So\'rovlar 15 ish kuni ichida ko\'rib chiqiladi.`,
      },
      {
        heading: '6. Cookie va kuzatuv',
        body: `Biz faqat funktsional cookie-fayllardan foydalanamiz: sessiya autentifikatsiyasi va til sozlamalari. Uchinchi tomon reklama cookie-lari yoki keng qamrovli kuzatuv amalga oshirilmaydi.`,
      },
      {
        heading: '7. Foydalanish shartlari',
        body: `Platformadan foydalanish uchun:\n• 18 yoshdan katta bo\'lishingiz kerak.\n• Faqat o\'zingizga tegishli yoki vakolatli bo\'lgan marketplace hisobi API kalitlarini kiritishingiz mumkin.\n• Platformani buzish, qayta sotish yoki ruxsatsiz maqsadlarda foydalanish taqiqlanadi.\n• Hisob ma\'lumotlarini maxfiy saqlash va ularga ruxsatsiz kirishni darhol bizga xabar qilish majburiydir.`,
      },
      {
        heading: '8. Javobgarlilik chegarasi',
        body: `Daromadchi — ma\'lumot ko\'rsatish vositasi. Biz marketplace API\'laridan olingan ma\'lumotlarning to\'liqligi yoki dolzarbligi uchun javob bermaymiz. Platformadagi tahlillar asosida qabul qilingan tijorat qarorlar uchun javobgarlik foydalanuvchida qoladi.`,
      },
      {
        heading: '9. Rozilik va ro\'yxatdan o\'tish',
        body: `Platformadan ro\'yxatdan o\'tish paytida siz ushbu maxfiylik siyosatini o\'qib chiqqaningiz va qabul qilganingizni tasdiqlaysiz — bu ZRU-547 Qonuni talab etgan elektron rozilik hisoblanadi.\n\nDaromadchi shaxsiy ma\'lumotlar bazasi O\'zbekiston Respublikasi Hukumati huzuridagi Davlat shaxslashtirish markazi tomonidan yuritiluvchi Shaxsiy ma\'lumotlar bazalarining Davlat reestriga kiritilishi ko\'zda tutilmoqda.`,
      },
      {
        heading: '10. Aloqa',
        body: `Savollar, shikoyatlar yoki huquqiy so\'rovlar uchun:\nElektron pochta: ${COMPANY_EMAIL}\n\nO\'zbekiston Respublikasida shikoyat qilish uchun: Raqamli texnologiyalar vazirligi yoki sudga murojaat qilishingiz mumkin.`,
      },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности и Условия использования',
    subtitle: 'Используя платформу Daromadchi, вы соглашаетесь с данной политикой.',
    lastUpdated: `Последнее обновление: ${LAST_UPDATED}`,
    back: 'На главную',
    sections: [
      {
        heading: '1. Общие сведения',
        body: `Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Wildberries, Yandex Market). Настоящая политика разработана в соответствии с Законом Республики Узбекистан «О персональных данных» (2 июля 2019 г., ЗРУ-547) и Законом «Об информатизации» (11 декабря 2003 г., № 560-II).`,
      },
      {
        heading: '2. Какие данные собираются',
        body: `• Учётные данные: адрес электронной почты и зашифрованный пароль (через Supabase Auth).\n• Данные магазина: API-ключ маркетплейса, введённый вами (хранится в зашифрованном виде AES-256).\n• Торговые данные: заказы, товары, запасы и рекламная статистика, полученные через API маркетплейса.\n• Технические данные: тип браузера, IP-адрес (в целях безопасности), системные журналы.\n\nМы не собираем данные платёжных карт, копии документов или иные специальные категории персональных данных.`,
      },
      {
        heading: '3. Как используются данные',
        body: `• Формирование показателей панели управления, отчётов и уведомлений.\n• Синхронизация с API маркетплейса (только режим чтения — мы не изменяем ничего в вашем магазине).\n• Безопасность: обнаружение и предотвращение несанкционированного доступа.\n• Улучшение сервиса: анонимная статистика использования.\n\nМы не продаём ваши данные третьим лицам и не используем их в рекламных целях.`,
      },
      {
        heading: '4. Хранение данных, безопасность и передача третьим лицам',
        body: `Данные хранятся в базе данных Supabase Inc. (провайдер инфраструктуры, США), PostgreSQL. API-ключи шифруются алгоритмом AES-256-CBC. Все передачи осуществляются по протоколу HTTPS.\n\nМеждународная передача: поправки к Закону ЗРУ-547 от 26 марта 2026 г. разрешают использование иностранных облачных сервисов при соблюдении требований информационной безопасности. Мы ссылаемся на сертификацию Supabase SOC 2 как подтверждение соответствия этим требованиям.\n\nТретьи лица: Supabase (инфраструктура базы данных) — доступ к данным только в рамках технического обслуживания. Данные не передаются иным третьим лицам.\n\nВ соответствии с Законом ЗРУ-547 персональные данные хранятся только в течение необходимого срока, но не более 1 года после удаления аккаунта.`,
      },
      {
        heading: '5. Права пользователей',
        body: `На основании Закона ЗРУ-547 вы имеете право:\n• Получить доступ к своим данным и их копию.\n• Потребовать исправления или удаления данных.\n• Отозвать согласие на обработку данных.\n• Перенести свои данные в другой сервис (право на портируемость).\n\nДля реализации своих прав обращайтесь на ${COMPANY_EMAIL}. Запросы рассматриваются в течение 15 рабочих дней.`,
      },
      {
        heading: '6. Куки и отслеживание',
        body: `Мы используем только функциональные куки: сессионная аутентификация и настройки языка. Сторонние рекламные куки и расширенное отслеживание не применяются.`,
      },
      {
        heading: '7. Условия использования',
        body: `Для использования платформы:\n• Вам должно быть не менее 18 лет.\n• Вы можете вводить только API-ключи аккаунтов маркетплейса, которые принадлежат вам или на использование которых вы уполномочены.\n• Запрещается взлом, перепродажа или использование платформы в несанкционированных целях.\n• Вы обязаны хранить учётные данные в тайне и незамедлительно сообщать нам о несанкционированном доступе.`,
      },
      {
        heading: '8. Ограничение ответственности',
        body: `Daromadchi является инструментом отображения данных. Мы не несём ответственности за полноту или актуальность данных, полученных через API маркетплейсов. Ответственность за коммерческие решения, принятые на основе аналитики платформы, лежит на пользователе.`,
      },
      {
        heading: '9. Согласие и регистрация',
        body: `При регистрации на платформе вы подтверждаете, что ознакомились с настоящей политикой и принимаете её — это является электронным согласием в соответствии с требованиями Закона ЗРУ-547.\n\nБаза персональных данных Daromadchi планируется к включению в Государственный реестр баз персональных данных, ведомый Государственным центром персонализации при Правительстве Республики Узбекистан.`,
      },
      {
        heading: '10. Контакты',
        body: `По вопросам, жалобам или юридическим запросам:\nЭлектронная почта: ${COMPANY_EMAIL}\n\nДля подачи жалобы в Республике Узбекистан: Министерство цифровых технологий или суд.`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy & Terms of Use',
    subtitle: 'By using the Daromadchi platform, you agree to this policy.',
    lastUpdated: `Last updated: ${LAST_UPDATED}`,
    back: 'Back to home',
    sections: [
      {
        heading: '1. About',
        body: `Daromadchi is an analytics platform for sellers on Uzbekistan marketplaces (Uzum Market, Wildberries, Yandex Market). This policy is prepared in compliance with the Law of the Republic of Uzbekistan "On Personal Data" (2 July 2019, ZRU-547) and the Law "On Informatization" (11 December 2003, No. 560-II).`,
      },
      {
        heading: '2. What data we collect',
        body: `• Account data: email address and encrypted password (via Supabase Auth).\n• Shop data: the marketplace API key you provide (stored encrypted with AES-256).\n• Trading data: orders, products, stock levels and ad statistics fetched via the marketplace API.\n• Technical data: browser type, IP address (for security purposes), system logs.\n\nWe do not collect payment card details, identity document copies, or other special-category personal data.`,
      },
      {
        heading: '3. How data is used',
        body: `• Generating dashboard metrics, reports and alerts.\n• Marketplace API synchronisation (read-only — we never modify anything in your store).\n• Security: detecting and preventing unauthorised access.\n• Service improvement: anonymous usage statistics.\n\nWe do not sell your data to third parties or use it for advertising purposes.`,
      },
      {
        heading: '4. Data storage, security & third-party transfers',
        body: `Data is stored with Supabase Inc. (infrastructure provider, USA) in a PostgreSQL database. API keys are encrypted with AES-256-CBC. All data in transit is protected by HTTPS.\n\nInternational transfer: amendments to Law ZRU-547 (26 March 2026) permit use of foreign cloud services where information security requirements are met. We rely on Supabase's SOC 2 certification as evidence of compliance with these requirements.\n\nThird parties: Supabase (database infrastructure) — access limited to technical operations only. No data is sold or shared with any other third parties.\n\nUnder Law ZRU-547, personal data is retained only as long as necessary, and for no more than 1 year after account deletion.`,
      },
      {
        heading: '5. User rights',
        body: `Under Law ZRU-547 you have the right to:\n• Access and receive a copy of your data.\n• Request correction or deletion of your data.\n• Withdraw consent to data processing.\n• Data portability — transfer your data to another service.\n\nTo exercise your rights, contact ${COMPANY_EMAIL}. Requests are processed within 15 working days.`,
      },
      {
        heading: '6. Cookies and tracking',
        body: `We use only functional cookies: session authentication and language preferences. No third-party advertising cookies or broad tracking are used.`,
      },
      {
        heading: '7. Terms of use',
        body: `To use the platform:\n• You must be at least 18 years old.\n• You may only enter API keys for marketplace accounts you own or are authorised to use.\n• Hacking, reselling or using the platform for unauthorised purposes is prohibited.\n• You must keep your credentials confidential and immediately notify us of any unauthorised access.`,
      },
      {
        heading: '8. Limitation of liability',
        body: `Daromadchi is a data display tool. We are not responsible for the completeness or accuracy of data obtained via marketplace APIs. Commercial decisions made based on platform analytics remain the user's responsibility.`,
      },
      {
        heading: '9. Consent & registration',
        body: `By registering on the platform you confirm you have read and accept this policy — this constitutes electronic consent as required by Law ZRU-547.\n\nThe Daromadchi personal data database is intended to be included in the State Register of Personal Data Bases maintained by the State Personalisation Centre under the Cabinet of Ministers of the Republic of Uzbekistan.`,
      },
      {
        heading: '10. Contact',
        body: `For questions, complaints or legal requests:\nEmail: ${COMPANY_EMAIL}\n\nTo file a complaint in the Republic of Uzbekistan: Ministry of Digital Technologies or the relevant court.`,
      },
    ],
  },
}

const LANG_LABELS: Record<Lang, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>('uz')
  const content = t[lang]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f1117)', color: 'var(--text, #e2e8f0)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border2, #2d2d3a)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim, #94a3b8)', textDecoration: 'none', fontSize: 14 }}>
          <ArrowLeft size={16} />
          {content.back}
        </Link>

        {/* Language switcher */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Globe size={14} style={{ color: 'var(--text-dim, #94a3b8)' }} />
          {(['uz', 'ru', 'en'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                borderColor: lang === l ? 'var(--c1, #00d4ff)' : 'var(--border2, #2d2d3a)',
                background: lang === l ? 'rgba(0,212,255,0.1)' : 'transparent',
                color: lang === l ? 'var(--c1, #00d4ff)' : 'var(--text-dim, #94a3b8)',
              }}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--c1, #00d4ff)' }}>
            {COMPANY_NAME}
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.3 }}>
          {content.title}
        </h1>
        <p style={{ color: 'var(--text-dim, #94a3b8)', marginBottom: 8 }}>
          {content.subtitle}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)', marginBottom: 48 }}>
          {content.lastUpdated}
        </p>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {content.sections.map((s, i) => (
            <section key={i}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: 'var(--text, #e2e8f0)' }}>
                {s.heading}
              </h2>
              <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-dim, #94a3b8)', whiteSpace: 'pre-line' }}>
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid var(--border2, #2d2d3a)', fontSize: 13, color: 'var(--text-dim, #94a3b8)' }}>
          © {new Date().getFullYear()} {COMPANY_NAME}. {lang === 'uz' ? 'Barcha huquqlar himoyalangan.' : lang === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
        </div>
      </main>
    </div>
  )
}
