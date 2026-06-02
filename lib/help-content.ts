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
  'zararсizlik-narxi':     { ru: { title: 'Расчёт точки безубыточности',             summary: 'Как определить минимальную прибыльную цену продажи.' },                   en: { title: 'Break-even price calculation',           summary: 'How to find the minimum profitable selling price.' } },
  'marja-hisoblash':       { ru: { title: 'Расчёт маржи прибыли',                   summary: 'Показатели маржи прибыли на уровне товара и магазина.' },                  en: { title: 'Profit margin calculation',              summary: 'Profit margin metrics at product and store level.' } },
  'logistika-xarajatlari': { ru: { title: 'Расчёт расходов на логистику',           summary: 'Добавление тарифов FBO и FBS в калькулятор юнит-экономики.' },             en: { title: 'Calculating logistics costs',            summary: 'Adding FBO and FBS rates to the unit economics calculator.' } },
  'dashboard-korsatkichlari': { ru: { title: 'Понимание показателей дашборда',      summary: 'Основные карточки дашборда и их значение.' },                             en: { title: 'Understanding dashboard metrics',        summary: 'Main dashboard cards and what they mean.' } },
  'pnl-hisobot':           { ru: { title: 'Отчёт P&L (Прибыли и убытки)',           summary: 'Как читать и анализировать ежемесячный отчёт о прибылях и убытках.' },    en: { title: 'P&L report (Profit & Loss)',             summary: 'How to read and analyse the monthly profit and loss report.' } },
  'kategoriya-tahlili':    { ru: { title: 'Анализ категорий и товаров',             summary: 'Какие категории и товары приносят наибольшую прибыль.' },                  en: { title: 'Category and product analysis',          summary: 'Which categories and products bring the most profit.' } },
  'qidiruv-iboralari':     { ru: { title: 'Анализ поисковых запросов',             summary: 'Какой трафик приходит на ваши товары через поиск.' },                      en: { title: 'Search query (keyword) analysis',        summary: 'What search traffic comes to your products.' } },
  'tashqi-trafik':         { ru: { title: 'Анализ внешнего трафика',               summary: 'Трафик из Instagram, Telegram и других каналов на Uzum.' },               en: { title: 'External traffic analysis',              summary: 'Traffic from Instagram, Telegram and other channels to Uzum.' } },
  'tariflar':              { ru: { title: 'Тарифы и цены',                          summary: 'Доступные тарифы, их различия и какой подходит вам.' },                    en: { title: 'Plans and pricing',                      summary: 'Available plans, differences, and which one suits you.' } },
  'tolov-usullari':        { ru: { title: 'Способы оплаты',                         summary: 'Как оплатить тариф и какие способы оплаты доступны.' },                    en: { title: 'Payment methods',                        summary: 'How to pay for a plan and which payment methods are available.' } },
  'tarifni-ozgartirish':   { ru: { title: 'Смена или отмена тарифа',               summary: 'Обновление, понижение или отмена подписки.' },                             en: { title: 'Change or cancel plan',                  summary: 'Upgrading, downgrading or cancelling your subscription.' } },
  'bepul-sinov':           { ru: { title: 'Бесплатный пробный период',             summary: 'Как воспользоваться 3-дневным бесплатным пробным периодом.' },             en: { title: 'Free trial period',                      summary: 'How to use the 3-day free trial.' } },
  'hisob-sozlamalari':     { ru: { title: 'Настройки аккаунта и профиля',          summary: 'Обновление данных профиля, пароля и настроек безопасности.' },             en: { title: 'Account and profile settings',           summary: 'Updating profile details, password, and security settings.' } },
  'api-token-sozlash':     { ru: { title: 'Добавление и управление API-токеном',   summary: 'Добавление, обновление и проверка токена Uzum Market.' },                  en: { title: 'Add and manage API token',               summary: 'Adding, updating and verifying your Uzum Market token.' } },
  'jamoa-boshqaruvi':      { ru: { title: 'Управление командой',                   summary: 'Добавление участников, роли и управление правами доступа.' },              en: { title: 'Team management',                        summary: 'Adding members, roles and managing access permissions.' } },
  'hisobni-ochirish':      { ru: { title: 'Удаление аккаунта',                     summary: 'Полное удаление аккаунта Daromadchi и очистка данных.' },                  en: { title: 'Delete account',                         summary: 'Permanently deleting your Daromadchi account and data.' } },
  'xavfsizlik':            { ru: { title: 'Безопасность аккаунта',                 summary: 'Настройки безопасности для защиты вашего аккаунта.' },                     en: { title: 'Account security',                       summary: 'Security settings to protect your account.' } },
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

const ARTICLE_CONTENT_RU: Record<string, string> = {
  'tez-boshlash': `
## Добро пожаловать!

Daromadchi — полноценная аналитическая платформа для продавцов Uzum Market, Yandex Market и Wildberries. Начните работу за 4 шага.

## Шаг 1: Создать аккаунт

Перейдите на страницу регистрации и создайте аккаунт с помощью email и пароля. Ссылка для подтверждения будет отправлена на вашу почту.

<info>Регистрация бесплатна и не требует данных банковской карты.</info>

## Шаг 2: Добавить API-токен

После входа перейдите в **Настройки → API-токен**. Скопируйте API-токен из кабинета Uzum Market (\`seller.uzum.uz\`) и вставьте его.

- seller.uzum.uz → Профиль → API-ключи
- Скопируйте токен
- Вставьте в настройках Daromadchi и нажмите «Сохранить»

## Шаг 3: Синхронизировать данные

После добавления токена нажмите кнопку **«Синхронизировать»**. Платформа загрузит:

- Все товары и SKU
- Заказы за последние 90 дней
- Рекламные кампании и расходы
- Данные по остаткам

Первая синхронизация может занять 1–3 минуты.

## Шаг 4: Начните анализ

После синхронизации на дашборде будут доступны все показатели:

- **DRR** (доля рекламных расходов)
- **Прибыль** по каждому товару
- **Остатки** и прогноз их хватит на сколько дней
- **Отчёт P&L** — доходы и расходы за месяц

<info>Данные обновляются автоматически каждые 4 часа.</info>
`,
  'malumotlar-sinxronizatsiyasi': `
## Процесс синхронизации

Daromadchi получает данные через API Uzum Market. Платформа поддерживает два режима синхронизации.

## Автоматическая синхронизация

Данные обновляются **каждые 4 часа** автоматически:

- 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (по Ташкенту)
- Во время обновления в правом верхнем углу дашборда отображается индикатор

## Ручная синхронизация

На странице дашборда вы можете запустить синхронизацию в любой момент с помощью кнопки **«Обновить»**.

<info>Ручную синхронизацию можно запускать не более 10 раз в сутки (тариф Pro).</info>

## Какие данные загружаются?

| Тип данных | Частота обновления |
|---|---|
| Товары и SKU | При каждой синхронизации |
| Заказы (последние 90 дней) | При каждой синхронизации |
| Рекламные кампании | При каждой синхронизации |
| Остатки | При каждой синхронизации |
| Цены | При каждой синхронизации |

## Ошибка синхронизации

Если синхронизация завершилась ошибкой:
1. Убедитесь, что API-токен ещё активен
2. Войдите в seller.uzum.uz и обновите токен
3. Введите новый токен в настройках Daromadchi

<warning>Если токен просрочен или отозван, данные не будут обновляться.</warning>
`,
  'fikr-va-xato': `
## Ваше мнение важно

Нам нужна ваша обратная связь, чтобы улучшать платформу. Если вы обнаружили ошибку или у вас есть предложение — напишите нам.

## Через Telegram

Самый быстрый способ — наш Telegram:

- Канал: **@daromadchi_uz**
- Бот поддержки: **@daromadchi_support_bot**
- Часы работы: 9:00 – 22:00 (Ташкент)

## По email

Для подробного описания проблемы или технической ошибки:

**support@daromadchi.uz**

При написании укажите:
1. Как возникла проблема?
2. На какой странице?
3. Приложите скриншот

## Обратная связь внутри приложения

Нажмите кнопку **«Оставить отзыв»** в правом нижнем углу дашборда. Заполните форму и отправьте прямо из приложения.

<info>Мы стараемся рассматривать сообщения об ошибках как можно быстрее. Как правило, ответ приходит в течение 24 часов.</info>
`,
  'bildirishnomalar': `
## Что такое уведомления?

Daromadchi автоматически отправляет уведомления о важных событиях. Это помогает следить за магазином и оперативно реагировать на проблемы.

## Типы уведомлений

### 1. Оповещения о низких остатках
Когда остаток товара опускается ниже установленного порога:
- Порог: от 3 до 30 дней (вы настраиваете)
- Указывает, по какому SKU и сколько осталось

### 2. Превышение рекламного бюджета
Когда дневной рекламный бюджет достигает установленного предела:
- Пример: дневной бюджет 500 000 сум — уведомление при достижении 90%

### 3. Падение продаж
Когда объём продаж резко снижается по сравнению с последними 7 днями:
- Порог: -20%, -30%, -50% (вы выбираете)

### 4. Новые заказы
Уведомление о каждом новом заказе (не рекомендуется — их может быть много).

### 5. Ежедневный отчёт
Краткий отчёт в заданное время каждый день:
- Выручка, количество заказов, DRR, состояние остатков

## Настройка

Перейдите в **Дашборд → Настройки → Уведомления**:

1. Включайте/выключайте каждый тип с помощью переключателя
2. Введите пороговые значения
3. Выберите время ежедневного отчёта
4. Нажмите «Сохранить»

<info>Уведомления доставляются через Telegram. Необходимо сначала подключить Telegram.</info>
`,
  'telegram-ulash': `
## Подключение Telegram-бота

Уведомления отправляются через Telegram. Выполните следующие шаги для подключения.

## Шаги подключения

### Шаг 1: Получите токен
Перейдите в **Дашборд → Настройки → Уведомления**. В разделе «Подключить Telegram» отображается ваш персональный токен (например: \`drm_abc123xyz\`).

### Шаг 2: Найдите бота
Найдите в Telegram **@daromadchi_bot** или перейдите по ссылке.

### Шаг 3: Запустите бота
Отправьте боту следующее сообщение:

\`/start drm_abc123xyz\`

(замените drm_abc123xyz на ваш токен)

### Шаг 4: Подтверждение
Бот отправит сообщение «Успешно подключено!». Страница Daromadchi обновится автоматически.

<info>К одному аккаунту нельзя подключить несколько Telegram-аккаунтов.</info>

## Отключение

Настройки → Уведомления → нажмите «Отключить Telegram».

## Если что-то пошло не так

- Проверьте правильность введённого токена
- Токен одноразовый — для повторного подключения получите новый
- Если бот заблокирован — разблокируйте и начните заново
`,
  'chrome-kengaytma': `
## Что такое расширение Chrome?

Расширение Daromadchi для Chrome — это инструмент, который показывает данные аналитики прямо в кабинете продавца Uzum Market, пока вы там работаете.

## Зачем оно нужно?

Открыв кабинет Uzum Market, вы можете видеть данные Daromadchi без переключения на отдельную вкладку:

- DRR отображается прямо на странице товара
- Остаток и количество дней до конца
- Текущая цена и маржа прибыли
- Цены конкурентов

## Как оно работает?

1. Расширение устанавливается в Chrome
2. Вы заходите на seller.uzum.uz
3. Расширение считывает данные страницы и добавляет аналитику из вашего аккаунта Daromadchi
4. Рядом с карточкой товара появляется виджет (мини-панель)

<info>Расширение работает только в Chrome и браузерах на основе Chromium (Edge, Brave, Opera).</info>

## Безопасность

Расширение работает только на домене seller.uzum.uz. На других сайтах никакие данные не считываются.
`,
  'vidzhet-nima-korsatadi': `
## Состав виджета

Когда расширение Daromadchi для Chrome включено, на страницах товаров seller.uzum.uz отображается мини-виджет со следующими данными:

## Основные показатели

| Показатель | Описание |
|---|---|
| DRR | Доля рекламных расходов (%) |
| Текущая цена | Действующая цена продажи |
| Себестоимость | Введённая вами себестоимость |
| Прибыль/шт | Доход с каждой проданной единицы |
| Маржа | Прибыль в % |
| Остаток | Количество на складе |
| Дней осталось | Сколько дней хватит при текущем темпе продаж |

## Рекламные данные

- Количество активных кампаний
- Рекламные расходы за сегодня
- CPC (цена за клик)
- CPO (цена за заказ)

## Конкуренты

Если для данного товара есть рыночный анализ:
- Самая низкая цена конкурента
- Средняя цена в категории

<info>Данные виджета основаны на последней синхронизации. Для актуальных данных обновите синхронизацию.</info>
`,
  'vidzhet-ornatish': `
## Шаги установки

### 1. Установка из Chrome Web Store

1. Откройте Chrome Web Store
2. Найдите «Daromadchi»
3. Нажмите «Добавить в Chrome»
4. Подтвердите разрешения

### 2. Войдите в аккаунт

Нажмите на значок расширения (правый верхний угол браузера) и введите данные вашего аккаунта Daromadchi.

### 3. Предоставьте разрешения

Расширению необходимы следующие разрешения:
- Чтение данных на домене seller.uzum.uz
- Отправка запросов на серверы Daromadchi

<warning>Расширение работает только на выбранных вами доменах. На других сайтах оно неактивно.</warning>

### 4. Проверьте работу

Перейдите в seller.uzum.uz → страница «Товары». Рядом с каждым товаром должен появиться значок виджета Daromadchi.

## Если что-то не работает

- Перезапустите браузер
- Отключите и снова включите расширение
- Chrome → Дополнительные инструменты → Расширения → Daromadchi → Подробнее
`,
  'qurilmalar-boshqaruvi': `
## Список устройств

К одному аккаунту можно подключить расширение Chrome на нескольких устройствах.

В разделе **Настройки → Расширение Chrome → Устройства** отображаются все подключённые устройства.

## Отображаемые данные

Для каждого устройства:
- Название устройства и версия браузера
- Операционная система
- Время последней активности
- Статус: Активно / Неактивно

## Удаление устройства

Чтобы удалить старое или неиспользуемое устройство из списка, нажмите «Удалить». Расширение на этом устройстве отключится от аккаунта.

<info>Можно подключить максимум 5 устройств (тариф Pro). На тарифе Pro+ — без ограничений.</info>

## Выйти на всех устройствах

Кнопка «Выйти на всех устройствах» завершает все активные сессии. После этого вам потребуется заново войти на каждом устройстве.
`,
  'reklama-tahlili': `
## Что такое аналитика рекламы?

Аналитика рекламы — набор показателей, измеряющих эффективность ваших рекламных расходов. Daromadchi автоматически рассчитывает все ключевые метрики.

## Основные показатели

### DRR (Доля рекламных расходов)
\`DRR = Рекламные расходы / Выручка × 100\`

- **DRR < 10%** — хорошо
- **DRR 10–20%** — приемлемо
- **DRR > 20%** — высокий, необходимо проверить кампанию

### CPC (Цена за клик)
\`CPC = Общие расходы / Количество кликов\`

### CPO (Цена за заказ)
\`CPO = Общие расходы / Количество заказов\`

### ROAS (Окупаемость рекламы)
\`ROAS = Выручка / Рекламные расходы\`

Рекомендуется ROAS > 5.

## Таблица кампаний

В разделе Дашборд → Аналитика → Кампании отображаются все активные и неактивные кампании с показателями.

## Выявление неэффективных расходов

Daromadchi автоматически отмечает:
- Клики есть, но нет заказов
- Кампании с DRR выше 30%
- Кампании с исчерпанным бюджетом

<info>Данные рекламы поступают через API Uzum Market и обновляются при каждой синхронизации.</info>
`,
  'drr-nima': `
## Что такое DRR?

**DRR** (Доля Рекламных Расходов) — доля рекламных расходов в выручке.

**Формула:** \`DRR = Рекламные расходы / Выручка × 100\`

**Пример:** выручка 1 000 000 сум, реклама 80 000 сум → DRR = 8%

## Какой DRR считается нормальным?

| Категория | Рекомендуемый DRR |
|---|---|
| Электроника | 5–10% |
| Одежда | 8–15% |
| Товары для дома | 6–12% |
| Продукты питания | 3–8% |
| Косметика | 10–18% |

## Как снизить DRR

### 1. Изменить цель кампании
Платить не за клики, а за заказы (CPC → CPO)

### 2. Отключить неэффективные ключевые слова
Ключевые слова, которые дают много кликов, но мало заказов

### 3. Настроить временны́е корректировки
Снижать бюджет в периоды низких продаж

### 4. Проверить цену
Если конкуренты продают дешевле — скорректируйте цену

### 5. Улучшить фото товара
Хорошие фото повышают CTR — больше заказов при тех же расходах

<info>Daromadchi рассчитывает DRR автоматически и отмечает кампании с высоким DRR жёлтым/красным цветом.</info>
`,
  'samarasiz-xarajatlar': `
## Что такое неэффективные расходы?

Неэффективные рекламные расходы — клики и показы, на которые потрачены деньги, но которые не превратились в заказы.

## Как Daromadchi их выявляет?

### 1. Высокий CPC, низкая конверсия
Кампании, за клики в которых платится много, но заказов приходит мало.

### 2. Кампании с нулевыми заказами
Кампании, которые тратят деньги, но не принесли ни одного заказа за последние 7 дней.

### 3. Реклама на товары с заканчивающимися остатками
Трата рекламного бюджета на товары, которых почти не осталось.

### 4. Кампании с DRR > 30%
Daromadchi помечает их как «Внимание».

## Что делать?

1. Примените фильтр «Неэффективные» в таблице **Кампании**
2. Проанализируйте каждую неэффективную кампанию
3. Обновите список ключевых слов или приостановите кампанию

<warning>Не останавливайте сразу все кампании с низкой конверсией — некоторые работают на узнаваемость бренда.</warning>
`,
  'kampaniya-byudjeti': `
## Управление бюджетом

Daromadchi помогает контролировать рекламный бюджет, однако настраивать его нужно напрямую в кабинете Uzum Market.

## Отслеживание бюджета

В разделе **Дашборд → Аналитика → Кампании**:
- Дневной бюджет каждой кампании
- Потраченная сумма за сегодня
- Прогнозируемое время исчерпания бюджета

## Настройка уведомлений

Чтобы получать уведомление в Telegram, когда бюджет достигнет 80% или 90%:

Перейдите в **Настройки → Уведомления → Рекламные расходы** и укажите порог.

## Рекомендации по бюджету

\`Оптимальный бюджет = Средний CPO × Целевое количество заказов\`

**Пример:** CPO = 15 000 сум, цель = 10 заказов/день → бюджет = 150 000 сум/день

## Сезонные изменения

В праздники и сезонные акции рекомендуется увеличивать бюджет в 1,5–2 раза.

<info>Рекламный бюджет изменяется напрямую в seller.uzum.uz → Реклама.</info>
`,
  'qoldiq-boshqaruvi': `
## Управление остатками

Daromadchi отслеживает ваши остатки с учётом темпа продаж и подсказывает, когда нужно делать новый заказ.

## Уровни остатков

\`Дней = Остаток / Среднесуточные продажи\`

| Уровень | Дней | Цвет |
|---|---|---|
| **A** | 30+ дней | Зелёный |
| **B** | 15–30 дней | Синий |
| **C** | 7–15 дней | Жёлтый |
| **D** | Менее 7 дней | Красный |

## Просмотр по FBO / FBS

На Uzum Market есть два типа остатков:

- **FBO** — товары на складе Uzum
- **FBS** — товары на вашем складе

В таблице товаров оба типа отображаются отдельно.

## Настройка уведомлений

В разделе **Настройки → Уведомления → Низкие остатки**:
1. Введите минимальный порог в днях (например: 7 дней)
2. Выберите, по каким типам товаров получать уведомления
3. Сохраните

<info>Данные об остатках поступают через API Uzum Market. Для склада FBO доступны данные в реальном времени.</info>
`,
  'qoldiq-ogohlantirish': `
## Оповещения об остатках

Когда остаток товара на складе опускается ниже установленного порога, Daromadchi автоматически отправляет сообщение в Telegram.

## Параметры оповещений

На странице **Настройки → Уведомления**:

- **Минимальный порог в днях**: через сколько дней отправлять оповещение (по умолчанию: 7 дней)
- **Минимальное количество**: оповещение при достижении этого остатка (по умолчанию: 10 штук)
- **Группы товаров**: все товары или только выбранные

## Вид сообщения

\`⚠️ Низкий остаток: [Название товара]\`
\`Остаток: 15 шт (5 дней)\`
\`Последние продажи: 3 шт/день\`

## Несколько оповещений

Для одного товара можно настроить 2 порога:
1. **Первое оповещение** — 14 дней (время для заказа)
2. **Срочное оповещение** — 5 дней (срочно заказать)

<warning>Для работы оповещений необходимо подключить Telegram-бота.</warning>
`,
  'fbo-fbs-rfbs': `
## Модели хранения

На Uzum Market существует три основные модели продажи товаров:

## FBO (Fulfillment by Operator)

**Склад Uzum** — товары хранятся на складе Uzum Market, доставку осуществляет Uzum.

- Более быстрая доставка
- Необходимо завезти товары на склад Uzum
- Дополнительные расходы на хранение

## FBS (Fulfillment by Seller)

**Склад продавца** — товары хранятся у вас, вы отправляете их после получения заказа от Uzum.

- Склад под полным вашим контролем
- Доставляете самостоятельно
- Больше гибкости

## rFBS (Real-time FBS)

Обновлённая версия FBS — с управлением заказами в режиме реального времени.

## Просмотр в Daromadchi

На странице **Товары → [Товар]** остатки FBO и FBS отображаются раздельно:

| Модель | Остаток | Дней |
|---|---|---|
| FBO | 150 шт | 22 дня |
| FBS | 80 шт | 12 дней |

<info>Общий остаток = FBO + FBS. Оповещения рассчитываются по общему остатку.</info>
`,
  'tovar-aylanmasi': `
## Что такое оборачиваемость товаров?

Оборачиваемость товаров — показатель того, как быстро продаётся товар.

\`Оборачиваемость = Продано единиц / Средний остаток\`

## Расчёт в Daromadchi

Платформа рассчитывает для каждого товара:
- Среднесуточные продажи за последние 7 дней
- Среднесуточные продажи за последние 30 дней
- Сезонный коэффициент (при наличии данных)

## Прогноз заказа

\`Дата заказа = Сегодня + (Остаток / Суточные продажи) − Срок поставки\`

**Пример:**
- Остаток: 100 шт
- Суточные продажи: 5 шт
- Срок поставки: 5 дней
- **Дата заказа: через 15 дней**

## Сезонные изменения

В праздники и в сезон продажи могут вырасти. Daromadchi строит прогноз на основе данных прошлого года.

<info>Прогноз приблизительный. Чем больше данных о товаре, тем точнее прогноз.</info>
`,
  'birlik-iqtisodiyoti': `
## Что такое юнит-экономика?

Юнит-экономика (Unit Economics) — система расчётов, показывающая, сколько прибыли вы получаете от продажи одной единицы товара.

## Как работает калькулятор?

Перейдите в **Дашборд → Калькулятор**. Введите следующие данные:

### Доходы
- Цена продажи

### Расходы
- Себестоимость (закупочная цена)
- Комиссия Uzum (%)
- Стоимость доставки
- Расходы на возврат
- Упаковка
- Рекламные расходы (на основе DRR)
- Налог (%)

## Результаты

Калькулятор рассчитывает:
- **Чистая прибыль** — после вычета всех расходов
- **Маржа** — прибыль в %
- **Точка безубыточности** — минимальная цена продажи
- **Целевая цена** — рекомендация для маржи 20%

## Настройки логистики

Введите тарифы доставки Uzum Market или выберите «Тариф Uzum» для автоматического расчёта.

<info>Результаты калькулятора можно сохранять и сравнивать с другими товарами.</info>
`,
  'zararсizlik-narxi': `
## Что такое точка безубыточности?

Точка безубыточности — минимальная цена продажи, покрывающая все расходы. Продажа ниже этой цены означает убыток.

## Формула

\`Безубыточность = Себестоимость + Комиссия + Логистика + Реклама + Прочие расходы\`

## Расчёт в Daromadchi

Введите в калькулятор следующие данные:

1. **Себестоимость** — закупочная цена
2. **Комиссия Uzum** — от 5 до 25% в зависимости от категории
3. **Логистика FBO** — зависит от веса и габаритов
4. **Расходы на возврат** — с учётом ~5–10% возвратов
5. **Реклама** — на основе целевого DRR

## Целевая прибыль

\`Цена продажи = Безубыточность × (1 + Целевая маржа / 100)\`

**Пример:**
- Безубыточность: 45 000 сум
- Цель: маржа 20%
- **Цена продажи: 54 000 сум**

<info>Daromadchi автоматически рассчитывает комиссию Uzum в зависимости от категории.</info>
`,
  'marja-hisoblash': `
## Виды маржи

### Валовая маржа (Gross Margin)
\`Валовая маржа = (Цена продажи − Себестоимость) / Цена продажи × 100\`

### Операционная маржа
Валовая маржа за вычетом операционных расходов (реклама, логистика, комиссии).

### Чистая маржа (Net Margin)
Доля прибыли, остающейся после всех расходов, налогов и платежей.

## Где смотреть в Daromadchi?

### В таблице товаров
Маржа в % отображается в строке каждого товара.

### В отчёте P&L
Тенденции маржи по месяцам и неделям в графическом виде.

### В калькуляторе
Расчёт в реальном времени на основе введённых данных.

## Какая маржа считается нормальной?

| Категория | Минимальная | Рекомендуемая |
|---|---|---|
| Электроника | 8% | 15–20% |
| Одежда | 20% | 35–50% |
| Косметика | 25% | 40–60% |
| Товары для дома | 15% | 25–35% |

<info>Даже при низкой марже общая прибыль может быть высокой, если объём продаж большой.</info>
`,
  'logistika-xarajatlari': `
## Что такое расходы на логистику?

На Uzum Market стоимость доставки зависит от веса, габаритов товара и модели (FBO/FBS).

## Тариф логистики FBO

Для FBO (склад Uzum) расходы включают:
- Плата за приёмку: за единицу товара
- Хранение: куб. метр × день
- Доставка: зависит от веса и региона

## Тариф логистики FBS

Для FBS (склад продавца) расходы включают:
- Доставка до сортировочного центра
- Плата за сортировку

## Настройка в калькуляторе

В разделе **Калькулятор → Логистика**:

1. Выберите **модель склада**: FBO / FBS
2. Введите **вес товара** (в граммах)
3. Введите **габариты** (длина × ширина × высота в см)
4. Daromadchi автоматически рассчитает по тарифам Uzum

## Расходы на возврат

Средний процент возвратов по категориям — от 3 до 15%. Введите % возвратов в калькулятор — расходы будут добавлены автоматически.

\`Расходы на возврат = (% возвратов / 100) × (Логистика × 2)\`

<info>Тарифы Uzum Market могут меняться. Daromadchi отслеживает изменения тарифов.</info>
`,
  'dashboard-korsatkichlari': `
## Показатели дашборда

Основные карточки, которые вы видите при входе:

## Карточки верхней панели

### Выручка (Revenue)
Общая выручка от продаж за последние 30 дней. Сравнивается с предыдущим месяцем.

### Заказы
Общее количество заказов за период. Отменённые заказы не учитываются.

### DRR
Общая доля рекламных расходов. Среднее значение по всем кампаниям.

### Активные товары
Количество SKU, находящихся в продаже в данный момент.

## Графики

### График продаж
Ежедневная динамика продаж за 7 или 30 дней.

### Анализ категорий
Выручка по категориям в виде круговой диаграммы.

### Состояние остатков
Количество критических (уровень D) товаров и их список.

## Изменение периода

Через фильтр дат в правом верхнем углу:
- Сегодня
- Последние 7 дней
- Последние 30 дней
- Последние 90 дней
- Произвольный период

<info>Данные основаны на последней синхронизации. Метки времени отображаются в фильтре дат.</info>
`,
  'pnl-hisobot': `
## Что такое отчёт P&L?

P&L (Profit & Loss) — ежемесячный отчёт, полностью отражающий финансовые результаты вашего магазина.

## Состав отчёта

### Доходная часть
- Общая выручка от продаж
- Чистая выручка за вычетом возвратов

### Расходная часть
- Себестоимость (COGS)
- Комиссия Uzum Market
- Рекламные расходы
- Логистика и доставка
- Расходы на возвраты
- Прочие операционные расходы

### Итог
- Валовая прибыль
- Операционная прибыль
- Чистая прибыль

## Как читать отчёт

Перейдите в **Дашборд → Отчёт P&L**.

Выберите месяц или откройте в режиме сравнения по месяцам.

## Сравнительный анализ

В режиме «Сравнение» вы можете видеть два месяца рядом — это наглядно показывает рост или снижение.

## Экспорт

Нажмите «Экспорт» для загрузки отчёта в формате Excel.

<info>Для точности отчёта P&L важно правильно указать себестоимость. Вы можете ввести её в Настройки → Товары.</info>
`,
  'kategoriya-tahlili': `
## Анализ категорий

Daromadchi разделяет ваши продажи по категориям.

## Просмотр на дашборде

На главном дашборде круговая диаграмма показывает долю выручки каждой категории. Нажмите на неё для подробной информации.

## Страница категорий

В разделе **Дашборд → Аналитика → Категории**:
- Выручка по каждой категории
- Количество заказов
- Средний чек
- DRR
- Тенденция (рост/снижение)

## ABC-анализ

| Класс | Описание | Доля |
|---|---|---|
| A | Наиболее важные, высокий доход | 20% товаров, 80% дохода |
| B | Средневажные | 30% товаров, 15% дохода |
| C | Наименее важные | 50% товаров, 5% дохода |

## Топ товаров

**Дашборд → Товары → Сортировка: Выручка** — самые прибыльные товары наверху.

<info>Анализ категорий и ABC-анализ доступны на тарифах Standard и выше.</info>
`,
  'qidiruv-iboralari': `
## Анализ поисковых запросов

Знание того, по каким запросам покупатели Uzum Market находят ваш товар, важно для рекламы и SEO.

## Просмотр на дашборде

На странице **Дашборд → Поисковые запросы**:
- Количество показов (impressions)
- Клики
- CTR (клики / показы в %)
- Средняя позиция
- Конверсия

## Категории запросов

### Растущие
Запросы с растущим CTR и продажами — уделите им внимание и при необходимости увеличьте бюджет.

### Снижающиеся
Есть показы, но мало кликов — нужно улучшить фото или описание товара.

### Высокий потенциал
Много показов, но низкая позиция — продвигайтесь с помощью рекламы.

## Стратегия ключевых слов

1. Запросы с CTR > 3% делайте основными
2. Делайте ставку на длинные запросы (long-tail), которые не используют конкуренты
3. Своевременно отслеживайте сезонные запросы

<info>Данные поисковых запросов поступают через API Uzum Market и могут быть ограниченными.</info>
`,
  'tashqi-trafik': `
## Что такое внешний трафик?

Внешний трафик — посетители, переходящие на ваш товар с платформ за пределами Uzum Market (Instagram, Telegram, YouTube, блог).

## Отслеживание через UTM-параметры

Для определения внешнего трафика добавляйте UTM-параметры к ссылкам:

\`https://uzum.uz/product/12345?utm_source=instagram&utm_campaign=may2025\`

## Просмотр в Daromadchi

В разделе **Дашборд → Аналитика → Внешний трафик**:
- Визиты по источникам
- Конверсия (из визита в заказ)
- Выручка с каждого источника

## Анализ каналов

| Канал | Доля трафика | Конверсия |
|---|---|---|
| Instagram | 45% | 2,3% |
| Telegram | 30% | 4,1% |
| YouTube | 15% | 1,8% |
| Блог | 10% | 3,5% |

## Рекомендация

Трафик из Telegram конвертируется лучше, поскольку аудитория более лояльная. Маркетинг через Telegram-каналы и чаты даёт хороший результат.

<info>Полный анализ внешнего трафика доступен на тарифах Pro и Enterprise.</info>
`,
  'tariflar': `
## Тарифные планы Daromadchi

Доступны три тарифа: Бесплатный, Pro и Pro+.

## Бесплатный тариф

**0 сум/месяц**

- 1 магазин
- 6 аналитических страниц
- Демо-данные
- Основной дашборд
- Список товаров и заказов

## Тариф Pro

**300 000 сум/месяц**

Всё из бесплатного тарифа, плюс:
- 3 магазина
- Вся аналитика
- Автосинхронизация
- Отчёт P&L
- Email-уведомления
- Аналитика рекламы и DRR
- Оповещения об остатках
- Расширение Chrome

## Тариф Pro+

**600 000 сум/месяц**

Всё из тарифа Pro, плюс:
- 5+ магазинов
- Доступ к API
- Приоритетная поддержка
- Детальный анализ категорий
- Управление командой
- Данные за последние 365 дней

<info>Все тарифы включают 3-дневный бесплатный пробный период. Данные карты не требуются.</info>
`,
  'tolov-usullari': `
## Способы оплаты

Daromadchi принимает следующие способы оплаты:

## Банковской картой

Карты Uzcard и Humo — ежемесячная оплата:
1. Перейдите в **Биллинг → Способ оплаты**
2. Введите данные карты
3. Нажмите «Сохранить»
4. Оплата будет списываться автоматически каждый месяц

## Счёт-фактура (Invoice)

Для юридических лиц — оплата по счёту:
1. Нажмите **Биллинг → Счёт-фактура**
2. Введите реквизиты компании (ИНН, СТИР)
3. Счёт-фактура отправляется на email
4. Оплата через банковский перевод

## Click и Payme

Через мобильные платёжные системы:
- В Click найдите «Daromadchi»
- В Payme найдите «Daromadchi»
- Введите номер вашего аккаунта и оплатите

## Сроки оплаты

- Ежемесячные платежи: каждый месяц в один и тот же день
- При просрочке: 3-дневный льготный период
- Если оплата не поступает: тариф снижается до Бесплатного

<warning>Платёжные данные хранятся в зашифрованном виде через SSL. Номер карты полностью не сохраняется.</warning>
`,
  'tarifni-ozgartirish': `
## Повышение тарифа

Перейдите в **Биллинг → Выбор тарифа** → Новый тариф → нажмите «Перейти».

Новый тариф активируется немедленно. Оставшийся период пересчитывается, и разница возвращается или добавляется к следующему платежу.

## Понижение тарифа

После окончания текущего расчётного периода можно перейти на более низкий тариф.

- **Биллинг → Выбор тарифа → Понизить**
- Изменение вступает в силу с начала следующего месяца

## Отмена подписки

1. Перейдите в **Биллинг → Тариф → Отменить подписку**
2. Выберите причину (необязательно)
3. Подтвердите

Даже после отмены вы можете пользоваться тарифом до конца оплаченного периода.

## Сохранность данных

После отмены:
- Данные хранятся 30 дней
- По истечении 30 дней данные удаляются
- При повторной подписке данные восстанавливаются

<info>При годовой подписке скидка 2 месяца (экономия 17%). При отмене годовой подписки неиспользованная часть возвращается.</info>
`,
  'bepul-sinov': `
## Бесплатный пробный период

Новые пользователи Daromadchi получают **3-дневный бесплатный пробный период с тарифом Pro**.

## Что включено?

В пробный период доступны все возможности тарифа Pro:
- Неограниченное количество магазинов
- Данные за 365 дней
- Управление командой
- Расширение Chrome
- Уведомления в Telegram
- Отчёт P&L и аналитика рекламы

## Карта не требуется

Для пробного периода не нужны данные карты или платёжная информация. Достаточно зарегистрироваться по email.

## После окончания пробного периода

За 2 дня до окончания придёт напоминание по email и в Telegram. Если тариф не выбрать — автоматически переходите на Бесплатный.

## Как узнать дату окончания

На странице **Биллинг** отображается дата окончания пробного периода и рекомендуемые тарифы.

<info>Пробный период предоставляется один раз. Повторная регистрация с другим email не даёт второго пробного периода.</info>
`,
  'hisob-sozlamalari': `
## Настройки профиля

На странице **Дашборд → Настройки → Профиль**:

### Личные данные
- Имя и фамилия
- Email-адрес
- Номер телефона
- Загрузка фотографии

### Данные магазина
- Название магазина
- ID магазина Uzum Market
- Категории

## Смена пароля

**Настройки → Безопасность → Сменить пароль:**
1. Введите текущий пароль
2. Введите новый пароль (минимум 8 символов)
3. Подтвердите новый пароль
4. Нажмите «Сохранить»

## Смена email-адреса

При смене email требуется двойное подтверждение:
1. Код отправляется на текущий email
2. Ссылка для подтверждения отправляется на новый email

## Двухфакторная аутентификация (2FA)

Включите в разделе **Настройки → Безопасность → 2FA**:
- Через Google Authenticator или Telegram
- При каждом входе запрашивается дополнительный код

<info>Включение 2FA значительно повышает безопасность аккаунта.</info>
`,
  'api-token-sozlash': `
## Что такое API-токен?

API-токен — ключ, дающий Daromadchi разрешение читать данные из вашего аккаунта Uzum Market. Токен работает только на чтение: Daromadchi не может добавлять товары или отменять заказы.

## Получение токена (Uzum Market)

1. Войдите на seller.uzum.uz
2. Перейдите в Профиль → API-ключи
3. Нажмите «Создать новый ключ»
4. Введите название ключа (например: «Daromadchi»)
5. Токен отображается — скопируйте его

<warning>Токен показывается только один раз. Сразу скопируйте и сохраните его.</warning>

## Добавление в Daromadchi

На странице **Настройки → API-токен**:
1. Нажмите «Добавить токен»
2. Вставьте токен в поле
3. Нажмите «Проверить и сохранить»

При успешном добавлении данные магазина загрузятся автоматически.

## Обновление токена

Если токен просрочен или отозван:
1. Получите новый токен в Uzum Market
2. Daromadchi → Настройки → API-токен → «Обновить»
3. Введите новый токен

## Несколько магазинов

Для каждого магазина нужен отдельный токен. В разделе **Настройки → Магазины** нажмите «Добавить магазин» для добавления ещё одного токена.
`,
  'jamoa-boshqaruvi': `
## Управление командой

На тарифе Pro вы можете добавлять других членов команды в Daromadchi.

## Роли

### Владелец (Owner)
- Все возможности
- Управление командой
- Управление тарифом и оплатой
- Управление API-токенами

### Администратор (Admin)
- Дашборд и вся аналитика
- Экспорт данных
- Настройка уведомлений
- ❌ Не может менять тариф
- ❌ Не может удалять членов команды

### Просмотр (Viewer)
- Просмотр дашборда
- Чтение отчётов
- ❌ Ничего не может изменить
- ❌ Не может экспортировать

## Добавление участника

**Дашборд → Команда → «Добавить участника»:**
1. Введите email-адрес
2. Выберите роль
3. Нажмите «Отправить приглашение»

Приглашение отправляется по email. После принятия участник добавляется в команду.

## Удаление участника

Нажмите «...» рядом с участником в таблице команды и выберите «Удалить».

<info>Управление командой доступно только на тарифе Pro. На Бесплатном тарифе — только 1 пользователь.</info>
`,
  'hisobni-ochirish': `
## Удаление аккаунта

Перед удалением аккаунта ознакомьтесь со следующей информацией.

## Перед удалением

- Все активные подписки будут отменены
- Скачайте данные, которые хотите сохранить
- Уведомите членов команды

## Процесс удаления

**Настройки → Аккаунт → Удалить аккаунт:**
1. Нажмите «Удалить аккаунт»
2. Введите текст подтверждения: \`удалить\`
3. Введите пароль
4. Нажмите «Подтвердить»

На email будет отправлена ссылка для подтверждения. Ссылка действует 24 часа.

## Что происходит с данными

- **Немедленно**: доступ к дашборду прекращается
- **Через 24 часа**: личные данные удаляются
- **Через 30 дней**: все аналитические данные удаляются

## Восстановление аккаунта

В течение 24 часов после отправки запроса вы можете нажать «Отменить» и отменить удаление.

<warning>По истечении 30 дней данные не подлежат восстановлению.</warning>
`,
  'xavfsizlik': `
## Безопасность аккаунта

В Daromadchi безопасность ваших данных — приоритет. Используйте следующие настройки для защиты аккаунта.

## Надёжный пароль

Хороший пароль:
- Не менее 12 символов
- Заглавные и строчные буквы
- Цифры
- Специальные символы (!@#$)

Рекомендуется обновлять пароль каждые 3–6 месяцев.

## Двухфакторная аутентификация (2FA)

Включите в разделе **Настройки → Безопасность → 2FA**:

1. Скачайте приложение Google Authenticator
2. Отсканируйте QR-код
3. Введите 6-значный код
4. Сохраните резервные коды

## История входов

В разделе **Настройки → Безопасность → История входов**:
- Все входы (время, устройство, IP-адрес)
- При обнаружении незнакомого входа немедленно смените пароль

## Выход со всех устройств

Если вы подозреваете несанкционированный доступ:
**Настройки → Безопасность → Выйти со всех устройств**

Это завершит все активные сессии на всех устройствах.

<info>Daromadchi никогда не запрашивает пароль или API-токен. Если вы получили такой запрос — это фишинг!</info>
`,
}

const ARTICLE_CONTENT_EN: Record<string, string> = {
  'tez-boshlash': `
## Welcome!

Daromadchi is a full analytics platform for sellers on Uzum Market, Yandex Market, and Wildberries. Get started in 4 steps.

## Step 1: Create an account

Go to the registration page and create an account with your email and password. A confirmation link will be sent to your email.

<info>Registration is free and no credit card is required.</info>

## Step 2: Add your API token

After signing in, go to **Settings → API Token**. Copy your API token from the Uzum Market seller cabinet (\`seller.uzum.uz\`) and paste it.

- seller.uzum.uz → Profile → API Keys
- Copy the token
- Paste it in Daromadchi Settings and click Save

## Step 3: Sync your data

After adding the token, click **"Sync"**. The platform will load:

- All products and SKUs
- Orders from the last 90 days
- Ad campaigns and spend
- Stock data

The first sync may take 1–3 minutes.

## Step 4: Start analysing

Once synced, all metrics are ready on the dashboard:

- **DRR** (ad spend ratio)
- **Profit** per product
- **Stock** levels and days remaining
- **P&L report** — monthly revenue and expenses

<info>Data updates automatically every 4 hours.</info>
`,
  'malumotlar-sinxronizatsiyasi': `
## How sync works

Daromadchi fetches data via the Uzum Market API. The platform supports two sync modes.

## Automatic sync

Data updates **every 4 hours** automatically:

- 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (Tashkent time)
- An indicator appears in the top-right corner of the dashboard during updates

## Manual sync

On the dashboard page, click the **"Refresh"** button to trigger sync at any time.

<info>Manual sync can be triggered up to 10 times per day (Pro plan).</info>

## What data is loaded?

| Data type | Update frequency |
|---|---|
| Products and SKUs | Every sync |
| Orders (last 90 days) | Every sync |
| Ad campaigns | Every sync |
| Stock levels | Every sync |
| Prices | Every sync |

## Sync error

If sync fails:
1. Verify your API token is still active
2. Log in to seller.uzum.uz and refresh the token
3. Enter the new token in Daromadchi Settings

<warning>If the token has expired or been revoked, data will not update.</warning>
`,
  'fikr-va-xato': `
## Your feedback matters

We need your feedback to improve the platform. If you find a bug or have a suggestion, reach out.

## Via Telegram

The fastest way — our Telegram:

- Channel: **@daromadchi_uz**
- Support bot: **@daromadchi_support_bot**
- Hours: 9:00 – 22:00 (Tashkent)

## By email

For detailed issues or technical errors:

**support@daromadchi.uz**

When writing, include:
1. How did the problem occur?
2. Which page?
3. Attach a screenshot

## In-app feedback

Click the **"Leave feedback"** button in the bottom-right corner of the dashboard. Fill in the form and submit directly from the app.

<info>We try to review bug reports as quickly as possible. Usually a response arrives within 24 hours.</info>
`,
  'bildirishnomalar': `
## What are notifications?

Daromadchi automatically sends notifications about important events, helping you monitor your store and react quickly.

## Notification types

### 1. Low stock alerts
When a product's stock drops below your threshold:
- Threshold: 3–30 days (you configure)
- Shows which SKU and how much is left

### 2. Ad budget exceeded
When the daily ad budget reaches your set limit:
- Example: daily budget 500,000 sum — notified at 90%

### 3. Sales drop
When sales volume drops sharply compared to the last 7 days:
- Threshold: -20%, -30%, -50% (you choose)

### 4. New orders
Notification for each new order (not recommended — can be very frequent).

### 5. Daily report
A short report at a set time each day:
- Revenue, orders count, DRR, stock status

## Setup

Go to **Dashboard → Settings → Notifications**:

1. Toggle each type on/off
2. Enter threshold values
3. Choose daily report time
4. Click Save

<info>Notifications are delivered via Telegram. You must connect Telegram first.</info>
`,
  'telegram-ulash': `
## Connect Telegram bot

Notifications are sent via Telegram. Follow these steps to connect.

## Connection steps

### Step 1: Get your token
Go to **Dashboard → Settings → Notifications**. Your personal token is shown in the "Connect Telegram" section (e.g. \`drm_abc123xyz\`).

### Step 2: Find the bot
Search for **@daromadchi_bot** in Telegram or use the link.

### Step 3: Start the bot
Send the bot this message:

\`/start drm_abc123xyz\`

(replace drm_abc123xyz with your token)

### Step 4: Confirmation
The bot will reply "Successfully connected!". The Daromadchi page will refresh automatically.

<info>Only one Telegram account can be connected per Daromadchi account.</info>

## Disconnect

Settings → Notifications → click "Disconnect Telegram".

## Troubleshooting

- Check that you entered the token correctly
- The token is single-use — get a new one to reconnect
- If the bot is blocked, unblock it and start again
`,
  'chrome-kengaytma': `
## What is the Chrome extension?

The Daromadchi Chrome extension shows analytics data directly inside the Uzum Market seller cabinet while you work there.

## Why use it?

With the extension you can see Daromadchi data without switching tabs:

- DRR shown directly on the product page
- Stock level and days remaining
- Current price and profit margin
- Competitor prices

## How it works

1. Install the extension in Chrome
2. Open seller.uzum.uz
3. The extension reads page data and overlays analytics from your Daromadchi account
4. A widget (mini-panel) appears next to each product card

<info>The extension works only in Chrome and Chromium-based browsers (Edge, Brave, Opera).</info>

## Security

The extension only activates on the seller.uzum.uz domain. No data is read from any other site.
`,
  'vidzhet-nima-korsatadi': `
## Widget contents

When the Daromadchi Chrome extension is enabled, a mini-widget appears on product pages at seller.uzum.uz.

## Main metrics

| Metric | Description |
|---|---|
| DRR | Ad spend ratio (%) |
| Current price | Active selling price |
| Cost price | Your entered cost |
| Profit/unit | Revenue per unit sold |
| Margin | Profit % |
| Stock | Quantity in warehouse |
| Days left | Days remaining at current sales pace |

## Ad data

- Number of active campaigns
- Today's ad spend
- CPC (cost per click)
- CPO (cost per order)

## Competitors

If market analysis exists for this product:
- Lowest competitor price
- Average category price

<info>Widget data is based on the last sync. Refresh sync for the most current data.</info>
`,
  'vidzhet-ornatish': `
## Installation steps

### 1. Install from Chrome Web Store

1. Open the Chrome Web Store
2. Search for "Daromadchi"
3. Click "Add to Chrome"
4. Confirm permissions

### 2. Sign in

Click the extension icon (top-right of the browser) and enter your Daromadchi account credentials.

### 3. Grant permissions

The extension needs:
- Read data on the seller.uzum.uz domain
- Send requests to Daromadchi servers

<warning>The extension only activates on your selected domains. It is inactive on other sites.</warning>

### 4. Test it

Go to seller.uzum.uz → Products page. You should see a Daromadchi widget icon next to each product.

## Troubleshooting

- Restart the browser
- Disable and re-enable the extension
- Chrome → More tools → Extensions → Daromadchi → Details
`,
  'qurilmalar-boshqaruvi': `
## Device list

You can connect the Chrome extension on multiple devices to one account.

All connected devices are shown in **Settings → Chrome Extension → Devices**.

## Displayed data

For each device:
- Device name and browser version
- Operating system
- Last activity time
- Status: Active / Inactive

## Remove a device

To remove an old or unused device from the list, click "Remove". The extension on that device will be disconnected from the account.

<info>Maximum 5 devices (Pro plan). Pro+ plan has no limit.</info>

## Sign out all devices

The "Sign out all devices" button ends all active sessions. You will need to sign in again on each device afterwards.
`,
  'reklama-tahlili': `
## What is ad analytics?

Ad analytics is a set of metrics measuring the effectiveness of your ad spend. Daromadchi calculates all key metrics automatically.

## Key metrics

### DRR (Ad spend ratio)
\`DRR = Ad spend / Revenue × 100\`

- **DRR < 10%** — good
- **DRR 10–20%** — acceptable
- **DRR > 20%** — high, review the campaign

### CPC (Cost per click)
\`CPC = Total spend / Number of clicks\`

### CPO (Cost per order)
\`CPO = Total spend / Number of orders\`

### ROAS (Return on ad spend)
\`ROAS = Revenue / Ad spend\`

ROAS > 5 is recommended.

## Campaigns table

Dashboard → Analytics → Campaigns shows all active and inactive campaigns with their metrics.

## Identifying ineffective spend

Daromadchi automatically flags:
- Clicks but no orders
- Campaigns with DRR above 30%
- Campaigns with exhausted budget

<info>Ad data is fetched via the Uzum Market API and updates with every sync.</info>
`,
  'drr-nima': `
## What is DRR?

**DRR** (Доля Рекламных Расходов) — the ratio of ad spend to revenue. A Russian abbreviation used on Uzum Market and in Daromadchi.

**Formula:** \`DRR = Ad spend / Revenue × 100\`

**Example:** 1,000,000 sum revenue, 80,000 sum ads → DRR = 8%

## What is a good DRR?

Varies by category:

| Category | Recommended DRR |
|---|---|
| Electronics | 5–10% |
| Clothing | 8–15% |
| Home goods | 6–12% |
| Food | 3–8% |
| Cosmetics | 10–18% |

## How to reduce DRR

### 1. Change campaign objective
Pay per order instead of per click (CPC → CPO)

### 2. Remove ineffective keywords
Keywords that bring lots of clicks but few orders

### 3. Set time-based adjustments
Lower budget during low-sales periods

### 4. Check your price
If competitors sell cheaper, adjust your price

### 5. Improve product photos
Good photos raise CTR — more orders for the same spend

<info>Daromadchi calculates DRR automatically and marks high-DRR campaigns yellow/red.</info>
`,
  'samarasiz-xarajatlar': `
## What is ineffective ad spend?

Ineffective ad spend — clicks and impressions you paid for but that didn't turn into orders.

## How Daromadchi detects it

### 1. High CPC, low conversion
Campaigns where you pay a lot per click but get few orders.

### 2. Zero-order campaigns
Campaigns spending money but with no orders in the last 7 days.

### 3. Ads on nearly out-of-stock products
Spending ad budget on products that are almost sold out.

### 4. Campaigns with DRR > 30%
Daromadchi flags these as "Attention".

## What to do

1. Apply the "Ineffective" filter in the **Campaigns** table
2. Review each ineffective campaign
3. Update your keyword list or pause the campaign

<warning>Don't stop all low-conversion campaigns at once — some serve brand awareness purposes.</warning>
`,
  'kampaniya-byudjeti': `
## Budget management

Daromadchi helps you monitor your ad budget, but budgets must be set directly in the Uzum Market cabinet.

## Budget tracking

In **Dashboard → Analytics → Campaigns**:
- Daily budget per campaign
- Amount spent today
- Estimated time until budget runs out

## Set up notifications

To get a Telegram alert when budget reaches 80% or 90%:

Go to **Settings → Notifications → Ad spend** and set the threshold.

## Budget recommendations

\`Optimal budget = Average CPO × Target orders per day\`

**Example:** CPO = 15,000 sum, target = 10 orders/day → budget = 150,000 sum/day

## Seasonal changes

During holidays and seasonal sales, increase budget by 1.5–2×.

<info>Ad budgets are changed directly in seller.uzum.uz → Advertising.</info>
`,
  'qoldiq-boshqaruvi': `
## Stock management

Daromadchi tracks your stock against your sales pace and tells you when to reorder.

## Stock levels

\`Days = Stock quantity / Average daily sales\`

| Level | Days | Colour |
|---|---|---|
| **A** | 30+ days | Green |
| **B** | 15–30 days | Blue |
| **C** | 7–15 days | Yellow |
| **D** | Less than 7 days | Red |

## FBO / FBS view

Uzum Market has two stock types:

- **FBO** — products stored in Uzum's warehouse
- **FBS** — products stored in your warehouse

Both types are shown separately in the products table.

## Set up alerts

In **Settings → Notifications → Low stock**:
1. Enter the minimum days threshold (e.g. 7 days)
2. Choose which product types to alert on
3. Save

<info>Stock data comes via the Uzum Market API. Real-time data is available for the FBO warehouse.</info>
`,
  'qoldiq-ogohlantirish': `
## Stock alerts

When a product's stock drops below your threshold, Daromadchi automatically sends a Telegram message.

## Alert settings

On the **Settings → Notifications** page:

- **Minimum days threshold**: when to send the alert (default: 7 days)
- **Minimum quantity**: alert at this stock level (default: 10 units)
- **Product groups**: all products or selected ones only

## Message format

\`⚠️ Low stock: [Product name]\`
\`Stock: 15 units (5 days)\`
\`Recent sales: 3 units/day\`

## Multiple alerts

You can set 2 thresholds per product:
1. **First alert** — 14 days (time to place an order)
2. **Urgent alert** — 5 days (order immediately)

<warning>Telegram bot must be connected for alerts to work.</warning>
`,
  'fbo-fbs-rfbs': `
## Warehouse models

Uzum Market has three main selling models:

## FBO (Fulfillment by Operator)

**Uzum's warehouse** — products are stored at Uzum Market's warehouse and delivery is handled by Uzum.

- Faster delivery
- Must ship products to Uzum's warehouse
- Additional storage costs

## FBS (Fulfillment by Seller)

**Seller's warehouse** — products are stored by you; you ship after receiving an order from Uzum.

- Full control over your warehouse
- You handle delivery
- More flexibility

## rFBS (Real-time FBS)

An updated version of FBS with real-time order management.

## View in Daromadchi

On the **Products → [Product]** page, FBO and FBS stock levels are shown separately:

| Model | Stock | Days |
|---|---|---|
| FBO | 150 units | 22 days |
| FBS | 80 units | 12 days |

<info>Total stock = FBO + FBS. Alerts are calculated based on total stock.</info>
`,
  'tovar-aylanmasi': `
## What is stock turnover?

Stock turnover measures how quickly a product sells.

\`Turnover = Units sold / Average stock\`

## Calculation in Daromadchi

The platform calculates for each product:
- Average daily sales over the last 7 days
- Average daily sales over the last 30 days
- Seasonal coefficient (if data is available)

## Order forecast

\`Order date = Today + (Stock / Daily sales) − Lead time\`

**Example:**
- Stock: 100 units
- Daily sales: 5 units
- Lead time: 5 days
- **Order date: in 15 days**

## Seasonal changes

Sales may rise during holidays and peak season. Daromadchi forecasts based on last year's data.

<info>The forecast is approximate. The more product data available, the more accurate the forecast.</info>
`,
  'birlik-iqtisodiyoti': `
## What is unit economics?

Unit Economics is a calculation system showing exactly how much profit you make from selling one unit of a product.

## How the calculator works

Go to **Dashboard → Calculator**. Enter the following:

### Revenue
- Selling price

### Costs
- Cost price (purchase price)
- Uzum commission (%)
- Delivery cost
- Return cost
- Packaging
- Ad spend (based on DRR)
- Tax (%)

## Results

The calculator computes:
- **Net profit** — after all costs
- **Margin** — profit %
- **Break-even price** — minimum selling price
- **Target price** — recommendation for 20% margin

## Logistics settings

Enter Uzum Market delivery rates or select "Uzum tariff" for automatic calculation.

<info>Calculator results can be saved and compared across products.</info>
`,
  'zararсizlik-narxi': `
## What is the break-even price?

The break-even price is the minimum price you must sell at to cover all costs. Selling below this means a loss.

## Formula

\`Break-even = Cost price + Commission + Logistics + Advertising + Other costs\`

## Calculation in Daromadchi

Enter in the calculator:

1. **Cost price** — purchase price
2. **Uzum commission** — 5 to 25% depending on category
3. **FBO logistics** — depends on weight and dimensions
4. **Return costs** — accounting for ~5–10% returns
5. **Advertising** — based on target DRR

## Target profit

\`Selling price = Break-even × (1 + Target margin / 100)\`

**Example:**
- Break-even: 45,000 sum
- Target: 20% margin
- **Selling price: 54,000 sum**

<info>Daromadchi automatically calculates the Uzum commission based on product category.</info>
`,
  'marja-hisoblash': `
## Types of margin

### Gross Margin
\`Gross margin = (Selling price − Cost price) / Selling price × 100\`

### Operating Margin
Gross margin minus operating expenses (ads, logistics, commissions).

### Net Margin
The profit share remaining after all costs, taxes, and fees.

## Where to see it in Daromadchi

### In the products table
Margin % is shown in each product row.

### In the P&L report
Monthly and weekly margin trends in chart form.

### In the calculator
Real-time calculation based on your inputs.

## What is a good margin?

| Category | Minimum | Recommended |
|---|---|---|
| Electronics | 8% | 15–20% |
| Clothing | 20% | 35–50% |
| Cosmetics | 25% | 40–60% |
| Home goods | 15% | 25–35% |

<info>Even with a low margin, total profit can be high if sales volume is large.</info>
`,
  'logistika-xarajatlari': `
## What are logistics costs?

On Uzum Market, delivery costs depend on the product's weight, dimensions, and model (FBO/FBS).

## FBO logistics tariff

For FBO (Uzum warehouse), costs include:
- Acceptance fee: per unit
- Storage: cubic metre × day
- Delivery: by weight and region

## FBS logistics tariff

For FBS (seller's warehouse), costs include:
- Delivery to the sorting centre
- Sorting fee

## Set up in the calculator

In **Calculator → Logistics**:

1. Select **warehouse model**: FBO / FBS
2. Enter **product weight** (grams)
3. Enter **dimensions** (length × width × height in cm)
4. Daromadchi calculates automatically using Uzum rates

## Return costs

Average return rate by category is 3–15%. Enter the return % in the calculator and costs are added automatically.

\`Return cost = (Return % / 100) × (Logistics × 2)\`

<info>Uzum Market tariffs may change. Daromadchi tracks tariff updates.</info>
`,
  'dashboard-korsatkichlari': `
## Dashboard metrics

The main cards you see when you sign in:

## Top panel cards

### Revenue
Total sales revenue for the last 30 days. Compared with the previous month.

### Orders
Total number of orders for the period. Cancelled orders are excluded.

### DRR
Overall ad spend ratio. The average across all campaigns.

### Active products
Number of SKUs currently on sale.

## Charts

### Sales chart
Daily sales trend over 7 or 30 days.

### Category analysis
Revenue by category as a donut chart.

### Stock status
Number of critical (level D) products and their list.

## Change period

Use the date filter in the top-right corner:
- Today
- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

<info>Data is based on the last sync. Timestamps are shown in the date filter.</info>
`,
  'pnl-hisobot': `
## What is the P&L report?

P&L (Profit & Loss) is a monthly report that fully reflects the financial results of your store.

## Report structure

### Revenue section
- Total sales revenue
- Net revenue after returns

### Costs section
- Cost of goods (COGS)
- Uzum Market commission
- Ad spend
- Logistics and delivery
- Return costs
- Other operating expenses

### Result
- Gross profit
- Operating profit
- Net profit

## How to read the report

Go to **Dashboard → P&L Report**.

Select a month or open in month-comparison view.

## Comparative analysis

In "Comparison" mode you can view two months side by side — clearly showing growth or decline.

## Export

Click "Export" to download the report in Excel format.

<info>Accurate P&L requires correct cost price data. You can enter it in Settings → Products.</info>
`,
  'kategoriya-tahlili': `
## Category analysis

Daromadchi breaks down your sales by category.

## View on the dashboard

The donut chart on the main dashboard shows each category's revenue share. Click for detailed information.

## Categories page

In **Dashboard → Analytics → Categories**:
- Revenue by category
- Number of orders
- Average order value
- DRR
- Trend (up/down)

## ABC analysis

| Class | Description | Share |
|---|---|---|
| A | Most important, high revenue | 20% of products, 80% of revenue |
| B | Medium importance | 30% of products, 15% of revenue |
| C | Least important | 50% of products, 5% of revenue |

## Top products

**Dashboard → Products → Sort by: Revenue** — most profitable products at the top.

<info>Category analysis and ABC analysis are available on Standard plans and above.</info>
`,
  'qidiruv-iboralari': `
## Search query analysis

Knowing which queries Uzum Market shoppers use to find your product is key for ads and SEO.

## View on the dashboard

On the **Dashboard → Search queries** page:
- Impressions
- Clicks
- CTR (clicks / impressions %)
- Average position
- Conversion rate

## Query categories

### Growing
Queries with rising CTR and sales — pay attention and increase budget if needed.

### Declining
There are impressions but few clicks — improve product photos or description.

### High potential
Many impressions but low position — promote with advertising.

## Keyword strategy

1. Make queries with CTR > 3% your primary keywords
2. Focus on long-tail queries that competitors don't use
3. Monitor seasonal queries in time

<info>Search query data comes via the Uzum Market API and may be limited.</info>
`,
  'tashqi-trafik': `
## What is external traffic?

External traffic — visitors coming to your product from platforms outside Uzum Market (Instagram, Telegram, YouTube, blog).

## Tracking with UTM parameters

Add UTM parameters to links to identify external traffic:

\`https://uzum.uz/product/12345?utm_source=instagram&utm_campaign=may2025\`

## View in Daromadchi

In **Dashboard → Analytics → External traffic**:
- Visits by source
- Conversion (visit to order)
- Revenue from each source

## Channel analysis

| Channel | Traffic share | Conversion |
|---|---|---|
| Instagram | 45% | 2.3% |
| Telegram | 30% | 4.1% |
| YouTube | 15% | 1.8% |
| Blog | 10% | 3.5% |

## Recommendation

Telegram traffic converts better because the audience is more loyal. Marketing through Telegram channels and chats delivers good results.

<info>Full external traffic analysis is available on Pro and Enterprise plans.</info>
`,
  'tariflar': `
## Daromadchi pricing plans

Three plans are available: Free, Pro, and Pro+.

## Free plan

**0 sum/month**

- 1 store
- 6 analytics pages
- Demo data
- Basic dashboard
- Product and order lists

## Pro plan

**300,000 sum/month**

Everything in Free, plus:
- 3 stores
- All analytics
- Auto-sync
- P&L report
- Email notifications
- Ad analytics and DRR
- Stock alerts
- Chrome extension

## Pro+ plan

**600,000 sum/month**

Everything in Pro, plus:
- 5+ stores
- API access
- Priority support
- Detailed category analysis
- Team management
- Last 365 days of data

<info>All plans include a 3-day free trial. No card details required.</info>
`,
  'tolov-usullari': `
## Payment methods

Daromadchi accepts the following payment methods:

## By card

Uzcard and Humo cards — monthly payment:
1. Go to **Billing → Payment method**
2. Enter card details
3. Click Save
4. Payment is charged automatically each month

## Invoice

For legal entities — payment by invoice:
1. Click **Billing → Invoice**
2. Enter company details (INN, STIR)
3. Invoice is sent to your email
4. Pay via bank transfer

## Click and Payme

Via mobile payment systems:
- Search for "Daromadchi" in Click
- Search for "Daromadchi" in Payme
- Enter your account number and pay

## Payment timing

- Monthly payments: same day each month
- If late: 3-day grace period
- If unpaid: plan downgraded to Free

<warning>Payment details are securely stored via SSL. Card numbers are not stored in full.</warning>
`,
  'tarifni-ozgartirish': `
## Upgrade plan

Go to **Billing → Choose plan** → New plan → click "Switch".

The new plan activates immediately. The remaining period is prorated and the difference is refunded or added to the next payment.

## Downgrade plan

You can switch to a lower plan after the current billing period ends.

- **Billing → Choose plan → Downgrade**
- Change takes effect at the start of the next month

## Cancel subscription

1. Go to **Billing → Plan → Cancel subscription**
2. Choose a reason (optional)
3. Confirm

Even after cancellation you can use the plan until the end of the paid period.

## Data retention

After cancellation:
- Data is stored for 30 days
- After 30 days, data is deleted
- If you re-subscribe, data is restored

<info>Annual subscription includes 2 months free (17% saving). If you cancel an annual subscription, the unused portion is refunded.</info>
`,
  'bepul-sinov': `
## Free trial

New Daromadchi users get a **3-day free Pro plan trial**.

## What's included?

During the trial all Pro plan features are available:
- Unlimited stores
- 365 days of data
- Team management
- Chrome extension
- Telegram notifications
- P&L report and ad analytics

## No card required

No card or payment information is needed for the trial. Just register with your email.

## After the trial ends

A reminder is sent 2 days before the trial ends via email and Telegram. If you don't choose a plan, you are automatically moved to the Free plan.

## Check expiry date

The **Billing** page shows your trial expiry date and recommended plans.

<info>The trial is provided once. Registering with a different email does not grant a second trial.</info>
`,
  'hisob-sozlamalari': `
## Profile settings

On the **Dashboard → Settings → Profile** page:

### Personal details
- Name and surname
- Email address
- Phone number
- Upload photo

### Store details
- Store name
- Uzum Market store ID
- Categories

## Change password

**Settings → Security → Change password:**
1. Enter current password
2. Enter new password (at least 8 characters)
3. Confirm new password
4. Click Save

## Change email

Changing email requires double confirmation:
1. A code is sent to the current email
2. A confirmation link is sent to the new email

## Two-factor authentication (2FA)

Enable in **Settings → Security → 2FA**:
- Via Google Authenticator or Telegram
- An additional code is requested at each login

<info>Enabling 2FA significantly increases account security.</info>
`,
  'api-token-sozlash': `
## What is an API token?

An API token is a key giving Daromadchi permission to read data from your Uzum Market account. The token is read-only: Daromadchi cannot add products or cancel orders.

## Get a token (Uzum Market)

1. Log in to seller.uzum.uz
2. Go to Profile → API Keys
3. Click "Create new key"
4. Enter a key name (e.g. "Daromadchi")
5. The token is shown — copy it

<warning>The token is shown only once. Copy and save it immediately.</warning>

## Add to Daromadchi

On the **Settings → API Token** page:
1. Click "Add token"
2. Paste the token into the field
3. Click "Verify and save"

If successful, your store data loads automatically.

## Update the token

If the token has expired or been revoked:
1. Get a new token from Uzum Market
2. Daromadchi → Settings → API Token → "Update"
3. Enter the new token

## Multiple stores

Each store needs its own token. In **Settings → Stores**, click "Add store" to add another token.
`,
  'jamoa-boshqaruvi': `
## Team management

On the Pro plan you can add other team members to Daromadchi.

## Roles

### Owner
- All capabilities
- Team management
- Plan and payment management
- API token management

### Admin
- Dashboard and all analytics
- Export data
- Configure notifications
- ❌ Cannot change the plan
- ❌ Cannot remove team members

### Viewer
- View dashboard
- Read reports
- ❌ Cannot change anything
- ❌ Cannot export

## Add a member

**Dashboard → Team → "Add member":**
1. Enter email address
2. Choose role
3. Click "Send invitation"

The invitation is sent by email. Once accepted, the member is added to the team.

## Remove a member

Click "..." next to the member in the team table and select "Remove".

<info>Team management is only available on the Pro plan. Free plan supports only 1 user.</info>
`,
  'hisobni-ochirish': `
## Delete account

Before deleting your account, be aware of the following.

## Before deleting

- All active subscriptions will be cancelled
- Download any data you want to keep
- Notify team members

## Deletion process

**Settings → Account → Delete account:**
1. Click "Delete account"
2. Enter the confirmation text: \`delete\`
3. Enter your password
4. Click "Confirm"

A confirmation link will be sent to your email. The link is valid for 24 hours.

## What happens to your data

- **Immediately**: dashboard access stops
- **After 24 hours**: personal data is deleted
- **After 30 days**: all analytics data is deleted

## Restore account

Within 24 hours of the deletion request, click "Cancel" to cancel the deletion.

<warning>After 30 days, data cannot be recovered.</warning>
`,
  'xavfsizlik': `
## Account security

At Daromadchi, the security of your data is a priority. Use these settings to protect your account.

## Strong password

A good password:
- At least 12 characters
- Upper and lowercase letters
- Numbers
- Special characters (!@#$)

Updating your password every 3–6 months is recommended.

## Two-factor authentication (2FA)

Enable in **Settings → Security → 2FA**:

1. Download Google Authenticator
2. Scan the QR code
3. Enter the 6-digit code
4. Save your backup codes

## Login history

In **Settings → Security → Login history**:
- All logins (time, device, IP address)
- If you see an unrecognised login, change your password immediately

## Sign out all devices

If you suspect unauthorised access:
**Settings → Security → Sign out all devices**

This ends all active sessions on all devices.

<info>Daromadchi will never ask for your password or API token. If you receive such a request — it's phishing!</info>
`,
}

export function getArticle(slug: string, lang: string = 'uz'): Article | undefined {
  const base = ARTICLES.find((a) => a.slug === slug)
  if (!base) return undefined
  const l = lang === 'ru' || lang === 'en' ? lang : 'uz'
  if (l === 'uz') return base
  const titleOverride = ARTICLE_TITLES[slug]?.[l]
  const contentMap = l === 'ru' ? ARTICLE_CONTENT_RU : ARTICLE_CONTENT_EN
  const contentOverride = contentMap[slug]
  return {
    ...base,
    ...(titleOverride ? { title: titleOverride.title, summary: titleOverride.summary } : {}),
    ...(contentOverride ? { content: contentOverride } : {}),
    category: CATEGORY_NAMES[base.categorySlug]?.[l] ?? base.category,
  }
}

export function getAllSlugs(): string[] {
  return ARTICLES.map((a) => a.slug)
}

export function getRelatedArticles(slug: string, lang = 'uz', limit = 3): Article[] {
  const base = ARTICLES.find((a) => a.slug === slug)
  if (!base) return []
  return ARTICLES
    .filter((a) => a.slug !== slug && a.categorySlug === base.categorySlug)
    .slice(0, limit)
    .map((a) => getArticle(a.slug, lang)!)
}
