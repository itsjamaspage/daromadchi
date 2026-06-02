export interface Article {
  slug: string
  title: string
  category: string
  categorySlug: string
  summary: string
  content: string
}

export interface Category {
  slug: string
  title: string
  icon: string
  articles: Article[]
}

const ARTICLES: Article[] = [
  // ───────────────────────────────────────────────
  // CATEGORY 1: Boshlash
  // ───────────────────────────────────────────────
  {
    slug: 'tez-boshlash',
    title: "Tez boshlash bo'yicha qo'llanma",
    category: 'Boshlash',
    categorySlug: 'boshlash',
    summary: "Daromadchi'da ro'yxatdan o'tishdan boshlab birinchi tahlilgacha — 4 qadamda.",
    content: `
## Xush kelibsiz!

Daromadchi — Uzum Market, Yandex Market va Wildberries sotuvchilari uchun to'liq analitika platformasi. Quyidagi 4 qadam orqali platformadan foydalanishni boshlashingiz mumkin.

## 1-qadam: Hisob yaratish

Ro'yxatdan o'tish sahifasiga o'ting va email manzilingiz hamda parol bilan hisob yarating. Tasdiqlash havolasi email manzilingizga yuboriladi.

<info>Hisob yaratish bepul va kredit karta talab qilinmaydi.</info>

## 2-qadam: API tokenini kiritish

Hisobingizga kirganingizdan so'ng **Sozlamalar → API Token** bo'limiga o'ting. Uzum Market kabineti (\`seller.uzum.uz\`) dan API tokeningizni nusxalab, qo'ying.

- seller.uzum.uz → Profil → API kalitlari
- Tokenni nusxalab oling
- Daromadchi Sozlamalar sahifasiga yapıştırın va Saqlang tugmasini bosing

## 3-qadam: Ma'lumotlarni sinxronizatsiya qilish

Token kiritilgandan so'ng **"Sinxronizatsiya"** tugmasini bosing. Platforma quyidagilarni yuklab oladi:

- Barcha mahsulotlar va SKU'lar
- So'nggi 90 kunlik buyurtmalar
- Reklama kampaniyalari va xarajatlar
- Qoldiq ma'lumotlari

Birinchi sinxronizatsiya 1-3 daqiqa davom etishi mumkin.

## 4-qadam: Tahlilni boshlang

Sinxronizatsiya tugagach, dashboard'da barcha ko'rsatkichlar tayyor bo'ladi:

- **DRR** (Reklama xarajatlari ulushi)
- **Foyda** har bir mahsulot bo'yicha
- **Qoldiq** va necha kun qolganini ko'rsatadi
- **P&L hisobot** oylik tushum va xarajatlar

<info>Ma'lumotlar har 4 soatda avtomatik yangilanadi.</info>
`,
  },
  {
    slug: 'malumotlar-sinxronizatsiyasi',
    title: "Ma'lumotlar sinxronizatsiyasi qanday ishlaydi",
    category: 'Boshlash',
    categorySlug: 'boshlash',
    summary: "Avtomatik va qo'lda sinxronizatsiya, qanday ma'lumotlar yuklanishi haqida.",
    content: `
## Sinxronizatsiya jarayoni

Daromadchi ma'lumotlarni Uzum Market API orqali oladi. Platforma ikkita sinxronizatsiya rejimini qo'llab-quvvatlaydi.

## Avtomatik sinxronizatsiya

Ma'lumotlar **har 4 soatda** avtomatik ravishda yangilanadi:

- 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (Toshkent vaqti)
- Yangilanish vaqtida dashboard o'ng yuqori burchagida indikator ko'rinadi

## Qo'lda sinxronizatsiya

Dashboard sahifasida **"Yangilash"** tugmasi orqali istalgan vaqt sinxronizatsiyani ishga tushirishingiz mumkin.

<info>Qo'lda sinxronizatsiya kuniga 10 martadan ko'p bosib bo'lmaydi (Pro tarif).</info>

## Qanday ma'lumotlar yuklanadi?

| Ma'lumot turi | Yangilanish chastotasi |
|---|---|
| Mahsulotlar va SKU'lar | Har sinxronizatsiyada |
| Buyurtmalar (so'nggi 90 kun) | Har sinxronizatsiyada |
| Reklama kampaniyalari | Har sinxronizatsiyada |
| Qoldiq miqdori | Har sinxronizatsiyada |
| Narxlar | Har sinxronizatsiyada |

## Sinxronizatsiya xatosi

Agar sinxronizatsiya muvaffaqiyatsiz bo'lsa:
1. API tokeningiz hali ham aktiv ekanligini tekshiring
2. seller.uzum.uz hisobingizga kiring va tokenni yangilang
3. Yangi tokenni Daromadchi Sozlamalar sahifasida yangilang

<warning>Token eskirgan yoki bekor qilingan bo'lsa, ma'lumotlar yangilanmaydi.</warning>
`,
  },
  {
    slug: 'fikr-va-xato',
    title: "Fikr bildirish va xato haqida xabar berish",
    category: 'Boshlash',
    categorySlug: 'boshlash',
    summary: 'Xato topasiz yoki taklif bormi? Qanday xabar berishingiz mumkin.',
    content: `
## Fikrlaringiz bizga muhim

Platformani yaxshilash uchun sizning fikrlaringizga muhtojmiz. Muammo yoki taklif bo'lsa, quyidagi yo'llar orqali bizga yetkazishingiz mumkin.

## Telegram orqali

Eng tezkor yo'l — Telegram kanalimiz:

- Kanal: **@daromadchi_uz**
- Support bot: **@daromadchi_support_bot**
- Ish vaqti: 9:00 – 22:00 (Toshkent)

## Email orqali

Batafsil muammo yoki texnik xatolik uchun:

**support@daromadchi.uz**

Xabar yozishda quyidagilarni qo'shing:
1. Muammo qanday yuz berdi?
2. Qaysi sahifada?
3. Ekran skrinshotini biriktiring

## Ilova ichidagi feedback

Dashboard'ning pastki o'ng burchagidagi **"Fikr bildirish"** tugmasini bosing. Forma to'ldirib, to'g'ridan-to'g'ri yuboring.

<info>Xato xabarlarini iloji boricha tezroq ko'rib chiqamiz. Odatda 24 soat ichida javob beramiz.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 2: Bildirishnomalar
  // ───────────────────────────────────────────────
  {
    slug: 'bildirishnomalar',
    title: 'Bildirishnoma turlari va sozlamalar',
    category: 'Bildirishnomalar',
    categorySlug: 'bildirishnomalar',
    summary: "Qaysi bildirishnomalar bor va ularni qanday sozlash mumkin.",
    content: `
## Bildirishnomalar nima?

Daromadchi muhim hodisalar haqida avtomatik bildirishnomalar yuboradi. Bu sizga do'koningizni kuzatib borishga va muammolarga tezda munosabat bildirishga yordam beradi.

## Bildirishnoma turlari

### 1. Kam qoldiq ogohlantirishlar
Mahsulot qoldig'i belgilangan chegaradan past tushganda:
- Chegara: 3-30 kun (siz sozlaysiz)
- Qaysi SKU va qancha qoldigini ko'rsatadi

### 2. Reklama sarfi oshib ketishi
Kunlik reklama byudjetingiz belgilangan chegaradan oshganda:
- Misol: Kunlik byudjet 500,000 so'm bo'lsa, 90% ga yetganda xabar beriladi

### 3. Savdo tushishi
So'nggi 7 kun solishtirganda savdo hajmi keskin pasayganda:
- Chegara: -20%, -30%, -50% (siz tanlaysiz)

### 4. Yangi buyurtmalar
Har yangi buyurtma kelganda xabar (tavsiya qilinmaydi — ko'p bo'lishi mumkin).

### 5. Kunlik hisobot
Har kuni belgilangan vaqtda qisqa hisobot:
- Tushum, buyurtmalar soni, DRR, qoldiq holati

## Sozlash

**Dashboard → Sozlamalar → Bildirishnomalar** bo'limiga o'ting:

1. Har bir tur uchun toggle bilan yoqing/o'chiring
2. Chegara qiymatlarini kiriting
3. Kunlik hisobot vaqtini tanlang
4. "Saqlash" tugmasini bosing

<info>Bildirishnomalar Telegram orqali yetkaziladi. Avval Telegram'ni ulash kerak.</info>
`,
  },
  {
    slug: 'telegram-ulash',
    title: "Telegram botini ulash",
    category: 'Bildirishnomalar',
    categorySlug: 'bildirishnomalar',
    summary: "Daromadchi bildirishnomalarini Telegram orqali qabul qilish uchun botni ulash.",
    content: `
## Telegram bot ulash

Bildirishnomalar Telegram orqali yuboriladi. Ulash uchun quyidagi qadamlarni bajaring.

## Ulash qadamlari

### 1-qadam: Token oling
**Dashboard → Sozlamalar → Bildirishnomalar** sahifasiga o'ting. "Telegram ulash" bo'limida shaxsiy token ko'rsatiladi (masalan: \`drm_abc123xyz\`).

### 2-qadam: Botga o'ting
Telegram'da **@daromadchi_bot** ni toping yoki quyidagi havolani bosing.

### 3-qadam: Botni ishga tushiring
Botga quyidagi xabarni yuboring:

\`/start drm_abc123xyz\`

(drm_abc123xyz o'rniga o'z tokeningizni yozing)

### 4-qadam: Tasdiqlash
Bot "Muvaffaqiyatli ulandi!" degan xabar yuboradi. Daromadchi sahifasi avtomatik yangilanadi.

<info>Bir hisobga bir nechta Telegram hisob ulash mumkin emas.</info>

## Ulanishni uzish

Sozlamalar → Bildirishnomalar → "Telegram'dan uzish" tugmasini bosing.

## Muammo bo'lsa

- Tokenni noto'g'ri kiritganingizni tekshiring
- Token bir marta ishlatiladi — qayta ulanish uchun yangi token oling
- Bot bloklangan bo'lsa, blokdan chiqarib qayta boshlang
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 3: Chrome Kengaytmasi
  // ───────────────────────────────────────────────
  {
    slug: 'chrome-kengaytma',
    title: "Chrome kengaytmasi haqida",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Uzum Market sahifalarida to'g'ridan-to'g'ri tahlil ko'rsatuvchi kengaytma.",
    content: `
## Chrome kengaytmasi nima?

Daromadchi Chrome kengaytmasi — Uzum Market sotuvchi kabinetida ishlayotganingizda to'g'ridan-to'g'ri tahlil ma'lumotlarini ko'rsatuvchi vosita.

## Nima uchun kerak?

Uzum Market kabinetini ochganda, Daromadchi ma'lumotlarini alohida tab'da ochmasdan ham ko'rishingiz mumkin:

- Mahsulot sahifasida DRR ko'rinadi
- Qoldiq va necha kun qolishi
- Joriy narx va foyda marjasi
- Raqobatchi narxlari

## Qanday ishlaydi?

1. Chrome'ga kengaytma o'rnatiladi
2. seller.uzum.uz saytiga kirasiz
3. Kengaytma sahifa ma'lumotlarini o'qib, Daromadchi hisobingizdan tahlil qo'shadi
4. Mahsulot kartasi yonida widget (mini panel) paydo bo'ladi

<info>Kengaytma faqat Chrome va Chromium-based brauzerlarda ishlaydi (Edge, Brave, Opera).</info>

## Xavfsizlik

Kengaytma faqat seller.uzum.uz domenida ishlaydi. Boshqa saytlarda hech qanday ma'lumot o'qimaydi.
`,
  },
  {
    slug: 'vidzhet-nima-korsatadi',
    title: "Widget nima ko'rsatadi",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Uzum Market kabinetida paydo bo'ladigan Daromadchi widget mazmuni.",
    content: `
## Widget tarkibi

Daromadchi Chrome kengaytmasi yoqilganda, seller.uzum.uz mahsulot sahifalarida mini widget ko'rinadi. Widget quyidagi ma'lumotlarni o'z ichiga oladi:

## Asosiy ko'rsatkichlar

| Ko'rsatkich | Tavsif |
|---|---|
| DRR | Reklama xarajatlari ulushi (%) |
| Joriy narx | Hozirgi sotuv narxi |
| Tannarx | Siz kiritgan tannarx |
| Foyda/dona | Har bir sotilgan mahsulotdan tushum |
| Marja | Foyda % |
| Qoldiq | Ombordagi miqdor |
| Kunlar qoldi | Joriy savdo tezligiga ko'ra qoldiq davomiyligi |

## Reklama ma'lumotlari

- Aktiv kampaniyalar soni
- Bugungi reklama sarfi
- CPC (bir klik narxi)
- CPO (bir buyurtma narxi)

## Raqobatchilar

Agar shu mahsulot uchun bozor tahlili mavjud bo'lsa:
- Eng arzon raqobatchi narxi
- Kategoriya o'rtacha narxi

<info>Widget ma'lumotlari oxirgi sinxronizatsiyaga asoslanadi. Eng yangi ma'lumot uchun sinxronizatsiyani yangilang.</info>
`,
  },
  {
    slug: 'vidzhet-ornatish',
    title: "Kengaytmani o'rnatish",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Chrome kengaytmasini o'rnatish va sozlash bo'yicha qo'llanma.",
    content: `
## O'rnatish qadamlari

### 1. Chrome Web Store'dan o'rnatish

1. Chrome Web Store'ni oching
2. "Daromadchi" deb qidiring
3. "Chrome'ga qo'shish" tugmasini bosing
4. Ruxsatlarni tasdiqlang

### 2. Hisobingizga kiring

Kengaytma belgisini bosing (brauzer o'ng yuqori burchagi) va Daromadchi hisob ma'lumotlaringizni kiriting.

### 3. Ruxsatlarni bering

Kengaytma uchun quyidagi ruxsatlar kerak:
- seller.uzum.uz domenida ma'lumot o'qish
- Daromadchi serveriga so'rov yuborish

<warning>Kengaytma faqat siz tanlagan domenlarda ishlaydi. Boshqa saytlarda faol emas.</warning>

### 4. Tekshirib ko'ring

seller.uzum.uz → Mahsulotlar sahifasiga o'ting. Har bir mahsulot yonida Daromadchi widget belgisi ko'rinishi kerak.

## Muammo bo'lsa

- Brauzerni qayta ishga tushiring
- Kengaytmani o'chirib, qayta yoqing
- Chrome → Ko'proq vositalar → Kengaytmalar → Daromadchi → Tafsilotlar
`,
  },
  {
    slug: 'qurilmalar-boshqaruvi',
    title: "Qurilmalar boshqaruvi",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Bir nechta qurilmada o'rnatilgan kengaytmalarni boshqarish.",
    content: `
## Qurilmalar ro'yxati

Bir hisobga bir nechta qurilmada Chrome kengaytmasini ulashingiz mumkin.

**Sozlamalar → Chrome Kengaytmasi → Qurilmalar** bo'limida barcha ulangan qurilmalar ko'rinadi.

## Ko'rsatilgan ma'lumotlar

Har bir qurilma uchun:
- Qurilma nomi va brauzer versiyasi
- Operatsion tizim
- Oxirgi faollik vaqti
- Holat: Aktiv / Nofaol

## Qurilmani o'chirish

Eski yoki ishlatilmaydigan qurilmani ro'yxatdan chiqarish uchun "O'chirish" tugmasini bosing. Bu qurilmadagi kengaytma hisobdan uziladi.

<info>Maksimum 5 ta qurilma ulanishi mumkin (Pro tarif). Pro tarifda cheksiz.</info>

## Barcha qurilmalardan chiqish

"Barchadan chiqish" tugmasi barcha qurilmalardagi sessiyalarni tugatadi. Keyin har bir qurilmada qayta kirishingiz kerak.
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 4: Reklama Tahlili
  // ───────────────────────────────────────────────
  {
    slug: 'reklama-tahlili',
    title: "Reklama tahlili asoslari",
    category: 'Reklama Tahlili',
    categorySlug: 'reklama-tahlili',
    summary: "DRR, CPC, CPO ko'rsatkichlari va reklama samaradorligini baholash.",
    content: `
## Reklama tahlili nima?

Reklama tahlili — reklama xarajatlaringiz qanchalik samarali ekanini o'lchovchi ko'rsatkichlar to'plami. Daromadchi avtomatik ravishda barcha asosiy ko'rsatkichlarni hisoblaydi.

## Asosiy ko'rsatkichlar

### DRR (Reklama xarajatlari ulushi)
\`DRR = Reklama xarajati / Tushum × 100\`

- **DRR < 10%** — yaxshi
- **DRR 10-20%** — qabul qilinarli
- **DRR > 20%** — yuqori, kampaniyani tekshirish kerak

### CPC (Bir klik narxi)
\`CPC = Umumiy xarajat / Kliklar soni\`

### CPO (Bir buyurtma narxi)
\`CPO = Umumiy xarajat / Buyurtmalar soni\`

### ROAS (Reklama daromadi)
\`ROAS = Tushum / Reklama xarajati\`

ROAS > 5 bo'lishi tavsiya etiladi.

## Kampaniyalar jadvali

Dashboard → Tahlil → Kampaniyalar bo'limida barcha aktiv va nofaol kampaniyalar, ularning ko'rsatkichlari jadvalda ko'rinadi.

## Samarasiz xarajatlarni aniqlash

Daromadchi avtomatik ravishda quyidagi holatlarni belgilaydi:
- Klik bor, lekin buyurtma yo'q
- DRR 30% dan yuqori kampaniyalar
- Byudjet tugab qolgan kampaniyalar

<info>Reklama ma'lumotlari Uzum Market API orqali olinadi va har sinxronizatsiyada yangilanadi.</info>
`,
  },
  {
    slug: 'drr-nima',
    title: "DRR nima va qanday pasaytirish mumkin",
    category: 'Reklama Tahlili',
    categorySlug: 'reklama-tahlili',
    summary: "DRR ko'rsatkichi va uni optimallashtirish usullari.",
    content: `
## DRR nima?

**DRR** (Доля Рекламных Расходов) — reklama xarajatlarining tushum ulushi. Ruscha qisqartma bo'lsa-da, Uzum Market va Daromadchi unda foydalanadi.

**Formula:** \`DRR = Reklama xarajati / Tushum × 100\`

**Misol:** 1,000,000 so'm tushum, 80,000 so'm reklama → DRR = 8%

## Ideal DRR qanday?

Kategoriyaga qarab farq qiladi:

| Kategoriya | Tavsiya etilgan DRR |
|---|---|
| Elektronika | 5-10% |
| Kiyim | 8-15% |
| Uy jihozlari | 6-12% |
| Oziq-ovqat | 3-8% |
| Kosmetika | 10-18% |

## DRR ni pasaytirish usullari

### 1. Kampaniya maqsadini o'zgartirish
Klik uchun emas, buyurtma uchun to'lash (CPC → CPO)

### 2. Samarasiz kalit so'zlarni o'chirish
Ko'p klik keltirib, buyurtma keltirmaydigan kalit so'zlar

### 3. Vaqt moslashtirishini sozlash
Sotuvlar oz bo'lgan vaqtlarda reklama byudjetini pasaytirish

### 4. Narxni tekshirish
Raqobatchilar arzonroq sotayotgan bo'lsa, narxni moslang

### 5. Mahsulot rasmlarini yaxshilash
Yaxshi rasm CTR ni oshiradi — bir xil xarajatda ko'proq buyurtma

<info>Daromadchi DRR ni automatik hisoblaydi va yuqori DRR bo'lgan kampaniyalarni sariq/qizil rang bilan belgilaydi.</info>
`,
  },
  {
    slug: 'samarasiz-xarajatlar',
    title: "Samarasiz reklama xarajatlarini aniqlash",
    category: 'Reklama Tahlili',
    categorySlug: 'reklama-tahlili',
    summary: "Qaysi reklama xarajatlari foyda keltirmaydi va nima qilish kerak.",
    content: `
## Samarasiz xarajatlar nima?

Samarasiz reklama xarajati — pul ketgan, lekin buyurtmaga aylanmagan kliklar va ko'rsatuvlar.

## Daromadchi qanday aniqlaydi?

Platforma avtomatik ravishda quyidagi holatlarga e'tibor beradi:

### 1. Yuqori CPC, past konversiya
Klik uchun ko'p pul to'lanayotgan, lekin oz buyurtma keladigan kampaniyalar.

### 2. Zero-order kampaniyalar
So'nggi 7 kunda hech buyurtma keltirmagan, lekin pul sarflanayotgan kampaniyalar.

### 3. Eski mahsulotlar reklamasi
Omborda qoldig'i tugayotgan mahsulotlarga reklama sarflash.

### 4. DRR > 30% bo'lgan kampaniyalar
Daromadchi bularni "Diqqat" deb belgilaydi.

## Nima qilish kerak?

1. **Kampaniyalar** jadvalida "Samarasiz" filterni qo'llang
2. Har bir samarasiz kampaniyani ko'rib chiqing
3. Kalit so'zlar ro'yxatini yangilang yoki kampaniyani to'xtatib qo'ying

<warning>Barcha kam konversiyali kampaniyalarni to'xtatib qo'ymang — ba'zilari brend recognitionga xizmat qilishi mumkin.</warning>
`,
  },
  {
    slug: 'kampaniya-byudjeti',
    title: "Reklama byudjetini boshqarish",
    category: 'Reklama Tahlili',
    categorySlug: 'reklama-tahlili',
    summary: "Reklama byudjetini qanday rejalashtirish va nazorat qilish.",
    content: `
## Byudjet boshqaruvi

Daromadchi reklama byudjetingizni nazorat qilishga yordam beradi, lekin byudjetni to'g'ridan-to'g'ri Uzum Market kabinetida sozlash kerak.

## Byudjet kuzatuvi

**Dashboard → Tahlil → Kampaniyalar** bo'limida:
- Har bir kampaniyaning kunlik byudjeti
- Shu kun sarflangan miqdor
- Byudjet tugash vaqti (taxminiy)

## Bildirishnoma sozlash

Byudjet 80% yoki 90% ga yetganda Telegram orqali ogohlantirish olish uchun:

**Sozlamalar → Bildirishnomalar → Reklama sarfi** bo'limida chegara kiriting.

## Byudjet tavsiyalari

Daromadchi quyidagi formulani tavsiya etadi:

\`Optimal byudjet = O'rtacha CPO × Maqsadli buyurtmalar soni\`

**Misol:** CPO = 15,000 so'm, maqsad = 10 buyurtma/kun → byudjet = 150,000 so'm/kun

## Mavsumiy o'zgarishlar

Bayrам kunlari va mavsumiy aksiyalarda byudjetni 1.5-2x ga oshirish tavsiya etiladi.

<info>Reklama byudjetini to'g'ridan-to'g'ri seller.uzum.uz → Reklama bo'limida o'zgartiring.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 5: Qoldiqlar va Buyurtmalar
  // ───────────────────────────────────────────────
  {
    slug: 'qoldiq-boshqaruvi',
    title: "Qoldiqlarni boshqarish",
    category: 'Qoldiqlar',
    categorySlug: 'qoldiqlar',
    summary: "Ombordagi mahsulot qoldiqlari, darajalar va ogohlantirish tizimi.",
    content: `
## Qoldiqlarni boshqarish

Daromadchi qoldiqlaringizni savdo tezligiga ko'ra kuzatib, qachon yangi mahsulot buyurtma qilish kerakligini aytadi.

## Qoldiq darajalari

Har bir mahsulot uchun qoldiq davomiyligi hisoblanadi:

\`Kunlar = Qoldiq miqdori / O'rtacha kunlik savdo\`

| Daraja | Kunlar | Rang |
|---|---|---|
| **A** | 30+ kun | Yashil |
| **B** | 15-30 kun | Ko'k |
| **C** | 7-15 kun | Sariq |
| **D** | 7 kundan kam | Qizil |

## FBO / FBS bo'yicha ko'rish

Uzum Market'da ikki turdagi qoldiq mavjud:

- **FBO** — Uzum omborida saqlanayotgan mahsulotlar
- **FBS** — Sizning omboringizda saqlanayotgan mahsulotlar

Mahsulotlar jadvalida ikkala tur alohida ko'rsatiladi.

## Ogohlantirish sozlash

**Sozlamalar → Bildirishnomalar → Kam qoldiq** bo'limida:
1. Minimal kun chegarasini kiriting (masalan: 7 kun)
2. Qaysi mahsulot turlari uchun ogohlantirish olishni tanlang
3. Saqlang

<info>Qoldiq ma'lumotlari Uzum Market API orqali olinadi. FBO ombori uchun real-vaqt ma'lumotlari mavjud.</info>
`,
  },
  {
    slug: 'qoldiq-ogohlantirish',
    title: "Qoldiq ogohlantirishlari",
    category: 'Qoldiqlar',
    categorySlug: 'qoldiqlar',
    summary: "Kam qoldiq ogohlantirishlarini sozlash va Telegram orqali qabul qilish.",
    content: `
## Qoldiq ogohlantirishlari

Ombordagi mahsulot qoldig'i belgilangan chegaradan past tushganda Daromadchi avtomatik Telegram xabari yuboradi.

## Ogohlantirish sozlamalari

**Sozlamalar → Bildirishnomalar** sahifasida:

- **Minimum kun chegarasi**: Necha kun qolganida ogohlantirish berilsin (standart: 7 kun)
- **Minimum miqdor**: Necha dona qolganida ogohlantirish (standart: 10 dona)
- **Mahsulot guruhlari**: Barcha mahsulotlar yoki faqat tanlanganlar

## Xabar ko'rinishi

Telegram'da bunday xabar keladi:

\`⚠️ Kam qoldiq: [Mahsulot nomi]\`
\`Qoldiq: 15 dona (5 kun)\`
\`So'nggi sotuv: 3 dona/kun\`

## Bir nechta ogohlantirish

Bir mahsulot uchun 2 ta chegara sozlashingiz mumkin:
1. **Birinchi ogohlantirish** — 14 kun (buyurtma berish vaqti)
2. **Shoshilinch ogohlantirish** — 5 kun (zudlik bilan buyurtma)

<warning>Ogohlantirish ishlashi uchun Telegram bot ulanishi shart.</warning>
`,
  },
  {
    slug: 'fbo-fbs-rfbs',
    title: "FBO, FBS va rFBS farqlari",
    category: 'Qoldiqlar',
    categorySlug: 'qoldiqlar',
    summary: "Uzum Market'da turli ombor modellarining farqlari va Daromadchi'da ko'rish.",
    content: `
## Ombor modellari

Uzum Market'da mahsulotlarni sotishning uch asosiy modeli mavjud:

## FBO (Fulfillment by Operator)

**Uzum ombori** — mahsulotlar Uzum Market omborida saqlanadi va yetkazib berish Uzum tomonidan amalga oshiriladi.

- Tezroq yetkazib berish
- Uzum omboriga etkazib berish kerak
- Qo'shimcha saqlash xarajatlari

## FBS (Fulfillment by Seller)

**Sotuvchi ombori** — mahsulotlar sizning omboringizda, Uzum buyurtma kelib qolsagina yetkazishingiz kerak.

- Saqlash to'liq nazorat ostida
- O'zingiz yetkazib berasiz
- Ko'proq moslashuvchanlik

## rFBS (Real-time FBS)

FBS ning yangilangan versiyasi — real vaqt buyurtma boshqaruvi bilan.

## Daromadchi'da ko'rish

**Mahsulotlar → [Mahsulot]** sahifasida FBO va FBS qoldiqlar alohida ko'rsatiladi:

| Model | Qoldiq | Kunlar |
|---|---|---|
| FBO | 150 dona | 22 kun |
| FBS | 80 dona | 12 kun |

<info>Jami qoldiq = FBO + FBS. Ogohlantirish jami qoldig'ga qarab beriladi.</info>
`,
  },
  {
    slug: 'tovar-aylanmasi',
    title: "Tovar aylanmasi va buyurtma prognozi",
    category: 'Qoldiqlar',
    categorySlug: 'qoldiqlar',
    summary: "Qoldiqlarning aylanish tezligi va keyingi buyurtma vaqtini hisoblash.",
    content: `
## Tovar aylanmasi nima?

Tovar aylanmasi — mahsulot qanchalik tez sotilishini ko'rsatuvchi ko'rsatkich.

\`Aylanma = Sotilgan miqdor / O'rtacha qoldiq\`

## Daromadchi'da hisoblash

Platforma har bir mahsulot uchun quyidagi davrlar bo'yicha hisoblaydi:
- So'nggi 7 kun o'rtacha kunlik savdo
- So'nggi 30 kun o'rtacha kunlik savdo
- Mavsumiy koeffitsient (agar mavjud bo'lsa)

## Buyurtma prognozi

Joriy qoldiq va savdo tezligiga ko'ra Daromadchi hisoblaydi:

\`Buyurtma berish sanasi = Bugun + (Qoldiq / Kunlik savdo) - Yetkazib berish vaqti\`

**Misol:**
- Qoldiq: 100 dona
- Kunlik savdo: 5 dona
- Yetkazib berish: 5 kun
- **Buyurtma berish sanasi: 15 kunda**

## Mavsumiy o'zgarishlar

Bayramlar va mavsumga ko'ra savdo ko'tarilishi mumkin. Daromadchi o'tgan yilgi ma'lumotlarga asoslanib prognoz qiladi.

<info>Prognoz taxminiy. Mahsulot ma'lumotlari qanchalik ko'p bo'lsa, prognoz shunchalik aniq bo'ladi.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 6: Birlik Iqtisodiyoti
  // ───────────────────────────────────────────────
  {
    slug: 'birlik-iqtisodiyoti',
    title: "Birlik iqtisodiyoti kalkulyatori",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "Har bir mahsulot uchun sof foyda, marja va zararсizlik narxini hisoblash.",
    content: `
## Birlik iqtisodiyoti nima?

Birlik iqtisodiyoti (Unit Economics) — bir dona mahsulotni sotishdan qanchalik foyda olishini batafsil ko'rsatuvchi hisob-kitob tizimi.

## Kalkulyator qanday ishlaydi?

**Dashboard → Kalkulyator** bo'limiga o'ting. Quyidagi ma'lumotlarni kiriting:

### Daromad
- Sotuv narxi

### Xarajatlar
- Tannarx (tovar narxi)
- Uzum komissiyasi (%)
- Yetkazib berish xarajati
- Qaytarish xarajati
- Qadoqlash
- Reklama xarajati (DRR asosida)
- Soliq (%)

## Natijalar

Kalkulyator hisoblaydi:
- **Sof foyda** — barcha xarajatlar chegilgandan keyin
- **Marja** — foyda %
- **Zararсizlik narxi** — minimal sotuv narxi
- **Maqsadli narx** — 20% marja uchun tavsiya

## Logistika sozlamalari

Uzum Market yetkazib berish tariflarini tizimga kiriting yoki avtomatik hisoblash uchun "Uzum tarifi" ni tanlang.

<info>Kalkulyator natijalarini saqlash va boshqa mahsulotlar bilan taqqoslash mumkin.</info>
`,
  },
  {
    slug: 'zararсizlik-narxi',
    title: "Zararсizlik narxi (breakeven) hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "Mahsulot uchun minimal foydali sotuv narxini aniqlash.",
    content: `
## Zararсizlik narxi nima?

Zararсizlik narxi — barcha xarajatlarni qoplash uchun mahsulotni kamida shuncha narxda sotish kerak bo'lgan qiymat. Bu narxdan past sotish zarar demak.

## Formula

\`Zararсizlik = Tannarx + Komissiya + Logistika + Reklama + Boshqa xarajatlar\`

## Daromadchi'da hisoblash

Kalkulyatorga quyidagilarni kiriting:

1. **Tannarx** — olish narxi
2. **Uzum komissiyasi** — kategoriyaga qarab 5-25%
3. **FBO logistika** — og'irlik va o'lchamga qarab
4. **Qaytarish xarajati** — taxminan 5-10% qaytarish hisobga olinadi
5. **Reklama** — maqsadli DRR asosida

## Maqsadli foyda

Zararсizlik narxiga maqsadli foydangizni qo'shing:

\`Sotuv narxi = Zararсizlik × (1 + Maqsadli marja / 100)\`

**Misol:**
- Zararсizlik: 45,000 so'm
- Maqsad: 20% marja
- **Sotuv narxi: 54,000 so'm**

<info>Daromadchi avtomatik ravishda Uzum komissiyasini kategoriyaga qarab hisoblaydi.</info>
`,
  },
  {
    slug: 'marja-hisoblash',
    title: "Foyda marjasini hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "Mahsulot va do'kon darajasida foyda marjasi ko'rsatkichlari.",
    content: `
## Marja turlari

### Yalpi marja (Gross Margin)
\`Yalpi marja = (Sotuv narxi - Tannarx) / Sotuv narxi × 100\`

### Operatsion marja
Yalpi marjadan operatsion xarajatlar (reklama, logistika, komissiyalar) chegilgandan keyin.

### Sof marja (Net Margin)
Barcha xarajatlar, soliqlar va to'lovlardan keyin qolgan foyda ulushi.

## Daromadchi'da qayerda ko'rish mumkin?

### Mahsulotlar jadvalida
Har bir mahsulot qatorida marja % ko'rsatiladi.

### P&L hisobotda
Oylik va haftalik marja tendentsiyalari grafik shaklida.

### Kalkulyatorda
Kiruvchi ma'lumotlarga asoslanib real-vaqt hisoblash.

## Ideal marja qancha?

| Kategoriya | Minimal marja | Tavsiya etilgan |
|---|---|---|
| Elektronika | 8% | 15-20% |
| Kiyim | 20% | 35-50% |
| Kosmetika | 25% | 40-60% |
| Uy jihozlari | 15% | 25-35% |

<info>Marja past bo'lsa ham, agar savdo hajmi katta bo'lsa umumiy foyda yuqori bo'lishi mumkin.</info>
`,
  },
  {
    slug: 'logistika-xarajatlari',
    title: "Logistika xarajatlarini hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "FBO va FBS logistika tariflarini birlik iqtisodiyoti kalkulyatoriga qo'shish.",
    content: `
## Logistika xarajatlari nima?

Uzum Market'da yetkazib berish xarajatlari mahsulot og'irligi, o'lchami va modeli (FBO/FBS) ga qarab farqlanadi.

## FBO logistika tarifi

FBO (Uzum ombori) uchun xarajatlar:
- Qabul qilish to'lovi: dona boshiga
- Saqlash: kub metr×kun
- Yetkazib berish: og'irlik va hudud

## FBS logistika tarifi

FBS (Sotuvchi ombori) uchun xarajatlar:
- Sortировка punktiga yetkazish
- Sortировка to'lovi

## Kalkulyatorda sozlash

**Kalkulyator → Logistika** bo'limida:

1. **Ombor modeli** ni tanlang: FBO / FBS
2. **Mahsulot og'irligi** (gramm)
3. **O'lchamlari** (uzunlik × kenglik × balandlik sm)
4. Daromadchi avtomatik Uzum tarifiga asoslanib hisoblaydi

## Qaytarish xarajati

O'rtacha qaytarish darajasi kategoriyaga qarab 3-15%. Kalkulyatorda qaytarish % kiriting — xarajat avtomatik qo'shiladi.

\`Qaytarish xarajati = (Qaytarish % / 100) × (Logistika × 2)\`

<info>Uzum Market tariflari o'zgarishi mumkin. Daromadchi tarif o'zgarishlarini kuzatib boradi.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 7: Analitika
  // ───────────────────────────────────────────────
  {
    slug: 'dashboard-korsatkichlari',
    title: "Dashboard ko'rsatkichlarini tushunish",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Asosiy dashboard kartochkalari va ularning ma'nosi.",
    content: `
## Dashboard ko'rsatkichlari

Kirganingizda ko'rinadigan asosiy kartochkalar:

## Yuqori panel kartochkalari

### Tushum (Revenue)
So'nggi 30 kunlik umumiy sotuv tushumi. O'tgan oy bilan taqqoslanadi.

### Buyurtmalar
Davr uchun umumiy buyurtmalar soni. Bekor qilinganlar hisobga olinmaydi.

### DRR
Umumiy reklama xarajatlari ulushi. Barcha kampaniyalarning o'rtacha ko'rsatkichi.

### Faol mahsulotlar
Hozirda sotuvda bo'lgan SKU'lar soni.

## Grafiklar

### Savdo grafigi
7 yoki 30 kunlik kunlik savdo tendentsiyasi.

### Kategoriya tahlili
Qaysi kategoriyadan qancha tushum — donut diagramma.

### Qoldiq holati
Kritik (D daraja) mahsulotlar soni va ularning ro'yxati.

## Vaqt oralig'ini o'zgartirish

Yuqori o'ng burchakda sana filtri orqali:
- Bugun
- So'nggi 7 kun
- So'nggi 30 kun
- So'nggi 90 kun
- Maxsus sana oralig'i

<info>Ma'lumotlar oxirgi sinxronizatsiyaga asoslanadi. Vaqt muhrlari sana filtrida ko'rinadi.</info>
`,
  },
  {
    slug: 'pnl-hisobot',
    title: "P&L hisobot (Foyda va Zarar)",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Oylik foyda va zarar hisobotini o'qish va tahlil qilish.",
    content: `
## P&L hisobot nima?

P&L (Profit & Loss) hisobot — do'koningizning moliyaviy natijasini to'liq ko'rsatuvchi oylik hisobot.

## Hisobot tarkibi

### Daromad qismi
- Umumiy sotuv tushumi
- Qaytarishlardan ayirilgan sof tushum

### Xarajatlar qismi
- Tannarx (COGS)
- Uzum Market komissiyasi
- Reklama xarajatlari
- Logistika va yetkazib berish
- Qaytarish xarajatlari
- Boshqa operatsion xarajatlar

### Natija
- Yalpi foyda
- Operatsion foyda
- Sof foyda

## Hisobotni o'qish

**Dashboard → F&Z Hisobot** sahifasiga o'ting.

Oy tanlang yoki oylarga taqqoslash ko'rinishida oching.

## Solishtiruv tahlili

P&L'ning "Solishtirish" rejimida ikki oyni yonma-yon ko'rishingiz mumkin. Bu o'sish yoki tushishni aniq ko'rsatadi.

## Eksport

Hisobotni Excel formatida yuklab olish uchun "Eksport" tugmasini bosing.

<info>P&L hisobot uchun tannarx ma'lumotlarini to'g'ri kiritish muhim. Sozlamalar → Mahsulotlar dan kiritishingiz mumkin.</info>
`,
  },
  {
    slug: 'kategoriya-tahlili',
    title: "Kategoriya va mahsulot tahlili",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Qaysi kategoriya va mahsulotlar eng ko'p foyda keltirishi.",
    content: `
## Kategoriya tahlili

Daromadchi sotuvlaringizni kategoriya bo'yicha ajratib ko'rsatadi.

## Dashboard'da ko'rish

Asosiy dashboard'dagi donut diagrammada har bir kategoriyaning tushum ulushi ko'rinadi. Ustiga bosib batafsil ma'lumot oling.

## Kategoriya sahifasi

**Dashboard → Tahlil → Kategoriya** bo'limida:
- Har bir kategoriya bo'yicha tushum
- Buyurtmalar soni
- O'rtacha buyurtma qiymati
- DRR
- Tendentsiya (o'sish/tushish)

## ABC tahlili

Mahsulotlarni ABC tizimida tasniflash:

| Sinf | Tavsif | Ulush |
|---|---|---|
| A | Eng muhim, ko'p daromad | 20% mahsulot, 80% daromad |
| B | O'rtacha muhim | 30% mahsulot, 15% daromad |
| C | Kam muhim | 50% mahsulot, 5% daromad |

## Top mahsulotlar

**Dashboard → Mahsulotlar → Saralash: Tushum** — eng ko'p daromad keltiruvchi mahsulotlar tepada.

<info>Kategoriya tahlili va ABC analiz Standard va undan yuqori tariflarda mavjud.</info>
`,
  },
  {
    slug: 'qidiruv-iboralari',
    title: "Qidiruv iboralari (kalit so'zlar) tahlili",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Mahsulotlaringizga qaysi qidiruv so'zlari orqali trafik kelishi.",
    content: `
## Qidiruv iboralari tahlili

Uzum Market mijozlari qaysi so'zlarni yozib mahsulotingizga kelishini bilish reklama va SEO uchun muhim.

## Dashboard'da ko'rish

**Dashboard → Qidiruv iboralari** sahifasida:
- Ko'rsatish soni (impressions)
- Kliklar
- CTR (klik/ko'rsatish %)
- O'rtacha pozitsiya
- Konversiya

## Tasniflar

### O'sib borayotgan
CTR va savdo o'sib borayotgan iboralar — ularga e'tibor bering va ulash kerak bo'lsa reklama byudjetini oshiring.

### Tushib borayotgan
Ko'rsatish bor, lekin klik kam — mahsulot rasmi yoki tavsifni yaxshilash kerak.

### Baland imkoniyat
Ko'p ko'rsatilayotgan, lekin past pozitsiyada turgan iboralar — reklama bilan oldinga chiqing.

## Kalit so'z strategiyasi

1. CTR > 3% bo'lgan iboralarni asosiy iboralar qiling
2. Raqobatchilar ishlatmaydigan long-tail iboralarga urg'u bering
3. Mavsumiy iboralarni vaqtida kuzating

<info>Qidiruv iboralari ma'lumotlari Uzum Market API orqali olinadi va cheklangan bo'lishi mumkin.</info>
`,
  },
  {
    slug: 'tashqi-trafik',
    title: "Tashqi trafik tahlili",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Instagram, Telegram va boshqa kanallardan Uzum'ga yo'naltirilgan trafik.",
    content: `
## Tashqi trafik nima?

Tashqi trafik — Uzum Market'dan tashqarida (Instagram, Telegram, YouTube, blog) bo'lgan reklama yoki kontentdan mahsulotingizga keladigan tashrufchilar.

## UTM parametrlar bilan kuzatish

Tashqi trafik aniqlash uchun havolalarga UTM parametrlar qo'shing:

\`https://uzum.uz/product/12345?utm_source=instagram&utm_campaign=may2025\`

## Daromadchi'da ko'rish

**Dashboard → Tahlil → Tashqi trafik** bo'limida:
- Manba bo'yicha tashriflar
- Konversiya (tashrifdan buyurtmaga)
- Har bir manbadan tushum

## Kanallar tahlili

| Kanal | Trafik ulushi | Konversiya |
|---|---|---|
| Instagram | 45% | 2.3% |
| Telegram | 30% | 4.1% |
| YouTube | 15% | 1.8% |
| Blog | 10% | 3.5% |

## Tavsiya

Telegram orqali kelgan trafik konversiyasi yuqori chunki auditoriya yanada ishonadiganroq. Telegram kanallar va chatlar orqali marketing samarali.

<info>Tashqi trafik tahlili Pro va Enterprise tariflarda to'liq mavjud.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 8: To'lov va Tariflar
  // ───────────────────────────────────────────────
  {
    slug: 'tariflar',
    title: "Tariflar va narxlar",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "Mavjud tariflar, ular orasidagi farqlar va qaysi tarif siz uchun to'g'ri.",
    content: `
## Daromadchi tariflar rejasi

Uchta tarif mavjud: Bepul, Pro va Pro+.

## Bepul tarif

**0 so'm/oy**

- 1 ta do'kon
- 6 tahlil sahifasi
- Demo ma'lumotlar
- Asosiy dashboard
- Mahsulotlar va buyurtmalar ro'yxati

## Pro tarif

**300,000 so'm/oy**

Bepul tarifning hamma narsi, qo'shimcha:
- 3 ta do'kon
- Barcha tahlillar
- Avto-sinxronizatsiya
- P&L hisobot
- Email ogohlantirishlar
- Reklama tahlili va DRR
- Qoldiq ogohlantirishlari
- Chrome kengaytmasi

## Pro+ tarif

**600,000 so'm/oy**

Pro tarifning hamma narsi, qo'shimcha:
- 5+ do'konlar
- API kirish
- Ustuvor yordam
- Kategoriya tahlili (batafsil)
- Jamoa boshqaruvi
- Oxirgi 365 kunlik ma'lumotlar

<info>Barcha tariflar 3 kunlik bepul sinov bilan keladi. Karta ma'lumotlari talab qilinmaydi.</info>
`,
  },
  {
    slug: 'tolov-usullari',
    title: "To'lov usullari",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "Tarifni qanday to'lash va qanday to'lov usullari mavjud.",
    content: `
## To'lov usullari

Daromadchi quyidagi to'lov usullarini qabul qiladi:

## Karta orqali

Uzcard va Humo kartalar orqali oylik to'lov:
1. **Billing → To'lov usuli** sahifasiga o'ting
2. Karta ma'lumotlarini kiriting
3. "Saqlash" tugmasini bosing
4. To'lov har oy avtomatik yechiladi

## Hisob-faktura (Invoice)

Yuridik shaxslar uchun hisob-faktura orqali to'lov:
1. **Billing → Hisob-faktura** ni bosing
2. Kompaniya ma'lumotlarini kiriting (STIR, INN)
3. Hisob-faktura emailga yuboriladi
4. Bank orqali o'tkazma amalga oshiriladi

## Click va Payme

Mobil to'lov tizimlari orqali:
- Click'da "Daromadchi" ni qidiring
- Payme'da "Daromadchi" ni qidiring
- Hisob raqamingizni kiriting va to'lang

## To'lov muddati

- Oylik to'lovlar: har oy bir xil kunda
- Kechikish bo'lsa: 3 kunlik sinov muddat
- To'lov qilinmasa: tarif Bepulga tushiriladi

<warning>To'lov ma'lumotlari xavfsiz SSL orqali saqlanadi. Karta raqamlari to'liq saqlanmaydi.</warning>
`,
  },
  {
    slug: 'tarifni-ozgartirish',
    title: "Tarifni o'zgartirish yoki bekor qilish",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "Tarifni yangilash, pasaytirish yoki obunani bekor qilish.",
    content: `
## Tarifni ko'tarish

**Billing → Tarif tanlash** → Yangi tarif → "O'tish" tugmasini bosing.

Yangi tarif darhol faollashadi. Qolgan davr hisoblanib, farq qaytariladi yoki keyingi to'lovga qo'shiladi.

## Tarifni pasaytirish

Joriy to'lov davri tugagandan so'ng pastroq tarifga o'tishingiz mumkin.

- **Billing → Tarif tanlang → Pasaytirish**
- O'zgarish keyingi oy boshida kuchga kiradi

## Obunani bekor qilish

1. **Billing → Tarif → Bekor qilish** sahifasiga o'ting
2. Sabab tanlang (ixtiyoriy)
3. Tasdiqlang

Bekor qilish amaldan ошса ham joriy to'lov davri so'ngigacha tarifdan foydalanishingiz mumkin.

## Ma'lumotlar saqlanishi

Bekor qilgandan so'ng:
- Ma'lumotlar 30 kun davomida saqlanadi
- 30 kundan so'ng o'chiriladi
- Qayta obuna bo'lsangiz, ma'lumotlar tiklanadi

<info>Yillik obunada 2 oylik chegirma (17% tejash). Yillik obunani bekor qilsangiz, foydalanilmagan qism qaytariladi.</info>
`,
  },
  {
    slug: 'bepul-sinov',
    title: "Bepul sinov davri",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "3 kunlik bepul sinov davridan qanday foydalanish.",
    content: `
## Bepul sinov davri

Daromadchi'ga yangi ro'yxatdan o'tgan foydalanuvchilar **3 kunlik Pro tarif sinov davrini** bepul ishlatadilar.

## Nima kiritilgan?

Sinov davrida Pro tarifning barcha imkoniyatlari mavjud:
- Cheksiz do'konlar
- 365 kunlik ma'lumotlar
- Jamoa boshqaruvi
- Chrome kengaytmasi
- Telegram bildirishnomalar
- P&L hisobot va reklama tahlili

## Karta talab qilinmaydi

Sinov davri uchun karta yoki to'lov ma'lumotlari talab qilinmaydi. Faqat email bilan ro'yxatdan o'ting.

## Sinov tugagandan so'ng

Sinov davri tugashidan 2 kun oldin email va Telegram orqali eslatma yuboriladi. Agar tarif tanlamasangiz, avtomatik Bepul tarifga o'tiladi.

## Sinov davri tugash sanasini ko'rish

**Billing** sahifasida sinov davri tugash sanasi va tavsiya etilgan tariflar ko'rinadi.

<info>Sinov davri bir marta beriladi. Boshqa email bilan ro'yxatdan o'tsangiz ham ikkinchi sinov olinmaydi.</info>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 9: Hisob Sozlamalari
  // ───────────────────────────────────────────────
  {
    slug: 'hisob-sozlamalari',
    title: "Hisob va profil sozlamalari",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Profil ma'lumotlarini yangilash, parol va xavfsizlik sozlamalari.",
    content: `
## Profil sozlamalari

**Dashboard → Sozlamalar → Profil** sahifasida:

### Shaxsiy ma'lumotlar
- Ism va familiya
- Email manzil
- Telefon raqami
- Fotosuratni yuklash

### Do'kon ma'lumotlari
- Do'kon nomi
- Uzum Market do'kon ID
- Kategoriyalar

## Parolni o'zgartirish

**Sozlamalar → Xavfsizlik → Parolni o'zgartirish:**
1. Joriy parolni kiriting
2. Yangi parol kiriting (kamida 8 belgi)
3. Yangi parolni tasdiqlang
4. "Saqlash" tugmasini bosing

## Email manzilni o'zgartirish

Email manzil o'zgartirilsa, ikki tasdiqlash kerak:
1. Joriy email manziliga kod yuboriladi
2. Yangi email manziliga tasdiqlash havolasi yuboriladi

## Ikki faktorli autentifikatsiya (2FA)

**Sozlamalar → Xavfsizlik → 2FA** bo'limida yoqing:
- Google Authenticator yoki Telegram orqali
- Har kirishda qo'shimcha kod so'raladi

<info>2FA yoqilsa hisob xavfsizligi sezilarli oshadi.</info>
`,
  },
  {
    slug: 'api-token-sozlash',
    title: "API token qo'shish va boshqarish",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Uzum Market API tokenini qo'shish, yangilash va tekshirish.",
    content: `
## API token nima?

API token — Daromadchi'ga Uzum Market hisobingizdan ma'lumotlarni o'qish uchun ruxsat beruvchi kalit. Token faqat o'qish uchun ishlaydi, ya'ni Daromadchi hech qachon tovarlar qo'shib yoki buyurtmalar bekor qilib bo'lmaydi.

## Token olish (Uzum Market)

1. seller.uzum.uz saytiga kiring
2. Profil → API kalitlari bo'limiga o'ting
3. "Yangi kalit yaratish" tugmasini bosing
4. Kalit nomi kiriting (masalan: "Daromadchi")
5. Token ko'rsatiladi — nusxalab oling

<warning>Token faqat bir marta ko'rsatiladi. Darhol nusxalab saqlang.</warning>

## Daromadchi'ga kiritish

**Sozlamalar → API Token** sahifasida:
1. "Token qo'shish" tugmasini bosing
2. Token maydoniga yapıştırın
3. "Tekshirish va saqlash" tugmasini bosing

Muvaffaqiyatli bo'lsa, do'kon ma'lumotlari avtomatik yuklanadi.

## Tokenni yangilash

Token eskirgan yoki bekor qilingan bo'lsa:
1. Uzum Market'da yangi token oling
2. Daromadchi → Sozlamalar → API Token → "Yangilash"
3. Yangi tokenni kiriting

## Bir nechta do'kon

Har bir do'kon uchun alohida token kerak. **Sozlamalar → Do'konlar** bo'limida boshqa do'konga "Do'kon qo'shish" orqali qo'shimcha token kiritish mumkin.
`,
  },
  {
    slug: 'jamoa-boshqaruvi',
    title: "Jamoa boshqaruvi",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Jamoangizga a'zo qo'shish, rollar va ruxsatlarni boshqarish.",
    content: `
## Jamoa boshqaruvi

Pro tarifda jamoangizdan boshqa odamlarni Daromadchi'ga qo'shishingiz mumkin.

## Rollar

### Egasi (Owner)
- Barcha imkoniyatlar
- Jamoa boshqaruvi
- Tarif va to'lov boshqaruvi
- API token boshqaruvi

### Admin
- Dashboard va barcha tahlillar
- Ma'lumotlarni eksport qilish
- Bildirishnomalar sozlash
- ❌ Tarif o'zgartira olmaydi
- ❌ Jamoa a'zolarini o'chira olmaydi

### Ko'ruvchi (Viewer)
- Dashboard ko'rish
- Hisobotlarni o'qish
- ❌ Hech narsa o'zgartira olmaydi
- ❌ Eksport qila olmaydi

## A'zo qo'shish

**Dashboard → Jamoa → "A'zo qo'shish":**
1. Email manzil kiriting
2. Rol tanlang
3. "Taklif yuborish" tugmasini bosing

Taklif email orqali yuboriladi. A'zo qabul qilgach, jamoaga qo'shiladi.

## A'zoni o'chirish

Jamoa jadvalida a'zo yonidagi "..." menyusini bosib "O'chirish" ni tanlang.

<info>Jamoa boshqaruvi faqat Pro tarifda mavjud. Bepul tarifda faqat 1 foydalanuvchi.</info>
`,
  },
  {
    slug: 'hisobni-ochirish',
    title: "Hisobni o'chirish",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Daromadchi hisobingizni to'liq o'chirish va ma'lumotlarni tozalash.",
    content: `
## Hisobni o'chirish

Hisobingizni o'chirishdan oldin quyidagilarni bilishingiz kerak.

## O'chirishdan oldin

- Barcha aktiv obunalar bekor qilinadi
- Eksport qilmoqchi bo'lgan ma'lumotlarni yuklab oling
- Jamoa a'zolariga xabar bering

## O'chirish jarayoni

**Sozlamalar → Hisob → Hisobni o'chirish:**
1. "Hisobni o'chirish" tugmasini bosing
2. Tasdiq matnini kiriting: \`o'chirish\`
3. Parolingizni kiriting
4. "Tasdiqlash" tugmasini bosing

Emailga tasdiqlash havolasi yuboriladi. Havola 24 soat davomida amal qiladi.

## Ma'lumotlar o'chirilishi

- **Darhol**: Dashboard'ga kirish to'xtatiladi
- **24 soatdan keyin**: Shaxsiy ma'lumotlar o'chiriladi
- **30 kundan keyin**: Barcha analitika ma'lumotlari o'chiriladi

## Hisobni tiklash

O'chirish so'rovidan 24 soat ichida "Bekor qilish" havolasini bosib, o'chirishni bekor qilishingiz mumkin.

<warning>30 kun o'tgandan keyin ma'lumotlar tiklanmaydi.</warning>
`,
  },
  {
    slug: 'xavfsizlik',
    title: "Hisob xavfsizligi",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Hisobingizni himoya qilish uchun xavfsizlik sozlamalari.",
    content: `
## Hisob xavfsizligi

Daromadchi'da sizning ma'lumotlaringiz xavfsizligi ustuvor. Quyidagi sozlamalar bilan hisobingizni himoya qiling.

## Kuchli parol

Yaxshi parol:
- Kamida 12 ta belgi
- Katta va kichik harflar
- Raqamlar
- Maxsus belgilar (!@#$)

Har 3-6 oyda parolni yangilash tavsiya etiladi.

## Ikki faktorli autentifikatsiya (2FA)

**Sozlamalar → Xavfsizlik → 2FA** ni yoqing:

1. Google Authenticator ilovasini yuklab oling
2. QR-kodni skaner qiling
3. 6 xonali kodni kiriting
4. Zaxira kodlarni saqlang

## Kirish tarixi

**Sozlamalar → Xavfsizlik → Kirish tarixi** bo'limida:
- Barcha kirishlar (vaqt, qurilma, IP manzil)
- Noma'lum kirish bo'lsa darhol parolni o'zgartiring

## Barcha sessiyalardan chiqish

Agar hisobga ruxsatsiz kirish bo'lgan deb shubhalansangiz:
**Sozlamalar → Xavfsizlik → Barcha sessiyalardan chiqish**

Bu barcha qurilmalardagi aktiv sessiyalarni tugatadi.

<info>Daromadchi hech qachon parol yoki API token so'ramaydi. Bunday so'rov kelsa — fishing!</info>
`,
  },
]

const CATEGORY_NAMES: Record<string, Record<string, string>> = {
  boshlash:               { uz: 'Boshlash',              ru: 'Начало работы',         en: 'Getting started' },
  bildirishnomalar:       { uz: 'Bildirishnomalar',       ru: 'Уведомления',           en: 'Notifications' },
  'chrome-kengaytmasi':   { uz: 'Chrome Kengaytmasi',    ru: 'Расширение Chrome',     en: 'Chrome Extension' },
  'reklama-tahlili':      { uz: 'Reklama Tahlili',        ru: 'Аналитика рекламы',    en: 'Ad Analytics' },
  qoldiqlar:              { uz: 'Qoldiqlar',              ru: 'Остатки',               en: 'Stock' },
  'birlik-iqtisodiyoti':  { uz: 'Birlik Iqtisodiyoti',   ru: 'Юнит-экономика',        en: 'Unit Economics' },
  analitika:              { uz: 'Analitika',              ru: 'Аналитика',             en: 'Analytics' },
  'tolov-va-tariflar':    { uz: "To'lov va Tariflar",    ru: 'Тарифы и оплата',       en: 'Billing & Plans' },
  'hisob-sozlamalari':    { uz: 'Hisob Sozlamalari',     ru: 'Настройки аккаунта',    en: 'Account Settings' },
}

const ARTICLE_TITLES: Record<string, Record<string, { title: string; summary: string }>> = {
  'tez-boshlash':           { ru: { title: 'Быстрый старт',                           summary: 'Регистрация, подключение токена и первый анализ за 4 шага.' },            en: { title: 'Quick start guide',                      summary: 'Registration, connecting a token, and first analysis in 4 steps.' } },
  'malumotlar-sinxronizatsiyasi': { ru: { title: 'Как работает синхронизация данных', summary: 'Автоматическая и ручная синхронизация, какие данные загружаются.' },      en: { title: 'How data sync works',                    summary: 'Auto and manual sync — what data gets imported.' } },
  'fikr-va-xato':           { ru: { title: 'Отправить отзыв или сообщить об ошибке', summary: 'Нашли ошибку или есть предложение? Как сообщить нам.' },                   en: { title: 'Submit feedback or report a bug',        summary: 'Found a bug or have a suggestion? How to reach us.' } },
  'bildirishnomalar':       { ru: { title: 'Типы уведомлений и настройки',            summary: 'Какие уведомления доступны и как их настроить.' },                        en: { title: 'Notification types and settings',        summary: 'Which notifications are available and how to configure them.' } },
  'telegram-ulash':         { ru: { title: 'Подключение Telegram-бота',               summary: 'Получайте уведомления Daromadchi через Telegram.' },                      en: { title: 'Connect Telegram bot',                   summary: 'Receive Daromadchi notifications via Telegram.' } },
  'chrome-kengaytma':       { ru: { title: 'О расширении Chrome',                     summary: 'Расширение, показывающее аналитику прямо на страницах Uzum Market.' },   en: { title: 'About the Chrome extension',             summary: 'Extension that shows analytics directly on Uzum Market pages.' } },
  'vidzhet-nima-korsatadi': { ru: { title: 'Что показывает виджет',                   summary: 'Содержимое виджета Daromadchi в кабинете Uzum Market.' },                 en: { title: 'What the widget shows',                  summary: 'Daromadchi widget content in your Uzum Market cabinet.' } },
  'vidzhet-ornatish':       { ru: { title: 'Установка расширения',                    summary: 'Руководство по установке и настройке расширения Chrome.' },               en: { title: 'Install the extension',                  summary: 'Guide to installing and configuring the Chrome extension.' } },
  'qurilmalar-boshqaruvi':  { ru: { title: 'Управление устройствами',                 summary: 'Управление расширениями, установленными на нескольких устройствах.' },    en: { title: 'Device management',                      summary: 'Manage extensions installed on multiple devices.' } },
  'reklama-tahlili':        { ru: { title: 'Основы аналитики рекламы',                summary: 'Показатели DRR, CPC, CPO и оценка эффективности рекламы.' },             en: { title: 'Ad analytics basics',                    summary: 'DRR, CPC, CPO metrics and ad performance evaluation.' } },
  'drr-nima':               { ru: { title: 'Что такое DRR и как его снизить',          summary: 'Показатель DRR и методы его оптимизации.' },                            en: { title: 'What is DRR and how to reduce it',       summary: 'DRR metric and how to optimize it.' } },
  'samarasiz-xarajatlar':   { ru: { title: 'Выявление неэффективных рекламных расходов', summary: 'Какие расходы не приносят прибыли и что с этим делать.' },            en: { title: 'Finding ineffective ad spend',           summary: 'Which costs bring no profit and what to do about it.' } },
  'kampaniya-byudjeti':     { ru: { title: 'Управление рекламным бюджетом',           summary: 'Как планировать и контролировать рекламный бюджет.' },                   en: { title: 'Managing your ad budget',                summary: 'How to plan and control your advertising budget.' } },
  'qoldiq-boshqaruvi':      { ru: { title: 'Управление остатками',                    summary: 'Остатки товаров на складе, уровни запасов и система оповещений.' },      en: { title: 'Stock management',                       summary: 'Warehouse stock levels and alert system.' } },
  'qoldiq-ogohlantirish':   { ru: { title: 'Оповещения об остатках',                  summary: 'Настройка оповещений о низких остатках и получение их в Telegram.' },    en: { title: 'Stock alerts',                           summary: 'Setting up low-stock alerts and receiving them in Telegram.' } },
  'fbo-fbs-rfbs':           { ru: { title: 'Разница между FBO, FBS и rFBS',           summary: 'Различия складских моделей Uzum Market и как их видеть в Daromadchi.' }, en: { title: 'FBO, FBS and rFBS differences',          summary: 'Uzum Market warehouse model differences and how to view them.' } },
  'tovar-aylanmasi':        { ru: { title: 'Оборачиваемость товаров и прогноз заказа',summary: 'Скорость оборота остатков и расчёт времени следующего заказа.' },        en: { title: 'Stock turnover and order forecast',      summary: 'Stock rotation speed and calculating when to reorder.' } },
  'birlik-iqtisodiyoti':    { ru: { title: 'Калькулятор юнит-экономики',              summary: 'Расчёт чистой прибыли, маржи и точки безубыточности для каждого товара.' }, en: { title: 'Unit economics calculator',            summary: 'Calculate net profit, margin and break-even for each product.' } },
}

export function getCategoryList(lang: string = 'uz'): Category[] {
  const map = new Map<string, Category>()
  const l = lang === 'ru' || lang === 'en' ? lang : 'uz'

  const ORDER: Record<string, { icon: string }> = {
    boshlash:             { icon: '🚀' },
    bildirishnomalar:     { icon: '🔔' },
    'chrome-kengaytmasi': { icon: '🧩' },
    'reklama-tahlili':    { icon: '📊' },
    qoldiqlar:            { icon: '📦' },
    'birlik-iqtisodiyoti':{ icon: '🧮' },
    analitika:            { icon: '📈' },
    'tolov-va-tariflar':  { icon: '💳' },
    'hisob-sozlamalari':  { icon: '⚙️' },
  }

  for (const article of ARTICLES) {
    const slug = article.categorySlug
    if (!map.has(slug)) {
      const icon  = ORDER[slug]?.icon ?? '📄'
      const title = CATEGORY_NAMES[slug]?.[l] ?? CATEGORY_NAMES[slug]?.['uz'] ?? article.category
      map.set(slug, { slug, title, icon, articles: [] })
    }
    const translatedArticle = l !== 'uz' && ARTICLE_TITLES[article.slug]?.[l]
      ? { ...article, title: ARTICLE_TITLES[article.slug][l].title, summary: ARTICLE_TITLES[article.slug][l].summary }
      : article
    map.get(slug)!.articles.push(translatedArticle)
  }

  const result: Category[] = []
  for (const slug of Object.keys(ORDER)) {
    if (map.has(slug)) result.push(map.get(slug)!)
  }
  return result
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

export function getAllSlugs(): string[] {
  return ARTICLES.map((a) => a.slug)
}

export function getRelatedArticles(slug: string, limit = 3): Article[] {
  const article = getArticle(slug)
  if (!article) return []
  return ARTICLES.filter(
    (a) => a.slug !== slug && a.categorySlug === article.categorySlug,
  ).slice(0, limit)
}
