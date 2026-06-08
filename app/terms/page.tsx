'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe } from 'lucide-react'

type Lang = 'uz' | 'ru' | 'en'

const LAST_UPDATED = '2026-06-08'
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
    title: 'Foydalanish shartlari',
    subtitle: "Daromadchi platformasidan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.",
    lastUpdated: `Oxirgi yangilanish: ${LAST_UPDATED}`,
    back: 'Bosh sahifaga',
    sections: [
      {
        heading: '1. Platformadan foydalanish',
        body: `Daromadchi — Uzbekiston bozorlarida (Uzum Market, Wildberries, Yandex Market) savdo qiluvchi sotuvchilar uchun mo'ljallangan analitika platformasidir.\n\nPlatformadan foydalanish uchun:\n• Faqat o'zingizga tegishli yoki vakolatli bo'lgan marketplace hisobi API kalitlarini kiritishingiz mumkin.\n• Platformani buzish, qayta sotish yoki ruxsatsiz maqsadlarda foydalanish taqiqlanadi.\n• Hisob ma'lumotlarini maxfiy saqlash va ularga ruxsatsiz kirishni darhol bizga xabar qilish majburiydir.`,
      },
      {
        heading: '2. Hisob va xavfsizlik',
        body: `Siz o'z hisobingiz xavfsizligi uchun javobgarsiz. Uchinchi shaxslarga hisob ma'lumotlarini berish taqiqlanadi. Hisob sizga shaxsiy va uzatilmas tarzda beriladi.`,
      },
      {
        heading: '3. Xizmat mavjudligi',
        body: `Biz xizmatni uzluksiz ta'minlashga harakat qilamiz, ammo texnik ta'mirlash, yangilanish yoki boshqa sabablarga ko'ra vaqtincha to'xtashlar bo'lishi mumkin. Biz ma'lum muddat ichida xizmat ko'rsatilishini kafolatlamaymiz.`,
      },
      {
        heading: '4. Intellektual mulk',
        body: `Platformadagi barcha kontent, dizayn va dasturiy ta'minot Daromadchi'ga tegishli. Ruxsatsiz nusxa ko'chirish, tarqatish yoki qayta foydalanish taqiqlanadi.`,
      },
      {
        heading: '5. Javobgarlilik chegarasi',
        body: `Daromadchi — ma'lumot ko'rsatish vositasi. Biz marketplace API'laridan olingan ma'lumotlarning to'liqligi yoki dolzarbligi uchun javob bermaymiz. Platformadagi tahlillar asosida qabul qilingan tijorat qarorlar uchun javobgarlik foydalanuvchida qoladi.`,
      },
      {
        heading: "6. Shartlarning o'zgarishi",
        body: `Biz ushbu shartlarni istalgan vaqtda o'zgartirish huquqini saqlaymiz. Muhim o'zgarishlar haqida elektron pochta orqali xabar beramiz. Platformadan foydalanishni davom ettirish yangilangan shartlarni qabul qilish deb hisoblanadi.`,
      },
      {
        heading: "7. Hisob o'chirish",
        body: `Siz istalgan vaqtda hisobingizni o'chirishingiz mumkin. O'chirish so'rovi uchun ${COMPANY_EMAIL} manziliga murojaat qiling. Hisobingiz o'chirilganidan so'ng 30 kun ichida ma'lumotlaringiz to'liq o'chiriladi.`,
      },
      {
        heading: "8. Qo'llaniladigan qonun",
        body: `Ushbu shartlar O'zbekiston Respublikasi qonunlariga muvofiq boshqariladi. Nizolar O'zbekiston Respublikasining vakolatli sudlari orqali hal etiladi.`,
      },
      {
        heading: '9. Aloqa',
        body: `Savollar yoki shikoyatlar uchun:\nElektron pochta: ${COMPANY_EMAIL}`,
      },
    ],
  },
  ru: {
    title: 'Условия использования',
    subtitle: 'Используя платформу Daromadchi, вы соглашаетесь с данными условиями.',
    lastUpdated: `Последнее обновление: ${LAST_UPDATED}`,
    back: 'На главную',
    sections: [
      {
        heading: '1. Использование платформы',
        body: `Daromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Wildberries, Yandex Market).\n\nДля использования платформы:\n• Вы можете вводить только API-ключи аккаунтов маркетплейса, которые принадлежат вам или на использование которых вы уполномочены.\n• Запрещается взлом, перепродажа или использование платформы в несанкционированных целях.\n• Вы обязаны хранить учётные данные в тайне и незамедлительно сообщать нам о несанкционированном доступе.`,
      },
      {
        heading: '2. Аккаунт и безопасность',
        body: `Вы несёте ответственность за безопасность своего аккаунта. Передача учётных данных третьим лицам запрещена. Аккаунт предоставляется вам лично и не подлежит передаче.`,
      },
      {
        heading: '3. Доступность сервиса',
        body: `Мы стремимся обеспечить бесперебойную работу сервиса, однако возможны временные перерывы в связи с техническим обслуживанием, обновлениями или иными причинами. Мы не гарантируем доступность сервиса в течение определённого времени.`,
      },
      {
        heading: '4. Интеллектуальная собственность',
        body: `Всё содержимое, дизайн и программное обеспечение платформы принадлежат Daromadchi. Несанкционированное копирование, распространение или повторное использование запрещены.`,
      },
      {
        heading: '5. Ограничение ответственности',
        body: `Daromadchi является инструментом отображения данных. Мы не несём ответственности за полноту или актуальность данных, полученных через API маркетплейсов. Ответственность за коммерческие решения, принятые на основе аналитики платформы, лежит на пользователе.`,
      },
      {
        heading: '6. Изменение условий',
        body: `Мы оставляем за собой право изменять настоящие условия в любое время. О существенных изменениях мы уведомим вас по электронной почте. Продолжение использования платформы означает согласие с обновлёнными условиями.`,
      },
      {
        heading: '7. Удаление аккаунта',
        body: `Вы можете удалить свой аккаунт в любое время. Для этого обратитесь на ${COMPANY_EMAIL}. После удаления аккаунта ваши данные будут полностью удалены в течение 30 дней.`,
      },
      {
        heading: '8. Применимое право',
        body: `Настоящие условия регулируются законодательством Республики Узбекистан. Споры разрешаются через компетентные суды Республики Узбекистан.`,
      },
      {
        heading: '9. Контакты',
        body: `По вопросам или жалобам:\nЭлектронная почта: ${COMPANY_EMAIL}`,
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    subtitle: 'By using the Daromadchi platform, you agree to these terms.',
    lastUpdated: `Last updated: ${LAST_UPDATED}`,
    back: 'Back to home',
    sections: [
      {
        heading: '1. Use of the platform',
        body: `Daromadchi is an analytics platform for sellers on Uzbekistan marketplaces (Uzum Market, Wildberries, Yandex Market).\n\nTo use the platform:\n• You may only enter API keys for marketplace accounts you own or are authorised to use.\n• Hacking, reselling or using the platform for unauthorised purposes is prohibited.\n• You must keep your credentials confidential and immediately notify us of any unauthorised access.`,
      },
      {
        heading: '2. Account and security',
        body: `You are responsible for the security of your account. Sharing credentials with third parties is prohibited. Your account is personal and non-transferable.`,
      },
      {
        heading: '3. Service availability',
        body: `We strive to provide uninterrupted service, but temporary outages may occur due to maintenance, updates, or other reasons. We do not guarantee uptime for any specific period.`,
      },
      {
        heading: '4. Intellectual property',
        body: `All content, design and software on the platform belongs to Daromadchi. Unauthorised copying, distribution or reuse is prohibited.`,
      },
      {
        heading: '5. Limitation of liability',
        body: `Daromadchi is a data display tool. We are not responsible for the completeness or accuracy of data obtained via marketplace APIs. Commercial decisions made based on platform analytics remain the user's responsibility.`,
      },
      {
        heading: '6. Changes to terms',
        body: `We reserve the right to update these terms at any time. We will notify you of material changes by email. Continued use of the platform constitutes acceptance of the updated terms.`,
      },
      {
        heading: '7. Account deletion',
        body: `You may delete your account at any time by contacting ${COMPANY_EMAIL}. Your data will be permanently deleted within 30 days of account deletion.`,
      },
      {
        heading: '8. Governing law',
        body: `These terms are governed by the laws of the Republic of Uzbekistan. Disputes shall be resolved through the competent courts of the Republic of Uzbekistan.`,
      },
      {
        heading: '9. Contact',
        body: `For questions or complaints:\nEmail: ${COMPANY_EMAIL}`,
      },
    ],
  },
}

const LANG_LABELS: Record<Lang, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

export default function TermsPage() {
  const [lang, setLang] = useState<Lang>('uz')
  const content = t[lang]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f1117)', color: 'var(--text, #e2e8f0)' }}>
      <div style={{ borderBottom: '1px solid var(--border2, #2d2d3a)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim, #94a3b8)', textDecoration: 'none', fontSize: 14 }}>
          <ArrowLeft size={16} />
          {content.back}
        </Link>
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

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
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

        <div style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid var(--border2, #2d2d3a)', fontSize: 13, color: 'var(--text-dim, #94a3b8)' }}>
          © {new Date().getFullYear()} {COMPANY_NAME}. {lang === 'uz' ? 'Barcha huquqlar himoyalangan.' : lang === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
        </div>
      </main>
    </div>
  )
}
