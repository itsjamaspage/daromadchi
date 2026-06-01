export interface Article {
  slug: string
  title: string
  titleRu: string
  category: string
  categoryRu: string
  categorySlug: string
  type: 'article' | 'video'
  readTime: string
  description: string
  descriptionRu: string
  gradient: string  // tailwind gradient classes for thumbnail
  icon: string      // emoji icon for thumbnail
  content: string   // HTML/markdown-like content string
  contentRu: string
}

export const CATEGORIES = [
  { slug: 'boshlash',        label: "Boshlash",              labelRu: 'Начало работы',      icon: '🚀' },
  { slug: 'ulanish',         label: "Do'konni ulash",        labelRu: 'Подключение магазина', icon: '🔗' },
  { slug: 'sinxronizatsiya', label: 'Sinxronizatsiya',       labelRu: 'Синхронизация',       icon: '🔄' },
  { slug: 'tahlil',          label: 'Tahlil va hisobotlar',  labelRu: 'Аналитика',           icon: '📊' },
  { slug: 'tarif',           label: 'Tarif va to\'lov',      labelRu: 'Тарифы и оплата',     icon: '💳' },
  { slug: 'sozlamalar',      label: 'Sozlamalar',            labelRu: 'Настройки',           icon: '⚙️' },
]

export const ARTICLES: Article[] = [
  {
    slug: 'boshlash',
    title: "Daromadchi bilan tanishuv",
    titleRu: 'Знакомство с Daromadchi',
    category: "Boshlash",
    categoryRu: 'Начало работы',
    categorySlug: 'boshlash',
    type: 'article',
    readTime: '5 daqiqa',
    description: "Daromadchi nima, qanday ishlaydi va qanday boshlash kerak — to'liq qo'llanma.",
    descriptionRu: 'Что такое Daromadchi, как работает и как начать — полное руководство.',
    gradient: 'from-violet-600 to-indigo-600',
    icon: '🚀',
    content: `
<h2>Daromadchi nima?</h2>
<p>Daromadchi — Uzum Market, Yandex Market va Wildberries savdochilariga mo'ljallangan ko'p marketplace analitika platformasi. Barcha do'konlaringiz ma'lumotlarini bir joyda ko'ring.</p>

<h2>Asosiy imkoniyatlar</h2>
<ul>
  <li><strong>Dashboard</strong> — daromad, foyda, buyurtmalar va ombor KPI ko'rsatkichlari</li>
  <li><strong>Mahsulotlar jadvali</strong> — narx, tannarx, margin, DRR va reklama tahlili</li>
  <li><strong>ABC-XYZ tahlil</strong> — mahsulotlarni daromad va talab barqarorligi bo'yicha tasniflash</li>
  <li><strong>Buyurtmalar</strong> — barcha marketplace buyurtmalari bir joyda</li>
  <li><strong>P&L hisoboti</strong> — oylik foyda va zarar hisoboti</li>
  <li><strong>Foyda kalkulyatori</strong> — komissiya va xarajatlar hisobiga real foyda hisoblash</li>
  <li><strong>Bozor tadqiqoti</strong> — raqiblar narxi va trend mahsulotlar</li>
</ul>

<h2>Qanday boshlash kerak?</h2>
<ol>
  <li>Ro'yxatdan o'ting — 3 kunlik Pro tarif bepul beriladi</li>
  <li>Sozlamalar sahifasiga o'ting va marketplace API tokeningizni ulang</li>
  <li>"Sinxronlash" tugmasini bosing — ma'lumotlar avtomatik yuklanadi</li>
  <li>Dashboard sahifasida tahlilni ko'ring</li>
</ol>

<h2>Qaysi marketplacelar qo'llab-quvvatlanadi?</h2>
<p>Hozirda 3 ta marketplace qo'llab-quvvatlanadi:</p>
<ul>
  <li>🟣 <strong>Uzum Market</strong> (seller.uzum.uz)</li>
  <li>🟡 <strong>Yandex Market</strong> (partner.market.yandex.ru)</li>
  <li>🟤 <strong>Wildberries</strong> (seller.wildberries.ru)</li>
</ul>
    `,
    contentRu: `
<h2>Что такое Daromadchi?</h2>
<p>Daromadchi — мультимаркетплейс аналитическая платформа для продавцов Uzum Market, Yandex Market и Wildberries. Смотрите данные всех магазинов в одном месте.</p>

<h2>Основные возможности</h2>
<ul>
  <li><strong>Дашборд</strong> — KPI по выручке, прибыли, заказам и остаткам</li>
  <li><strong>Таблица товаров</strong> — цена, себестоимость, маржа, ДРР и рекламная аналитика</li>
  <li><strong>ABC-XYZ анализ</strong> — классификация товаров по доходу и стабильности спроса</li>
  <li><strong>Заказы</strong> — все заказы со всех маркетплейсов в одном месте</li>
  <li><strong>P&L отчёт</strong> — ежемесячный отчёт о прибылях и убытках</li>
  <li><strong>Калькулятор прибыли</strong> — реальная прибыль с учётом комиссий и расходов</li>
  <li><strong>Исследование рынка</strong> — цены конкурентов и трендовые товары</li>
</ul>

<h2>Как начать?</h2>
<ol>
  <li>Зарегистрируйтесь — 3 дня Pro тарифа бесплатно</li>
  <li>Перейдите в Настройки и подключите API-токен маркетплейса</li>
  <li>Нажмите "Синхронизировать" — данные загрузятся автоматически</li>
  <li>Смотрите аналитику на странице Dashboard</li>
</ol>
    `,
  },
  {
    slug: 'uzum-ulash',
    title: "Uzum Market do'konini ulash",
    titleRu: 'Подключение магазина Uzum Market',
    category: "Do'konni ulash",
    categoryRu: 'Подключение магазина',
    categorySlug: 'ulanish',
    type: 'article',
    readTime: '3 daqiqa',
    description: "Uzum Market API tokenini qanday olish va Daromadchiga ulash — bosqichma-bosqich ko'rsatma.",
    descriptionRu: 'Как получить API-токен Uzum Market и подключить к Daromadchi — пошаговая инструкция.',
    gradient: 'from-violet-500 to-purple-600',
    icon: '🟣',
    content: `
<h2>Uzum Market API tokenini olish</h2>
<ol>
  <li><strong>seller.uzum.uz</strong> saytiga kiring</li>
  <li>Yuqori o'ng burchakdagi profil ikonasini bosing</li>
  <li><strong>Sozlamalar</strong> → <strong>API integratsiya</strong> bo'limiga o'ting</li>
  <li>"Yangi token yaratish" tugmasini bosing</li>
  <li>Tokenni nusxalab oling (u faqat bir marta ko'rsatiladi)</li>
</ol>

<h2>Daromadchiga ulash</h2>
<ol>
  <li>Daromadchi → <strong>Sozlamalar</strong> sahifasiga o'ting</li>
  <li>Uzum Market bo'limidagi "API Token" maydoniga tokenni joylashtiring</li>
  <li><strong>Saqlash</strong> tugmasini bosing</li>
  <li>"Sinxronlash" tugmasini bosing — ma'lumotlar yuklanadi</li>
</ol>

<h2>Qanday ma'lumotlar yuklanadi?</h2>
<ul>
  <li>Barcha mahsulotlar (nom, SKU, narx, kategoriya)</li>
  <li>So'nggi 30 kunlik buyurtmalar</li>
  <li>Buyurtma holatlari (kutilmoqda, yetkazildi, bekor qilindi)</li>
</ul>

<h2>Muammo bo'lsa</h2>
<p>Agar sinxronizatsiya xato bilan tugasa, tokenni tekshiring — u eskirgan bo'lishi mumkin. Uzumda yangi token yarating va qayta saqlang.</p>
    `,
    contentRu: `
<h2>Получение API-токена Uzum Market</h2>
<ol>
  <li>Войдите на <strong>seller.uzum.uz</strong></li>
  <li>Нажмите на иконку профиля в правом верхнем углу</li>
  <li>Перейдите в <strong>Настройки</strong> → <strong>API интеграция</strong></li>
  <li>Нажмите "Создать новый токен"</li>
  <li>Скопируйте токен (он показывается только один раз)</li>
</ol>

<h2>Подключение к Daromadchi</h2>
<ol>
  <li>Перейдите в Daromadchi → <strong>Настройки</strong></li>
  <li>Вставьте токен в поле "API Token" раздела Uzum Market</li>
  <li>Нажмите <strong>Сохранить</strong></li>
  <li>Нажмите "Синхронизировать" — данные загрузятся</li>
</ol>
    `,
  },
  {
    slug: 'wildberries-ulash',
    title: "Wildberries do'konini ulash",
    titleRu: 'Подключение магазина Wildberries',
    category: "Do'konni ulash",
    categoryRu: 'Подключение магазина',
    categorySlug: 'ulanish',
    type: 'article',
    readTime: '4 daqiqa',
    description: "Wildberries API tokenini qanday olish, mahsulotlar, buyurtmalar va reklama ma'lumotlarini yuklash.",
    descriptionRu: 'Как получить API-токен Wildberries, загрузить товары, заказы и рекламную статистику.',
    gradient: 'from-purple-600 to-pink-600',
    icon: '🟤',
    content: `
<h2>Wildberries API tokenini olish</h2>
<ol>
  <li><strong>seller.wildberries.ru</strong> ga kiring</li>
  <li>Yuqori o'ng burchakdagi profilingizga o'ting</li>
  <li><strong>Profil</strong> → <strong>Sozlamalar</strong> → <strong>API integratsiyalari</strong></li>
  <li>"Yangi token" tugmasini bosing</li>
  <li>Barcha kerakli huquqlarni belgilang: <em>Kontent, Statistika, Reklama</em></li>
  <li>Tokenni nusxalab saqlang</li>
</ol>

<h2>Daromadchiga ulash</h2>
<ol>
  <li>Daromadchi → <strong>Sozlamalar</strong> → Wildberries bo'limi</li>
  <li>API tokenni kiriting va <strong>Saqlash</strong> ni bosing</li>
  <li><strong>Sinxronlash</strong> — mahsulotlar va buyurtmalar yuklanadi</li>
  <li><strong>Reklamani sinxronlash</strong> — WB reklama statistikasi (DRR, bosishlar, ko'rsatmalar) yuklanadi</li>
</ol>

<h2>Muhim: Token huquqlari</h2>
<p>Token yaratishda quyidagi huquqlarni albatta belgilang:</p>
<ul>
  <li>✅ Kontent (mahsulotlar uchun)</li>
  <li>✅ Statistika (buyurtmalar uchun)</li>
  <li>✅ Reklama (DRR tahlili uchun)</li>
</ul>
    `,
    contentRu: `
<h2>Получение API-токена Wildberries</h2>
<ol>
  <li>Войдите на <strong>seller.wildberries.ru</strong></li>
  <li>Перейдите в профиль → <strong>Настройки</strong> → <strong>API интеграции</strong></li>
  <li>Нажмите "Новый токен"</li>
  <li>Выберите права: <em>Контент, Статистика, Реклама</em></li>
  <li>Скопируйте и сохраните токен</li>
</ol>

<h2>Подключение к Daromadchi</h2>
<ol>
  <li>Daromadchi → <strong>Настройки</strong> → раздел Wildberries</li>
  <li>Введите токен и нажмите <strong>Сохранить</strong></li>
  <li><strong>Синхронизировать</strong> — загрузятся товары и заказы</li>
  <li><strong>Синхронизировать рекламу</strong> — загрузится рекламная статистика WB (ДРР, клики, показы)</li>
</ol>
    `,
  },
  {
    slug: 'yandex-ulash',
    title: "Yandex Market do'konini ulash",
    titleRu: 'Подключение магазина Yandex Market',
    category: "Do'konni ulash",
    categoryRu: 'Подключение магазина',
    categorySlug: 'ulanish',
    type: 'article',
    readTime: '4 daqiqa',
    description: "Yandex Market OAuth token va Campaign ID olish, Daromadchiga ulash ko'rsatmasi.",
    descriptionRu: 'Как получить OAuth-токен и Campaign ID Yandex Market и подключить к Daromadchi.',
    gradient: 'from-amber-500 to-orange-500',
    icon: '🟡',
    content: `
<h2>Yandex Market OAuth tokenini olish</h2>
<ol>
  <li><strong>oauth.yandex.ru</strong> ga kiring va Yandex akkauntingizga kiring</li>
  <li><strong>partner.market.yandex.ru</strong> → API → OAuth token bo'limiga o'ting</li>
  <li>Yangi token yarating yoki mavjudini nusxalang</li>
  <li>Token formatı: <code>y0_AgAAAAAxx...</code></li>
</ol>

<h2>Campaign ID topish</h2>
<ol>
  <li>partner.market.yandex.ru ga kiring</li>
  <li>Do'konlar ro'yxatidan kerakli do'konni tanlang</li>
  <li>URL dagi raqamni oling: <code>partner.market.yandex.ru/shop/<strong>12345678</strong>/...</code></li>
  <li>Bu raqam Campaign ID hisoblanadi</li>
</ol>

<h2>Daromadchiga ulash</h2>
<ol>
  <li>Daromadchi → <strong>Sozlamalar</strong> → Yandex Market bo'limi</li>
  <li>OAuth tokenni "OAuth Token" maydoniga kiriting</li>
  <li>Campaign ID ni tegishli maydoniga kiriting</li>
  <li><strong>Saqlash</strong> ni bosing, so'ng <strong>Sinxronlash</strong></li>
</ol>
    `,
    contentRu: `
<h2>Получение OAuth-токена Yandex Market</h2>
<ol>
  <li>Войдите на <strong>partner.market.yandex.ru</strong></li>
  <li>Перейдите в раздел API → OAuth токен</li>
  <li>Создайте новый токен или скопируйте существующий</li>
  <li>Формат токена: <code>y0_AgAAAAAxx...</code></li>
</ol>

<h2>Поиск Campaign ID</h2>
<ol>
  <li>Войдите на partner.market.yandex.ru</li>
  <li>Выберите нужный магазин из списка</li>
  <li>Возьмите число из URL: <code>partner.market.yandex.ru/shop/<strong>12345678</strong>/...</code></li>
  <li>Это и есть Campaign ID</li>
</ol>
    `,
  },
  {
    slug: 'sinxronizatsiya',
    title: "Sinxronizatsiya qanday ishlaydi",
    titleRu: 'Как работает синхронизация',
    category: 'Sinxronizatsiya',
    categoryRu: 'Синхронизация',
    categorySlug: 'sinxronizatsiya',
    type: 'article',
    readTime: '3 daqiqa',
    description: "Ma'lumotlar qanday yuklanadi, nima sinxronlanadi va muammolarni qanday hal qilish.",
    descriptionRu: 'Как загружаются данные, что синхронизируется и как решать проблемы.',
    gradient: 'from-cyan-500 to-blue-600',
    icon: '🔄',
    content: `
<h2>Sinxronizatsiya nima?</h2>
<p>Sinxronizatsiya — marketplace API orqali eng so'nggi mahsulot va buyurtma ma'lumotlarini Daromadchiga yuklash jarayoni. Har safar "Sinxronlash" tugmasini bosganingizda ma'lumotlar yangilanadi.</p>

<h2>Nima sinxronlanadi?</h2>
<table>
  <tr><th>Marketplace</th><th>Mahsulotlar</th><th>Buyurtmalar</th><th>Reklama</th></tr>
  <tr><td>Uzum Market</td><td>✅</td><td>✅ (30 kun)</td><td>🔜</td></tr>
  <tr><td>Yandex Market</td><td>✅</td><td>✅ (90 kun)</td><td>🔜</td></tr>
  <tr><td>Wildberries</td><td>✅</td><td>✅ (30 kun)</td><td>✅</td></tr>
</table>

<h2>Sinxronizatsiya holati sahifasi</h2>
<p>Dashboard → <strong>Sinxronizatsiya</strong> sahifasida har bir marketplace uchun:</p>
<ul>
  <li>Oxirgi sinxronizatsiya vaqti</li>
  <li>Mahsulotlar soni</li>
  <li>Buyurtmalar soni</li>
  <li>Individual sinxronlash tugmalari</li>
</ul>

<h2>Qancha tez-tez sinxronlash kerak?</h2>
<p>Kuniga 1-2 marta yetarli. Wildberries uchun reklama statistikasini ham alohida sinxronlang.</p>

<h2>Xato bo'lsa nima qilish kerak?</h2>
<ul>
  <li>Tokenni tekshiring — eskirgan bo'lishi mumkin</li>
  <li>Sozlamalarda tokenni yangilang</li>
  <li>Qayta sinxronlashga urinib ko'ring</li>
</ul>
    `,
    contentRu: `
<h2>Что такое синхронизация?</h2>
<p>Синхронизация — процесс загрузки актуальных данных о товарах и заказах через API маркетплейса в Daromadchi. Каждый раз при нажатии "Синхронизировать" данные обновляются.</p>

<h2>Что синхронизируется?</h2>
<ul>
  <li>Uzum Market: товары, заказы за 30 дней</li>
  <li>Yandex Market: товары, заказы за 90 дней</li>
  <li>Wildberries: товары, заказы за 30 дней, рекламная статистика</li>
</ul>

<h2>Как часто синхронизировать?</h2>
<p>Достаточно 1-2 раза в день. Для Wildberries также синхронизируйте рекламу отдельно.</p>
    `,
  },
  {
    slug: 'dashboard',
    title: "Dashboard va KPI ko'rsatkichlari",
    titleRu: 'Дашборд и KPI показатели',
    category: 'Tahlil va hisobotlar',
    categoryRu: 'Аналитика',
    categorySlug: 'tahlil',
    type: 'article',
    readTime: '4 daqiqa',
    description: "Dashboard sahifasidagi KPI kartalar, daromad grafigi, marketplace filtrlari va widget sozlamalari.",
    descriptionRu: 'KPI-карточки, график выручки, фильтры маркетплейсов и настройка виджетов на дашборде.',
    gradient: 'from-violet-600 to-blue-600',
    icon: '📊',
    content: `
<h2>KPI kartalar</h2>
<p>Dashboard yuqorisida 4 ta asosiy ko'rsatkich ko'rsatiladi:</p>
<ul>
  <li><strong>Umumiy daromad</strong> — tanlangan davr uchun jami daromad</li>
  <li><strong>Sof foyda</strong> — daromad minus tannarx va xarajatlar</li>
  <li><strong>Buyurtmalar</strong> — jami buyurtmalar soni</li>
  <li><strong>Ombordagi mahsulot</strong> — jami qoldiq</li>
</ul>
<p>Har bir kartada o'tgan davrga nisbatan foiz o'zgarish ko'rsatiladi (masalan: +12%).</p>

<h2>Vaqt filtrlari</h2>
<p>Yuqori o'ng burchakdagi tugmalar orqali:</p>
<ul>
  <li>Kecha</li>
  <li>7 kun</li>
  <li>30 kun</li>
  <li>90 kun</li>
  <li>Bu oy</li>
</ul>

<h2>Marketplace filtrlari</h2>
<p>Marketplace tablar orqali faqat bitta marketplace ma'lumotlarini ko'ring:</p>
<ul>
  <li>Hammasi — barcha marketplace</li>
  <li>Uzum — faqat Uzum Market</li>
  <li>Yandex Market</li>
  <li>Wildberries</li>
</ul>

<h2>Widget sozlamalari</h2>
<p>"Moslash" tugmasini bosib, qaysi bo'limlarni ko'rsatish yoki yashirish mumkin:</p>
<ul>
  <li>KPI Kartalar</li>
  <li>Ombor ogohlantirishlari</li>
  <li>Daromad grafigi</li>
  <li>Kategoriyalar</li>
</ul>
    `,
    contentRu: `
<h2>KPI карточки</h2>
<p>В верхней части дашборда отображаются 4 основных показателя: общая выручка, чистая прибыль, заказы и остатки на складе. В каждой карточке показывается изменение в % по сравнению с предыдущим периодом.</p>

<h2>Фильтры маркетплейсов</h2>
<p>Через вкладки маркетплейсов можно просматривать данные по отдельному магазину: Все / Uzum / Yandex Market / Wildberries.</p>

<h2>Настройка виджетов</h2>
<p>Нажмите кнопку "Настроить" чтобы скрыть или показать нужные секции дашборда.</p>
    `,
  },
  {
    slug: 'abc-xyz',
    title: "ABC-XYZ tahlil",
    titleRu: 'ABC-XYZ анализ',
    category: 'Tahlil va hisobotlar',
    categoryRu: 'Аналитика',
    categorySlug: 'tahlil',
    type: 'article',
    readTime: '5 daqiqa',
    description: "Mahsulotlarni daromad va talab barqarorligi bo'yicha tasniflash — inventarni samarali boshqarish.",
    descriptionRu: 'Классификация товаров по доходу и стабильности спроса — эффективное управление запасами.',
    gradient: 'from-emerald-500 to-teal-600',
    icon: '📈',
    content: `
<h2>ABC tahlil nima?</h2>
<p>ABC tahlili mahsulotlarni jami daromaddagi ulushiga qarab 3 guruhga bo'ladi:</p>
<ul>
  <li><strong style="color:#34d399">A sinf</strong> — eng muhim mahsulotlar. Jami daromadning 80% ini tashkil etadi. Doimo stokda bo'lishi kerak.</li>
  <li><strong style="color:#fbbf24">B sinf</strong> — o'rtacha muhim. Qolgan 15%. Barqaror stok saqlang.</li>
  <li><strong style="color:#f87171">C sinf</strong> — past prioritet. Eng oxirgi 5%. Assortimentni ko'rib chiqing.</li>
</ul>

<h2>XYZ tahlil nima?</h2>
<p>XYZ tahlili sotuvlar barqarorligini baholaydi:</p>
<ul>
  <li><strong style="color:#60a5fa">X</strong> — Barqaror talab (10 va undan ko'p sotilgan). Prognozlash oson.</li>
  <li><strong style="color:#fbbf24">Y</strong> — O'rtacha talab (1–9 sotilgan). O'rtacha barqarorlik.</li>
  <li><strong style="color:#94a3b8">Z</strong> — Sotilmagan (0 ta). Talab yo'q yoki noaniq.</li>
</ul>

<h2>Kombinatsiya qanday o'qiladi?</h2>
<ul>
  <li><strong>AX</strong> — Eng muhim mahsulot, barqaror sotiladi. Har doim stokda bo'lsin.</li>
  <li><strong>AZ</strong> — Yuqori daromad, lekin noaniq talab. Ehtiyotkorlik bilan boshqaring.</li>
  <li><strong>CX</strong> — Barqaror sotiladi, lekin kam daromad. Assortimentni qayta ko'ring.</li>
  <li><strong>CZ</strong> — Eng past prioritet. Chiqarib tashlashni ko'ring.</li>
</ul>

<h2>Qanday ishlatish kerak?</h2>
<ol>
  <li>Sidebar → <strong>ABC-XYZ</strong> sahifasiga o'ting</li>
  <li>Filtr tugmalari orqali kerakli guruhni tanlang</li>
  <li>A sinf mahsulotlar uchun stok nazoratini kuchaytiring</li>
  <li>CZ mahsulotlarni assortimentdan olib tashlashni ko'ring</li>
</ol>
    `,
    contentRu: `
<h2>Что такое ABC анализ?</h2>
<p>ABC анализ делит товары на 3 группы по доле в общей выручке:</p>
<ul>
  <li><strong>Класс A</strong> — топ-товары, дающие 80% выручки. Всегда держите в наличии.</li>
  <li><strong>Класс B</strong> — средние товары, ещё 15% выручки.</li>
  <li><strong>Класс C</strong> — нижние 5%. Пересмотрите ассортимент.</li>
</ul>

<h2>Что такое XYZ анализ?</h2>
<ul>
  <li><strong>X</strong> — Стабильный спрос (продано ≥10 шт.)</li>
  <li><strong>Y</strong> — Умеренный спрос (1–9 шт.)</li>
  <li><strong>Z</strong> — Нет продаж (0 шт.)</li>
</ul>

<h2>Как читать комбинацию?</h2>
<p>AX — лучшие товары, всегда в наличии. AZ — высокий доход, но непредсказуемый спрос. CZ — рассмотрите исключение из ассортимента.</p>
    `,
  },
  {
    slug: 'tarif',
    title: "Tarif rejalari va bepul sinov",
    titleRu: 'Тарифные планы и бесплатный пробный период',
    category: "Tarif va to'lov",
    categoryRu: 'Тарифы и оплата',
    categorySlug: 'tarif',
    type: 'article',
    readTime: '3 daqiqa',
    description: "Bepul, Pro va Pro+ tariflari farqlari, 3 kunlik bepul sinov va to'lov usullari.",
    descriptionRu: 'Отличия тарифов Free, Pro и Pro+, 3-дневный пробный период и способы оплаты.',
    gradient: 'from-amber-500 to-yellow-500',
    icon: '💳',
    content: `
<h2>3 kunlik bepul sinov</h2>
<p>Ro'yxatdan o'tgan har bir yangi foydalanuvchi avtomatik ravishda <strong>3 kunlik Pro tarif</strong> ga ega bo'ladi. Hech qanday karta talab etilmaydi.</p>

<h2>Tarif rejalari</h2>
<table>
  <tr><th>Xususiyat</th><th>Bepul</th><th>Pro</th><th>Pro+</th></tr>
  <tr><td>Narx</td><td>0</td><td>300,000 so'm/oy</td><td>600,000 so'm/oy</td></tr>
  <tr><td>Do'konlar soni</td><td>1 ta</td><td>3 ta</td><td>5 ta</td></tr>
  <tr><td>Ma'lumot tarixi</td><td>7 kun</td><td>Cheksiz</td><td>Cheksiz</td></tr>
  <tr><td>Barcha marketplace</td><td>✅</td><td>✅</td><td>✅</td></tr>
  <tr><td>Telegram xabarnomalar</td><td>❌</td><td>✅</td><td>✅</td></tr>
  <tr><td>WB reklama tahlili</td><td>❌</td><td>✅</td><td>✅</td></tr>
  <tr><td>ABC-XYZ tahlil</td><td>❌</td><td>✅</td><td>✅</td></tr>
</table>

<h2>To'lov usullari</h2>
<ul>
  <li>💳 <strong>Click</strong> — karta yoki Click hamyon</li>
  <li>💳 <strong>Payme</strong> — karta yoki Payme hamyon</li>
</ul>

<h2>Tarifni qanday yangilash</h2>
<ol>
  <li>Profil → Tarif rejasi sahifasiga o'ting</li>
  <li>"Pro ga o'tish" tugmasini bosing</li>
  <li>To'lov usulini tanlang</li>
  <li>To'lovdan so'ng tarif darhol faollashadi</li>
</ol>
    `,
    contentRu: `
<h2>3-дневный бесплатный пробный период</h2>
<p>Каждый новый пользователь автоматически получает <strong>3 дня Pro тарифа</strong> бесплатно. Карта не требуется.</p>

<h2>Тарифные планы</h2>
<ul>
  <li><strong>Бесплатный</strong> — 1 магазин, 7 дней истории</li>
  <li><strong>Pro</strong> — 300 000 сум/мес, 3 магазина, неограниченная история</li>
  <li><strong>Pro+</strong> — 600 000 сум/мес, 5 магазинов, приоритетная поддержка</li>
</ul>

<h2>Способы оплаты</h2>
<p>Click или Payme — карта или электронный кошелёк.</p>
    `,
  },
]

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

export function getArticlesByCategory(categorySlug: string): Article[] {
  return ARTICLES.filter(a => a.categorySlug === categorySlug)
}
