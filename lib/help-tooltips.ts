export type HelpStep = { step: number; text: string }

export type HelpContent = {
  title: string
  what: string       // what the feature does
  why: string        // how it helps run the shop
  how: string        // how to use the data
  steps: HelpStep[]  // how data is collected/shown
}

export type HelpSection =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'analytics'
  | 'advertising'
  | 'searchPhrases'
  | 'unitEconomics'
  | 'pnl'
  | 'calculator'
  | 'keywords'
  | 'team'
  | 'dataState'
  | 'priceTracking'
  | 'alerts'
  | 'payouts'
  | 'reviews'
  | 'seasonality'
  | 'marketResearch'

type LangMap = Record<'uz' | 'ru' | 'en', HelpContent>
type HelpDB = Record<HelpSection, LangMap>

export const helpContent: HelpDB = {
  dashboard: {
    uz: {
      title: 'Bosh sahifa',
      what: 'Bosh sahifada do\'koningizning eng muhim ko\'rsatkichlari bir joyda ko\'rsatiladi: daromad, buyurtmalar, mahsulotlar va reklama statistikasi.',
      why: 'Har kuni bir nazar tashlash orqali do\'konning umumiy holatini tezda baholashingiz va muammolarni erta aniqlashingiz mumkin.',
      how: 'Kartochkalardagi raqamlarni oldingi davr bilan solishtiring. O\'sish yashil, tushish qizil rang bilan ko\'rsatiladi. Grafikda tendensiyani kuzating.',
      steps: [
        { step: 1, text: 'Uzum Market hisobingiz API orqali ulangan' },
        { step: 2, text: 'Sinxronizatsiya kuniga bir marta avtomatik ishlaydi' },
        { step: 3, text: 'Ma\'lumotlar har kuni yangilanadi va saqlanadi' },
        { step: 4, text: 'Tarixiy ma\'lumotlar 12 oygacha saqlanadi' },
      ],
    },
    ru: {
      title: 'Главная страница',
      what: 'Главная страница отображает ключевые показатели вашего магазина: выручку, заказы, товары и статистику рекламы.',
      why: 'Ежедневный обзор позволяет быстро оценить состояние магазина и выявить проблемы на ранней стадии.',
      how: 'Сравнивайте цифры в карточках с предыдущим периодом. Рост — зелёный, падение — красный. Следите за тенденцией на графике.',
      steps: [
        { step: 1, text: 'Ваш аккаунт Uzum Market подключён через API' },
        { step: 2, text: 'Синхронизация происходит автоматически раз в день' },
        { step: 3, text: 'Данные обновляются и сохраняются ежедневно' },
        { step: 4, text: 'История данных хранится до 12 месяцев' },
      ],
    },
    en: {
      title: 'Dashboard Overview',
      what: 'The dashboard displays your store\'s key metrics in one place: revenue, orders, products, and ad statistics.',
      why: 'A daily glance lets you quickly assess your store\'s health and spot issues early.',
      how: 'Compare the card numbers with the previous period. Growth is green, decline is red. Track the trend on the chart.',
      steps: [
        { step: 1, text: 'Your Uzum Market account is connected via API' },
        { step: 2, text: 'Sync runs automatically once a day' },
        { step: 3, text: 'Data is updated and stored daily' },
        { step: 4, text: 'Historical data is kept for up to 12 months' },
      ],
    },
  },

  products: {
    uz: {
      title: 'Mahsulotlar',
      what: 'Do\'koningizdagi barcha mahsulotlar ro\'yxati: narxlar, zaxira miqdori, sotuvlar va holati.',
      why: 'Qaysi mahsulotlar yaxshi sotilayotgani, qaysilari omborda qolib ketayotganini bilib, assortimentingizni optimallashtiring.',
      how: 'Mahsulotlarni sotuv bo\'yicha tartiblang. Zaxirasi kamayib borayotganlarni belgilang va narxlarni raqobatchilarga moslashtiring.',
      steps: [
        { step: 1, text: 'Uzum API orqali mahsulotlar ro\'yxati tortib olinadi' },
        { step: 2, text: 'Sotuv ma\'lumotlari buyurtmalar bilan birlashtiriladi' },
        { step: 3, text: 'Zaxira ma\'lumotlari ombor hisobidan olinadi' },
        { step: 4, text: 'Ma\'lumotlar kunlik yangilanadi' },
      ],
    },
    ru: {
      title: 'Товары',
      what: 'Полный список товаров вашего магазина: цены, остатки, продажи и статус.',
      why: 'Узнайте, какие товары хорошо продаются, а какие залеживаются на складе, и оптимизируйте ассортимент.',
      how: 'Сортируйте товары по продажам. Отметьте те, у которых кончается запас, и скорректируйте цены в соответствии с конкурентами.',
      steps: [
        { step: 1, text: 'Список товаров получен через API Uzum' },
        { step: 2, text: 'Данные о продажах объединены с заказами' },
        { step: 3, text: 'Данные об остатках получены из складского учёта' },
        { step: 4, text: 'Данные обновляются ежедневно' },
      ],
    },
    en: {
      title: 'Products',
      what: 'A complete list of your store\'s products: prices, stock levels, sales, and status.',
      why: 'Find out which products sell well and which are stuck in inventory, then optimize your assortment.',
      how: 'Sort products by sales. Flag those running low on stock and adjust prices to match competitors.',
      steps: [
        { step: 1, text: 'Product list is pulled via Uzum API' },
        { step: 2, text: 'Sales data is merged with order data' },
        { step: 3, text: 'Stock data is taken from warehouse records' },
        { step: 4, text: 'Data refreshes daily' },
      ],
    },
  },

  orders: {
    uz: {
      title: 'Buyurtmalar',
      what: 'Barcha buyurtmalar tarixi: holati, miqdori, mahsulot tafsilotlari va to\'lov ma\'lumotlari.',
      why: 'Qaytarib yuborishlar, bekor qilingan buyurtmalar va eng ko\'p buyurtma keladigan mahsulotlarni kuzating.',
      how: 'Buyurtmalarni sana yoki holat bo\'yicha filtrlab, haftalik yoki oylik tendensiyalarni tahlil qiling.',
      steps: [
        { step: 1, text: 'Uzum API orqali buyurtmalar olinadi' },
        { step: 2, text: 'Har bir buyurtmaning holati kuzatiladi' },
        { step: 3, text: 'To\'lov va yetkazib berish ma\'lumotlari birlashtiriladi' },
        { step: 4, text: 'Tarixiy ma\'lumotlar bazada saqlanadi' },
      ],
    },
    ru: {
      title: 'Заказы',
      what: 'История всех заказов: статус, сумма, детали товара и платёжная информация.',
      why: 'Отслеживайте возвраты, отменённые заказы и самые популярные товары.',
      how: 'Фильтруйте заказы по дате или статусу, анализируйте еженедельные или ежемесячные тенденции.',
      steps: [
        { step: 1, text: 'Заказы получены через API Uzum' },
        { step: 2, text: 'Статус каждого заказа отслеживается' },
        { step: 3, text: 'Объединяются данные об оплате и доставке' },
        { step: 4, text: 'История сохраняется в базе данных' },
      ],
    },
    en: {
      title: 'Orders',
      what: 'Full order history: status, amount, product details, and payment info.',
      why: 'Track returns, cancelled orders, and which products get ordered most.',
      how: 'Filter orders by date or status to analyze weekly or monthly trends.',
      steps: [
        { step: 1, text: 'Orders are pulled via Uzum API' },
        { step: 2, text: 'Each order\'s status is tracked' },
        { step: 3, text: 'Payment and delivery data are merged' },
        { step: 4, text: 'History is stored in the database' },
      ],
    },
  },

  analytics: {
    uz: {
      title: 'Tahlil',
      what: 'Do\'koningizning sotuv, daromad va trafik dinamikasini grafik ko\'rinishda ko\'rsatadi.',
      why: 'O\'sish davrlari va pasayishlarni aniqlab, nima ishlayotganini va nima ishlamayotganini tushunib oling.',
      how: 'Davr oralig\'ini o\'zgartiring va ko\'rsatkichlarni solishtirib tahlil qiling. Reklama investitsiyangizning samarasini (DRR) ko\'ring.',
      steps: [
        { step: 1, text: 'Buyurtma va daromad ma\'lumotlari aggregate qilinadi' },
        { step: 2, text: 'Reklama xarajatlari bilan taqqoslanadi' },
        { step: 3, text: 'Grafik kunlik yoki oylik ko\'rinishda chiziladi' },
        { step: 4, text: 'DRR = Reklama xarajatlari / Daromad × 100' },
      ],
    },
    ru: {
      title: 'Аналитика',
      what: 'Показывает динамику продаж, выручки и трафика вашего магазина в графическом виде.',
      why: 'Выявите периоды роста и спада, поймите, что работает, а что нет.',
      how: 'Измените диапазон дат и анализируйте показатели в сравнении. Смотрите эффективность рекламных инвестиций (ДРР).',
      steps: [
        { step: 1, text: 'Данные о заказах и выручке агрегируются' },
        { step: 2, text: 'Сравниваются с рекламными расходами' },
        { step: 3, text: 'График строится в дневном или месячном виде' },
        { step: 4, text: 'ДРР = Расходы на рекламу / Выручка × 100' },
      ],
    },
    en: {
      title: 'Analytics',
      what: 'Shows sales, revenue, and traffic trends for your store in chart form.',
      why: 'Identify growth and decline periods to understand what\'s working and what isn\'t.',
      how: 'Change the date range and compare metrics side by side. See your ad spend efficiency (DRR).',
      steps: [
        { step: 1, text: 'Order and revenue data are aggregated' },
        { step: 2, text: 'Compared against advertising spend' },
        { step: 3, text: 'Charts are drawn daily or monthly' },
        { step: 4, text: 'DRR = Ad Spend / Revenue × 100' },
      ],
    },
  },

  advertising: {
    uz: {
      title: 'Reklama',
      what: 'Uzum, Wildberries va Yandex Market reklamalariga sarflangan mablag\', klik soni, ko\'rishlar va DRR (reklama samaradorligi) ko\'rsatkichlari.',
      why: 'Reklama budjetingizni to\'g\'ri boshqaring: nima foydali, nima zararga ishlayotganini aniqlang.',
      how: 'DRR 15-20% dan past bo\'lishi ideal. Yuqori DRR — reklama qimmat. Effektiv kampaniyalarni ko\'paytiring.',
      steps: [
        { step: 1, text: 'Uzum, Wildberries va Yandex Market reklama tizimlaridan xarajatlar olinadi' },
        { step: 2, text: 'Har bir kampaniya bo\'yicha klik va ko\'rishlar sanaldi' },
        { step: 3, text: 'Daromad bilan solishtirilib DRR hisoblanadi' },
        { step: 4, text: 'Kunlik va haftalik yangilanadi' },
      ],
    },
    ru: {
      title: 'Реклама',
      what: 'Затраты на рекламу Uzum, Wildberries и Yandex Market, количество кликов, показы и показатель ДРР (эффективность рекламы).',
      why: 'Правильно управляйте рекламным бюджетом: определите, что работает в плюс, а что — в минус.',
      how: 'Идеальный ДРР — ниже 15–20%. Высокий ДРР означает дорогую рекламу. Масштабируйте эффективные кампании.',
      steps: [
        { step: 1, text: 'Расходы получены из рекламных систем Uzum, Wildberries и Yandex Market' },
        { step: 2, text: 'Клики и показы подсчитаны по каждой кампании' },
        { step: 3, text: 'ДРР рассчитывается в сравнении с выручкой' },
        { step: 4, text: 'Обновляется ежедневно и еженедельно' },
      ],
    },
    en: {
      title: 'Advertising',
      what: 'Ad spend, clicks, impressions and DRR (ad efficiency metric) across Uzum, Wildberries and Yandex Market.',
      why: 'Manage your ad budget effectively: find what\'s profitable and what\'s losing money.',
      how: 'Ideal DRR is below 15–20%. High DRR = expensive ads. Scale up the campaigns that work.',
      steps: [
        { step: 1, text: 'Spend data pulled from Uzum, Wildberries and Yandex Market ad systems' },
        { step: 2, text: 'Clicks and impressions counted per campaign' },
        { step: 3, text: 'DRR calculated vs revenue' },
        { step: 4, text: 'Updated daily and weekly' },
      ],
    },
  },

  searchPhrases: {
    uz: {
      title: 'Qidiruv iboralari',
      what: 'Xaridorlar Uzumda mahsulotlaringizni topish uchun qaysi so\'zlarni kiritayotganini ko\'rsatadi.',
      why: 'Eng yaxshi ishlayotgan qidiruv so\'zlarini bilib, mahsulot sarlavhalarini va tavsiflarini optimallashtiring.',
      how: 'Ko\'rsatmalar yuqori — mahsulot ko\'p topilmoqda. CTR (bosish foizi) yuqori — sarlavha jozibali. Ikkalasi ham past bo\'lsa — pozitsiya yaxshilanishi kerak.',
      steps: [
        { step: 1, text: 'Uzum qidiruv statistikasidan ma\'lumot tortiladi' },
        { step: 2, text: 'Har bir qidiruv iborasi mahsulot bilan bog\'lanadi' },
        { step: 3, text: 'Ko\'rsatmalar, kliklar va CTR hisoblanadi' },
        { step: 4, text: 'O\'rtacha pozitsiya kuzatiladi' },
      ],
    },
    ru: {
      title: 'Поисковые фразы',
      what: 'Показывает, какие слова покупатели вводят на Uzum, чтобы найти ваши товары.',
      why: 'Зная лучшие поисковые запросы, оптимизируйте заголовки и описания товаров.',
      how: 'Высокие показы — товар часто находят. Высокий CTR — заголовок привлекательный. Если оба низкие — позицию нужно улучшать.',
      steps: [
        { step: 1, text: 'Данные получены из поисковой статистики Uzum' },
        { step: 2, text: 'Каждая поисковая фраза привязана к товару' },
        { step: 3, text: 'Подсчитываются показы, клики и CTR' },
        { step: 4, text: 'Отслеживается средняя позиция' },
      ],
    },
    en: {
      title: 'Search Phrases',
      what: 'Shows which words shoppers type on Uzum to find your products.',
      why: 'Knowing the best search terms lets you optimize product titles and descriptions.',
      how: 'High impressions = product is found often. High CTR = title is compelling. Both low = position needs improvement.',
      steps: [
        { step: 1, text: 'Data pulled from Uzum search statistics' },
        { step: 2, text: 'Each phrase is linked to a product' },
        { step: 3, text: 'Impressions, clicks, and CTR are counted' },
        { step: 4, text: 'Average position is tracked' },
      ],
    },
  },

  unitEconomics: {
    uz: {
      title: 'Birlik iqtisodiyoti',
      what: 'Har bir mahsulot yoki buyurtma bo\'yicha haqiqiy foyda: narxdan barcha xarajatlar (komissiya, yetkazish, soliq) ayirilgandan keyingi holat.',
      why: 'Qaysi mahsulotlar sof foyda keltiradi, qaysilari aslida zararli ekanini bilib oling.',
      how: 'Foyda marjasi manfiy bo\'lsa — bu mahsulot narxini oshirish yoki xarajatlarni kamaytirish kerak. 20%+ marja ideal.',
      steps: [
        { step: 1, text: 'Sotish narxi va sotuv hajmi olinadi' },
        { step: 2, text: 'Komissiya, yetkazish, qaytarishlar ayiriladi' },
        { step: 3, text: 'Xarid narxi va reklama xarajatlari qo\'shiladi' },
        { step: 4, text: 'Sof foyda va marja hisoblanadi' },
      ],
    },
    ru: {
      title: 'Юнит-экономика',
      what: 'Реальная прибыль на единицу товара или заказ: цена минус все расходы (комиссия, доставка, налоги).',
      why: 'Узнайте, какие товары приносят чистую прибыль, а какие на самом деле убыточны.',
      how: 'Отрицательная маржа — нужно поднять цену или снизить расходы. Маржа 20%+ считается идеальной.',
      steps: [
        { step: 1, text: 'Берётся цена продажи и объём продаж' },
        { step: 2, text: 'Вычитаются комиссия, доставка, возвраты' },
        { step: 3, text: 'Учитываются закупочная цена и рекламные расходы' },
        { step: 4, text: 'Рассчитывается чистая прибыль и маржа' },
      ],
    },
    en: {
      title: 'Unit Economics',
      what: 'Real profit per product or order: price minus all costs (commission, delivery, taxes).',
      why: 'Find out which products generate real profit and which are actually losing money.',
      how: 'Negative margin = raise price or cut costs. 20%+ margin is considered ideal.',
      steps: [
        { step: 1, text: 'Sale price and sales volume are taken' },
        { step: 2, text: 'Commission, delivery, and returns are subtracted' },
        { step: 3, text: 'Purchase price and ad spend are factored in' },
        { step: 4, text: 'Net profit and margin are calculated' },
      ],
    },
  },

  pnl: {
    uz: {
      title: 'Foyda va zarar (P&L)',
      what: 'Do\'koningizning oylik daromad-xarajat hisoboti: umumiy foyda, xarajatlar tarkibi va sof foyda.',
      why: 'Biznesingiz haqiqatan foydali yoki zararli ekanini, pul qayerga ketayotganini aniq bilib oling.',
      how: 'Har oy sof foydangiz o\'sib borayotganini tekshiring. Eng katta xarajat moddasini qisqartirish yo\'llarini qidiring.',
      steps: [
        { step: 1, text: 'Barcha sotuv daromadlari yig\'iladi' },
        { step: 2, text: 'Marketplace xarajatlari (komissiya, yetkazish, reklama) to\'planadi' },
        { step: 3, text: 'Qaytarishlar va soliq ayiriladi' },
        { step: 4, text: 'Oylik sof foyda chiqariladi' },
      ],
    },
    ru: {
      title: 'Прибыли и убытки (P&L)',
      what: 'Ежемесячный отчёт о доходах и расходах магазина: общая выручка, структура расходов и чистая прибыль.',
      why: 'Точно узнайте, прибыльный ли ваш бизнес, и куда уходят деньги.',
      how: 'Следите за ростом чистой прибыли каждый месяц. Ищите способы сократить самую крупную статью расходов.',
      steps: [
        { step: 1, text: 'Все доходы от продаж суммируются' },
        { step: 2, text: 'Расходы маркетплейса (комиссия, доставка, реклама) суммируются' },
        { step: 3, text: 'Вычитаются возвраты и налоги' },
        { step: 4, text: 'Рассчитывается ежемесячная чистая прибыль' },
      ],
    },
    en: {
      title: 'Profit & Loss (P&L)',
      what: 'Monthly income-expense report for your store: total revenue, cost breakdown, and net profit.',
      why: 'Know exactly whether your business is profitable and where the money is going.',
      how: 'Check that your net profit is growing each month. Look for ways to cut the biggest expense category.',
      steps: [
        { step: 1, text: 'All sales revenue is summed up' },
        { step: 2, text: 'Marketplace costs (commission, delivery, ads) are totalled' },
        { step: 3, text: 'Returns and taxes are subtracted' },
        { step: 4, text: 'Monthly net profit is calculated' },
      ],
    },
  },

  calculator: {
    uz: {
      title: 'Foyda kalkulyatori',
      what: 'Mahsulot narxi, xarid narxi va marketplace xarajatlarini kiritib, foyda marjasini hisoblaydi.',
      why: 'Yangi mahsulot qo\'shishdan oldin yoki narxni o\'zgartirishdan avval foydali yoki zararli ekanini bilib oling.',
      how: 'Sotish narxi, xarid narxi, yetkazish va komissiya foizini kiriting. Kalkulyator sof foydani avtomatik chiqaradi.',
      steps: [
        { step: 1, text: 'Sotish narxini kiriting (so\'mda)' },
        { step: 2, text: 'Xarid narxini kiriting' },
        { step: 3, text: 'Marketplace komissiyasi va yetkazish narxini belgilang' },
        { step: 4, text: 'Sof foyda va marja avtomatik hisoblanadi' },
      ],
    },
    ru: {
      title: 'Калькулятор прибыли',
      what: 'Введите цену товара, закупочную цену и расходы маркетплейса — калькулятор покажет маржу прибыли.',
      why: 'Проверьте прибыльность до добавления нового товара или изменения цены.',
      how: 'Введите цену продажи, закупочную цену, стоимость доставки и процент комиссии. Калькулятор автоматически выдаст чистую прибыль.',
      steps: [
        { step: 1, text: 'Введите цену продажи (в сумах)' },
        { step: 2, text: 'Введите закупочную цену' },
        { step: 3, text: 'Укажите комиссию маркетплейса и стоимость доставки' },
        { step: 4, text: 'Чистая прибыль и маржа рассчитываются автоматически' },
      ],
    },
    en: {
      title: 'Profit Calculator',
      what: 'Enter the sale price, purchase price, and marketplace costs — the calculator shows your profit margin.',
      why: 'Check profitability before adding a new product or changing a price.',
      how: 'Enter the sale price, purchase cost, delivery fee, and commission rate. Net profit is calculated automatically.',
      steps: [
        { step: 1, text: 'Enter the sale price (in UZS)' },
        { step: 2, text: 'Enter the purchase price' },
        { step: 3, text: 'Set marketplace commission and delivery cost' },
        { step: 4, text: 'Net profit and margin are calculated automatically' },
      ],
    },
  },

  keywords: {
    uz: {
      title: 'Kalit so\'zlar',
      what: 'Mahsulotlaringiz qaysi kalit so\'zlar orqali topilayotgani, ularning pozitsiyasi va tendensiyasi.',
      why: 'Ko\'rishlar va bosishlar past bo\'lgan kalit so\'zlarni aniqlang, mahsulot sarlavhalarini yaxshilang.',
      how: 'O\'sib borayotgan kalit so\'zlarga e\'tibor bering. CTR 4%+ bo\'lgan so\'zlar yaxshi ishlayapti. Tushayotganlarga alohida e\'tibor bering.',
      steps: [
        { step: 1, text: 'Uzum qidiruv ma\'lumotlaridan kalit so\'zlar olinadi' },
        { step: 2, text: 'Har bir mahsulot bilan qaysi so\'zlar bog\'liq ekanligi aniqlanadi' },
        { step: 3, text: 'Ko\'rsatmalar, kliklar va o\'rtacha pozitsiya kuzatiladi' },
        { step: 4, text: 'Trend (o\'sish/tushish) avtomatik belgilanadi' },
      ],
    },
    ru: {
      title: 'Ключевые слова',
      what: 'По каким ключевым словам находят ваши товары, их позиция и тенденция.',
      why: 'Найдите ключевые слова с низкими показами и кликами, улучшите заголовки товаров.',
      how: 'Обращайте внимание на растущие ключевые слова. CTR 4%+ — хороший результат. За падающими следите особо.',
      steps: [
        { step: 1, text: 'Ключевые слова получены из поисковых данных Uzum' },
        { step: 2, text: 'Определяется, какие слова связаны с каждым товаром' },
        { step: 3, text: 'Отслеживаются показы, клики и средняя позиция' },
        { step: 4, text: 'Тренд (рост/падение) определяется автоматически' },
      ],
    },
    en: {
      title: 'Keywords',
      what: 'Which keywords your products are found by, their position, and trend.',
      why: 'Identify keywords with low impressions and clicks, then improve product titles.',
      how: 'Focus on growing keywords. CTR 4%+ means it\'s working well. Watch closely for declining ones.',
      steps: [
        { step: 1, text: 'Keywords pulled from Uzum search data' },
        { step: 2, text: 'Each word is matched to its product' },
        { step: 3, text: 'Impressions, clicks, and avg. position are tracked' },
        { step: 4, text: 'Trend (up/down) is assigned automatically' },
      ],
    },
  },

  team: {
    uz: {
      title: 'Jamoa',
      what: 'Do\'koningizga kirish huquqini boshqa foydalanuvchilar bilan bo\'lishish. Har bir a\'zoga alohida rol beriladi.',
      why: 'Ishonchli xodimlarga yoki hamkorlaringizga ma\'lum huquqlar berish orqali vazifalarni bo\'lishib ishlang.',
      how: 'Admin — to\'liq boshqaruv. Viewer — faqat ko\'rish. Egasi — barcha huquqlarga ega. Pro+ tarifida mavjud.',
      steps: [
        { step: 1, text: 'A\'zo qo\'shish tugmasini bosing' },
        { step: 2, text: 'Taklif qilmoqchi bo\'lgan shaxsning emailini kiriting' },
        { step: 3, text: 'Rol tanlang: Admin yoki Viewer' },
        { step: 4, text: 'A\'zo taklif emailini qabul qilib kiradi' },
      ],
    },
    ru: {
      title: 'Команда',
      what: 'Предоставьте другим пользователям доступ к вашему магазину. Каждому участнику назначается своя роль.',
      why: 'Делегируйте задачи доверенным сотрудникам или партнёрам, дав им нужные права.',
      how: 'Admin — полное управление. Viewer — только просмотр. Владелец — все права. Доступно на тарифе Pro+.',
      steps: [
        { step: 1, text: 'Нажмите кнопку «Добавить участника»' },
        { step: 2, text: 'Введите email человека, которого хотите пригласить' },
        { step: 3, text: 'Выберите роль: Admin или Viewer' },
        { step: 4, text: 'Участник принимает приглашение по email и входит' },
      ],
    },
    en: {
      title: 'Team',
      what: 'Share access to your store with other users. Each member is assigned a specific role.',
      why: 'Delegate tasks to trusted employees or partners by giving them the right permissions.',
      how: 'Admin = full control. Viewer = read-only. Owner = all rights. Available on Pro+ plan.',
      steps: [
        { step: 1, text: 'Click the "Add Member" button' },
        { step: 2, text: 'Enter the email of the person to invite' },
        { step: 3, text: 'Choose a role: Admin or Viewer' },
        { step: 4, text: 'Member accepts the invite by email and logs in' },
      ],
    },
  },

  dataState: {
    uz: {
      title: 'Ma\'lumotlar holati',
      what: 'Sinxronizatsiya tarixi va holati: qachon oxirgi marta ma\'lumotlar yangilangani va xatolar bo\'lganmi.',
      why: 'Ma\'lumotlar eskirib qolmayotganini va API ulanish muammolari yo\'qligini nazorat qiling.',
      how: 'Yashil holat — hamma yaxshi. Qizil xato — API kaliti muammo yoki sinxronizatsiya bajarilmagan.',
      steps: [
        { step: 1, text: 'Uzum API orqali ma\'lumotlar so\'raladi' },
        { step: 2, text: 'Kuniga bir marta avtomatik sinxronizatsiya ishlaydi' },
        { step: 3, text: 'Xato bo\'lsa — sabab va vaqt qayd etiladi' },
        { step: 4, text: 'Qo\'lda sinxronizatsiya ham mumkin' },
      ],
    },
    ru: {
      title: 'Состояние данных',
      what: 'История и статус синхронизации: когда данные последний раз обновлялись и были ли ошибки.',
      why: 'Следите, чтобы данные не устаревали и не было проблем с подключением к API.',
      how: 'Зелёный статус — всё в порядке. Красная ошибка — проблема с ключом API или синхронизация не выполнена.',
      steps: [
        { step: 1, text: 'Данные запрашиваются через API Uzum' },
        { step: 2, text: 'Автоматическая синхронизация раз в день' },
        { step: 3, text: 'При ошибке фиксируется причина и время' },
        { step: 4, text: 'Ручная синхронизация также доступна' },
      ],
    },
    en: {
      title: 'Data State',
      what: 'Sync history and status: when data was last updated and whether any errors occurred.',
      why: 'Make sure data isn\'t getting stale and there are no API connection issues.',
      how: 'Green = all good. Red error = API key problem or sync failed.',
      steps: [
        { step: 1, text: 'Data is requested via Uzum API' },
        { step: 2, text: 'Auto-sync runs once a day' },
        { step: 3, text: 'Errors are logged with reason and timestamp' },
        { step: 4, text: 'Manual sync is also available' },
      ],
    },
  },

  priceTracking: {
    uz: {
      title: 'Narx kuzatuvi',
      what: 'Raqobatchilarnig narxlari bilan o\'zingizning narxingizni taqqoslash. Bozordagi pozitsiyangizni ko\'rsatadi.',
      why: 'Narxingiz raqobatbardosh bo\'lishi uchun bozor narxlarini kuzatib boring va kerakli o\'zgartirishlar kiriting.',
      how: '"Eng arzon" — sizning narxingiz eng past. "Eng qimmat" — narxni pasaytirish kerak bo\'lishi mumkin. Farq foizini kuzating.',
      steps: [
        { step: 1, text: 'Mahsulotlaringiz Uzumdagi raqobatchilar bilan solishtiriladi' },
        { step: 2, text: 'Minimal va o\'rtacha raqobat narxlari hisoblanadi' },
        { step: 3, text: 'Narx farqi (so\'m va foizda) chiqariladi' },
        { step: 4, text: 'Narx tarixi grafikda ko\'rsatiladi' },
      ],
    },
    ru: {
      title: 'Отслеживание цен',
      what: 'Сравнение ваших цен с ценами конкурентов. Показывает вашу позицию на рынке.',
      why: 'Следите за рыночными ценами, чтобы ваши цены оставались конкурентоспособными.',
      how: '"Самая низкая" — ваша цена наименьшая. "Самая высокая" — возможно, нужно снизить цену. Следите за разницей в процентах.',
      steps: [
        { step: 1, text: 'Ваши товары сравниваются с конкурентами на Uzum' },
        { step: 2, text: 'Рассчитываются минимальная и средняя цены конкурентов' },
        { step: 3, text: 'Выводится разница в цене (в сумах и процентах)' },
        { step: 4, text: 'История цен отображается на графике' },
      ],
    },
    en: {
      title: 'Price Tracking',
      what: 'Compare your prices against competitors. Shows your market position.',
      why: 'Monitor market prices to keep your pricing competitive.',
      how: '"Lowest" = your price is the cheapest. "Highest" = you may need to lower the price. Watch the % difference.',
      steps: [
        { step: 1, text: 'Your products are compared to Uzum competitors' },
        { step: 2, text: 'Min and avg competitor prices are calculated' },
        { step: 3, text: 'Price difference is shown in UZS and %' },
        { step: 4, text: 'Price history is shown on a chart' },
      ],
    },
  },

  alerts: {
    uz: {
      title: 'Ogohlantirishlar',
      what: 'Ombordagi mahsulot zaxirasi belgilangan chegaradan past tushganda ogohlantirish beradi.',
      why: 'Mahsulot tugab qolmasligi uchun oldindan xabar olib, o\'z vaqtida tovar buyurtma qiling.',
      how: 'Qizil badge — 3 kundan kam zaxira. Sariq — 7 kungacha. Chegara miqdorini o\'zingiz belgilashingiz mumkin.',
      steps: [
        { step: 1, text: 'Kunlik sotuv tezligi hisoblanadi' },
        { step: 2, text: 'Joriy zaxira qoldig\'i/kunlik sotuv = qolgan kunlar' },
        { step: 3, text: 'Kunlar belgilangan chegaradan past tushsa — ogohlantirish' },
        { step: 4, text: 'Email va push bildirishnomalar yuborilib turadi' },
      ],
    },
    ru: {
      title: 'Оповещения',
      what: 'Уведомляет, когда запас товара на складе опускается ниже установленного порога.',
      why: 'Получайте предупреждение заранее, чтобы вовремя заказать товар и не остаться без запасов.',
      how: 'Красный бейдж — менее 3 дней запаса. Жёлтый — до 7 дней. Порог можно установить самостоятельно.',
      steps: [
        { step: 1, text: 'Рассчитывается ежедневная скорость продаж' },
        { step: 2, text: 'Текущий запас / ежедневные продажи = оставшиеся дни' },
        { step: 3, text: 'Если дней меньше порога — создаётся оповещение' },
        { step: 4, text: 'Отправляются email- и push-уведомления' },
      ],
    },
    en: {
      title: 'Alerts',
      what: 'Notifies you when a product\'s stock drops below a set threshold.',
      why: 'Get advance warning so you can reorder in time and avoid running out of stock.',
      how: 'Red badge = under 3 days of stock. Yellow = up to 7 days. You can set the threshold yourself.',
      steps: [
        { step: 1, text: 'Daily sales velocity is calculated' },
        { step: 2, text: 'Current stock / daily sales = days remaining' },
        { step: 3, text: 'If days fall below threshold, alert is triggered' },
        { step: 4, text: 'Email and push notifications are sent' },
      ],
    },
  },

  payouts: {
    uz: {
      title: 'To\'lovlar',
      what: 'Marketplace sizga o\'tkazgan to\'lovlar tarixi: har davr uchun brutto daromad, barcha chegirmalar va sof to\'lov.',
      why: 'Marketplace qancha ushlab qolayotganini — komissiya, yetkazish, reklama, soliq — aniq bilib oling.',
      how: 'Har bir satrni kengaytiring — qanday chegirmalar qilinganini ko\'ring. Sof to\'lovni brutto bilan solishtiring.',
      steps: [
        { step: 1, text: 'Uzum to\'lov hisobotlari API orqali olinadi' },
        { step: 2, text: 'Har bir davr uchun barcha chegirmalar sanab chiqiladi' },
        { step: 3, text: 'Sof to\'lov = Brutto − Komissiya − Yetkazish − Qaytarish − Reklama − Soliq' },
        { step: 4, text: 'Holat: to\'langan, jarayonda yoki kutilmoqda' },
      ],
    },
    ru: {
      title: 'Выплаты',
      what: 'История выплат от маркетплейса: для каждого периода — валовая выручка, все вычеты и чистая выплата.',
      why: 'Точно узнайте, сколько удерживает маркетплейс: комиссию, доставку, рекламу, налоги.',
      how: 'Раскройте каждую строку — посмотрите, какие вычеты сделаны. Сравните чистую выплату с валовой.',
      steps: [
        { step: 1, text: 'Отчёты о выплатах Uzum получены через API' },
        { step: 2, text: 'Для каждого периода перечислены все вычеты' },
        { step: 3, text: 'Чистая выплата = Валовая − Комиссия − Доставка − Возвраты − Реклама − Налог' },
        { step: 4, text: 'Статус: оплачено, в обработке или ожидается' },
      ],
    },
    en: {
      title: 'Payouts',
      what: 'History of marketplace payouts: gross revenue, all deductions, and net payout for each period.',
      why: 'See exactly how much the marketplace keeps: commission, delivery, ads, and taxes.',
      how: 'Expand each row to see the breakdown. Compare net payout to gross revenue.',
      steps: [
        { step: 1, text: 'Uzum payout reports retrieved via API' },
        { step: 2, text: 'All deductions listed for each period' },
        { step: 3, text: 'Net payout = Gross − Commission − Delivery − Returns − Ads − Tax' },
        { step: 4, text: 'Status: paid, processing, or pending' },
      ],
    },
  },

  reviews: {
    uz: {
      title: 'Izohlar',
      what: 'Xaridorlarning mahsulotlaringiz haqidagi sharhlari va reytinglari.',
      why: 'Salbiy izohlarni o\'qib, mahsulot sifatini yoki tavsifini yaxshilab, reyting va sotuvlarni oshiring.',
      how: 'Javob berilmagan izohlarni toping. 1-2 yulduzli izohlar eng muhim — muammoni tushunib, javob bering.',
      steps: [
        { step: 1, text: 'Uzum API orqali barcha izohlar olinadi' },
        { step: 2, text: 'Reyting va matn saqlandi' },
        { step: 3, text: 'Javob berilmagan va muhim izohlar belgilanadi' },
        { step: 4, text: 'Yangi izohlar kelganda bildirishnoma yuboriladi' },
      ],
    },
    ru: {
      title: 'Отзывы',
      what: 'Отзывы покупателей и рейтинги ваших товаров.',
      why: 'Читайте негативные отзывы, улучшайте качество товара или описание, повышайте рейтинг и продажи.',
      how: 'Найдите отзывы без ответа. Отзывы на 1–2 звезды наиболее важны — поймите проблему и ответьте.',
      steps: [
        { step: 1, text: 'Все отзывы получены через API Uzum' },
        { step: 2, text: 'Рейтинг и текст сохраняются' },
        { step: 3, text: 'Отмечаются отзывы без ответа и важные' },
        { step: 4, text: 'При поступлении нового отзыва приходит уведомление' },
      ],
    },
    en: {
      title: 'Reviews',
      what: 'Shopper reviews and ratings for your products.',
      why: 'Read negative reviews, improve product quality or descriptions, and boost ratings and sales.',
      how: 'Find unanswered reviews. 1–2 star reviews are most important — understand the issue and respond.',
      steps: [
        { step: 1, text: 'All reviews pulled via Uzum API' },
        { step: 2, text: 'Rating and text are stored' },
        { step: 3, text: 'Unanswered and important reviews are flagged' },
        { step: 4, text: 'Notification sent when a new review arrives' },
      ],
    },
  },

  seasonality: {
    uz: {
      title: 'Mavsumiylik',
      what: 'Turli mahsulot kategoriyalari bo\'yicha yil davomidagi sotuv tendensiyasi — qaysi oyda ko\'proq sotiladi.',
      why: 'Mavsumiy o\'zgarishlarni oldindan bilib, ombor, reklama va narx strategiyangizni moslang.',
      how: 'Yozgi mahsulotlar may-iyulda ko\'proq sotiladi. Qishki — noyabr-yanvarda. Shunday davrlarda zaxirani oshiring.',
      steps: [
        { step: 1, text: 'O\'tgan yillardagi sotuv ma\'lumotlari tahlil qilinadi' },
        { step: 2, text: 'Har oy uchun o\'rtacha sotuv indeksi hisoblanadi' },
        { step: 3, text: 'Kategoriyalar bo\'yicha mavsumiy grafik chiziladi' },
        { step: 4, text: 'Kelgusi oy uchun tavsiya beriladi' },
      ],
    },
    ru: {
      title: 'Сезонность',
      what: 'Тенденция продаж в течение года по категориям товаров — в какие месяцы продаётся больше.',
      why: 'Зная сезонные колебания заранее, адаптируйте стратегию склада, рекламы и ценообразования.',
      how: 'Летние товары лучше продаются в мае–июле. Зимние — в ноябре–январе. Увеличивайте запасы в эти периоды.',
      steps: [
        { step: 1, text: 'Анализируются данные о продажах за прошлые годы' },
        { step: 2, text: 'Рассчитывается средний индекс продаж за каждый месяц' },
        { step: 3, text: 'Строится сезонный график по категориям' },
        { step: 4, text: 'Даётся рекомендация на следующий месяц' },
      ],
    },
    en: {
      title: 'Seasonality',
      what: 'Sales trend throughout the year by product category — which months sell more.',
      why: 'By knowing seasonal patterns in advance, adapt your inventory, ad, and pricing strategy.',
      how: 'Summer products sell more in May–July. Winter — November–January. Increase stock during those periods.',
      steps: [
        { step: 1, text: 'Historical sales data is analyzed' },
        { step: 2, text: 'Avg. sales index is calculated for each month' },
        { step: 3, text: 'Seasonal chart is drawn by category' },
        { step: 4, text: 'Recommendation is given for the next month' },
      ],
    },
  },

  marketResearch: {
    uz: {
      title: 'Bozor tadqiqoti',
      what: 'Uzum bozorida tendensiyalar, eng ko\'p sotilayotgan mahsulotlar, niches va raqobat tahlili.',
      why: 'Yangi mahsulot qo\'shish yoki niche tanlash uchun bozorni tahlil qiling va to\'g\'ri qaror qabul qiling.',
      how: 'Kamroq raqobat va yuqori talab bo\'lgan nichlarni qidiring. O\'sib borayotgan kategoriyalarga investitsiya qiling.',
      steps: [
        { step: 1, text: 'Uzum kategorialari bo\'yicha sotuv ma\'lumotlari yig\'iladi' },
        { step: 2, text: 'Eng ko\'p sotiladigan mahsulotlar aniqlanadi' },
        { step: 3, text: 'Raqobat darajasi va narx diapazoni tahlil qilinadi' },
        { step: 4, text: 'Tendensiya va o\'sish imkoniyatlari ko\'rsatiladi' },
      ],
    },
    ru: {
      title: 'Исследование рынка',
      what: 'Тенденции на рынке Uzum, самые продаваемые товары, ниши и анализ конкурентов.',
      why: 'Анализируйте рынок перед добавлением нового товара или выбором ниши и принимайте взвешенные решения.',
      how: 'Ищите ниши с низкой конкуренцией и высоким спросом. Инвестируйте в растущие категории.',
      steps: [
        { step: 1, text: 'Данные о продажах по категориям Uzum собираются' },
        { step: 2, text: 'Определяются самые продаваемые товары' },
        { step: 3, text: 'Анализируется уровень конкуренции и ценовой диапазон' },
        { step: 4, text: 'Показаны тенденции и возможности роста' },
      ],
    },
    en: {
      title: 'Market Research',
      what: 'Uzum market trends, top-selling products, niches, and competitor analysis.',
      why: 'Analyze the market before adding a new product or picking a niche to make informed decisions.',
      how: 'Look for niches with low competition and high demand. Invest in growing categories.',
      steps: [
        { step: 1, text: 'Sales data by Uzum category is gathered' },
        { step: 2, text: 'Top-selling products are identified' },
        { step: 3, text: 'Competition level and price range are analyzed' },
        { step: 4, text: 'Trends and growth opportunities are shown' },
      ],
    },
  },
}
