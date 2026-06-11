# Marketplace Tariffs Reference

Last updated: 2026-06-11

---

## Uzum Market

### Category Commissions

| Category (UZ) | Category (RU) | Rate |
|---|---|---|
| Telefon va gadjetlar | Телефоны и гаджеты | 5% |
| Kompyuter va noutbuklar | Компьютеры и ноутбуки | 5% |
| Elektronika | Электроника | 6% |
| Kiyim (ayollar) | Одежда (женская) | 8% |
| Kiyim (erkaklar) | Одежда (мужская) | 8% |
| Kiyim (bolalar) | Одежда (детская) | 9% |
| Poyabzal | Обувь | 7% |
| Go'zallik va parvarish | Красота и уход | 10% |
| Maishiy texnika (katta) | Крупная бытовая техника | 10% |
| Maishiy texnika (kichik) | Мелкая бытовая техника | 10% |
| Uy va bog' | Дом и сад | 11% |
| Sport va turizm | Спорт и туризм | 9% |
| Avtomobil tovarlari | Автотовары | 12% |
| Oziq-ovqat | Продукты питания | 10% |
| O'yinchoqlar | Игрушки | 6% |
| Boshqa toifalar | Прочие категории | 10% |

### Logistics Fee (from 01.06.2026)

Volume formula: `(length_mm × width_mm × height_mm) ÷ 1,000,000` = volume in litres (rounded UP)

| Condition | Fee |
|---|---|
| ≤ 1 litre | 5,250 sum |
| Each additional litre above 1st | + 250 sum |
| Maximum fee | 50,000 sum |
| Without dimensions data | 50,000 sum |
| SIM cards | fixed 20,000 sum |

**Formula:** `min(50000, volume <= 1 ? 5250 : 5250 + (ceil(volume) - 1) * 250)`

**Example:** Microwave 500×380×300 mm → 57 litres → 5,250 + 56×250 = 19,250 sum

### Payout Schedule Fees

| Schedule | Fee |
|---|---|
| Daily | 1.5% |
| Weekly | 1.0% |
| Bi-weekly (2× per month) | 0% |
| Monthly | 0% |
| Emergency early withdrawal | 2.5% |

> Default for new sellers: bi-weekly (0%).

---

## Wildberries UZ

> Full tariff table: 7,418 rows in `commission.xlsx` (WB warehouse / FBY rates).

### Key Category Rates

| Category (UZ) | Category (RU) | Rate |
|---|---|---|
| Smartfonlar | Смартфоны | 3% |
| Planshetlar | Планшеты | 5% |
| Noutbuklar | Ноутбуки | 5% |
| Kompyuterlar | Компьютеры | 9.5% |
| Aqlli soat va fitness | Смарт-часы и фитнес-трекеры | 14.5% |
| Elektronika aksessuarlari | Аксессуары для электроники | 20% |
| Maishiy texnika | Бытовая техника | 14% |
| Kiyim | Одежда | 23% |
| Ichki kiyim | Нижнее бельё | 23% |
| Sport kiyimi | Спортивная одежда | 23% |
| Poyabzal | Обувь | 18% |
| Sport jihozlari va aksessuarlar | Спорттовары и аксессуары | 18% |
| Go'zallik va parvarish | Красота и уход | 18% |
| Uy tekstili va interer | Текстиль для дома и декор | 19% |
| O'yinchoqlar | Игрушки | 18% |
| Oziq-ovqat | Продукты питания | 11% |
| Avtomobil qismlari | Автозапчасти | 8% |
| Bolalar kiyimi va mahsulotlari | Детская одежда и товары | 8% |
| Boshqa | Другое | 17% |

---

## Yandex Market Go UZ

Source: partner.market.yandex.uz (official tariff table)

### Category Commissions

| Category (UZ) | Category (RU) | Rate |
|---|---|---|
| Apple mahsulotlari | Продукция Apple | 1.5% |
| Smartfonlar va telefonlar | Смартфоны и телефоны | 4% |
| Noutbuk va kompyuterlar | Ноутбуки и компьютеры | 4% |
| Elektronika va aksessuarlar | Электроника и аксессуары | 5% |
| Maishiy texnika | Бытовая техника | 6% |
| Avtomobil va ehtiyot qismlar | Автотовары и запчасти | 8% |
| Go'zallik va parvarish | Красота и уход | 10% |
| Uy, oshxona va mebel | Дом, кухня и мебель | 11% |
| Kiyim, poyabzal va sumkalar | Одежда, обувь и сумки | 12% |

### Payment Processing by Payout Frequency

| Frequency | Fee |
|---|---|
| Daily | 1.5% |
| Weekly | 1.0% |
| Bi-weekly | 0.5% |
| Monthly | 0% |

### FBY / FBS Delivery Tariff (weight-based)

| Weight | FBY Fee | FBS Fee |
|---|---|---|
| Up to 0.5 kg | — | — |
| Up to 1 kg | — | — |
| Up to 5 kg | — | — |
| Up to 10 kg | — | — |
| Up to 25 kg | — | — |

> Official rates vary by region and change periodically. See partner.market.yandex.uz for current figures.

### Storage Fees

| Period | Fee |
|---|---|
| 0–60 days | Free |
| 61–90 days | 15 sum / litre / day |
| 91+ days | 30 sum / litre / day |
