// Static fallback for Yandex Market categories when the live API is slow or
// unreachable. Built from the canonical taxonomy (lib/categories/taxonomy.ts).
// IDs are synthetic (8000+) — the seller should verify the category ID against
// their Yandex seller cabinet before publishing.

import type { YandexCategory } from './client'

export const YANDEX_STATIC_CATEGORIES: YandexCategory[] = [
  {
    id: 8001,
    name: 'Электроника',
    childCount: 13,
    children: [
      { id: 80011, name: 'Смартфоны', childCount: 0 },
      { id: 80012, name: 'Аксессуары для смартфонов', childCount: 0 },
      { id: 80013, name: 'Наушники и гарнитуры', childCount: 0 },
      { id: 80014, name: 'Умные часы и браслеты', childCount: 0 },
      { id: 80015, name: 'Ноутбуки', childCount: 0 },
      { id: 80016, name: 'Планшеты', childCount: 0 },
      { id: 80017, name: 'Компьютерная периферия', childCount: 0 },
      { id: 80018, name: 'Сетевое оборудование и накопители', childCount: 0 },
      { id: 80019, name: 'Телевизоры и проекторы', childCount: 0 },
      { id: 80020, name: 'Портативная акустика', childCount: 0 },
      { id: 80021, name: 'Фото- и видеотехника', childCount: 0 },
      { id: 80022, name: 'Игровые приставки', childCount: 0 },
      { id: 80023, name: 'Внешние аккумуляторы и зарядные устройства', childCount: 0 },
    ],
  },
  {
    id: 8002,
    name: 'Бытовая техника',
    childCount: 4,
    children: [
      { id: 80031, name: 'Мелкая кухонная техника', childCount: 0 },
      { id: 80032, name: 'Крупная бытовая техника', childCount: 0 },
      { id: 80033, name: 'Техника для дома', childCount: 0 },
      { id: 80034, name: 'Климатическая техника', childCount: 0 },
    ],
  },
  {
    id: 8003,
    name: 'Дом и сад',
    childCount: 9,
    children: [
      { id: 80041, name: 'Посуда для приготовления', childCount: 0 },
      { id: 80042, name: 'Столовая посуда и кухонные принадлежности', childCount: 0 },
      { id: 80043, name: 'Домашний текстиль', childCount: 0 },
      { id: 80044, name: 'Мебель', childCount: 0 },
      { id: 80045, name: 'Домашний декор', childCount: 0 },
      { id: 80046, name: 'Бытовая химия', childCount: 0 },
      { id: 80047, name: 'Освещение', childCount: 0 },
      { id: 80048, name: 'Сад и огород', childCount: 0 },
      { id: 80049, name: 'Инструменты и стройматериалы', childCount: 0 },
    ],
  },
  {
    id: 8004,
    name: 'Красота и здоровье',
    childCount: 7,
    children: [
      { id: 80051, name: 'Декоративная косметика', childCount: 0 },
      { id: 80052, name: 'Уход за кожей', childCount: 0 },
      { id: 80053, name: 'Уход за волосами', childCount: 0 },
      { id: 80054, name: 'Парфюмерия', childCount: 0 },
      { id: 80055, name: 'Средства гигиены', childCount: 0 },
      { id: 80056, name: 'Уход за полостью рта', childCount: 0 },
      { id: 80057, name: 'Товары для здоровья', childCount: 0 },
    ],
  },
  {
    id: 8005,
    name: 'Одежда, обувь и аксессуары',
    childCount: 7,
    children: [
      { id: 80061, name: 'Мужская одежда', childCount: 0 },
      { id: 80062, name: 'Женская одежда', childCount: 0 },
      { id: 80063, name: 'Детская одежда', childCount: 0 },
      { id: 80064, name: 'Обувь', childCount: 0 },
      { id: 80065, name: 'Сумки и аксессуары', childCount: 0 },
      { id: 80066, name: 'Ювелирные изделия и бижутерия', childCount: 0 },
      { id: 80067, name: 'Нижнее белье и носки', childCount: 0 },
    ],
  },
  {
    id: 8006,
    name: 'Детские товары',
    childCount: 2,
    children: [
      { id: 80071, name: 'Игрушки', childCount: 0 },
      { id: 80072, name: 'Товары для малышей', childCount: 0 },
    ],
  },
  {
    id: 8007,
    name: 'Спорт и отдых',
    childCount: 3,
    children: [
      { id: 80081, name: 'Спорттовары и тренажёры', childCount: 0 },
      { id: 80082, name: 'Туризм и кемпинг', childCount: 0 },
      { id: 80083, name: 'Велосипеды и самокаты', childCount: 0 },
    ],
  },
  {
    id: 8008,
    name: 'Автотовары',
    childCount: 2,
    children: [
      { id: 80091, name: 'Автозапчасти и автоаксессуары', childCount: 0 },
      { id: 80092, name: 'Автоэлектроника', childCount: 0 },
    ],
  },
  {
    id: 8009,
    name: 'Книги и канцтовары',
    childCount: 3,
    children: [
      { id: 80101, name: 'Книги', childCount: 0 },
      { id: 80102, name: 'Канцелярские товары', childCount: 0 },
      { id: 80103, name: 'Офисные товары', childCount: 0 },
    ],
  },
  {
    id: 8010,
    name: 'Зоотовары',
    childCount: 3,
    children: [
      { id: 80111, name: 'Товары для собак', childCount: 0 },
      { id: 80112, name: 'Товары для кошек', childCount: 0 },
      { id: 80113, name: 'Аквариумистика', childCount: 0 },
    ],
  },
  {
    id: 8011,
    name: 'Продукты питания',
    childCount: 4,
    children: [
      { id: 80121, name: 'Бакалея', childCount: 0 },
      { id: 80122, name: 'Чай и кофе', childCount: 0 },
      { id: 80123, name: 'Сладости и снеки', childCount: 0 },
      { id: 80124, name: 'Напитки', childCount: 0 },
    ],
  },
]
