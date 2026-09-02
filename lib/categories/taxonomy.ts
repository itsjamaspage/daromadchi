// Matching threshold calibration
// Current: Jaccard >= 0.5 for token_set tier (matcher.ts)
// Calibration log (update after each dry-run against real product data):
//   [date] | threshold | tier-3 precision by score band | notes
//   -------|-----------|-------------------------------|------
//   (none yet — run npm run categories:suggest against a DB snapshot,
//    bucket tier-3 by 0.5-0.6 / 0.6-0.7 / 0.7-0.8, review 20 per band)
//
// Note: resurrecting a rejected suggestion (reject->approve) does not
// re-validate against the current taxonomy. If terms changed since the
// suggestion was created, delete the stale suggestion and re-run the
// backfill instead of approving it.

export type ParentGroup =
  | 'electronics'
  | 'home'
  | 'beauty_health'
  | 'clothing'
  | 'kids'
  | 'sports'
  | 'auto'
  | 'other'

export interface CanonicalCategory {
  id: string
  parent_group: ParentGroup
  name: { ru: string; uz: string; en: string }
  terms: { ru: string[]; uz: string[]; en: string[] }
  raw_examples: { uzum: string[]; yandex_market: string[] }
  notes?: string
}

export const TAXONOMY: CanonicalCategory[] = [
  {
    id: 'smartphones',
    parent_group: 'electronics',
    name: { ru: 'Смартфоны', uz: 'Smartfonlar', en: 'Smartphones' },
    terms: {
      ru: ['смартфоны','смартфон','мобильные телефоны','телефоны','сотовые телефоны','айфон','iphone','android телефон','кнопочные телефоны'],
      uz: ['smartfonlar','smartfon','aqlli telefonlar','telefonlar','mobil telefonlar','iphone','tugmali telefonlar'],
      en: ['smartphones','smartphone','mobile phones','cell phones','iphones','android phones','feature phones'],
    },
    raw_examples: {
      uzum: ['Smartfonlar','Смартфоны'],
      yandex_market: ['Смартфоны','Мобильные телефоны'],
    },
    notes: 'The device itself, not accessories. If raw string mentions "чехол" (case) or "стекло" (glass), it belongs to phone_accessories.',
  },
  {
    id: 'phone_accessories',
    parent_group: 'electronics',
    name: { ru: 'Аксессуары для телефонов', uz: 'Telefon aksessuarlari', en: 'Phone accessories' },
    terms: {
      ru: ['аксессуары для телефонов','чехлы','чехол для телефона','защитные стекла','защитная пленка','кабели для телефона','держатели для телефона','попсокеты','селфи-палки','подставки для телефона'],
      uz: ['telefon aksessuarlari','chexollar','himoya oynasi','himoya plyonkasi','telefon ushlagichlari','popsoketlar','selfi tayoqchalari'],
      en: ['phone accessories','phone cases','screen protectors','phone cables','phone holders','popsockets','selfie sticks','phone stands'],
    },
    raw_examples: {
      uzum: ['Telefon aksessuarlari','Chexollar','Himoya oynalari'],
      yandex_market: ['Аксессуары для мобильных телефонов','Аксессуары для смартфонов','Чехлы для телефонов','Защитные стекла'],
    },
  },
  {
    id: 'headphones',
    parent_group: 'electronics',
    name: { ru: 'Наушники и гарнитуры', uz: 'Quloqchinlar', en: 'Headphones & Earphones' },
    terms: {
      ru: ['наушники','наушник','гарнитура','tws','беспроводные наушники','проводные наушники','наушники-вкладыши','полноразмерные наушники','накладные наушники','airpods','bluetooth наушники','блютуз наушники','игровые наушники','наушники для компьютера'],
      uz: ['quloqchinlar','quloqchin','simsiz quloqchinlar','simli quloqchinlar','tws','bluetooth quloqchinlar','blyutuz quloqchinlar','garnitura',"o'yin quloqchinlari"],
      en: ['headphones','earphones','earbuds','tws','wireless earphones','wired headphones','in-ear','over-ear','on-ear','airpods','bluetooth headphones','gaming headset','headset'],
    },
    raw_examples: {
      uzum: ['Simsiz quloqchinlar','Quloqchinlar','TWS quloqchinlar'],
      yandex_market: ['Наушники','Гарнитуры','Наушники и гарнитуры','Беспроводные наушники','TWS наушники'],
    },
  },
  {
    id: 'smart_watches',
    parent_group: 'electronics',
    name: { ru: 'Смарт-часы и фитнес-браслеты', uz: 'Aqlli soatlar va fitness bilaguzuklar', en: 'Smart watches & Fitness trackers' },
    terms: {
      ru: ['смарт-часы','смарт часы','умные часы','фитнес-браслеты','фитнес браслет','apple watch','носимая электроника','умные браслеты','спортивные часы','детские смарт часы'],
      uz: ['aqlli soatlar','smart soatlar','smart soat','smart-soat','fitness bilaguzuk','fitnes braslet','sport soatlar','bolalar aqlli soatlari'],
      en: ['smart watches','smartwatches','fitness trackers','fitness bands','wearables','apple watch','sport watches','kids smart watches'],
    },
    raw_examples: {
      // Uzum returns the category as a raw localized string that varies by
      // account language / taxonomy version, so the SAME watch can arrive as
      // Uzbek ("Aqlli soatlar") OR Russian ("Смарт-часы" / "Умные часы"). All
      // spellings must be listed here or a Uzum product stored under the
      // Russian label misses the alias join (keyed by marketplace='uzum') and
      // fragments into its own donut slice.
      uzum: ['Aqlli soatlar','Smart soatlar','Fitness bilaguzuklar','Смарт-часы','Умные часы'],
      yandex_market: ['Умные часы','Фитнес-браслеты','Умные часы и браслеты','Смарт-часы'],
    },
    notes: 'Distinct from analog jewelry/fashion watches — those go to jewelry.',
  },
  {
    id: 'laptops',
    parent_group: 'electronics',
    name: { ru: 'Ноутбуки', uz: 'Noutbuklar', en: 'Laptops' },
    terms: {
      ru: ['ноутбуки','ноутбук','лэптопы','ультрабуки','macbook','игровые ноутбуки','портативные компьютеры'],
      uz: ['noutbuklar','noutbuk','laptop','macbook',"o'yin noutbuklari",'portativ kompyuterlar'],
      en: ['laptops','laptop','notebooks','macbooks','gaming laptops','ultrabooks'],
    },
    raw_examples: {
      uzum: ['Noutbuklar','Ноутбуки'],
      yandex_market: ['Ноутбуки','Ноутбуки и ультрабуки'],
    },
  },
  {
    id: 'tablets',
    parent_group: 'electronics',
    name: { ru: 'Планшеты и электронные книги', uz: 'Planshetlar', en: 'Tablets & E-readers' },
    terms: {
      ru: ['планшеты','планшет','ipad','электронные книги','ридеры','kindle','графические планшеты'],
      uz: ['planshetlar','planshet','ipad','elektron kitoblar','grafik planshetlar'],
      en: ['tablets','tablet','ipads','e-readers','kindle','drawing tablets'],
    },
    raw_examples: {
      uzum: ['Planshetlar','Планшеты'],
      yandex_market: ['Планшеты','Электронные книги'],
    },
  },
  {
    id: 'computer_peripherals',
    parent_group: 'electronics',
    name: { ru: 'Компьютерные аксессуары', uz: 'Kompyuter aksessuarlari', en: 'Computer peripherals' },
    terms: {
      ru: ['клавиатуры','клавиатура','мыши','мышь компьютерная','мониторы','монитор','веб-камеры','usb-хабы','коврики для мыши','компьютерные аксессуары','комплектующие для пк','системные блоки','комплекты клавиатур и мышей','комплекты клавиатур'],
      uz: ['klaviaturalar','sichqonchalar','monitorlar','veb kameralar','kompyuter aksessuarlari','sichqoncha gilamchalari','klaviatura va sichqoncha to\'plami'],
      en: ['keyboards','mice','computer mouse','monitors','webcams','mousepads','computer peripherals','usb hubs','pc components'],
    },
    raw_examples: {
      uzum: ['Kompyuter aksessuarlari','Klaviaturalar','Monitorlar','Klaviatura va sichqoncha to\'plami'],
      yandex_market: ['Компьютерная периферия','Мониторы','Клавиатуры','Компьютерные мыши','Комплекты клавиатур и мышей'],
    },
  },
  {
    id: 'networking_storage',
    parent_group: 'electronics',
    name: { ru: 'Сетевое оборудование и накопители', uz: 'Tarmoq uskunalari va xotira qurilmalari', en: 'Networking & Storage' },
    terms: {
      ru: ['роутеры','wi-fi роутеры','модемы','внешние жесткие диски','ssd','жесткие диски','флешки','usb накопители','сетевое оборудование','карты памяти','microsd'],
      uz: ['routerlar','wi-fi routerlar','tashqi disklar','flashkalar','ssd','xotira kartalari'],
      en: ['routers','wifi routers','external hard drives','ssds','usb flash drives','modems','network equipment','memory cards','microsd'],
    },
    raw_examples: {
      uzum: ['Routerlar','Flash xotira'],
      yandex_market: ['Wi-Fi роутеры','Внешние накопители','Сетевое оборудование','Внешние жесткие диски','Флешки USB'],
    },
  },
  {
    id: 'tvs',
    parent_group: 'electronics',
    name: { ru: 'Телевизоры и проекторы', uz: 'Televizorlar', en: 'TVs & Projectors' },
    terms: {
      ru: ['телевизоры','тв','smart tv','led телевизоры','oled','qled','проекторы','тв приставки','android tv','кронштейны для телевизоров'],
      uz: ['televizorlar','televizor','tv','smart tv','proyektorlar','tv pristavkalari'],
      en: ['tvs','televisions','smart tvs','led tvs','oled tvs','qled tvs','projectors','streaming devices','tv mounts'],
    },
    raw_examples: {
      uzum: ['Televizorlar'],
      yandex_market: ['Телевизоры и видеотехника','Телевизоры','Проекторы'],
    },
  },
  {
    id: 'speakers_audio',
    parent_group: 'electronics',
    name: { ru: 'Колонки и домашняя аудиотехника', uz: 'Kolonkalar va uy audiosi', en: 'Speakers & Home audio' },
    terms: {
      ru: ['колонки','портативные колонки','беспроводные колонки','bluetooth колонки','саундбары','домашние кинотеатры','акустические системы','акустика','jbl','сабвуферы','умные колонки','алиса'],
      uz: ['kolonkalar','portativ kolonkalar','bluetooth kolonkalar','saundbarlar','aqlli kolonkalar'],
      en: ['speakers','bluetooth speakers','portable speakers','soundbars','home theater','jbl','subwoofers','smart speakers'],
    },
    raw_examples: {
      uzum: ['Kolonkalar','Portativ kolonkalar'],
      yandex_market: ['Портативная акустика','Домашняя акустика','Портативные колонки','Акустические системы','Саундбары'],
    },
    notes: 'Distinct from headphones. Speakers = external audio playback.',
  },
  {
    id: 'cameras_photo',
    parent_group: 'electronics',
    name: { ru: 'Фото- и видеотехника', uz: 'Foto va video texnikasi', en: 'Cameras & Photography' },
    terms: {
      ru: ['фотоаппараты','камеры','экшн-камеры','gopro','зеркальные фотоаппараты','объективы','штативы','видеокамеры','полароид','мгновенная печать','фото аксессуары'],
      uz: ['fotoapparatlar','kameralar','aksiya kameralari','gopro','shtativlar','obyektivlar'],
      en: ['cameras','dslr cameras','mirrorless cameras','action cameras','gopro','camcorders','lenses','tripods','instant cameras'],
    },
    raw_examples: {
      uzum: ['Fotoapparatlar','Экшн-камеры'],
      yandex_market: ['Фото- и видеотехника','Фото- и видеокамеры','Аксессуары для фото'],
    },
  },
  {
    id: 'gaming',
    parent_group: 'electronics',
    name: { ru: 'Игровые консоли и видеоигры', uz: "O'yin konsollari", en: 'Gaming consoles & Video games' },
    terms: {
      ru: ['игровые приставки','игровые консоли','playstation','ps5','ps4','xbox','nintendo','nintendo switch','джойстики','геймпады','видеоигры','игры для консолей','игровые кресла','vr шлемы','рули игровые'],
      uz: ["o'yin konsollari",'playstation','xbox','nintendo','joystiklar','geympadlar',"video o'yinlar"],
      en: ['gaming consoles','playstation','xbox','nintendo switch','controllers','video games','gaming chairs','vr headsets','gaming steering wheels'],
    },
    raw_examples: {
      uzum: ["O'yin konsollari",'Игровые приставки'],
      yandex_market: ['Игровые приставки','Игры для консолей','Геймпады'],
    },
  },
  {
    id: 'power_banks_chargers',
    parent_group: 'electronics',
    name: { ru: 'Повербанки и зарядные устройства', uz: 'Powerbanklar va zaryadlagichlar', en: 'Power banks & Chargers' },
    terms: {
      ru: ['повербанки','повербанк','внешние аккумуляторы','портативные зарядки','зарядные устройства','адаптеры питания','блоки питания','беспроводные зарядки','сетевые зарядки','автомобильные зарядки','портативные аккумуляторы'],
      uz: ['powerbanklar','powerbank','portativ zaryadlagichlar','zaryadlash qurilmalari','adapterlar','simsiz zaryadlagichlar','tashqi akkumulyatorlar'],
      en: ['power banks','power bank','powerbank','portable chargers','chargers','power adapters','wireless chargers','wall chargers','car chargers'],
    },
    raw_examples: {
      uzum: ['Powerbanklar','Zaryadlagichlar','Tashqi akkumulyatorlar'],
      yandex_market: ['Внешние аккумуляторы','Зарядные устройства','Повербанки','Портативные аккумуляторы'],
    },
    notes: 'Car chargers may also match car_electronics — prefer this canonical unless raw string contains "авто"/"car"/"avto".',
  },
  {
    id: 'small_kitchen_appliances',
    parent_group: 'home',
    name: { ru: 'Мелкая бытовая техника для кухни', uz: 'Kichik oshxona texnikasi', en: 'Small kitchen appliances' },
    terms: {
      ru: ['чайники','электрочайники','блендеры','миксеры','тостеры','кофемашины','кофеварки','микроволновки','микроволновые печи','мультиварки','соковыжималки','кухонные комбайны','мясорубки электрические','йогуртницы','хлебопечки','аэрогрили'],
      uz: ['choynaklar','elektr choynaklar','blenderlar','mikserlar','tosterlar','kofe mashinalari',"mikroto'lqinli pechlar",'multivarkalar','shirasiqargichlar',"go'sht qiymalagichlar"],
      en: ['kettles','electric kettles','blenders','mixers','toasters','coffee machines','microwaves','multicookers','juicers','food processors','meat grinders','bread makers','air fryers'],
    },
    raw_examples: {
      uzum: ['Choynaklar','Blenderlar','Kofe mashinalari'],
      yandex_market: ['Мелкая бытовая техника','Мелкая кухонная техника','Чайники','Блендеры'],
    },
  },
  {
    id: 'large_kitchen_appliances',
    parent_group: 'home',
    name: { ru: 'Крупная кухонная техника', uz: 'Katta oshxona texnikasi', en: 'Large kitchen appliances' },
    terms: {
      ru: ['холодильники','холодильник','морозильники','плиты','газовые плиты','электрические плиты','варочные панели','духовые шкафы','посудомоечные машины','вытяжки','встраиваемая техника'],
      uz: ['muzlatgichlar','muzlatkichlar','plitalar','gaz plitalari','elektr plitalar','idish yuvish mashinalari',"so'rgichlar"],
      en: ['refrigerators','fridges','freezers','stoves','gas stoves','electric stoves','cooktops','ovens','dishwashers','range hoods','built-in appliances'],
    },
    raw_examples: {
      uzum: ['Muzlatgichlar','Katta maishiy texnika'],
      yandex_market: ['Крупная бытовая техника','Холодильники','Посудомоечные машины'],
    },
  },
  {
    id: 'cookware',
    parent_group: 'home',
    name: { ru: 'Посуда для приготовления пищи', uz: 'Pishirish uchun idishlar', en: 'Cookware & Bakeware' },
    terms: {
      ru: ['сковородки','сковороды','кастрюли','казаны','сотейники','формы для выпечки','противни','наборы посуды','жаровни','воки'],
      uz: ['qozonlar','tovalar','kostryulkalar','pishirish idishlari'],
      en: ['cookware','pans','pots','frying pans','saucepans','cast iron','bakeware','baking sheets','cookware sets','woks'],
    },
    raw_examples: {
      uzum: ['Tovalar va qozonlar'],
      yandex_market: ['Кастрюли и сковороды','Посуда для приготовления','Сковороды','Кастрюли'],
    },
  },
  {
    id: 'tableware_utensils',
    parent_group: 'home',
    name: { ru: 'Столовая посуда и кухонные принадлежности', uz: 'Stol idishlari va oshxona buyumlari', en: 'Tableware & Kitchen utensils' },
    terms: {
      ru: ['столовая посуда','тарелки','кружки','стаканы','бокалы','столовые приборы','ложки','вилки','ножи столовые','ножи кухонные','разделочные доски','кухонные принадлежности','силиконовые лопатки','терки'],
      uz: ['stol idishlari','likobchalar','krujkalar','stakanlar','oshxona pichoqlari','kesish taxtalari','oshxona buyumlari'],
      en: ['tableware','dinnerware','plates','mugs','cups','glasses','cutlery','kitchen knives','cutting boards','kitchen utensils','graters'],
    },
    raw_examples: {
      uzum: ['Stol idishlari','Oshxona pichoqlari'],
      yandex_market: ['Столовая посуда','Посуда для сервировки','Кухонные принадлежности'],
    },
  },
  {
    id: 'bed_bath_textiles',
    parent_group: 'home',
    name: { ru: 'Постельное белье и текстиль', uz: "Choyshab va uy to'qimachiligi", en: 'Bed & Bath textiles' },
    terms: {
      ru: ['постельное белье','полотенца','одеяла','подушки','пледы','матрасы','простыни','наволочки','пододеяльники','наматрасники','банные халаты','кпб'],
      uz: ['choyshab','sochiqlar',"ko'rpalar",'yostiqlar',"choyshab to'plamlari",'matraslar'],
      en: ['bedding','bed linen','sheets','pillowcases','duvet covers','towels','blankets','pillows','comforters','mattresses','bathrobes'],
    },
    raw_examples: {
      uzum: ["Choyshab to'plamlari",'Sochiqlar'],
      yandex_market: ['Домашний текстиль','Постельное белье','Полотенца','Одеяла'],
    },
  },
  {
    id: 'furniture',
    parent_group: 'home',
    name: { ru: 'Мебель', uz: 'Mebel', en: 'Furniture' },
    terms: {
      ru: ['мебель','диваны','кресла','столы','стулья','кровати','шкафы','комоды','тумбочки','полки','компьютерные столы','офисные кресла','мягкая мебель','корпусная мебель'],
      uz: ['mebel','divanlar','stollar','stullar','karavotlar','shkaflar','tumbalar','kompyuter stollari'],
      en: ['furniture','sofas','armchairs','chairs','tables','beds','wardrobes','cabinets','shelves','desks','office chairs'],
    },
    raw_examples: {
      uzum: ['Mebel'],
      yandex_market: ['Мебель','Диваны','Столы'],
    },
    notes: 'Kids furniture belongs here unless the raw string is clearly a nursery item — otherwise use baby_products.',
  },
  {
    id: 'home_decor',
    parent_group: 'home',
    name: { ru: 'Домашний декор', uz: 'Uy bezaklari', en: 'Home decor' },
    terms: {
      ru: ['декор','домашний декор','картины','постеры','вазы','свечи','зеркала','настенные часы','ковры','шторы','подушки декоративные','статуэтки','фоторамки'],
      uz: ['uy bezaklari','rasmlar','vazalar','shamlar','oynalar','devor soatlari','gilamlar','pardalar','foto ramkalar'],
      en: ['home decor','wall art','posters','vases','candles','mirrors','wall clocks','rugs','curtains','decorative pillows','figurines','picture frames'],
    },
    raw_examples: {
      uzum: ['Uy bezaklari','Gilamlar'],
      yandex_market: ['Домашний декор','Декор для дома','Картины','Ковры'],
    },
  },
  {
    id: 'cleaning_supplies',
    parent_group: 'home',
    name: { ru: 'Бытовая химия и хозтовары', uz: "Maishiy kimyo va xo'jalik tovarlari", en: 'Cleaning supplies & Household' },
    terms: {
      ru: ['бытовая химия','стиральные порошки','жидкий стиральный порошок','кондиционеры для белья','средства для мытья посуды','чистящие средства','хозтовары','швабры','тряпки','мешки для мусора','освежители воздуха','средства от насекомых'],
      uz: ['maishiy kimyo','kir yuvish kukunlari','idish yuvish vositalari','tozalash vositalari','axlat xaltalari','havoni tozalovchilar'],
      en: ['cleaning supplies','laundry detergent','fabric softener','dish soap','household chemicals','mops','trash bags','air fresheners','insect repellent'],
    },
    raw_examples: {
      uzum: ['Maishiy kimyo','Kir yuvish vositalari'],
      yandex_market: ['Бытовая химия','Средства для стирки'],
    },
  },
  {
    id: 'lighting',
    parent_group: 'home',
    name: { ru: 'Освещение', uz: 'Yoritish', en: 'Lighting' },
    terms: {
      ru: ['освещение','лампы','светильники','люстры','настольные лампы','торшеры','ночники','led лампы','светодиодные лампы','гирлянды','бра','точечные светильники'],
      uz: ['yoritish','lampalar','yoritgichlar','lyustralar','stol lampalari','led lampalar','giryandalar'],
      en: ['lighting','lamps','light fixtures','chandeliers','desk lamps','floor lamps','led bulbs','string lights','wall sconces'],
    },
    raw_examples: {
      uzum: ['Yoritish','Lampalar'],
      yandex_market: ['Освещение','Люстры','Настольные лампы'],
    },
  },
  {
    id: 'home_small_appliances',
    parent_group: 'home',
    name: { ru: 'Мелкая бытовая техника для дома', uz: 'Uy uchun kichik maishiy texnika', en: 'Home small appliances' },
    terms: {
      ru: ['утюги','пылесосы','вентиляторы','обогреватели','кондиционеры','увлажнители воздуха','очистители воздуха','швейные машины','отпариватели','стиральные машины','сушилки для белья','роботы-пылесосы'],
      uz: ['dazmollar','changyutgichlar','ventilyatorlar','isitgichlar','konditsionerlar','havo namlagichlar','tikuv mashinalari','kir yuvish mashinalari'],
      en: ['irons','vacuum cleaners','fans','heaters','air conditioners','humidifiers','air purifiers','sewing machines','garment steamers','washing machines','robot vacuums'],
    },
    raw_examples: {
      uzum: ['Dazmollar','Changyutgichlar','Konditsionerlar'],
      yandex_market: ['Уход за домом','Климатическая техника','Техника для дома','Утюги','Пылесосы'],
    },
  },
  {
    id: 'makeup_cosmetics',
    parent_group: 'beauty_health',
    name: { ru: 'Декоративная косметика', uz: 'Bezovchi kosmetika', en: 'Makeup & Cosmetics' },
    terms: {
      ru: ['декоративная косметика','тональные средства','тональный крем','помады','помада','тени для век','тушь','тушь для ресниц','румяна','пудра','консилеры','кисти для макияжа','подводка','карандаши для глаз','блески для губ','хайлайтеры','бронзеры'],
      uz: ['bezovchi kosmetika',"labbo'yoqlar","ko'z bo'yoqlari","ko'z qalamlari",'yuz uchun kremlar','pudralar','kirpik uchun tushlar'],
      en: ['makeup','cosmetics','foundation','lipstick','eyeshadow','mascara','blush','powder','concealer','makeup brushes','eyeliner','lip gloss','highlighter','bronzer'],
    },
    raw_examples: {
      uzum: ['Bezovchi kosmetika',"Labbo'yoqlar"],
      yandex_market: ['Декоративная косметика','Макияж лица'],
    },
  },
  {
    id: 'skincare',
    parent_group: 'beauty_health',
    name: { ru: 'Уход за кожей', uz: 'Teri parvarishi', en: 'Skincare' },
    terms: {
      ru: ['уход за кожей','кремы для лица','сыворотки','маски для лица','тоники','очищающие средства','скрабы','солнцезащитные средства','спф','уход за телом','кремы для тела','лосьоны для тела','патчи для глаз'],
      uz: ['teri parvarishi','yuz kremlari','serumlar','yuz niqoblari','toniklar','skrablar','quyoshdan himoya vositalari','tana kremlari'],
      en: ['skincare','face creams','serums','face masks','toners','cleansers','scrubs','sunscreen','spf','body care','body lotions','eye patches'],
    },
    raw_examples: {
      uzum: ['Teri parvarishi','Yuz kremlari'],
      yandex_market: ['Уход за лицом','Уход за телом','Уход за кожей','Средства для лица'],
    },
  },
  {
    id: 'haircare',
    parent_group: 'beauty_health',
    name: { ru: 'Уход за волосами', uz: 'Soch parvarishi', en: 'Haircare' },
    terms: {
      ru: ['уход за волосами','шампуни','шампунь','кондиционеры для волос','маски для волос','масла для волос','средства для укладки','краски для волос','фены','плойки','утюжки для волос','бигуди','машинки для стрижки'],
      uz: ['soch parvarishi','shampunlar','soch niqoblari','soch bo\'yoqlari','fenlar','soch to\'g\'rilagichlar','soch olish mashinalari'],
      en: ['haircare','shampoo','hair conditioner','hair masks','hair oils','hair dye','hair dryers','curling irons','hair straighteners','hair clippers'],
    },
    raw_examples: {
      uzum: ['Soch parvarishi','Shampunlar','Fenlar'],
      yandex_market: ['Уход за волосами','Средства для волос'],
    },
  },
  {
    id: 'perfumes',
    parent_group: 'beauty_health',
    name: { ru: 'Парфюмерия', uz: 'Atirlar', en: 'Perfumes & Fragrances' },
    terms: {
      ru: ['парфюмерия','духи','туалетная вода','парфюмерная вода','ароматы','одеколон','мужские духи','женские духи','арабские духи','нишевая парфюмерия','парфюмированная вода'],
      uz: ['atirlar','parfyumeriya','erkaklar atirlari','ayollar atirlari','arab atirlari'],
      en: ['perfumes','fragrances','eau de parfum','eau de toilette','cologne',"men's fragrances","women's fragrances",'arabic perfumes'],
    },
    raw_examples: {
      uzum: ['Atirlar'],
      yandex_market: ['Парфюмерия','Женская парфюмерия','Мужская парфюмерия'],
    },
  },
  {
    id: 'personal_hygiene',
    parent_group: 'beauty_health',
    name: { ru: 'Личная гигиена', uz: 'Shaxsiy gigiyena', en: 'Personal hygiene' },
    terms: {
      ru: ['личная гигиена','мыло','гели для душа','дезодоранты','антиперспиранты','влажные салфетки','прокладки','тампоны','бритвы','средства для бритья','пена для бритья','ватные диски','ватные палочки','туалетная бумага','бумажные полотенца'],
      uz: ['shaxsiy gigiyena','sovun','dush gellari','dezodorantlar','nam salfetkalar','ustaralar','hojatxona qog\'ozi'],
      en: ['personal hygiene','soap','shower gel','deodorants','antiperspirants','wet wipes','feminine care','razors','shaving supplies','cotton pads','toilet paper'],
    },
    raw_examples: {
      uzum: ['Shaxsiy gigiyena','Sovunlar'],
      yandex_market: ['Средства гигиены','Женская гигиена','Средства для бритья'],
    },
  },
  {
    id: 'oral_care',
    parent_group: 'beauty_health',
    name: { ru: 'Уход за полостью рта', uz: "Og'iz parvarishi", en: 'Oral care' },
    terms: {
      ru: ['уход за полостью рта','зубные пасты','зубная паста','зубные щетки','электрические зубные щетки','ополаскиватели для рта','зубная нить','ирригаторы','отбеливание зубов'],
      uz: ["og'iz parvarishi",'tish pastalari',"tish cho'tkalari","elektr tish cho'tkalari","og'izni chayqash vositalari"],
      en: ['oral care','toothpaste','toothbrushes','electric toothbrushes','mouthwash','dental floss','water flossers','teeth whitening'],
    },
    raw_examples: {
      uzum: ['Tish parvarishi','Tish pastalari'],
      yandex_market: ['Уход за полостью рта','Гигиена полости рта','Зубные щетки'],
    },
  },
  {
    id: 'health_medical',
    parent_group: 'beauty_health',
    name: { ru: 'Медицинские товары', uz: 'Tibbiy tovarlar', en: 'Health & Medical devices' },
    terms: {
      ru: ['медицинские товары','тонометры','термометры','пульсоксиметры','глюкометры','ингаляторы','небулайзеры','массажеры','ортопедические изделия','витамины','бады','аптечки','бинты','пластыри','маски медицинские'],
      uz: ['tibbiy tovarlar','tonometrlar','termometrlar','pulsoksimetrlar','massajerlar','vitaminlar','plastirlar','tibbiy niqoblar'],
      en: ['medical devices','blood pressure monitors','thermometers','pulse oximeters','glucose meters','nebulizers','massagers','vitamins','supplements','first aid','bandages','medical masks'],
    },
    raw_examples: {
      uzum: ['Tibbiy tovarlar','Vitaminlar'],
      yandex_market: ['Медицинские приборы','Витамины и БАДы','Товары для здоровья','Тонометры','БАДы'],
    },
  },
  {
    id: 'mens_clothing',
    parent_group: 'clothing',
    name: { ru: 'Мужская одежда', uz: 'Erkaklar kiyimi', en: "Men's clothing" },
    terms: {
      ru: ['мужская одежда','мужские футболки','мужские рубашки','мужские джинсы','мужские брюки','мужские куртки','мужские свитера','мужские костюмы','толстовки мужские','мужские шорты','мужские поло','мужские пуховики'],
      uz: ['erkaklar kiyimi','erkaklar futbolkalari',"erkaklar ko'ylaklari",'erkaklar shimlari','erkaklar kurtkalari','erkaklar kostyumlari'],
      en: ["men's clothing","men's t-shirts","men's shirts","men's jeans","men's pants","men's jackets","men's sweaters","men's suits",'hoodies',"men's shorts",'polo shirts'],
    },
    raw_examples: {
      uzum: ['Erkaklar kiyimi'],
      yandex_market: ['Мужская одежда','Мужские футболки','Мужские джинсы'],
    },
    notes: 'This is your Auralook target category. Precision here matters.',
  },
  {
    id: 'womens_clothing',
    parent_group: 'clothing',
    name: { ru: 'Женская одежда', uz: 'Ayollar kiyimi', en: "Women's clothing" },
    terms: {
      ru: ['женская одежда','женские платья','женские блузки','женские юбки','женские джинсы','женские куртки','женские топы','кардиганы','сарафаны','женские брюки','женские шорты','женские пуховики','женские свитера'],
      uz: ['ayollar kiyimi',"ayollar ko'ylaklari",'ayollar bluzkalari','yubkalar','ayollar shimlari','ayollar kurtkalari'],
      en: ["women's clothing",'dresses','blouses','skirts',"women's jeans","women's jackets",'tops','cardigans',"women's pants","women's sweaters"],
    },
    raw_examples: {
      uzum: ['Ayollar kiyimi'],
      yandex_market: ['Женская одежда','Платья','Блузки'],
    },
  },
  {
    id: 'kids_clothing',
    parent_group: 'clothing',
    name: { ru: 'Детская одежда', uz: 'Bolalar kiyimi', en: "Kids' & Baby clothing" },
    terms: {
      ru: ['детская одежда','одежда для новорожденных','детские боди','детские комбинезоны','одежда для мальчиков','одежда для девочек','школьная форма','детские футболки','детские джинсы','ползунки','детские платья'],
      uz: ['bolalar kiyimi','chaqaloqlar kiyimi',"o'g'il bolalar kiyimi",'qizlar kiyimi','maktab formasi'],
      en: ["kids' clothing",'baby clothing','newborn clothing','bodysuits',"boys' clothing","girls' clothing",'school uniforms','onesies'],
    },
    raw_examples: {
      uzum: ['Bolalar kiyimi'],
      yandex_market: ['Детская одежда','Одежда для мальчиков','Одежда для девочек'],
    },
  },
  {
    id: 'shoes',
    parent_group: 'clothing',
    name: { ru: 'Обувь', uz: 'Poyabzallar', en: 'Shoes' },
    terms: {
      ru: ['обувь','кроссовки','кеды','ботинки','сапоги','туфли','босоножки','сандалии','слипоны','спортивная обувь','мужская обувь','женская обувь','детская обувь','мокасины','угги','резиновые сапоги','валенки','тапочки'],
      uz: ['poyabzallar','krossovkalar','etiklar','tuflilar','sandallar','erkaklar poyabzali','ayollar poyabzali','bolalar poyabzali','shippaklar'],
      en: ['shoes','sneakers','boots','loafers','sandals','slippers','sports shoes',"men's shoes","women's shoes","kids' shoes",'moccasins','uggs','rain boots'],
    },
    raw_examples: {
      uzum: ['Poyabzallar','Krossovkalar'],
      yandex_market: ['Обувь','Мужская обувь','Женская обувь','Кроссовки'],
    },
  },
  {
    id: 'bags_wallets',
    parent_group: 'clothing',
    name: { ru: 'Сумки, рюкзаки и кошельки', uz: 'Sumkalar va hamyonlar', en: 'Bags & Wallets' },
    terms: {
      ru: ['сумки','рюкзаки','кошельки','портмоне','клатчи','дорожные сумки','чемоданы','мужские сумки','женские сумки','сумки через плечо','поясные сумки','визитницы'],
      uz: ['sumkalar','ryukzaklar','hamyonlar','sayohat sumkalari','chemodanlar','erkaklar sumkalari','ayollar sumkalari'],
      en: ['bags','backpacks','wallets','purses','clutches','travel bags','suitcases',"men's bags","women's bags",'crossbody bags','waist bags'],
    },
    raw_examples: {
      uzum: ['Sumkalar','Ryukzaklar'],
      yandex_market: ['Сумки и аксессуары','Сумки','Женские сумки','Рюкзаки','Чемоданы'],
    },
  },
  {
    id: 'jewelry',
    parent_group: 'clothing',
    name: { ru: 'Ювелирные изделия и бижутерия', uz: 'Zargarlik buyumlari', en: 'Jewelry & Fashion watches' },
    terms: {
      ru: ['ювелирные изделия','украшения','кольца','серьги','цепочки','кулоны','браслеты','наручные часы','бижутерия','подвески','колье','обручальные кольца','запонки','броши'],
      uz: ['zargarlik buyumlari','uzuklar',"sirg'alar",'zanjirlar','bilagujuklar',"qo'l soatlari",'bijuteriya'],
      en: ['jewelry','rings','earrings','necklaces','pendants','bracelets','watches','fashion jewelry','wedding rings','brooches'],
    },
    raw_examples: {
      uzum: ['Zargarlik buyumlari','Bijuteriya'],
      yandex_market: ['Ювелирные изделия','Ювелирные украшения','Бижутерия','Наручные часы'],
    },
    notes: 'Analog wristwatches go here, not smart_watches. Disambiguate via "смарт"/"smart"/"fitness" keywords in raw string.',
  },
  {
    id: 'underwear_socks',
    parent_group: 'clothing',
    name: { ru: 'Нижнее белье и носки', uz: 'Ichki kiyim va paypoqlar', en: 'Underwear & Socks' },
    terms: {
      ru: ['нижнее белье','трусы','бюстгальтеры','носки','колготки','чулки','термобелье','пижамы','домашняя одежда','халаты','бесшовное белье','корректирующее белье'],
      uz: ['ichki kiyim','paypoqlar','kolgotkilar','pijamalar','uy kiyimi','xalatlar'],
      en: ['underwear','bras','panties','socks','tights','stockings','thermal underwear','pajamas','loungewear','shapewear'],
    },
    raw_examples: {
      uzum: ['Ichki kiyim'],
      yandex_market: ['Нижнее белье','Носки','Пижамы','Домашняя одежда'],
    },
  },
  {
    id: 'toys',
    parent_group: 'kids',
    name: { ru: 'Игрушки', uz: "O'yinchoqlar", en: 'Toys' },
    terms: {
      ru: ['игрушки','мягкие игрушки','конструкторы','lego','куклы','машинки','настольные игры','развивающие игрушки','радиоуправляемые игрушки','пазлы','кинетический песок','слаймы','фигурки','наборы для творчества'],
      uz: ["o'yinchoqlar",'yumshoq o\'yinchoqlar','konstruktorlar','lego',"qo'g'irchoqlar",'mashinalar',"stol o'yinlari",'pazllar'],
      en: ['toys','stuffed animals','building blocks','lego','dolls','toy cars','board games','educational toys','rc toys','puzzles','kinetic sand','action figures'],
    },
    raw_examples: {
      uzum: ["O'yinchoqlar"],
      yandex_market: ['Игрушки','Мягкие игрушки','Конструкторы'],
    },
  },
  {
    id: 'baby_products',
    parent_group: 'kids',
    name: { ru: 'Товары для новорожденных и малышей', uz: 'Chaqaloqlar uchun mahsulotlar', en: 'Baby products' },
    terms: {
      ru: ['товары для новорожденных','подгузники','памперсы','детское питание','смеси','бутылочки','пустышки','слинги','коляски','автокресла','радионяни','детские ванночки','кроватки','манежи','подгузники-трусики','детские каши'],
      uz: ['chaqaloqlar uchun mahsulotlar','tagliklar','pampers','chaqaloq oziq-ovqati','shishalar',"so'rg'ichlar",'kolyaskalar',"avtoo'rindiqlar",'beshiklar'],
      en: ['baby products','diapers','baby food','baby formula','baby bottles','pacifiers','strollers','car seats','baby monitors','baby baths','cribs','playpens'],
    },
    raw_examples: {
      uzum: ['Chaqaloqlar uchun mahsulotlar','Tagliklar'],
      yandex_market: ['Товары для детей','Товары для малышей','Подгузники','Детское питание'],
    },
  },
  {
    id: 'fitness_sports_equipment',
    parent_group: 'sports',
    name: { ru: 'Спортивные товары и тренажеры', uz: 'Sport tovarlari', en: 'Fitness & Sports equipment' },
    terms: {
      ru: ['спортивные товары','тренажеры','гантели','штанги','коврики для йоги','эспандеры','фитнес резинки','скакалки','спортивная форма','компрессионная одежда','мячи','футбольные мячи','баскетбольные мячи','боксерские перчатки'],
      uz: ['sport tovarlari','trenajerlar','gantellar','yoga gilamchalar','fitnes uskunalari','sport kiyimlari',"to'plar"],
      en: ['sports equipment','exercise machines','dumbbells','barbells','yoga mats','resistance bands','jump ropes','activewear','sportswear','sports balls','boxing gloves'],
    },
    raw_examples: {
      uzum: ['Sport tovarlari','Trenajerlar'],
      yandex_market: ['Спорттовары','Фитнес','Спорт и отдых','Тренажеры','Одежда для фитнеса'],
    },
  },
  {
    id: 'outdoor_camping',
    parent_group: 'sports',
    name: { ru: 'Туризм и кемпинг', uz: 'Turizm va kamping', en: 'Outdoor & Camping' },
    terms: {
      ru: ['туризм','кемпинг','палатки','спальные мешки','туристические рюкзаки','термосы','походная посуда','мангалы','шампуры','коврики туристические','фляги','газовые горелки'],
      uz: ['turizm','kamping','chodirlar','uxlash xaltalari','termoslar','mangallar'],
      en: ['outdoor','camping','tents','sleeping bags','hiking backpacks','thermoses','camping cookware','grills','bbq skewers','camping mats','flasks'],
    },
    raw_examples: {
      uzum: ['Turizm','Chodirlar'],
      yandex_market: ['Товары для туризма','Туризм','Палатки','Мангалы'],
    },
  },
  {
    id: 'bicycles_scooters',
    parent_group: 'sports',
    name: { ru: 'Велосипеды, самокаты, скейтборды', uz: 'Velosipedlar va samokatlar', en: 'Bicycles, Scooters & Skateboards' },
    terms: {
      ru: ['велосипеды','велосипед','самокаты','электросамокаты','скейтборды','роликовые коньки','гироскутеры','аксессуары для велосипедов','шлемы','детские велосипеды','горные велосипеды'],
      uz: ['velosipedlar','samokatlar','elektr samokatlar','skeytbordlar','rolikli konkilar','bolalar velosipedlari'],
      en: ['bicycles','bikes','scooters','electric scooters','skateboards','roller skates','hoverboards','bike accessories','helmets',"kids' bikes"],
    },
    raw_examples: {
      uzum: ['Velosipedlar','Samokatlar'],
      yandex_market: ['Велосипеды','Самокаты и ролики'],
    },
  },
  {
    id: 'auto_parts',
    parent_group: 'auto',
    name: { ru: 'Автозапчасти и автотовары', uz: 'Avto ehtiyot qismlar', en: 'Auto parts & Accessories' },
    terms: {
      ru: ['автозапчасти','автотовары','автомобильные аксессуары','автохимия','моторные масла','автомобильные коврики','чехлы для сидений','автосигнализации','шины','зимние шины','летние шины','диски автомобильные','дворники','аккумуляторы автомобильные'],
      uz: ['avto ehtiyot qismlar','avto tovarlar','motor moylari','avtomobil gilamchalari','shinalar','disklar'],
      en: ['auto parts','car accessories','motor oil','car mats','seat covers','car alarms','tires','winter tires','wheels','wipers','car batteries'],
    },
    raw_examples: {
      uzum: ['Avto tovarlar'],
      yandex_market: ['Автотовары','Автозапчасти','Шины и диски'],
    },
  },
  {
    id: 'car_electronics',
    parent_group: 'auto',
    name: { ru: 'Автоэлектроника', uz: 'Avto elektronika', en: 'Car electronics' },
    terms: {
      ru: ['автоэлектроника','автомагнитолы','магнитолы','видеорегистраторы','gps навигаторы','радар-детекторы','автомобильные держатели для телефонов','автомобильные зарядки','парктроники','камеры заднего вида'],
      uz: ['avto elektronika','avtomagnitolalar','video registratorlar','gps navigatorlar','avtomobil telefon ushlagichlari'],
      en: ['car electronics','car stereos','dash cams','gps navigators','radar detectors','car phone mounts','car chargers','parking sensors','reverse cameras'],
    },
    raw_examples: {
      uzum: ['Avto elektronika'],
      yandex_market: ['Автомобильная электроника','Автоэлектроника','Видеорегистраторы'],
    },
  },
  {
    id: 'books_stationery',
    parent_group: 'other',
    name: { ru: 'Книги и канцтовары', uz: 'Kitoblar va kantselyariya', en: 'Books & Stationery' },
    terms: {
      ru: ['книги','художественная литература','учебники','тетради','ручки','карандаши','канцтовары','канцелярия','блокноты','ежедневники','школьные рюкзаки','пеналы','фломастеры','маркеры','детская литература'],
      uz: ['kitoblar','badiiy adabiyot','darsliklar','daftarlar','ruchkalar','qalamlar','kantselyariya tovarlari','bloknotlar','maktab ryukzaklari'],
      en: ['books','fiction','textbooks','notebooks','pens','pencils','stationery','notepads','planners','school backpacks','markers',"children's books"],
    },
    raw_examples: {
      uzum: ['Kitoblar','Kantselyariya'],
      yandex_market: ['Книги','Канцелярские товары','Канцтовары','Тетради'],
    },
  },
  {
    id: 'pet_supplies',
    parent_group: 'other',
    name: { ru: 'Товары для животных', uz: 'Hayvonlar uchun tovarlar', en: 'Pet supplies' },
    terms: {
      ru: ['товары для животных','товары для собак','товары для кошек','корм для собак','корм для кошек','наполнитель для туалета','игрушки для животных','поводки','переноски','ошейники','домики для животных','когтеточки','аквариумистика'],
      uz: ['hayvonlar uchun tovarlar','itlar uchun tovarlar','mushuklar uchun tovarlar','hayvonlar uchun ozuqa','akvariumlar'],
      en: ['pet supplies','dog supplies','cat supplies','dog food','cat food','cat litter','pet toys','leashes','pet carriers','collars','pet houses','aquariums'],
    },
    raw_examples: {
      uzum: ['Hayvonlar uchun tovarlar'],
      yandex_market: ['Зоотовары','Корм для собак','Корм для кошек'],
    },
  },
  {
    id: 'groceries_food',
    parent_group: 'other',
    name: { ru: 'Продукты питания', uz: 'Oziq-ovqat mahsulotlari', en: 'Groceries & Food' },
    terms: {
      ru: ['продукты питания','бакалея','крупы','макароны','растительное масло','сахар','мука','специи','приправы','консервы','кондитерские изделия','чай','кофе','сладости','снеки','соусы','напитки','детское питание готовое'],
      uz: ['oziq-ovqat mahsulotlari','bakaleya','yormalar','makaronlar',"o'simlik moyi",'shakar','un','ziravorlar','konservalar','choy','kofe','shirinliklar'],
      en: ['groceries','pantry staples','rice','pasta','cooking oil','sugar','flour','spices','condiments','canned goods','tea','coffee','sweets','snacks','beverages'],
    },
    raw_examples: {
      uzum: ['Oziq-ovqat','Choy va kofe'],
      yandex_market: ['Продукты питания','Бакалея','Чай, кофе'],
    },
  },
  {
    id: 'garden_outdoor',
    parent_group: 'other',
    name: { ru: 'Сад, огород, дача', uz: "Bog' va tomorqa", en: 'Garden & Outdoor' },
    terms: {
      ru: ['товары для дачи','сад и огород','семена','удобрения','садовый инвентарь','газонокосилки','секаторы','шланги для полива','уличная мебель','теплицы','горшки для цветов','грунт','триммеры'],
      uz: ["bog' va tomorqa","urug'lar","o'g'itlar","bog' asboblari",'gullar uchun tuvaklar','issiqxonalar'],
      en: ['garden supplies','seeds','fertilizers','garden tools','lawn mowers','pruning shears','hoses','outdoor furniture','greenhouses','plant pots','trimmers'],
    },
    raw_examples: {
      uzum: ["Bog' va tomorqa"],
      yandex_market: ['Сад и огород','Сад и дача','Товары для сада','Семена'],
    },
  },
  {
    id: 'tools_hardware',
    parent_group: 'other',
    name: { ru: 'Инструменты и стройматериалы', uz: 'Asboblar va qurilish materiallari', en: 'Tools & Hardware' },
    terms: {
      ru: ['инструменты','ручные инструменты','электроинструменты','дрели','шуруповерты','молотки','отвертки','гаечные ключи','крепеж','строительные материалы','лакокрасочные материалы','пилы','болгарки','перфораторы','уровни','рулетки'],
      uz: ['asboblar',"qo'l asboblari",'elektr asboblari','drellar',"bolg'alar",'otvyortkalar','gayka kalitlari','qurilish materiallari','arralar'],
      en: ['tools','hand tools','power tools','drills','screwdrivers','hammers','wrenches','fasteners','building materials','paint','saws','angle grinders'],
    },
    raw_examples: {
      uzum: ['Asboblar','Qurilish materiallari'],
      yandex_market: ['Строительство и ремонт','Инструменты','Электроинструменты'],
    },
  },
  {
    id: 'office_supplies',
    parent_group: 'other',
    name: { ru: 'Офисные товары и печать', uz: 'Ofis tovarlari', en: 'Office supplies & Printing' },
    terms: {
      ru: ['офисные товары','принтеры','мфу','многофункциональные устройства','картриджи','бумага для принтера','степлеры','дыроколы','папки','файлы канцелярские','скотч','калькуляторы','уничтожители бумаг','офисные стулья'],
      uz: ['ofis tovarlari','printerlar','mfu','kartrijlar','printer qog\'ozlari','kalkulyatorlar','ofis stullari'],
      en: ['office supplies','printers','all-in-one printers','ink cartridges','printer paper','staplers','hole punches','folders','calculators','paper shredders','office chairs'],
    },
    raw_examples: {
      uzum: ['Ofis tovarlari','Printerlar'],
      yandex_market: ['Товары для офиса','Офисные товары','Принтеры и МФУ'],
    },
    notes: 'Office chairs may also match furniture — prefer this canonical if raw string mentions "офис"/"office".',
  },
]
