'use client'

import { useLang } from '@/app/providers'

type Row = { name: string; purpose: string; type: string; life: string }

const T: Record<string, {
  title: string
  subtitle: string
  updated: string
  intro: string
  colName: string
  colPurpose: string
  colType: string
  colLife: string
  rows: Row[]
  noTrackTitle: string
  noTrack: string
  manageTitle: string
  manage: string
  rights: string
}> = {
  uz: {
    title: 'Cookie siyosati',
    subtitle: 'Daromadchi cookie-fayllardan qanday foydalanishi haqida.',
    updated: 'Oxirgi yangilanish: 2026-08-09',
    intro: 'Cookie — brauzeringiz saqlaydigan kichik matn fayli. Daromadchi platformaning ishlashi uchun zarur cookie-lardan va, faqat roziligingiz bilan, saytni yaxshilash uchun anonim analitika cookie-laridan (Google Analytics) foydalanadi. Biz uchinchi tomon reklama cookie-laridan foydalanmaymiz va ma\'lumotlaringizni sotmaymiz.',
    colName: 'Cookie',
    colPurpose: 'Maqsadi',
    colType: 'Turi',
    colLife: 'Amal muddati',
    rows: [
      { name: 'Sessiya (autentifikatsiya)', purpose: 'Tizimga kirganingizni eslab qoladi, shunda har bir sahifada qayta parol kiritish shart emas.', type: 'Zarur', life: 'Sessiya / 30 kun' },
      { name: 'lang', purpose: 'Tanlagan tilingizni (UZ / RU / EN) saqlaydi.', type: 'Funktsional', life: '1 yil' },
      { name: 'theme (localStorage)', purpose: 'Yorug\' yoki tungi rejim tanlovingizni saqlaydi.', type: 'Funktsional', life: 'O\'chirilguncha' },
      { name: '_ga, _ga_* (Google Analytics)', purpose: 'Rozilik bergan bo\'lsangiz, sayt qanday ishlatilishini anonim tahlil qiladi (sahifa ko\'rishlari). Shaxsiy ma\'lumot yuborilmaydi.', type: 'Analitika (ixtiyoriy)', life: '13 oy' },
    ],
    noTrackTitle: 'Analitika (roziligingiz bilan)',
    noTrack: 'Rozilik bersangiz, saytni yaxshilash uchun Google Analytics 4 dan foydalanamiz. U faqat siz «Qabul qilish» tugmasini bosgandan keyin yuklanadi; «Rad etish»ni tanlasangiz umuman yuklanmaydi. Reklama cookie-lari yo\'q, ma\'lumotlaringizni sotmaymiz va Google Analytics\'ga shaxsiy ma\'lumot (email, foydalanuvchi ID, do\'kon nomi) yubormaymiz.',
    manageTitle: 'Cookie-larni boshqarish',
    manage: 'Istalgan vaqtda brauzer sozlamalari orqali cookie-larni o\'chirishingiz yoki bloklashingiz mumkin. Ammo zarur cookie-lar o\'chirilsa, tizimga kirish ishlamasligi mumkin. Analitikaga bergan roziligingizni brauzer ma\'lumotlarini tozalab istalgan vaqtda qaytarib olishingiz mumkin.',
    rights: 'Batafsil ma\'lumot uchun Maxfiylik siyosatimizga qarang.',
  },
  ru: {
    title: 'Политика использования cookie',
    subtitle: 'Как Daromadchi использует файлы cookie.',
    updated: 'Последнее обновление: 2026-08-09',
    intro: 'Cookie — это небольшой текстовый файл, который сохраняет ваш браузер. Daromadchi использует cookie, необходимые для работы платформы, и — только с вашего согласия — анонимные аналитические cookie (Google Analytics) для улучшения сайта. Мы не используем сторонние рекламные cookie и не продаём ваши данные.',
    colName: 'Cookie',
    colPurpose: 'Назначение',
    colType: 'Тип',
    colLife: 'Срок',
    rows: [
      { name: 'Сессия (аутентификация)', purpose: 'Запоминает, что вы вошли в систему, чтобы не вводить пароль на каждой странице.', type: 'Необходимый', life: 'Сессия / 30 дней' },
      { name: 'lang', purpose: 'Сохраняет выбранный язык (UZ / RU / EN).', type: 'Функциональный', life: '1 год' },
      { name: 'theme (localStorage)', purpose: 'Сохраняет выбор светлой или тёмной темы.', type: 'Функциональный', life: 'До удаления' },
      { name: '_ga, _ga_* (Google Analytics)', purpose: 'Если вы дали согласие — анонимно анализирует использование сайта (просмотры страниц). Персональные данные не передаются.', type: 'Аналитика (по желанию)', life: '13 месяцев' },
    ],
    noTrackTitle: 'Аналитика (с вашего согласия)',
    noTrack: 'С вашего согласия мы используем Google Analytics 4 для улучшения сайта. Он загружается только после нажатия «Принять»; если вы выберете «Отклонить», он не загружается вовсе. Никаких рекламных cookie, мы не продаём ваши данные и не передаём в Google Analytics персональные данные (email, ID пользователя, название магазина).',
    manageTitle: 'Управление cookie',
    manage: 'Вы можете в любой момент удалить или заблокировать cookie в настройках браузера. Однако при удалении необходимых cookie вход в систему может перестать работать. Согласие на аналитику можно отозвать в любой момент, очистив данные сайта в браузере.',
    rights: 'Подробнее — в нашей Политике конфиденциальности.',
  },
  en: {
    title: 'Cookie Policy',
    subtitle: 'How Daromadchi uses cookies.',
    updated: 'Last updated: 2026-08-09',
    intro: 'A cookie is a small text file your browser stores. Daromadchi uses the cookies needed for the platform to work and, only with your consent, anonymous analytics cookies (Google Analytics) to improve the site. We do not use third-party advertising cookies, and we never sell your data.',
    colName: 'Cookie',
    colPurpose: 'Purpose',
    colType: 'Type',
    colLife: 'Lifetime',
    rows: [
      { name: 'Session (authentication)', purpose: 'Remembers that you are logged in so you do not re-enter your password on every page.', type: 'Essential', life: 'Session / 30 days' },
      { name: 'lang', purpose: 'Stores your chosen language (UZ / RU / EN).', type: 'Functional', life: '1 year' },
      { name: 'theme (localStorage)', purpose: 'Stores your light / dark theme choice.', type: 'Functional', life: 'Until cleared' },
      { name: '_ga, _ga_* (Google Analytics)', purpose: 'If you consent, anonymously measures how the site is used (page views). No personal data is sent.', type: 'Analytics (optional)', life: '13 months' },
    ],
    noTrackTitle: 'Analytics (with your consent)',
    noTrack: 'With your consent we use Google Analytics 4 to improve the site. It loads only after you click "Accept"; if you choose "Decline" it is never loaded. No advertising cookies, we do not sell your data, and we never send personal data (email, user ID, shop name) to Google Analytics.',
    manageTitle: 'Managing cookies',
    manage: 'You can delete or block cookies at any time in your browser settings. Note that if you remove essential cookies, logging in may stop working. You can withdraw analytics consent at any time by clearing the site data in your browser.',
    rights: 'For more detail, see our Privacy Policy.',
  },
}

export default function CookiesPage() {
  const { lang } = useLang()
  const t = T[lang] ?? T.uz

  return (
    <main className="flex-1 min-w-0 px-6 sm:px-8 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-extrabold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
          >
            {t.title}
          </h1>
          <p className="text-base mb-2" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.updated}</p>
        </div>

        <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
          {t.intro}
        </p>

        <div className="overflow-x-auto rounded-2xl border mb-10" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--bg-card2)' }}>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-base)' }}>{t.colName}</th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-base)' }}>{t.colPurpose}</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: 'var(--text-base)' }}>{t.colType}</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: 'var(--text-base)' }}>{t.colLife}</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--text-base)' }}>{r.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.purpose}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.life}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.noTrackTitle}
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.noTrack}</p>
          </div>
          <div>
            <h2 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.manageTitle}
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.manage}</p>
          </div>
        </div>

        <p className="text-center text-sm mt-12" style={{ color: 'var(--text-muted)' }}>
          <a href="/privacy" className="underline" style={{ color: 'var(--c1)' }}>{t.rights}</a>
        </p>
      </div>
    </main>
  )
}
