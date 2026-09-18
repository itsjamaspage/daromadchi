// Static fallback for Uzum categories when the live API is unreachable.
// Built from the canonical taxonomy (lib/categories/taxonomy.ts).
// IDs are synthetic (9000+) — the seller should verify the category ID
// against their Uzum seller cabinet before uploading the generated Excel.

export interface StaticCategory {
  id: number
  title: string
  children?: StaticCategory[]
}

export const UZUM_STATIC_CATEGORIES: StaticCategory[] = [
  {
    id: 9001,
    title: 'Электроника',
    children: [
      { id: 90011, title: 'Смартфоны' },
      { id: 90012, title: 'Аксессуары для телефонов' },
      { id: 90013, title: 'Наушники и гарнитуры' },
      { id: 90014, title: 'Смарт-часы и фитнес-браслеты' },
      { id: 90015, title: 'Ноутбуки' },
      { id: 90016, title: 'Планшеты' },
      { id: 90017, title: 'Компьютерные аксессуары' },
      { id: 90018, title: 'Сетевое оборудование и накопители' },
      { id: 90019, title: 'Телевизоры и проекторы' },
      { id: 90020, title: 'Колонки и аудиотехника' },
      { id: 90021, title: 'Фото- и видеотехника' },
      { id: 90022, title: 'Игровые консоли и видеоигры' },
      { id: 90023, title: 'Повербанки и зарядные устройства' },
    ],
  },
  {
    id: 9002,
    title: 'Бытовая техника',
    children: [
      { id: 90031, title: 'Мелкая кухонная техника' },
      { id: 90032, title: 'Крупная кухонная техника' },
      { id: 90033, title: 'Техника для дома' },
      { id: 90034, title: 'Климатическая техника' },
    ],
  },
  {
    id: 9003,
    title: 'Дом и сад',
    children: [
      { id: 90041, title: 'Посуда для приготовления' },
      { id: 90042, title: 'Столовая посуда и кухонные принадлежности' },
      { id: 90043, title: 'Постельное белье и текстиль' },
      { id: 90044, title: 'Мебель' },
      { id: 90045, title: 'Домашний декор' },
      { id: 90046, title: 'Бытовая химия и хозтовары' },
      { id: 90047, title: 'Освещение' },
      { id: 90048, title: 'Сад и огород' },
      { id: 90049, title: 'Инструменты и стройматериалы' },
    ],
  },
  {
    id: 9004,
    title: 'Красота и здоровье',
    children: [
      { id: 90051, title: 'Декоративная косметика' },
      { id: 90052, title: 'Уход за кожей' },
      { id: 90053, title: 'Уход за волосами' },
      { id: 90054, title: 'Парфюмерия' },
      { id: 90055, title: 'Личная гигиена' },
      { id: 90056, title: 'Уход за полостью рта' },
      { id: 90057, title: 'Медицинские товары' },
    ],
  },
  {
    id: 9005,
    title: 'Одежда, обувь и аксессуары',
    children: [
      { id: 90061, title: 'Мужская одежда' },
      { id: 90062, title: 'Женская одежда' },
      { id: 90063, title: 'Детская одежда' },
      { id: 90064, title: 'Обувь' },
      { id: 90065, title: 'Сумки, рюкзаки и кошельки' },
      { id: 90066, title: 'Ювелирные изделия и бижутерия' },
      { id: 90067, title: 'Нижнее белье и носки' },
    ],
  },
  {
    id: 9006,
    title: 'Детские товары',
    children: [
      { id: 90071, title: 'Игрушки' },
      { id: 90072, title: 'Товары для новорожденных и малышей' },
    ],
  },
  {
    id: 9007,
    title: 'Спорт и отдых',
    children: [
      { id: 90081, title: 'Спортивные товары и тренажеры' },
      { id: 90082, title: 'Туризм и кемпинг' },
      { id: 90083, title: 'Велосипеды, самокаты, скейтборды' },
    ],
  },
  {
    id: 9008,
    title: 'Автотовары',
    children: [
      { id: 90091, title: 'Автозапчасти и автоаксессуары' },
      { id: 90092, title: 'Автоэлектроника' },
    ],
  },
  {
    id: 9009,
    title: 'Книги и канцтовары',
    children: [
      { id: 90101, title: 'Книги' },
      { id: 90102, title: 'Канцелярские товары' },
      { id: 90103, title: 'Офисные товары' },
    ],
  },
  {
    id: 9010,
    title: 'Зоотовары',
    children: [
      { id: 90111, title: 'Товары для собак' },
      { id: 90112, title: 'Товары для кошек' },
      { id: 90113, title: 'Аквариумистика' },
    ],
  },
  {
    id: 9011,
    title: 'Продукты питания',
    children: [
      { id: 90121, title: 'Бакалея' },
      { id: 90122, title: 'Чай и кофе' },
      { id: 90123, title: 'Сладости и снеки' },
      { id: 90124, title: 'Напитки' },
    ],
  },
]
