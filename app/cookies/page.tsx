'use client'

import { useLang } from '@/app/providers'
import { reopenConsent, useConsentGA } from '@/lib/cookie-consent'

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
  changeChoice: string
  statusLabel: string
  statusAccepted: string
  statusDeclined: string
  statusUnset: string
  legalTitle: string
  legal: string
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
    manage: 'Istalgan vaqtda brauzer sozlamalari orqali cookie-larni o\'chirishingiz yoki bloklashingiz mumkin. Ammo zarur cookie-lar o\'chirilsa, tizimga kirish ishlamasligi mumkin. Analitikaga bergan roziligingizni quyidagi tugma orqali istalgan vaqtda o\'zgartirishingiz mumkin.',
    changeChoice: 'Cookie tanlovini o\'zgartirish',
    statusLabel: 'Joriy tanlov:',
    statusAccepted: 'Analitika qabul qilingan',
    statusDeclined: 'Analitika rad etilgan',
    statusUnset: 'Hali tanlanmagan',
    legalTitle: 'Operator va huquqiy asos',
    legal: 'Ma\'lumotlar operatori: YATT Xakimjonov Jamshid (yakka tartibdagi tadbirkor), INN 51608028660035, O\'zbekiston Respublikasi. «Daromadchi» — xizmat nomi.\n\nUshbu siyosat «Shaxsiy ma\'lumotlar to\'g\'risida»gi O\'zbekiston Respublikasi Qonuni (2019-yil 2-iyul, ZRU-547-son), 1125-son Qonun bilan kiritilgan o\'zgartishlar (2026-yil 27-martdan kuchga kirgan) asosida tuzilgan. Nazorat organlari: O\'zbekiston Respublikasi Adliya vazirligi huzuridagi Shaxsiylashtirish agentligi (Shaxsiy ma\'lumotlar bazalarining Davlat reestrini yuritadi) va «Uzkomnazorat» davlat inspeksiyasi.\n\nDaromadchi marketplace xaridorlarining shaxsiy ma\'lumotlarini to\'plamaydi — faqat sotuvchining o\'z hisob ma\'lumotlari va do\'konining umumlashtirilgan savdo statistikasi qayta ishlanadi.\n\nMa\'lumotlaringiz O\'zbekiston Respublikasidan tashqarida joylashgan serverlarda (infratuzilma Germaniyada) qayta ishlanishi mumkin; Daromadchi\'dan foydalanib, siz ushbu transchegaraviy qayta ishlashga rozilik bildirasiz. Nozik bo\'lmagan shaxsiy ma\'lumotlar qonunda belgilangan shartlar asosida chet elda saqlanishi mumkin; biz rasmiy «adekvatlik» tan olinishini da\'vo qilmaymiz.\n\nMa\'lumotlarni himoya qilish bo\'yicha so\'rovlar: privacy@daromadchi.uz',
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
    manage: 'Вы можете в любой момент удалить или заблокировать cookie в настройках браузера. Однако при удалении необходимых cookie вход в систему может перестать работать. Согласие на аналитику можно изменить в любой момент с помощью кнопки ниже.',
    changeChoice: 'Изменить выбор cookie',
    statusLabel: 'Текущий выбор:',
    statusAccepted: 'Аналитика принята',
    statusDeclined: 'Аналитика отклонена',
    statusUnset: 'Выбор ещё не сделан',
    legalTitle: 'Оператор и правовое основание',
    legal: 'Оператор персональных данных: ЯТТ Хакимжонов Жамшид (индивидуальный предприниматель), ИНН 51608028660035, Республика Узбекистан. «Daromadchi» — наименование сервиса.\n\nНастоящая политика основана на Законе Республики Узбекистан «О персональных данных» (2 июля 2019 г., № ЗРУ-547) с изменениями, внесёнными Законом № 1125 (вступил в силу 27 марта 2026 г.). Надзорные органы: Агентство персонализации при Министерстве юстиции Республики Узбекистан (ведёт Государственный реестр баз персональных данных) и государственная инспекция «Узкомназорат».\n\nDaromadchi не собирает персональные данные покупателей маркетплейсов — обрабатываются только данные учётной записи самого продавца и агрегированная торговая статистика его магазина.\n\nВаши данные могут обрабатываться на серверах за пределами Республики Узбекистан (инфраструктура размещена в Германии); используя Daromadchi, вы даёте согласие на такую трансграничную обработку. Несенситивные персональные данные могут храниться за рубежом при соблюдении условий закона; мы не заявляем о наличии официального признания «адекватности».\n\nЗапросы по защите данных: privacy@daromadchi.uz',
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
    manage: 'You can delete or block cookies at any time in your browser settings. Note that if you remove essential cookies, logging in may stop working. You can change your analytics consent at any time using the button below.',
    changeChoice: 'Change cookie choice',
    statusLabel: 'Current choice:',
    statusAccepted: 'Analytics accepted',
    statusDeclined: 'Analytics declined',
    statusUnset: 'No choice made yet',
    legalTitle: 'Operator & legal basis',
    legal: 'Data operator: YATT Xakimjonov Jamshid (individual entrepreneur), INN 51608028660035, Republic of Uzbekistan. "Daromadchi" is the name of the service.\n\nThis policy is grounded in the Law of the Republic of Uzbekistan "On Personal Data" (2 July 2019, No. ZRU-547), as amended by Law No. 1125 (in force 27 March 2026). Supervisory authorities: the Personalization Agency under the Ministry of Justice of the Republic of Uzbekistan (which maintains the State Register of Personal Data Bases) and the state inspectorate Uzkomnazorat.\n\nDaromadchi does not collect marketplace customers\' (buyers\') personal data — it processes only the seller\'s own account data and their store\'s aggregated sales statistics.\n\nYour data may be processed on servers outside the Republic of Uzbekistan (our infrastructure is hosted in Germany); by using Daromadchi you consent to this cross-border processing. Non-sensitive personal data may be stored abroad subject to the conditions of the law; we do not claim any official "adequacy" finding.\n\nData-protection requests: privacy@daromadchi.uz',
    rights: 'For more detail, see our Privacy Policy.',
  },
}

export default function CookiesPage() {
  const { lang } = useLang()
  const t = T[lang] ?? T.uz
  const consent = useConsentGA()
  const statusText = consent === 'accepted' ? t.statusAccepted
    : consent === 'declined' ? t.statusDeclined
    : t.statusUnset
  const statusColor = consent === 'accepted' ? '#10b981'
    : consent === 'declined' ? 'var(--text-muted)'
    : 'var(--text-muted)'

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
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={reopenConsent}
                className="btn-primary"
                style={{ height: '2.5rem', padding: '0 1.25rem', fontSize: '0.875rem' }}
              >
                {t.changeChoice}
              </button>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t.statusLabel}{' '}
                <span className="font-semibold" style={{ color: statusColor }}>{statusText}</span>
              </span>
            </div>
          </div>
          <div>
            <h2 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
              {t.legalTitle}
            </h2>
            <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>{t.legal}</p>
          </div>
        </div>

        <p className="text-center text-sm mt-12" style={{ color: 'var(--text-muted)' }}>
          <a href="/privacy" className="underline" style={{ color: 'var(--c1)' }}>{t.rights}</a>
        </p>
      </div>
    </main>
  )
}
