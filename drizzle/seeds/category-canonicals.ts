import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { categoriesCanonical, categoryAliases } from '@/lib/db/schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

interface SeedEntry {
  canonical: { name_ru: string; name_uz: string; name_en: string }
  aliases: { marketplace: string; original_name: string }[]
}

const SEED_DATA: SeedEntry[] = [
  {
    canonical: { name_ru: 'Наушники TWS', name_uz: 'Simsiz quloqchinlar', name_en: 'TWS Earphones' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Simsiz quloqchinlar' },
      { marketplace: 'uzum', original_name: 'TWS quloqchinlar' },
      { marketplace: 'ym', original_name: 'Наушники и гарнитуры' },
      { marketplace: 'ym', original_name: 'Беспроводные наушники' },
      { marketplace: 'wb', original_name: 'Наушники TWS' },
      { marketplace: 'wb', original_name: 'Беспроводные наушники' },
    ],
  },
  {
    canonical: { name_ru: 'Наушники проводные', name_uz: 'Simli quloqchinlar', name_en: 'Wired Earphones' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Simli quloqchinlar' },
      { marketplace: 'ym', original_name: 'Проводные наушники' },
      { marketplace: 'wb', original_name: 'Наушники проводные' },
    ],
  },
  {
    canonical: { name_ru: 'Умные часы', name_uz: 'Aqlli soatlar', name_en: 'Smartwatches' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Aqlli soatlar' },
      { marketplace: 'uzum', original_name: 'Smart soatlar' },
      { marketplace: 'ym', original_name: 'Умные часы' },
      { marketplace: 'ym', original_name: 'Смарт-часы' },
      { marketplace: 'wb', original_name: 'Смарт-часы' },
    ],
  },
  {
    canonical: { name_ru: 'Фитнес-браслеты', name_uz: 'Fitnes bilaguzuklar', name_en: 'Fitness Bands' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Fitnes bilaguzuklar' },
      { marketplace: 'ym', original_name: 'Фитнес-браслеты' },
      { marketplace: 'wb', original_name: 'Фитнес-браслеты' },
    ],
  },
  {
    canonical: { name_ru: 'Портативные зарядные устройства', name_uz: 'Portativ zaryadlash qurilmalari', name_en: 'Power Banks' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Portativ zaryadlagichlar' },
      { marketplace: 'uzum', original_name: 'Powerbank' },
      { marketplace: 'ym', original_name: 'Внешние аккумуляторы' },
      { marketplace: 'ym', original_name: 'Power Bank' },
      { marketplace: 'wb', original_name: 'Портативные зарядные устройства' },
      { marketplace: 'wb', original_name: 'Power Bank' },
    ],
  },
  {
    canonical: { name_ru: 'Зарядные устройства', name_uz: 'Zaryadlash qurilmalari', name_en: 'Chargers' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Zaryadlagichlar' },
      { marketplace: 'ym', original_name: 'Зарядные устройства' },
      { marketplace: 'wb', original_name: 'Сетевые зарядные устройства' },
    ],
  },
  {
    canonical: { name_ru: 'USB-кабели', name_uz: 'USB kabellar', name_en: 'USB Cables' },
    aliases: [
      { marketplace: 'uzum', original_name: 'USB kabellar' },
      { marketplace: 'uzum', original_name: 'Kabellar' },
      { marketplace: 'ym', original_name: 'Кабели USB' },
      { marketplace: 'wb', original_name: 'Кабели' },
    ],
  },
  {
    canonical: { name_ru: 'Клавиатуры', name_uz: 'Klaviaturalar', name_en: 'Keyboards' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Klaviaturalar' },
      { marketplace: 'ym', original_name: 'Клавиатуры' },
      { marketplace: 'wb', original_name: 'Клавиатуры' },
    ],
  },
  {
    canonical: { name_ru: 'Компьютерные мыши', name_uz: 'Kompyuter sichqonchalari', name_en: 'Computer Mice' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Sichqonchalar' },
      { marketplace: 'uzum', original_name: 'Kompyuter sichqonchalari' },
      { marketplace: 'ym', original_name: 'Компьютерные мыши' },
      { marketplace: 'wb', original_name: 'Мыши компьютерные' },
    ],
  },
  {
    canonical: { name_ru: 'Наборы клавиатура + мышь', name_uz: "Klaviatura va sichqoncha to'plamlari", name_en: 'Keyboard & Mouse Sets' },
    aliases: [
      { marketplace: 'uzum', original_name: "Klaviatura va sichqoncha to'plami" },
      { marketplace: 'ym', original_name: 'Комплекты клавиатура и мышь' },
      { marketplace: 'wb', original_name: 'Наборы клавиатура + мышь' },
    ],
  },
  {
    canonical: { name_ru: 'Bluetooth-колонки', name_uz: 'Bluetooth kolonkalar', name_en: 'Bluetooth Speakers' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Bluetooth kolonkalar' },
      { marketplace: 'uzum', original_name: 'Simsiz kolonkalar' },
      { marketplace: 'ym', original_name: 'Портативные колонки' },
      { marketplace: 'ym', original_name: 'Bluetooth-колонки' },
      { marketplace: 'wb', original_name: 'Колонки портативные' },
    ],
  },
  {
    canonical: { name_ru: 'Вентиляторы', name_uz: 'Ventilyatorlar', name_en: 'Fans' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Ventilyatorlar' },
      { marketplace: 'ym', original_name: 'Вентиляторы' },
      { marketplace: 'wb', original_name: 'Вентиляторы напольные' },
    ],
  },
  {
    canonical: { name_ru: 'Мини-вентиляторы', name_uz: 'Mini ventilyatorlar', name_en: 'Mini Fans' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Mini ventilyatorlar' },
      { marketplace: 'uzum', original_name: 'USB ventilyatorlar' },
      { marketplace: 'ym', original_name: 'Настольные вентиляторы' },
      { marketplace: 'wb', original_name: 'Мини-вентиляторы' },
    ],
  },
  {
    canonical: { name_ru: 'Фены для волос', name_uz: 'Soch fenlari', name_en: 'Hair Dryers' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Soch fenlari' },
      { marketplace: 'uzum', original_name: 'Fenlar' },
      { marketplace: 'ym', original_name: 'Фены' },
      { marketplace: 'wb', original_name: 'Фены для волос' },
    ],
  },
  {
    canonical: { name_ru: 'Утюги', name_uz: 'Dazmollar', name_en: 'Irons' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Dazmollar' },
      { marketplace: 'ym', original_name: 'Утюги' },
      { marketplace: 'wb', original_name: 'Утюги' },
    ],
  },
  {
    canonical: { name_ru: 'Электрические чайники', name_uz: 'Elektr choynaklar', name_en: 'Electric Kettles' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Elektr choynaklar' },
      { marketplace: 'ym', original_name: 'Электрочайники' },
      { marketplace: 'wb', original_name: 'Электрические чайники' },
    ],
  },
  {
    canonical: { name_ru: 'Пылесосы', name_uz: 'Changyutgichlar', name_en: 'Vacuum Cleaners' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Changyutgichlar' },
      { marketplace: 'ym', original_name: 'Пылесосы' },
      { marketplace: 'wb', original_name: 'Пылесосы' },
    ],
  },
  {
    canonical: { name_ru: 'Микроволновые печи', name_uz: "Mikroto'lqinli pechlar", name_en: 'Microwaves' },
    aliases: [
      { marketplace: 'uzum', original_name: "Mikroto'lqinli pechlar" },
      { marketplace: 'ym', original_name: 'Микроволновые печи' },
      { marketplace: 'wb', original_name: 'Микроволновые печи' },
    ],
  },
  {
    canonical: { name_ru: 'Блендеры', name_uz: 'Blenderlar', name_en: 'Blenders' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Blenderlar' },
      { marketplace: 'ym', original_name: 'Блендеры' },
      { marketplace: 'wb', original_name: 'Блендеры' },
    ],
  },
  {
    canonical: { name_ru: 'Кофеварки', name_uz: 'Qahva mashinalari', name_en: 'Coffee Makers' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Qahva mashinalari' },
      { marketplace: 'ym', original_name: 'Кофеварки и кофемашины' },
      { marketplace: 'wb', original_name: 'Кофеварки' },
    ],
  },
  {
    canonical: { name_ru: 'Тостеры', name_uz: 'Tosterlar', name_en: 'Toasters' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Tosterlar' },
      { marketplace: 'ym', original_name: 'Тостеры' },
      { marketplace: 'wb', original_name: 'Тостеры' },
    ],
  },
  {
    canonical: { name_ru: 'Смартфоны', name_uz: 'Smartfonlar', name_en: 'Smartphones' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Smartfonlar' },
      { marketplace: 'ym', original_name: 'Смартфоны' },
      { marketplace: 'wb', original_name: 'Смартфоны' },
    ],
  },
  {
    canonical: { name_ru: 'Планшеты', name_uz: 'Planshetlar', name_en: 'Tablets' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Planshetlar' },
      { marketplace: 'ym', original_name: 'Планшеты' },
      { marketplace: 'wb', original_name: 'Планшеты' },
    ],
  },
  {
    canonical: { name_ru: 'Ноутбуки', name_uz: 'Noutbuklar', name_en: 'Laptops' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Noutbuklar' },
      { marketplace: 'ym', original_name: 'Ноутбуки' },
      { marketplace: 'wb', original_name: 'Ноутбуки' },
    ],
  },
  {
    canonical: { name_ru: 'Чехлы для телефонов', name_uz: "Telefon g'iloflari", name_en: 'Phone Cases' },
    aliases: [
      { marketplace: 'uzum', original_name: "Telefon g'iloflari" },
      { marketplace: 'uzum', original_name: 'Telefon chexlari' },
      { marketplace: 'ym', original_name: 'Чехлы для телефонов' },
      { marketplace: 'wb', original_name: 'Чехлы для телефонов' },
    ],
  },
  {
    canonical: { name_ru: 'Защитные стёкла', name_uz: 'Himoya oynalari', name_en: 'Screen Protectors' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Himoya oynalari' },
      { marketplace: 'uzum', original_name: 'Ekran himoyachilari' },
      { marketplace: 'ym', original_name: 'Защитные стёкла и пленки' },
      { marketplace: 'wb', original_name: 'Защитные стекла' },
    ],
  },
  {
    canonical: { name_ru: 'Держатели для телефонов', name_uz: 'Telefon ushlagichlari', name_en: 'Phone Holders' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Telefon ushlagichlari' },
      { marketplace: 'ym', original_name: 'Держатели для телефонов' },
      { marketplace: 'wb', original_name: 'Держатели для телефонов' },
    ],
  },
  {
    canonical: { name_ru: 'Автомобильные аксессуары', name_uz: 'Avtomobil aksessuarlari', name_en: 'Car Accessories' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Avto aksessuarlari' },
      { marketplace: 'ym', original_name: 'Автомобильные аксессуары' },
      { marketplace: 'wb', original_name: 'Автотовары' },
    ],
  },
  {
    canonical: { name_ru: 'Игрушки', name_uz: "O'yinchoqlar", name_en: 'Toys' },
    aliases: [
      { marketplace: 'uzum', original_name: "O'yinchoqlar" },
      { marketplace: 'ym', original_name: 'Игрушки' },
      { marketplace: 'wb', original_name: 'Игрушки' },
    ],
  },
  {
    canonical: { name_ru: 'Куклы', name_uz: "Qo'g'irchoqlar", name_en: 'Dolls' },
    aliases: [
      { marketplace: 'uzum', original_name: "Qo'g'irchoqlar" },
      { marketplace: 'ym', original_name: 'Куклы' },
      { marketplace: 'wb', original_name: 'Куклы' },
    ],
  },
  {
    canonical: { name_ru: 'Конструкторы', name_uz: 'Konstruktorlar', name_en: 'Building Sets' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Konstruktorlar' },
      { marketplace: 'ym', original_name: 'Конструкторы' },
      { marketplace: 'wb', original_name: 'Конструкторы' },
    ],
  },
  {
    canonical: { name_ru: 'Мужская одежда', name_uz: 'Erkaklar kiyimi', name_en: "Men's Clothing" },
    aliases: [
      { marketplace: 'uzum', original_name: 'Erkaklar kiyimi' },
      { marketplace: 'ym', original_name: 'Мужская одежда' },
      { marketplace: 'wb', original_name: 'Мужская одежда' },
    ],
  },
  {
    canonical: { name_ru: 'Женская одежда', name_uz: 'Ayollar kiyimi', name_en: "Women's Clothing" },
    aliases: [
      { marketplace: 'uzum', original_name: 'Ayollar kiyimi' },
      { marketplace: 'ym', original_name: 'Женская одежда' },
      { marketplace: 'wb', original_name: 'Женская одежда' },
    ],
  },
  {
    canonical: { name_ru: 'Детская одежда', name_uz: 'Bolalar kiyimi', name_en: "Kids' Clothing" },
    aliases: [
      { marketplace: 'uzum', original_name: 'Bolalar kiyimi' },
      { marketplace: 'ym', original_name: 'Детская одежда' },
      { marketplace: 'wb', original_name: 'Детская одежда' },
    ],
  },
  {
    canonical: { name_ru: 'Мужская обувь', name_uz: 'Erkaklar poyabzali', name_en: "Men's Shoes" },
    aliases: [
      { marketplace: 'uzum', original_name: 'Erkaklar poyabzali' },
      { marketplace: 'ym', original_name: 'Мужская обувь' },
      { marketplace: 'wb', original_name: 'Мужская обувь' },
    ],
  },
  {
    canonical: { name_ru: 'Женская обувь', name_uz: 'Ayollar poyabzali', name_en: "Women's Shoes" },
    aliases: [
      { marketplace: 'uzum', original_name: 'Ayollar poyabzali' },
      { marketplace: 'ym', original_name: 'Женская обувь' },
      { marketplace: 'wb', original_name: 'Женская обувь' },
    ],
  },
  {
    canonical: { name_ru: 'Сумки', name_uz: 'Sumkalar', name_en: 'Bags' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Sumkalar' },
      { marketplace: 'ym', original_name: 'Сумки' },
      { marketplace: 'wb', original_name: 'Сумки' },
    ],
  },
  {
    canonical: { name_ru: 'Рюкзаки', name_uz: 'Ryukzaklar', name_en: 'Backpacks' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Ryukzaklar' },
      { marketplace: 'ym', original_name: 'Рюкзаки' },
      { marketplace: 'wb', original_name: 'Рюкзаки' },
    ],
  },
  {
    canonical: { name_ru: 'Кошельки', name_uz: 'Hamyonlar', name_en: 'Wallets' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Hamyonlar' },
      { marketplace: 'ym', original_name: 'Кошельки и портмоне' },
      { marketplace: 'wb', original_name: 'Кошельки' },
    ],
  },
  {
    canonical: { name_ru: 'Косметика', name_uz: 'Kosmetika', name_en: 'Cosmetics' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Kosmetika' },
      { marketplace: 'uzum', original_name: 'Dekorativ kosmetika' },
      { marketplace: 'ym', original_name: 'Декоративная косметика' },
      { marketplace: 'wb', original_name: 'Декоративная косметика' },
    ],
  },
  {
    canonical: { name_ru: 'Парфюмерия', name_uz: 'Parfyumeriya', name_en: 'Perfume' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Parfyumeriya' },
      { marketplace: 'uzum', original_name: 'Atirlar' },
      { marketplace: 'ym', original_name: 'Парфюмерия' },
      { marketplace: 'wb', original_name: 'Парфюмерия' },
    ],
  },
  {
    canonical: { name_ru: 'Уход за волосами', name_uz: 'Soch parvarishi', name_en: 'Hair Care' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Soch parvarishi' },
      { marketplace: 'ym', original_name: 'Уход за волосами' },
      { marketplace: 'wb', original_name: 'Уход за волосами' },
    ],
  },
  {
    canonical: { name_ru: 'Уход за кожей', name_uz: 'Teri parvarishi', name_en: 'Skin Care' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Teri parvarishi' },
      { marketplace: 'uzum', original_name: 'Yuz parvarishi' },
      { marketplace: 'ym', original_name: 'Уход за лицом и телом' },
      { marketplace: 'wb', original_name: 'Уход за лицом' },
    ],
  },
  {
    canonical: { name_ru: 'Постельное бельё', name_uz: 'Yotoq choyshablari', name_en: 'Bedding' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Yotoq choyshablari' },
      { marketplace: 'ym', original_name: 'Постельное белье' },
      { marketplace: 'wb', original_name: 'Постельное белье' },
    ],
  },
  {
    canonical: { name_ru: 'Полотенца', name_uz: 'Sochiqlar', name_en: 'Towels' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Sochiqlar' },
      { marketplace: 'ym', original_name: 'Полотенца' },
      { marketplace: 'wb', original_name: 'Полотенца' },
    ],
  },
  {
    canonical: { name_ru: 'Посуда', name_uz: 'Idish-tovoqlar', name_en: 'Kitchenware' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Idish-tovoqlar' },
      { marketplace: 'ym', original_name: 'Посуда' },
      { marketplace: 'wb', original_name: 'Посуда и кухонные принадлежности' },
    ],
  },
  {
    canonical: { name_ru: 'Инструменты', name_uz: 'Asboblar', name_en: 'Tools' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Asboblar' },
      { marketplace: 'uzum', original_name: "Qo'l asboblari" },
      { marketplace: 'ym', original_name: 'Ручной инструмент' },
      { marketplace: 'wb', original_name: 'Инструменты' },
    ],
  },
  {
    canonical: { name_ru: 'Спортивные товары', name_uz: 'Sport tovarlari', name_en: 'Sports Goods' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Sport tovarlari' },
      { marketplace: 'ym', original_name: 'Спорт и отдых' },
      { marketplace: 'wb', original_name: 'Спортивные товары' },
    ],
  },
  {
    canonical: { name_ru: 'Товары для дома', name_uz: 'Uy uchun tovarlar', name_en: 'Home Goods' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Uy uchun tovarlar' },
      { marketplace: 'ym', original_name: 'Товары для дома' },
      { marketplace: 'wb', original_name: 'Товары для дома' },
    ],
  },
  {
    canonical: { name_ru: 'Освещение', name_uz: 'Yoritish', name_en: 'Lighting' },
    aliases: [
      { marketplace: 'uzum', original_name: 'Yoritish' },
      { marketplace: 'uzum', original_name: 'Lampalar' },
      { marketplace: 'ym', original_name: 'Люстры и светильники' },
      { marketplace: 'wb', original_name: 'Освещение' },
    ],
  },
]

async function main() {
  let canonicalsInserted = 0
  let aliasesInserted = 0
  let skipped = 0

  await db.transaction(async (tx) => {
    for (const entry of SEED_DATA) {
      const [row] = await tx
        .insert(categoriesCanonical)
        .values(entry.canonical)
        .onConflictDoNothing()
        .returning({ id: categoriesCanonical.id })

      if (!row) {
        const existing = await tx
          .select({ id: categoriesCanonical.id })
          .from(categoriesCanonical)
          .where(
            eq(categoriesCanonical.name_ru, entry.canonical.name_ru),
          )
          .limit(1)

        if (existing.length === 0) {
          skipped++
          continue
        }

        for (const alias of entry.aliases) {
          const [a] = await tx
            .insert(categoryAliases)
            .values({ canonical_id: existing[0].id, ...alias })
            .onConflictDoNothing()
            .returning({ id: categoryAliases.id })
          if (a) aliasesInserted++
          else skipped++
        }
        skipped++
        continue
      }

      canonicalsInserted++
      for (const alias of entry.aliases) {
        const [a] = await tx
          .insert(categoryAliases)
          .values({ canonical_id: row.id, ...alias })
          .onConflictDoNothing()
          .returning({ id: categoryAliases.id })
        if (a) aliasesInserted++
        else skipped++
      }
    }
  })

  console.log(`Seeded ${canonicalsInserted} canonicals and ${aliasesInserted} aliases (skipped ${skipped} existing).`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
