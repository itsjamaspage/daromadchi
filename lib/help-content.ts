// Trial length is interpolated from TRIAL_DAYS — see lib/trial-copy.ts. These
// articles said "3 kunlik / 3-дневный / 3-day" long after the code moved to 14.
import { TRIAL_UZ, TRIAL_RU, TRIAL_EN } from './trial-copy'
import { TRIAL_REMINDER_DAYS } from './billing/nudge-constants'

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

Daromadchi — Uzum Market va Yandex Market sotuvchilari uchun analitika platformasi. Quyidagi 4 qadam orqali ishni boshlashingiz mumkin.

## 1-qadam: Hisob yaratish

Ro'yxatdan o'tish sahifasiga o'ting va email manzilingiz hamda parol bilan hisob yarating. Tasdiqlash havolasi email manzilingizga yuboriladi.

<info>Hisob yaratish bepul va kredit karta talab qilinmaydi.</info>

## 2-qadam: Do'kon ulash

Hisobingizga kirganingizdan so'ng **Sozlamalar** sahifasiga o'ting — u yerda har bir marketplace uchun alohida kartochka bor:

- **Uzum Market** — *API Token*: seller.uzum.uz → Sozlamalar → API integratsiya
- **Yandex Market** — *OAuth Token* va *Campaign ID* (faqat raqamlardan iborat)

Tokenni kiritib "Saqlash" ni bosing. Bir nechta do'konni ulash mumkin — har biri alohida token bilan.

<info>Token faqat o'qish uchun ishlatiladi. Batafsil: «API token qo'shish va boshqarish».</info>

## 3-qadam: Ma'lumotlarni sinxronizatsiya qilish

Do'kon ulangach **"Sinxronizatsiya"** tugmasini bosing. Platforma quyidagilarni yuklab oladi:

- Mahsulotlar, SKU va variantlar
- Buyurtmalar va ularning holati (shu jumladan bekor qilinganlar)
- Qoldiq miqdori va omborlar
- Narxlar, komissiya va to'lov (settlement) ma'lumotlari

Birinchi sinxronizatsiya 1-3 daqiqa davom etishi mumkin.

## 4-qadam: Tahlilni boshlang

Sinxronizatsiya tugagach dashboard tayyor bo'ladi:

- **Tushum va buyurtmalar** — tanlangan davr bo'yicha
- **Foyda va marja** — har bir mahsulot bo'yicha (tannarx kiritilgan bo'lsa)
- **Qoldiq** va u necha kunga yetishi
- **F&Z (P&L) hisobot** — oylik tushum va xarajatlar

<info>Ma'lumotlar keyin avtomatik yangilanadi — sinxronizatsiya har 5 daqiqada ishga tushadi.</info>
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

Daromadchi ma'lumotlarni Uzum Market va Yandex Market API'lari orqali oladi. Platforma ikkita sinxronizatsiya rejimini qo'llab-quvvatlaydi.

## Avtomatik sinxronizatsiya

Sinxronizatsiya **har 5 daqiqada** fon rejimida ishga tushadi. Alohida vaqt jadvali yoki "yangilanish soati" yo'q — yangi buyurtma yoki bekor qilish odatda bir necha daqiqada ko'rinadi.

Oxirgi sinxronizatsiya vaqtini **Dashboard → Sinxronizatsiya** sahifasida har bir marketplace bo'yicha alohida ko'rishingiz mumkin.

## Qo'lda sinxronizatsiya

Kutmaslik uchun **Sozlamalar** sahifasidagi do'kon kartochkasida **"Sinxronlash"** tugmasini bosing.

## Qanday ma'lumotlar yuklanadi?

| Ma'lumot turi | Izoh |
|---|---|
| Mahsulotlar, SKU va variantlar | Nomi, artikul, rang/o'lcham |
| Buyurtmalar va ularning holati | Yangi, yig'ilmoqda, yetkazilgan, qaytarilgan, bekor qilingan |
| Qoldiq miqdori | Ombor bo'yicha |
| Narxlar va komissiya | Marketplace hisoblagan qiymatlar |
| To'lovlar (settlements) | F&Z va "To'lovlar" sahifasi uchun |

<info>Reklama statistikasi yuklanmaydi — Uzum va Yandex Market reklama API'lari hozircha ulanmagan.</info>

## Sinxronizatsiya xatosi

Agar sinxronizatsiya muvaffaqiyatsiz bo'lsa:

1. **Dashboard → Sinxronizatsiya** sahifasida xato matnini ko'ring
2. Tokeningiz hali ham aktiv ekanligini tekshiring
3. Marketplace kabinetiga kirib yangi token oling
4. Yangi tokenni **Sozlamalar** sahifasida saqlang

<warning>Token eskirgan yoki bekor qilingan bo'lsa, ma'lumotlar yangilanmaydi va dashboard eski raqamlarni ko'rsatishda davom etadi.</warning>
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

Platformani yaxshilash uchun sizning fikrlaringizga muhtojmiz. Xato topsangiz yoki taklifingiz bo'lsa, quyidagi yo'llar bilan yetkazing.

## Ilova ichidagi forma — eng tezkori

Dashboard'ning **o'ng chetida**, ekran o'rtasi balandligida **«Fikr»** yorlig'i turadi. Uni bosing va ikkitadan birini tanlang:

- **Xato bildirish** — nimadir noto'g'ri ishlayapti
- **G'oya taklif qilish** — yangi imkoniyat yoki takomillashtirish

Matnni yozing va **rasm biriktiring** — skrinshot muammoni tushuntirishning eng tez yo'li. Yuborilgach «Rahmat! Xabaringiz qabul qilindi» degan tasdiq chiqadi.

## Telegram kanali

Yangiliklar va e'lonlar: **@daromadchi_uz** (https://t.me/daromadchi_uz)

## Email orqali

Batafsil yoki texnik masalalar uchun: **support@daromadchi.uz**

Shaxsiy ma'lumotlar va hisobni o'chirish so'rovlari uchun alohida manzil: **privacy@daromadchi.uz**

## Xabar yozishda foydali bo'ladigan ma'lumotlar

1. Nima kutgan edingiz va nima bo'ldi?
2. Qaysi do'kon / marketplace?
3. Qaysi davr tanlangan edi?
4. Skrinshot

<info>Xabarlarni imkon qadar tez ko'rib chiqamiz. Prioritet qo'llab-quvvatlash Pro+ va undan yuqori tariflarda mavjud.</info>
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
    summary: "Yangi buyurtma, bekor qilish, kam qoldiq va hisobotlar — hamda ularni qayerda sozlash.",
    content: `
## Bildirishnomalar nima?

Daromadchi muhim hodisalar haqida xabar beradi. Bildirishnomalar ikki joyda ko'rinadi: **Telegram bot** orqali va **ilova ichida** (yuqori paneldagi qo'ng'iroq belgisi → Bildirishnomalar sahifasi).

## Telegram bildirishnomalari

### 🛒 Yangi buyurtmalar
Har sinxronizatsiyada topilgan yangi buyurtmalar bitta xabarga jamlanadi: qaysi marketplace, qaysi mahsulot, nechta dona.

### ❌ Bekor qilingan buyurtmalar
Buyurtma bekor qilinganda **alohida xabar** keladi — u yangi buyurtmalar xabariga qo'shilmaydi. Sababi oddiy: "yig'ing va jo'nating" va "jo'natmang" — bir-biriga qarama-qarshi ko'rsatmalar, ularni bitta xabarga qo'shish esa bekor qilishni e'tibordan chetda qoldirishning eng oson yo'li.

Har bir buyurtma uchun bekor qilish xabari faqat **bir marta** yuboriladi, sinxronizatsiya necha marta ishga tushishidan qat'i nazar. Bekor qilingan buyurtmalar hisobotlarda tushumdan chiqariladi.

<info>Bekor qilish xabari «Yangi buyurtmalar» sozlamasi bilan birga yoqiladi va o'chiriladi.</info>

### 📦 Kam qoldiq
Mahsulot qoldig'i belgilangan chegaradan past tushganda. Bir jismoniy mahsulot bo'yicha bitta qator beriladi — bir xil tovar bir necha listingda bo'lsa ham.

### 🔄 Qoldiq sinxronizatsiyasi
Bir marketplace'da sotilgan tovar boshqasida ham kamayganda (do'kon uchun «Ostatok sinxronizatsiyasi» rejimi yoqilgan bo'lsa) — nima o'zgargani va natija haqida xabar.

### 📊 Kunlik hisobot
Har kuni siz tanlagan vaqtda: tushum, buyurtmalar, foyda, komissiya, bekor qilinganlar, kategoriyalar bo'yicha taqsimot.

### 📈 Haftalik hisobot
Xuddi shunday, lekin hafta bo'yicha. Standart holatda o'chirilgan.

## Telegram bildirishnomalarini sozlash

Sozlamalar **botning o'zida** turadi — dashboard'da emas:

1. Telegram'da botga **/start** yozing
2. Bot menyusidan bildirishnoma sozlamalarini oching
3. Har bir turni ✅ / ❌ tugmasi bilan yoqing yoki o'chiring:
   📦 Kam qoldiq · 📊 Kunlik hisobot · 🛒 Yangi buyurtmalar · 📈 Haftalik hisobot
4. Kunlik hisobot vaqtini tanlang

<info>Telegram ulanmagan bo'lsa hech qanday xabar kelmaydi. «Telegram botini ulash» maqolasiga qarang.</info>

## Ilova ichidagi bildirishnomalar

**Dashboard → Bildirishnomalar** sahifasida kam qoldiq ogohlantirishlari va yangi buyurtmalar ro'yxati ko'rinadi. Sahifani ochish qo'ng'iroq belgisidagi hisoblagichni tozalaydi.

Qoldiq o'zgarishi haqidagi xabarni ilova ichida va/yoki Telegram'da olishni **Dashboard → Ogohlantirishlar** sahifasidagi ikki tugma orqali tanlaysiz.
`,
  },
  {
    slug: 'telegram-ulash',
    title: "Telegram botini ulash",
    category: 'Bildirishnomalar',
    categorySlug: 'bildirishnomalar',
    summary: "Daromadchi bildirishnomalarini Telegram orqali qabul qilish uchun botni ulash.",
    content: `
## Telegram botini ulash

Bildirishnomalar Telegram orqali yuboriladi. Ulash bir necha bosishda bajariladi — hech qanday token ko'chirish shart emas.

## Ulash qadamlari

### 1-qadam: Sozlamalarni oching
**Dashboard → Sozlamalar** sahifasining pastida **Telegram** kartochkasi turadi.

### 2-qadam: "Telegramga ulash" tugmasini bosing
Daromadchi sizning shaxsiy havolangizni tayyorlaydi.

### 3-qadam: Havolani oching
Havola Telegram'da botni ochadi va ulanish so'rovi allaqachon tayyor bo'ladi — faqat **Start** ni bosing.

### 4-qadam: Tilni tanlang
Bot bildirishnomalar tilini so'raydi. Tanlaganingizdan so'ng ulanish tugaydi va Sozlamalar sahifasi o'zi yangilanadi: kartochkada **«Ulangan ✓»** va Telegram foydalanuvchi nomingiz ko'rinadi.

## Ishlayotganini tekshirish

Ulangandan keyin kartochkada **«Test yuborish»** tugmasi paydo bo'ladi. Uni bosing — bot darhol sinov xabari yuboradi. Xabar kelmasa, botni bloklab qo'ymaganingizni tekshiring.

## Ulanishni uzish

Xuddi shu kartochkadagi **«Uzish»** tugmasi. Shundan keyin hech qanday xabar yuborilmaydi.

## Bildirishnomalarni sozlash

Qaysi turdagi xabarlar kelishi **botning o'zida** sozlanadi — botga **/start** yozib menyudan tanlaysiz. Batafsil — «Bildirishnoma turlari va sozlamalar» maqolasida.

<info>Bir Daromadchi hisobiga bitta Telegram hisobi ulanadi.</info>

## Muammo bo'lsa

- Havolaning amal qilish muddati o'tgan bo'lsa, "Telegramga ulash" ni qayta bosib yangisini oling
- Bot bloklangan bo'lsa, blokdan chiqarib qayta urinib ko'ring
- Kengaytmadagi "Telegramni ulash" tugmasi ham shu sahifaga olib keladi
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
    summary: "Uzum va Yandex Market sahifalarida birlik iqtisodiyotini hisoblab beruvchi kengaytma.",
    content: `
## Chrome kengaytmasi nima?

Daromadchi kengaytmasi — marketplace sahifasidan chiqmasdan **birlik iqtisodiyotini** hisoblab beruvchi vosita. Mahsulot sahifasida panel ochiladi va o'sha mahsulot uchun komissiya, yetkazib berish, sof foyda va marjani ko'rsatadi.

## Qayerda ishlaydi

- **uzum.uz** — Uzum Market mahsulot sahifalari
- **market.yandex.ru / market.yandex.uz** — Yandex Market mahsulot sahifalari
- **partner.market.yandex.ru** — Yandex Market hamkor kabineti
- **daromadchi.uz** — hisobingiz bilan bog'lash uchun

Boshqa saytlarda kengaytma umuman ishga tushmaydi.

## Nima beradi

### Mahsulot sahifasida panel
Narxni sahifadan o'zi o'qiydi. Siz tannarx, qadoqlash, komissiya foizi va hajmni kiritasiz — panel darhol sof foyda va marjani qayta hisoblaydi. **FBO / FBS** tugmalari xarajat modelini almashtiradi.

### Popup (belgini bosganda)
Do'koningiz bo'yicha qisqacha statistika va ogohlantirishlar. Telegram ulash tugmasi ham shu yerda.

### Sozlamalar (Options)
Kengaytmaning o'z ogohlantirishlari: kam qoldiq chegarasi, savdo pasayishi, qaytarish foizi, "jim soatlar" va kunlik xulosa. Bu sozlamalar brauzerda saqlanadi.

## Brauzerlar

Chrome va Chromium asosidagi brauzerlar: Edge, Brave, Opera.

<info>Panelning hisob-kitobi Daromadchi'dagi **Birlik iqtisodiyoti** sahifasi bilan bir xil formulalarga asoslanadi. Paneldagi tugma sizni to'liq kalkulyatorga olib o'tadi.</info>
`,
  },
  {
    slug: 'vidzhet-nima-korsatadi',
    title: "Widget nima ko'rsatadi",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Mahsulot sahifasidagi panelning har bir qatori nimani anglatadi.",
    content: `
## Panel tarkibi

Mahsulot sahifasida Daromadchi paneli ochilganda quyidagilar ko'rinadi.

## Yuqori qism

- Mahsulot nomi
- Sahifadan o'qilgan **narx**
- Til (UZ / RU / EN), mavzu va yangilash tugmalari

## Model tanlash

**FBO** yoki **FBS** tugmasi — xarajat modelini almashtiradi. Yandex sahifalarida shunga mos model ishlatiladi.

## Siz kiritadigan qiymatlar

| Maydon | Nima uchun kerak |
|---|---|
| **Tannarx** | Tovarning o'zingizga tushgan narxi |
| **Qadoqlash** | Bir dona uchun qadoqlash xarajati |
| **Komissiya (%)** | Marketplace komissiyasi; kategoriyaga qarab oldindan to'ldiriladi |
| **Hajm** | Yetkazib berish narxini hisoblash uchun |

## Hisob natijasi

| Qator | Ma'nosi |
|---|---|
| Narx | Sahifadagi sotuv narxi |
| Komissiya (%) | Marketplace komissiyasi |
| Yetkazib berish | Logistika — **taxminiy** deb belgilanadi |
| Marketplace jami | Komissiya + yetkazib berish |
| Umumiy xarajat | Marketplace jami + tannarx + qadoqlash |
| **Sof foyda** | Yakuniy natija, rangli chiziq bilan |
| **Marja** | Foydaning narxdagi ulushi (%) |

Marja rangi holatni bildiradi: yashil — sog'lom, sariq — chegaraviy, qizil — zarar.

## Nimalar yo'q

Panelda **reklama ko'rsatkichlari (DRR, CPC, CPO), kampaniyalar va raqobatchilar narxlari yo'q**. Marketplace'lar bu ma'lumotlarni API orqali bermaydi.

<info>Qiymatlarni o'zgartirsangiz, foyda va marja darhol qayta hisoblanadi — saqlash tugmasini bosish shart emas.</info>
`,
  },
  {
    slug: 'vidzhet-ornatish',
    title: "Kengaytmani o'rnatish",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Chrome kengaytmasini o'rnatish va sozlash bo'yicha qo'llanma.",
    content: `
## 1. Chrome Web Store'dan o'rnatish

Kengaytma «Daromadchi — Uzum & Yandex» nomi bilan Chrome Web Store'da joylashgan:

https://chromewebstore.google.com/detail/daromadchi-%E2%80%94-uzum-yandex/kdgmhemligckdjibcojbdiofokjjnaed

Havolani oching va **«Chrome'ga qo'shish»** tugmasini bosing. Xuddi shu havola Daromadchi bosh sahifasida va **Birlik iqtisodiyoti** sahifasida ham bor.

## 2. Hisobingizga kiring

Kengaytma belgisini bosing. Tizimga kirmagan bo'lsangiz, popup **«Kirish»** tugmasini ko'rsatadi va daromadchi.uz saytini ochadi. Kirganingizdan so'ng popup statistikangizni ko'rsata boshlaydi.

## 3. Kengaytmani faollashtirish

1. Telegram'da **@daromadchi_uz** kanaliga a'zo bo'ling
2. Botga **/activate** yozing
3. Bot 6 belgili kod yuboradi
4. Kodni kengaytmaga kiriting

<info>Kod bir marta ishlaydi va muddati cheklangan. Muddati o'tsa, botga qayta **/activate** yuboring.</info>

## 4. Ixtiyoriy: API kalitlarini kiritish

Kengaytma **Sozlamalar (Options)** sahifasida marketplace kalitlarini alohida saqlash mumkin:

- **Yandex Market API kaliti** — Seller kabineti → Sozlamalar → API va modullar
- **Uzum Seller API tokeni** — seller.uzum.uz → Profil → API kalitlari

Har bir maydon yonida **«Tekshirish»** tugmasi bor — kalit ishlayotganini darhol sinab ko'radi.

## 5. Tekshirib ko'ring

uzum.uz yoki market.yandex.ru saytida biror mahsulot sahifasini oching. Daromadchi paneli ochilishi kerak. Panel yopilgan bo'lsa, chetdagi **«D»** tugmasi orqali qayta ochiladi.

## Muammo bo'lsa

- Sahifani yangilang — panel sahifa yuklangandan keyin qo'shiladi
- Kengaytmani o'chirib, qayta yoqing
- Chrome → Ko'proq vositalar → Kengaytmalar → Daromadchi → Tafsilotlar
`,
  },
  {
    slug: 'qurilmalar-boshqaruvi',
    title: "Qurilmalar boshqaruvi",
    category: 'Chrome Kengaytmasi',
    categorySlug: 'chrome-kengaytmasi',
    summary: "Kengaytma bir necha kompyuterda: nima hisobda, nima brauzerda saqlanadi.",
    content: `
## Bir nechta qurilmada foydalanish

Kengaytmani xohlagancha kompyuterga o'rnatishingiz mumkin — qurilmalar soni cheklanmagan va Daromadchi'da qurilmalar ro'yxati yuritilmaydi.

Buning o'rniga har bir brauzer mustaqil sozlanadi.

## Qaysi qurilmada nima saqlanadi

| Ma'lumot | Qayerda saqlanadi |
|---|---|
| Do'kon ma'lumotlari, buyurtmalar, qoldiqlar | Daromadchi hisobingizda — barcha qurilmada bir xil |
| Telegram ulanishi | Hisobingizda — bir marta ulanadi, hamma joyda ishlaydi |
| Kengaytma ogohlantirish sozlamalari | **Faqat shu brauzerda** |
| Kengaytmadagi API kalitlari | **Faqat shu brauzerda** |
| Til va mavzu tanlovi | **Faqat shu brauzerda** |

Ya'ni yangi kompyuterda kengaytmani o'rnatgach, uning **Sozlamalar** sahifasidagi chegaralarni qaytadan belgilashingiz kerak bo'ladi. Do'kon ma'lumotlari esa avtomatik ko'rinadi.

## Yangi qurilmada ulash

1. Kengaytmani o'rnating
2. Daromadchi hisobingizga kiring
3. Botga **/activate** yozib yangi kod oling va kiriting

Eski qurilmadagi kengaytma ishlashda davom etadi — yangi faollashtirish uni o'chirmaydi.

## Qurilmani uzish

Qurilmani masofadan uzish imkoni yo'q. O'sha qurilmada:

- Kengaytmani Chrome'dan o'chiring, yoki
- Popup orqali Telegram'ni uzing va Daromadchi hisobidan chiqing

<warning>Boshqa odam ishlatgan kompyuterda hisobingizdan chiqishni unutmang — kengaytma brauzerdagi sessiya orqali ishlaydi.</warning>
`,
  },

  // ───────────────────────────────────────────────
  // CATEGORY 4: Reklama Tahlili
  // ───────────────────────────────────────────────
  {
    slug: 'reklama-tahlili',
    title: "Reklama xarajatlari asoslari",
    category: 'Reklama xarajatlari',
    categorySlug: 'reklama-tahlili',
    summary: "DRR, CPC, CPO nimani anglatadi va reklama sarfi Daromadchi hisobiga qayerdan kiradi.",
    content: `
## Muhim: Daromadchi reklama kabinetiga ulanmaydi

Daromadchi'da reklama kampaniyalari jadvali **yo'q**, va reklama statistikasi API orqali yuklanmaydi. Uzum Market ham, Yandex Market ham reklama ma'lumotlarini beruvchi API'ni hozircha ochmagan — **Sozlamalar** sahifasidagi "Reklamani sinxronlash" tugmasi ham aynan shu haqda xabar beradi.

Kampaniyalar, kliklar va kunlik sarfni **marketplace kabinetida** ko'rasiz. Bu maqola esa o'sha raqamlarni qanday o'qish va Daromadchi'dagi foyda hisobiga qanday qo'shishni tushuntiradi.

## Asosiy ko'rsatkichlar

### DRR (Reklama xarajatlari ulushi)
\`DRR = Reklama xarajati / Tushum × 100\`

- **DRR < 10%** — yaxshi
- **DRR 10–20%** — qabul qilinarli
- **DRR > 20%** — yuqori, kampaniyani tekshirish kerak

### CPC (Bir klik narxi)
\`CPC = Umumiy xarajat / Kliklar soni\`

### CPO (Bir buyurtma narxi)
\`CPO = Umumiy xarajat / Buyurtmalar soni\`

### ROAS (Reklama daromadi)
\`ROAS = Tushum / Reklama xarajati\`

Bu qisqartmalarning barchasi dashboard'dagi **Qisqartmalar** bo'limida ham izohlangan.

## Reklama xarajati Daromadchi'ga qayerdan kiradi?

### 1. Birlik iqtisodiyoti kalkulyatori
**Dashboard → Kalkulyator** dagi **Reklama (%)** maydoniga o'zingizning DRR'ingizni kiritasiz. Kalkulyator uni xarajat sifatida hisobga oladi va sof foyda hamda zararsizlik narxini shunga qarab chiqaradi.

### 2. F&Z (P&L) hisobot
Marketplace reklama pulini to'lovingizdan ushlab qolgan bo'lsa, u **"Marketplace'ning boshqa ushlab qolishlari"** qatoriga tushadi (ekvayring, jarimalar bilan birga). Bu — marketplace hisobotidan olingan haqiqiy ushlanma, taxmin emas.

<info>Ya'ni: kampaniya darajasidagi tahlil — kabinetda, foydaga ta'siri — Daromadchi'da.</info>
`,
  },
  {
    slug: 'drr-nima',
    title: "DRR nima va qanday pasaytirish mumkin",
    category: 'Reklama xarajatlari',
    categorySlug: 'reklama-tahlili',
    summary: "DRR ko'rsatkichi va uni optimallashtirish usullari.",
    content: `
## DRR nima?

**DRR** (Доля Рекламных Расходов) — reklama xarajatlarining tushumdagi ulushi. Ruscha qisqartma bo'lsa-da, Uzum Market va Daromadchi undan foydalanadi.

**Formula:** \`DRR = Reklama xarajati / Tushum × 100\`

**Misol:** 1,000,000 so'm tushum, 80,000 so'm reklama → DRR = 8%

<info>DRR'ni marketplace kabinetidagi kampaniya hisobotidan olasiz — Daromadchi reklama kabinetiga ulanmagan va bu raqamni o'zi hisoblay olmaydi.</info>

## Ideal DRR qanday?

Kategoriyaga qarab farq qiladi:

| Kategoriya | Tavsiya etilgan DRR |
|---|---|
| Elektronika | 5-10% |
| Kiyim | 8-15% |
| Uy jihozlari | 6-12% |
| Oziq-ovqat | 3-8% |
| Kosmetika | 10-18% |

## O'zingizga mos maksimal DRR'ni qanday topish

Yuqoridagi jadval — umumiy o'rtacha ko'rsatkich. Aniq javob sizning marjangizga bog'liq:

1. **Dashboard → Kalkulyator** ni oching va mahsulotni tanlang
2. **Reklama (%)** maydonini 0 ga qo'ying — bu sof marjangiz
3. Foyda nolga yaqinlashguncha foizni asta oshiring

Shu nuqta — mahsulot uchun **zararsizlik DRR'i**. Undan yuqorisi zarar demakdir.

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

<warning>Kampaniya sozlamalarining barchasi marketplace kabinetida o'zgartiriladi. Daromadchi kampaniyalarni o'zgartirmaydi va to'xtatmaydi.</warning>
`,
  },
  {
    slug: 'samarasiz-xarajatlar',
    title: "Samarasiz reklama xarajatlarini aniqlash",
    category: 'Reklama xarajatlari',
    categorySlug: 'reklama-tahlili',
    summary: "Kabinetdagi sarfni Daromadchi'dagi foyda bilan solishtirib isrofni topish.",
    content: `
## Samarasiz xarajatlar nima?

Samarasiz reklama xarajati — pul ketgan, lekin foydaga aylanmagan kliklar va ko'rsatuvlar.

<info>Daromadchi kampaniyalarni o'zi belgilamaydi — reklama statistikasi API orqali kelmaydi. Quyida marketplace kabinetidagi raqamlar bilan Daromadchi'dagi foyda raqamlarini birga ishlatish usuli tasvirlangan.</info>

## Ish tartibi

### 1-qadam: Kabinetdan kampaniya sarfini oling
Marketplace kabinetida so'nggi 7-30 kunlik har bir mahsulot bo'yicha sarfni ko'chirib oling.

### 2-qadam: Daromadchi'da o'sha mahsulotning foydasini ko'ring
**Mahsulot tahlili** sahifasidagi jadvalda shu davr uchun:
- **Foyda** — tannarx va komissiyalardan keyingi qoldiq
- **Marja %** — foydaning tushumdagi ulushi
- **Sotuv ulushi** — mahsulot umumiy tushumning necha foizi
- **ABC** — A/B/C sinfi

### 3-qadam: Solishtiring

| Holat | Xulosa |
|---|---|
| Sarf > Foyda | Reklama zarar keltirmoqda — to'xtating yoki narxni qayta ko'rib chiqing |
| Sarf ≈ Foyda | Nol nuqta — faqat aylanma uchun ishlayapsiz |
| Sarf < Foyda, ABC = A | Sog'lom — byudjetni oshirish mumkin |
| Sarf bor, sotuv yo'q | Eng aniq isrof — birinchi navbatda shuni to'xtating |

## Diqqat qiladigan holatlar

### Qoldig'i tugayotgan mahsulotga reklama
**Dashboard → Ogohlantirishlar** dagi kam qoldiq ro'yxatini tekshiring. Bir necha kunga qolgan tovarga reklama qilish — pulni yo'qotish.

### Qaytarish foizi yuqori mahsulotlar
Tovar tahlili jadvalidagi **% qaytarish** ustuni. Qaytarish yuqori bo'lsa, buyurtma foyda emas — bu reklamani ikki marta qimmatga tushiradi.

### Marjasi past mahsulotlar
Marja 10% dan past bo'lsa, kichik DRR ham mahsulotni zararga o'tkazadi. Chegarani **Kalkulyator** da hisoblang.

<warning>Barcha kam konversiyali kampaniyalarni birdan to'xtatib qo'ymang — ba'zilari brendni tanitishga xizmat qilishi mumkin.</warning>
`,
  },
  {
    slug: 'kampaniya-byudjeti',
    title: "Reklama byudjetini boshqarish",
    category: 'Reklama xarajatlari',
    categorySlug: 'reklama-tahlili',
    summary: "Byudjetni foyda va CPO asosida hisoblash. Byudjet marketplace kabinetida sozlanadi.",
    content: `
## Byudjet qayerda sozlanadi?

Reklama byudjeti **marketplace kabinetida** sozlanadi — Daromadchi'da emas. Daromadchi reklama kabinetiga ulanmagan, shuning uchun byudjetni ko'rsata olmaydi, o'zgartira olmaydi va byudjet tugashi haqida ogohlantirmaydi.

Daromadchi bergan narsa — **byudjetni qancha qo'yish kerakligini hisoblash uchun kerakli foyda raqamlari**.

## Byudjetni hisoblash

### 1. Bir buyurtmadan qancha foyda olasiz?
**Dashboard → Kalkulyator** da mahsulotni tanlang, tannarx va narxni kiriting, **Reklama (%)** ni 0 ga qo'ying. Chiqqan sof foyda — bitta buyurtmadan reklamasiz oladigan pulingiz.

### 2. Maksimal CPO'ni aniqlang
\`Maksimal CPO = Bir buyurtmadagi sof foyda\`

Bundan yuqori CPO'da har bir buyurtma zarar keltiradi. Amalda foydaning yarmidan oshmaslik tavsiya etiladi.

### 3. Kunlik byudjetni chiqaring
\`Kunlik byudjet = Maqsadli CPO × Kunlik maqsadli buyurtmalar\`

**Misol:** sof foyda 30,000 so'm → maqsadli CPO 15,000 so'm; kuniga 10 buyurtma kerak → byudjet 150,000 so'm/kun.

### 4. Qoldiqqa qarab tekshiring
**Dashboard → Ogohlantirishlar** da mahsulot qoldig'i necha kunga yetishini ko'ring. Byudjet qoldiqdan tez tugaydigan savdo tezligini moliyalashtirmasligi kerak.

## Nazorat

Har hafta:
1. Kabinetdan haqiqiy sarfni oling
2. **Mahsulotlar samaradorligi** jadvalida o'sha davr foydasini ko'ring
3. DRR'ni qayta hisoblang va byudjetni moslang

## Mavsumiy o'zgarishlar

Bayram kunlari va mavsumiy aksiyalarda savdo ko'tariladi — byudjetni oshirishdan oldin qoldiq yetarli ekanini tekshiring.

<info>Reklama byudjetini seller.uzum.uz yoki Yandex Market kabinetining reklama bo'limida o'zgartiring.</info>
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

Daromadchi qoldiqlaringizni savdo tezligiga ko'ra kuzatadi va qachon yangi mahsulot buyurtma qilish kerakligini aytadi.

## Qoldiq necha kunga yetadi

Har bir mahsulot uchun:

\`Kunlar = Qoldiq miqdori / O'rtacha kunlik savdo\`

**Ogohlantirishlar** sahifasida bu raqam rangli belgi bilan ko'rsatiladi:

| Holat | Kunlar | Rang |
|---|---|---|
| **Kritik** | 3 kundan kam yoki qoldiq 0 | Qizil |
| **Ogohlantirish** | 3-7 kun | Sariq |
| **Kuzatuvda** | 7 kundan ko'p | Ko'k |

## Marketplace modellari

Buyurtma va qoldiq qaysi ombordan kelayotgani belgilar bilan ko'rsatiladi:

**Uzum Market**
- **FBO** — tovar Uzum omborida, yig'ish va yetkazish Uzum zimmasida
- **FBS** — tovar sizning omboringizda, buyurtma kelganda o'zingiz yig'asiz

**Yandex Market**
- **FBY** — tovar Yandex omborida, hammasini Yandex qiladi
- **FBS** — sizning omboringiz, Yandex logistikasi (Ekspress ham shu turga kiradi)
- **DBS** — saqlash ham, yetkazish ham sizda

<info>«Yig'ing va jo'nating» xabari faqat sotuvchi o'zi yig'adigan modellarda (FBS, DBS) yuboriladi — FBO va FBY buyurtmalarida sizdan hech narsa talab qilinmaydi.</info>

## Bir tovar — bir nechta listing

Bir jismoniy mahsulot ikki marketplace'da yoki bir marketplace'da bir necha listingda turishi mumkin. **Dashboard → Qoldiqlar** sahifasida ularni bitta guruhga birlashtirasiz — shundan keyin qoldiq guruh darajasida hisoblanadi va ogohlantirish takrorlanmaydi.

## Ostatok sinxronizatsiyasi (ixtiyoriy)

Do'kon uchun yoqilgan bo'lsa, bir marketplace'da sotilgan tovarning qoldig'i boshqasida ham kamayadi. Bu — Daromadchi marketplace listingiga yozadigan yagona narsa, va faqat qoldiq soni. Batafsil — «API token qo'shish va boshqarish» maqolasida.

<info>Qoldiq ma'lumotlari sinxronizatsiya bilan birga yangilanadi.</info>
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

Mahsulot qoldig'i belgilangan chegaradan past tushganda Daromadchi ogohlantiradi.

## Chegarani sozlash

**Dashboard → Ogohlantirishlar** sahifasida chegara maydoniga dona sonini kiriting (standart: **15 dona**) va saqlang. Ro'yxat darhol yangi chegara bo'yicha qayta hisoblanadi.

Guruhga birlashtirilgan mahsulotlar uchun **Qoldiqlar** sahifasida alohida chegara belgilash mumkin.

## Kunlar bo'yicha holat

Chegaradan tashqari har bir qatorda qoldiq necha kunga yetishi ko'rsatiladi: 3 kundan kam — qizil, 3-7 kun — sariq, undan ko'pi — ko'k. Bu chegaralar o'zgarmas.

## Ogohlantirish qayerga keladi

### Ilova ichida
**Ogohlantirishlar** va **Bildirishnomalar** sahifalarida, hamda yuqori paneldagi qo'ng'iroq belgisida.

### Telegram'da
Telegram ulangan va botda **📦 Kam qoldiq** yoqilgan bo'lsa. Xabarda mahsulot, qolgan miqdor va necha kun qolgani yoziladi.

Qoldiq o'zgarishi haqidagi xabarni ilova ichida va/yoki Telegram'da olishni **Ogohlantirishlar** sahifasidagi ikki tugma orqali tanlaysiz.

## Takrorlanmaslik

Bir jismoniy mahsulot uchun bitta qator beriladi — u bir necha listingda turgan bo'lsa ham. Guruhlarni **Qoldiqlar** sahifasida sozlaysiz.

## Eksport

Ogohlantirishlar ro'yxatini jadval fayli sifatida yuklab olish mumkin.

<warning>Telegram ulanmagan bo'lsa, ogohlantirish faqat ilova ichida ko'rinadi.</warning>
`,
  },
  {
    slug: 'fbo-fbs-rfbs',
    title: "FBO, FBS va rFBS farqlari",
    category: 'Qoldiqlar',
    categorySlug: 'qoldiqlar',
    summary: "Uzum FBO/FBS va Yandex FBY/FBS/DBS: kim yig'adi va bu nimaga ta'sir qiladi.",
    content: `
## Ombor modellari

Sotish modeli ikki narsani hal qiladi: tovar qayerda saqlanadi va buyurtmani kim yig'adi. Daromadchi buni har bir buyurtma va qoldiq yonidagi belgi bilan ko'rsatadi.

## Uzum Market

### FBO (Fulfillment by Operator)
Tovar **Uzum omborida**. Yig'ish va yetkazib berish Uzum zimmasida.

- Tezroq yetkazib berish
- Tovarni oldindan Uzum omboriga topshirish kerak
- Saqlash xarajatlari qo'shiladi

### FBS (Fulfillment by Seller)
Tovar **sizning omboringizda**. Buyurtma kelganda o'zingiz yig'ib topshirasiz.

- Saqlash to'liq nazoratingizda
- Har bir buyurtma uchun harakat talab qilinadi

## Yandex Market

### FBY
Tovar **Yandex omborida** — Yandex yig'adi va yetkazadi. Sizdan hech narsa talab qilinmaydi.

### FBS
Tovar sizning omboringizda, yetkazib berish Yandex logistikasi orqali. **Ekspress** buyurtmalar ham shu turga kiradi — alohida model emas.

### DBS (Delivery by Seller)
Saqlash ham, yetkazib berish ham sizda.

## Nima uchun bu muhim

Telegram'dagi **«yig'ing va jo'nating»** xabari faqat sotuvchi o'zi yig'adigan modellarda yuboriladi: Uzum FBS, Yandex FBS va DBS. FBO va FBY buyurtmalarida sizdan hech narsa talab qilinmaydi — shuning uchun bunday buyurtma harakat so'rovi sifatida yuborilmaydi.

## Daromadchi'da ko'rish

Belgilar **Buyurtmalar** va **Qoldiqlar** jadvallarida ko'rinadi. Bir mahsulot bir vaqtning o'zida bir necha modelda turishi mumkin — jami qoldiq ularning yig'indisi, ogohlantirish esa jami bo'yicha beriladi.

<info>rFBS — FBS ning bir ko'rinishi. Marketplace uni alohida qaytarmaydi, shuning uchun Daromadchi'da FBS sifatida ko'rinadi.</info>
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

Tovar aylanmasi — mahsulot qanchalik tez sotilishini ko'rsatuvchi ko'rsatkich. Amaliy savol esa oddiy: **qoldiq necha kunga yetadi va qachon yangi buyurtma berish kerak?**

## Daromadchi qanday hisoblaydi

Hisob **so'nggi 30 kunlik** haqiqiy savdoga asoslanadi:

\`Kunlik savdo = So'nggi 30 kunda sotilgan / 30\`

\`Qolgan kunlar = Mavjud qoldiq / Kunlik savdo\`

Bu ikkala raqam **Dashboard → Ogohlantirishlar** sahifasida har bir mahsulot qatorida ko'rinadi. Ro'yxat qolgan kunlar bo'yicha saralanadi — eng shoshilinchlari tepada.

<info>Hisobda faqat **mavjud** qoldiq ishlatiladi: allaqachon buyurtma qilingan, lekin hali jo'natilmagan birliklar ayirib tashlanadi. Aks holda sotib bo'lingan tovar hali ham javonda turgandek ko'rinardi.</info>

So'nggi 30 kunda savdo bo'lmagan bo'lsa, qolgan kunlar o'rniga **«—»** ko'rsatiladi — bu «ko'p qoldi» degani emas, «hisoblab bo'lmaydi» degani.

## Qachon buyurtma berish kerak

\`Buyurtma berish sanasi = Bugun + (Qolgan kunlar − Yetkazib berish muddati)\`

**Misol:**
- Qoldiq: 100 dona
- Kunlik savdo: 5 dona → 20 kunga yetadi
- Yetkazib beruvchi 5 kunda keltiradi
- **15 kundan keyin buyurtma bering**

Yetkazib berish muddatini o'zingiz bilasiz — Daromadchi uni bilmaydi, shuning uchun bu ayirishni siz qilasiz.

## Ogohlantirish chegaralari

| Holat | Qolgan kunlar |
|---|---|
| Kritik | 3 kundan kam yoki qoldiq 0 |
| Ogohlantirish | 3-7 kun |
| Kuzatuvda | 7 kundan ko'p |

## Nimaga e'tibor berish kerak

- **Yangi mahsulot**: 30 kunlik tarixi to'liq bo'lmagani uchun kunlik savdo past chiqadi va prognoz haqiqiydan uzoqroq ko'rinadi
- **Aksiya davri**: aksiyadagi savdo o'rtachani ko'taradi va qoldiq kutilganidan tez tugaydi
- **Bir tovar bir nechta listingda**: **Qoldiqlar** sahifasida ularni guruhga birlashtiring, aks holda har biri alohida hisoblanadi

<info>Mavsumiylik bo'limi hozircha «Yaqin orada» holatida — mavsumiy koeffitsient hisobga olinmaydi.</info>
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
    summary: "Har bir mahsulot uchun sof foyda, marja va zararsizlik narxini hisoblash.",
    content: `
## Birlik iqtisodiyoti nima?

Birlik iqtisodiyoti (Unit Economics) — bir dona mahsulotni sotishdan qancha foyda qolishini ko'rsatuvchi hisob-kitob.

Daromadchi'da buning uchun **ikkita** vosita bor.

## 1. Foyda kalkulyatori — bitta mahsulot uchun tez hisob

**Dashboard → Kalkulyator**. Hech narsa ulash shart emas: marketplace'ni (**Uzum** yoki **Yandex**) va kategoriyani tanlaysiz — komissiya foizi o'zi qo'yiladi.

Kiritiladigan maydonlar:
- Sotish narxi
- Tannarx
- Logistika
- Reklama xarajati
- Qaytarish foizi (%)
- Oylik savdo (dona)

Natijada quyidagilar chiqadi:
- **1 donadagi xarajatlar taqsimoti** — komissiya, tannarx, logistika, qaytarish zarari, reklama
- **Sof foyda (dona)**, **Marja**, **ROI**, **DRR**, **zararsizlik narxi**
- **Reality Check** — oylik savdoga ko'paytirilgan haqiqiy foyda, siz kutgan raqam bilan yonma-yon

Marja 20% dan past bo'lsa yoki narx zarar keltirsa, kalkulyator ogohlantiradi.

## 2. Birlik iqtisodiyoti jadvali — barcha mahsulotlar bo'yicha

**Dashboard → Birlik iqtisodiyoti**. Bu yerda mahsulotlar ro'yxati va har biri uchun to'liq hisob turadi: tannarx, yetkazib berilgan tannarx (landed cost), komissiya, yetkazib berish, reklama, jami xarajatlar, sof foyda, ROI, marja, qoldiq va yetkazib beruvchi havolasi.

### Standart xarajatlar
Jadval sozlamalarida bir marta belgilanadi va barcha qatorlarga qo'llanadi:

| Sozlama | Standart |
|---|---|
| Ekvayring (%) | 1.5 |
| Reklama (%) | 5 |
| Soliq (%) | 6 |
| Komissiya (%) | 10 |
| Oxirgi milya (%) | 0 |
| Soliq turi | Daromad (6%) yoki Daromad − xarajat (15%) |

### Ustunlar
Ustunlarni yoqib-o'chirish mumkin — kerakli ko'rinishni o'zingiz yig'asiz.

## Chrome kengaytmasi bilan bog'lanish

Kengaytmadagi panel xuddi shu formulalarni ishlatadi va mahsulotni to'g'ridan-to'g'ri shu jadvalga qo'shib qo'yishi mumkin.

<warning>Kalkulyatordagi barcha raqamlar taxminiy. Marketplace tariflari o'zgaradi — muhim qarordan oldin kabinetdagi joriy tarifni tekshiring.</warning>
`,
  },
  {
    slug: 'zararsizlik-narxi',
    title: "Zararsizlik narxi (breakeven) hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "Mahsulot uchun minimal foydali sotuv narxini aniqlash.",
    content: `
## Zararsizlik narxi nima?

Zararsizlik narxi (breakeven) — barcha xarajatlarni qoplaydigan eng past sotuv narxi. Undan past sotish zarar demakdir.

## Formula

\`Zararsizlik = Tannarx + Komissiya + Logistika + Qaytarish zarari + Reklama + Soliq\`

## Daromadchi'da hisoblash

**Dashboard → Kalkulyator** ni oching:

1. Marketplace'ni tanlang: **Uzum** yoki **Yandex**
2. Kategoriyani tanlang — komissiya foizi o'zi qo'yiladi
3. **Tannarx** ni kiriting
4. **Logistika** ni kiriting (marketplace tarifidan)
5. **Qaytarish foizi** ni kiriting — haqiqiy foizni **Mahsulot tahlili** jadvalidagi **% qaytarish** ustunidan oling
6. **Reklama xarajati** ni kiriting

Kalkulyator **Zararlanmaslik** qiymatini boshqa ko'rsatkichlar (marja, ROI, DRR) bilan birga chiqaradi.

## Maqsadli foyda qo'shish

\`Sotuv narxi = Zararsizlik × (1 + Maqsadli marja / 100)\`

**Misol:**
- Zararsizlik: 45,000 so'm
- Maqsad: 20% marja
- **Sotuv narxi: 54,000 so'm**

## Joriy narxingiz yetarlimi?

Kalkulyatordagi **Reality Check** bo'limi joriy narx bilan oyiga qancha foyda (yoki zarar) chiqishini ko'rsatadi. Narx zararli bo'lsa, kalkulyator uni qanchaga ko'tarish kerakligini aytadi.

<info>Komissiya foizi kategoriya bo'yicha oldindan qo'yiladi, lekin uni qo'lda o'zgartirish mumkin — o'z shartnomangizdagi foiz aniqroq.</info>
`,
  },
  {
    slug: 'marja-hisoblash',
    title: "Foyda marjasini hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "Mahsulot va do'kon darajasida foyda marjasi ko'rsatkichlari.",
    content: `
## Marja nima?

Marja — foydaning tushumdagi ulushi, foizda. Daromadchi'da marja **sof marja** ma'nosida ishlatiladi: tannarx va marketplace ushlanmalaridan keyin qolgan qism.

\`Marja = Sof foyda / Tushum × 100\`

## Marja va ustama (nasenka) bir narsa emas

Bu ikkisi tez-tez adashtiriladi:

- **Marja** — foyda **sotuv narxidan** foiz sifatida
- **Ustama** — foyda **tannarxdan** foiz sifatida

50,000 so'mga olib 100,000 so'mga sotsangiz: ustama 100%, marja esa 50%.

## Marjani qayerda ko'rish mumkin

### Mahsulot bo'yicha
**Dashboard → Mahsulot tahlili** jadvalidagi **Marja** ustuni. Sahifaning yuqorisida do'kon bo'yicha **o'rtacha marja**, hamda past va yuqori marjali mahsulotlar soni ko'rsatiladi.

### Variantlar bo'yicha
Ota-qatorni ochsangiz, har bir variant (rang, o'lcham) uchun marja alohida ko'rinadi — bittasi butun guruh raqamini pasaytirayotgan bo'lishi mumkin.

### Rejalashtirishda
**Kalkulyator** va **Birlik iqtisodiyoti** jadvali marjani siz kiritgan qiymatlar asosida hisoblaydi.

## Tannarxsiz marja bo'lmaydi

Tannarx kiritilmagan mahsulotning marjasi haqiqiydan yuqori chiqadi — chunki eng katta xarajat hisobga olinmaydi. Tannarxni **Mahsulot tahlili** jadvalida qalam belgisi orqali yoki **Mahsulotlar** sahifasida to'ldiring.

## Ideal marja qancha?

| Kategoriya | Minimal marja | Tavsiya etilgan |
|---|---|---|
| Elektronika | 8% | 15-20% |
| Kiyim | 20% | 35-50% |
| Kosmetika | 25% | 40-60% |
| Uy jihozlari | 15% | 25-35% |

<info>Marja past bo'lsa ham, savdo hajmi katta bo'lsa umumiy foyda yuqori bo'lishi mumkin. Shuning uchun marjani **sotuv ulushi** ustuni bilan birga o'qing.</info>
`,
  },
  {
    slug: 'logistika-xarajatlari',
    title: "Logistika xarajatlarini hisoblash",
    category: 'Birlik Iqtisodiyoti',
    categorySlug: 'birlik-iqtisodiyoti',
    summary: "FBO va FBS logistika tariflarini birlik iqtisodiyoti kalkulyatoriga qo'shish.",
    content: `
## Logistika xarajatlari

Yetkazib berish narxi mahsulotning og'irligi, hajmi va ombor modeliga (FBO/FBS, FBY/FBS/DBS) qarab farqlanadi. Bu — komissiyadan keyingi ikkinchi eng katta ushlanma.

## Daromadchi logistikani qanday hisobga oladi

### Kalkulyatorda — qo'lda
**Dashboard → Kalkulyator** dagi **Logistika (so'm)** maydoniga bir dona uchun yetkazib berish xarajatini kiritasiz. Raqamni marketplace tarifidan olasiz.

### Birlik iqtisodiyoti jadvalida — qo'lda va foizli
**Birlik iqtisodiyoti** jadvalida yetkazib berish alohida ustun bo'lib turadi. Sozlamalardagi **Oxirgi milya (%)** esa narxdan foiz sifatida qo'shiladi — tarifi foizga bog'liq bo'lgan yetkazib berish uchun qulay.

### F&Z hisobotda — haqiqiy raqam
**F&Z hisobot** sahifasidagi **Yetkazib berish** qatori taxmin emas: u marketplace hisobotidan olinadi. Marketplace hali yakuniy hisobotni bermagan bo'lsa, qiymat yonida **≈** turadi va hisobot kelgach haqiqiysiga almashadi.

<info>Ya'ni rejalashtirish uchun kalkulyatordagi taxminni, o'tgan davrni baholash uchun F&Z hisobotdagi haqiqiy raqamni ishlating.</info>

## Qaytarish xarajati

Qaytarilgan tovar logistikani ikki marta to'laydi — u yerga ham, qaytib ham.

\`Qaytarish xarajati = (Qaytarish % / 100) × (Logistika × 2)\`

Qaytarish foizini kalkulyatorga kiritasiz. Haqiqiy foizni **Mahsulot tahlili** jadvalidagi **% qaytarish** ustunidan olasiz — u sizning o'z ma'lumotingizdan hisoblanadi.

## Tariflarni qayerdan olish

- **Uzum Market**: seller.uzum.uz kabinetidagi tariflar bo'limi
- **Yandex Market**: hamkor kabinetidagi tariflar bo'limi

<warning>Tariflar o'zgarib turadi va hududga bog'liq. Daromadchi ularni avtomatik yangilamaydi — kiritgan qiymatingizni vaqti-vaqti bilan tekshiring.</warning>
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

Kirganingizda ko'rinadigan asosiy kartochkalar.

## Yuqori panel kartochkalari

### Tushum
Tanlangan davrdagi umumiy sotuv tushumi. Yonida oldingi shu uzunlikdagi davr bilan taqqoslash foizi ko'rsatiladi.

### Foyda
Tannarx va marketplace ushlab qolgan summalardan keyingi sof foyda. Tannarx kiritilmagan mahsulotlar bu raqamni pasaytiradi — **Mahsulotlar** sahifasida tannarxni to'ldiring.

### Buyurtmalar
Davr uchun buyurtmalar soni. Bekor qilinganlar hisobga olinmaydi.

### Qoldiq
Hozirgi umumiy qoldiq miqdori.

## Grafiklar

### Savdo grafigi
Tanlangan davr bo'yicha kunlik tushum tendentsiyasi.

### Kategoriya tahlili
Qaysi kategoriyadan qancha tushum kelgani — donut diagramma.

### Top mahsulotlar
Davr ichida eng ko'p tushum keltirgan mahsulotlar ro'yxati.

### Qoldiq ogohlantirishlari
Qoldig'i tugayotgan mahsulotlar. To'liq ro'yxat — **Ogohlantirishlar** sahifasida.

## Vaqt oralig'ini o'zgartirish

Yuqori qismdagi sana filtri orqali:
- Kecha
- 7 kun
- 30 kun
- 90 kun
- Shu oy

## Marketplace bo'yicha ajratish

Bir nechta do'kon ulangan bo'lsa, yuqoridagi marketplace tugmalari orqali faqat bitta marketplace ma'lumotlarini ko'rishingiz mumkin.

<info>Barcha raqamlar oxirgi sinxronizatsiyaga asoslanadi. Oxirgi sinxronizatsiya vaqti «Sinxronizatsiya» sahifasida ko'rinadi.</info>
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

F&Z (P&L — Profit & Loss) hisobot do'koningizning moliyaviy natijasini oylar kesimida ko'rsatadi. **Dashboard → F&Z hisobot** sahifasida ochiladi.

## Hisobot tarkibi

| Qator | Ma'nosi |
|---|---|
| **Umumiy tushum** | Yetkazilgan buyurtmalar tushumi |
| **Komissiya** | Marketplace komissiyasi |
| **Boshqa** | Marketplace'ning boshqa ushlab qolishlari: ekvayring, reklama, jarimalar |
| **Yetkazib berish** | Logistika xarajatlari |
| **Marketplace to'lovi** | Tushum − komissiya − yetkazib berish − boshqa |
| **Tannarx (COGS)** | Sotilgan tovarlarning tannarxi |
| **Sof foyda** | Yakuniy natija |

## "Jarayonda" qatori

Yetkazilmagan buyurtmalar alohida ko'rsatiladi: ularning daromadi yetkazilgandan keyin hisoblanadi va hozircha foydaga kirmaydi. Bu — hisobotni haqiqiy pul bilan mos qilib turadigan qism.

## "≈" belgisi

Ba'zi qiymatlar yonida **≈** turishi mumkin. Bu — marketplace hali yakuniy hisobotni bermagani va raqam foizlar asosida taxmin qilinganini bildiradi. Marketplace hisoboti kelgach, raqam haqiqiysiga almashadi.

## Tannarxni to'g'ridan-to'g'ri tahrirlash

Tannarx qatoridagi tugma orqali oyning tannarxini o'sha yerda to'ldirishingiz mumkin — mahsulotlar ro'yxatiga o'tmasdan. Tannarx bo'sh bo'lsa, sof foyda haqiqiydan yuqori chiqadi.

## Oylar bo'yicha jadval

Pastdagi jadvalda har bir oy alohida qator: tushum, komissiya, boshqa ushlanmalar, tannarx va sof foyda. O'sish yoki tushishni shu yerda ko'rasiz.

## Eksport

**Eksport** tugmasi hisobotni jadval fayli sifatida yuklab beradi.

<info>Tannarx kiritilmagan bo'lsa, P&L faqat marketplace ushlanmalarini ko'rsatadi — foyda haqiqiydan katta bo'lib ko'rinadi.</info>
`,
  },
  {
    slug: 'kategoriya-tahlili',
    title: "Kategoriya va mahsulot tahlili",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Kategoriyalar bo'yicha tushum, ABC tasnifi va ABC-XYZ sahifasi.",
    content: `
## Kategoriya tahlili

Daromadchi sotuvlaringizni kategoriya bo'yicha ajratib ko'rsatadi.

## Dashboard'da ko'rish

Asosiy dashboard'dagi **Kategoriyalar** donut diagrammasida har bir kategoriyaning tushum ulushi ko'rinadi. Diagramma yonidagi ro'yxatda summalar yozilgan.

Kunlik hisobot Telegram'da ham kategoriyalar bo'yicha taqsimotni yuboradi.

## Mahsulot darajasidagi tahlil

**Dashboard → Mahsulot tahlili** sahifasida yuqorida umumiy raqamlar, pastida esa **Mahsulotlar samaradorligi** jadvali turadi: har bir mahsulot bo'yicha sotuv, tushum, foyda, marja va ABC sinfi. Batafsil — «Tovar tahlili jadvali» maqolasida.

## ABC tahlili

Mahsulotlar tushumdagi ulushiga qarab tasniflanadi. Ro'yxat tushum bo'yicha kamayish tartibida jamlanadi va:

| Sinf | Qoida |
|---|---|
| **A** | Jamlangan tushum 80% ga yetguncha |
| **B** | 80% dan 95% gacha |
| **C** | Qolgan hammasi |

ABC ustuni **Mahsulotlar samaradorligi** jadvalida ko'rinadi.

## ABC-XYZ sahifasi

**Dashboard → ABC-XYZ** sahifasi bir qadam uzoqroqqa boradi: ABC (daromad) ni XYZ (talab barqarorligi) bilan birga ko'rsatadi. AX — barqaror va daromadli, CZ — kam daromadli va oldindan aytib bo'lmaydigan.

## Top mahsulotlar

Dashboard'dagi **Top mahsulotlar** bloki — davr ichida eng ko'p tushum keltirganlari. To'liq ro'yxat va saralash **Mahsulotlar** sahifasida.

<info>Kategoriya ma'lumoti marketplace bergan kategoriyaga asoslanadi. Kategoriyasi yo'q tovarlar «Kategoriyasiz» qatoriga tushadi.</info>
`,
  },
  {
    slug: 'tovar-tahlili-jadvali',
    title: "Tovar tahlili jadvali",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "14 ta ustun, jadval sozlamalari va narx / tannarx / qoldiqni joyida tahrirlash.",
    content: `
## Tovar tahlili jadvali

**Dashboard → Mahsulot tahlili** sahifasidagi asosiy jadval. Ilgari «Top sotilgan» va «Mahsulot bo'yicha marja tahlili» ikki alohida jadval edi — endi ular bitta jadvalga birlashtirilgan, chunki bir mahsulot haqidagi savolga ikki joyga qarab javob berish shart emas.

Har bir qator — mahsulot. Variantlari (rang, o'lcham) bor tovar bitta ota-qatorga yig'iladi; uni ochib har bir variantni alohida ko'rish mumkin.

## Ustunlar

| Ustun | Ma'nosi |
|---|---|
| **Mahsulot** | Nomi va varianti. Har doim ko'rinadi |
| **Yetkazilgan** | Davr ichida yetkazilgan dona |
| **Yo'lda** | Yetkazilmoqda — hali foydaga kirmagan |
| **Bekor qilingan** | Bekor qilingan buyurtmalar |
| **Qaytarilgan** | Qaytarilgan dona |
| **% qaytarish** | Qaytarilgan ÷ (yetkazilgan + qaytarilgan) |
| **Tushum** | Davr tushumi |
| **Sotuv ulushi** | Mahsulot umumiy tushumning necha foizi |
| **O'rtacha narx** | Tushum ÷ sotilgan dona — chegirmalardan keyingi haqiqiy narx |
| **Narx** | Joriy sotuv narxi |
| **Tannarx** | Sizning tannarxingiz |
| **Foyda** | Tushum − tannarx − marketplace ushlanmalari |
| **Marja** | Foydaning tushumdagi ulushi (%) |
| **ABC** | A / B / C sinfi |

<info>Bu ustunlarning barchasi ikkala marketplace uchun ham hisoblanadi. Faqat bitta marketplace bera oladigan ko'rsatkichlar jadvalga qo'shilmagan — aks holda Yandex qatorlari doim bo'sh turgan bo'lardi.</info>

## Jadval sozlamalari

Jadval ustidagi **Jadval sozlamalari** tugmasi ustunlarni yoqish va o'chirish panelini ochadi. Belgini olib tashlasangiz — ustun yo'qoladi, qaytarsangiz — qayta chiqadi.

Tayyor to'plamlar ham bor:
- **Minimal** — sotildimi va daromad keltiradimi
- **Savdo** — dona, qaytarish, ulush, ABC
- **Pul** — narx, tannarx, foyda, marja

Tanlovingiz brauzerda saqlanadi va keyingi kirishda ham shundayligicha qoladi. **Mahsulot** ustunini o'chirib bo'lmaydi — aks holda jadval nomsiz raqamlar to'plamiga aylanardi.

## Qiymatlarni tahrirlash

Uchta ustunni to'g'ridan-to'g'ri jadvalda o'zgartirish mumkin — qator ustiga kursorni olib borsangiz **qalam belgisi** chiqadi:

- **Narx**
- **Tannarx**
- **Qoldiq**

<warning>Bu tahrirlar faqat Daromadchi ichida qoladi. Marketplace listingiga hech narsa yuborilmaydi — narx, nom yoki boshqa hech nima o'zgarmaydi.</warning>

Narx va qoldiq marketplace'dan keladi, shuning uchun sizning qiymatingiz alohida saqlanadi va ko'rsatishda ustiga qo'yiladi. Maydonni bo'shatsangiz, marketplace'ning o'z raqami qaytadi — tahrir haqiqiy qiymatni yashiradi, o'chirmaydi.

Ota-qatorda **Narx** va **Tannarx** ni tahrirlash barcha variantlarga bir vaqtda qo'llanadi. Qoldiqda ota-qator uchun qalam yo'q: variantlarning qoldig'i har xil bo'ladi va ularni bitta raqamga tenglashtirish noto'g'ri bo'lardi.

## Nima uchun tannarx muhim

Tannarx bo'sh bo'lsa, **Foyda** va **Marja** ustunlari mahsulotni haqiqiydan foydaliroq ko'rsatadi. Tannarxni shu yerda yoki **Mahsulotlar** sahifasida to'ldiring.
`,
  },
  {
    slug: 'qidiruv-iboralari',
    title: "Qidiruv iboralari (kalit so'zlar) tahlili",
    category: 'Analitika',
    categorySlug: 'analitika',
    summary: "Sahifa nimani ko'rsatadi va nega u marketplace API ochilgunicha bo'sh turadi.",
    content: `
## Qidiruv iboralari tahlili

Mijozlar qaysi so'zlarni yozib mahsulotingizga kelishini bilish SEO va reklama uchun muhim. Daromadchi'da bu **Dashboard → Qidiruv iboralari** sahifasida ko'rsatiladi.

## Sahifa nimani ko'rsatadi

- Ibora va u qaysi mahsulotga tegishli
- Ko'rsatishlar (impressions)
- Kliklar
- CTR (kliklar ÷ ko'rsatishlar)
- Buyurtmalar
- Sarf

<warning>Hozircha bu sahifa bo'sh turadi. Qidiruv iboralari ma'lumotlari marketplace'ning reklama/qidiruv API'sidan keladi, u esa hali ulanmagan — Uzum Market ham, Yandex Market ham bu ma'lumotni ochmagan. API ochilganda sahifa avtomatik to'ladi.</warning>

## Shu vaqtgacha nima qilish mumkin

### Kalit so'zlarni marketplace kabinetida ko'ring
Kabinetdagi qidiruv hisoboti — hozircha yagona manba.

### Mahsulot nomini tekshiring
**Dashboard → Mahsulotlar** ro'yxatida mahsulot nomlari qanday yozilganini ko'ring. Nom qidiruvga to'g'ridan-to'g'ri ta'sir qiladi.

### Natijani sotuv orqali o'lchang
Nom yoki rasmni o'zgartirgandan keyin **Mahsulotlar samaradorligi** jadvalida o'sha mahsulotning tushumi va sotuv ulushi qanday o'zgarganini kuzating. Bu — kliklarsiz ham ishlaydigan o'lchov.

<info>Sahifadagi qisqartmalar (CTR, CPC) dashboard'dagi «Qisqartmalar» bo'limida izohlangan.</info>
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
    summary: "Aylanmaga qarab belgilanadigan tariflar, narxlar va Bepul tarifda nima qoladi.",
    content: `
## Tarif aylanmaga qarab belgilanadi

Daromadchi'da tarif tanlanmaydi — u sizning **so'nggi 30 kunlik sof aylanmangizga** qarab aniqlanadi. Aylanma o'sganda tarif ham ko'tariladi.

| So'nggi 30 kunlik aylanma | Tarif |
|---|---|
| 12 mln so'mgacha | **Bepul** |
| 12–50 mln so'm | **Pro** |
| 50–120 mln so'm | **Pro+** |
| 120–180 mln so'm | **Biznes** |
| 180 mln so'mdan yuqori | **Enterprise** |

## Narxlar

| Tarif | Oylik | Yillik to'lovda (oyiga) |
|---|---|---|
| Bepul | 0 so'm | — |
| Pro | 150 000 so'm | 125 000 so'm |
| Pro+ | 250 000 so'm | 225 000 so'm |
| Biznes | 500 000 so'm | 450 000 so'm |
| Enterprise | Kelishuv asosida | — |

<info>Enterprise uchun yagona e'lon qilingan narx yo'q — bu tarif alohida kelishiladi.</info>

## Pullik tariflar orasida farq bormi?

Imkoniyatlar jihatidan — **yo'q**. Pro, Pro+, Biznes va Enterprise bir xil funksiyalarni beradi; ular aylanma va narx bilan farqlanadi. Pro+ va undan yuqorisida qo'shimcha ravishda **prioritet qo'llab-quvvatlash** bor.

## Bepul tarifda nima qoladi

Doimiy bepul:
- Dashboard (tushum va foyda bilan)
- Mahsulotlar
- Buyurtmalar va ular bo'yicha bildirishnomalar (yangi buyurtma, bekor qilish, kam qoldiq)
- **Uzum va Yandex Market** — ikkalasi ham, har qanday tarifda
- Chrome kengaytmasi

Sinov davri tugagach yopiladigan bo'limlar:
- Mahsulot tahlili
- Qoldiqlar sahifasi va qoldiq sinxronizatsiyasi
- Moliya va to'lovlar (F&Z hisobot)
- Birlik iqtisodiyoti

<info>Barcha tariflar ${TRIAL_UZ}lik bepul sinov bilan boshlanadi. Karta ma'lumotlari talab qilinmaydi.</info>
`,
  },
  {
    slug: 'tolov-usullari',
    title: "To'lov usullari",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "Kartani biriktirish, avtomatik yangilash, oylik va yillik to'lov.",
    content: `
## To'lov usuli

Daromadchi to'lovni **bank kartasi** orqali qabul qiladi. Karta ATMOS to'lov tizimi orqali biriktiriladi.

## Kartani biriktirish

**Dashboard → Tarif va to'lov** sahifasida:

1. Tarifni tanlang va **Oylik** yoki **Yillik** to'lovni belgilang
2. Karta raqami va amal qilish muddatini kiriting
3. Telefoningizga kelgan SMS kodini kiriting
4. Tasdiqlangach tarif darhol faollashadi

<info>Karta raqami Daromadchi serverlarida to'liq saqlanmaydi — to'lov tizimi bergan xavfsiz identifikator saqlanadi.</info>

## Avtomatik yangilash

Karta biriktirilgach **Avtomatik yangilash** yoqiladi: davr tugashidan oldin to'lov kartadan o'zi yechiladi. Uni istalgan vaqtda o'chirib qo'yish mumkin — shundan keyin keyingi to'lov olinmaydi.

## Oylik va yillik

Yillik to'lovda oylik narx pastroq — aniq summalar «Tariflar va narxlar» maqolasidagi jadvalda. Yillik obuna bir marta, 12 oy uchun to'liq summada olinadi.

## To'lov o'tmasa

To'lov muvaffaqiyatsiz bo'lsa, sahifada sabab ko'rsatiladi va qayta urinib ko'rish mumkin. To'lovlar tarixi shu yerda, ro'yxat ko'rinishida turadi.

<warning>To'lov ma'lumotlari shifrlangan aloqa orqali uzatiladi. Daromadchi hech qachon kartangizning to'liq raqamini yoki parolingizni so'ramaydi.</warning>
`,
  },
  {
    slug: 'tarifni-ozgartirish',
    title: "Tarifni o'zgartirish yoki bekor qilish",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: "Tarifni yangilash, pasaytirish yoki obunani bekor qilish.",
    content: `
## Tarifni o'zgartirish

**Dashboard → Tarif va to'lov** sahifasida:

1. Tarif tanlash oynasini oching
2. Aylanmangizga mos keladigan tarif ajratib ko'rsatilgan bo'ladi — uni yoki boshqasini tanlang
3. **Oylik** yoki **Yillik** to'lovni belgilang
4. Tasdiqlang

Yangi tarif to'lov o'tgach darhol faollashadi.

## Aylanma paneli

Sahifadagi aylanma paneli so'nggi 30 kunlik sof aylanmangizni va u qaysi tarif oralig'iga tushishini ko'rsatadi. Panel faqat ma'lumot uchun — u o'z-o'zidan pul yechmaydi va tarifni almashtirmaydi. Aylanma keyingi tarif chegarasiga yaqinlashsa, panel shu haqda ogohlantiradi.

## Obunani bekor qilish

**Tarifni bekor qilish** tugmasini bosing va tasdiqlang.

Bekor qilish nimani anglatadi:
- **Keyingi to'lov olinmaydi**
- To'langan davr oxirigacha barcha imkoniyatlar ochiq qoladi
- Davr tugagach hisob o'zi Bepul tarifga o'tadi

Bu — pul qaytarish emas va darhol uzib qo'yish ham emas. Hali hech qanday to'langan davr bo'lmasa, Bepul tarifga darhol o'tiladi.

## Bekor qilishni qaytarish

To'langan davr hali tugamagan bo'lsa, **Tarifni tiklash** tugmasi orqali avtomatik yangilashni qaytarib yoqishingiz mumkin.

## Ma'lumotlar saqlanishi

Obunani bekor qilganingizdan so'ng hisobingiz va ma'lumotlaringiz o'chirilmaydi — biz hisoblarni avtomatik o'chirmaymiz. Ma'lumotlaringiz hisobingiz mavjud bo'lgunicha saqlanadi va istalgan vaqtda qayta obuna bo'lishingiz mumkin.

Hisobingizni butunlay o'chirishni istasangiz, buni sozlamalardagi "Hisobni o'chirish so'rovi" funksiyasi orqali yoki privacy@daromadchi.uz manziliga so'rov yuborib amalga oshirishingiz mumkin.

<info>Narx o'zgarsa, mavjud obunachilarga oldindan xabar beriladi — sizdan hozir kelishilgan summadan boshqasi olinmaydi.</info>
`,
  },
  {
    slug: 'bepul-sinov',
    title: "Bepul sinov davri",
    category: "To'lov va Tariflar",
    categorySlug: 'tolov-va-tariflar',
    summary: `${TRIAL_UZ}lik bepul sinov davridan qanday foydalanish.`,
    content: `
## Bepul sinov davri

Yangi ro'yxatdan o'tgan foydalanuvchilar **${TRIAL_UZ}lik** bepul sinov davrini oladi.

## Nima kiritilgan?

Sinov davrida pullik bo'limlar ham ochiq bo'ladi:

- **Mahsulot tahlili** — 14 ustunli jadval, ABC, marja
- **Qoldiqlar** sahifasi va qoldiq sinxronizatsiyasi
- **Moliya va to'lovlar** — F&Z (P&L) hisobot
- **Birlik iqtisodiyoti** kalkulyatori

## Sinovdan keyin ham bepul qoladigan bo'limlar

- Dashboard (tushum va foyda bilan)
- Mahsulotlar
- Buyurtmalar va bildirishnomalar (yangi buyurtma, bekor qilish, kam qoldiq)
- **Uzum va Yandex Market** — ikkalasi ham
- Chrome kengaytmasi

## Karta talab qilinmaydi

Sinov davri uchun karta yoki to'lov ma'lumotlari kerak emas. Faqat email bilan ro'yxatdan o'ting.

## Sinov tugagandan so'ng

Tugashiga ${TRIAL_REMINDER_DAYS} kun qolganda ilovada va Telegram orqali eslatma yuboriladi. Sinov tugagach, tarif tanlamasangiz, yuqoridagi to'rt bo'lim yopiladi — hisob esa Bepul tarifda ishlashda davom etadi.

## Sinov davri tugash sanasini ko'rish

**Tarif va to'lov** sahifasida sinov tugash sanasi va aylanmangizga mos tarif ko'rsatiladi.

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
## Hisobingiz qayerda

Hisobga oid ma'lumotlar ikki sahifada:

- **Dashboard → Hisob** — email, ro'yxatdan o'tgan sana, joriy tarif va uning muddati
- **Dashboard → Profil** — ism, email va telefon maydonlari, hamda xavfsizlik bo'limi

## Tarif holati

**Hisob** sahifasida joriy tarif, sinov davri tugash sanasi va tarif amal qilish muddati ko'rinadi. To'lov va tarif almashtirish — **Tarif va to'lov** sahifasida.

## Til

Til yuqori paneldagi **UZ / RU / EN** tugmalari orqali almashtiriladi va butun ilovaga qo'llanadi.

Telegram bildirishnomalari tili **alohida** — u botni ulaganda tanlanadi va botning o'zida o'zgartiriladi.

## Parolni o'zgartirish

Parolni tiklash havolasi orqali o'zgartiriladi:

1. Tizimdan chiqing va **Kirish** sahifasini oching
2. **«Parolni unutdingizmi?»** ni bosing
3. Email manzilingizni kiriting
4. Xatdagi havola orqali yangi parol o'rnating

<info>Ikki faktorli autentifikatsiya (2FA), sessiyalar ro'yxati va xavfsizlik jurnali Profil sahifasida ko'rinadi, lekin hali ishga tushirilmagan — ular tayyorlanmoqda.</info>

## Marketplace ulanishlari

Do'kon tokenlari va yozish rejimi — **Sozlamalar** sahifasida. Batafsil: «API token qo'shish va boshqarish».

## Hisobni o'chirish

**Hisob** sahifasidagi «Hisobni o'chirish so'rovi» tugmasi orqali. Batafsil: «Hisobni o'chirish».
`,
  },
  {
    slug: 'api-token-sozlash',
    title: "API token qo'shish va boshqarish",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Uzum va Yandex Market tokenlarini qo'shish, yangilash va yozish rejimini boshqarish.",
    content: `
## API token nima?

API token — Daromadchi'ga marketplace hisobingizdan ma'lumotlarni **o'qish** uchun ruxsat beruvchi kalit. Har bir do'kon uchun alohida token kerak.

## Sukut bo'yicha: faqat o'qish

Yangi ulangan do'kon **«Faqat o'qish»** rejimida ishlaydi. Bu rejimda Daromadchi hech narsa yozmaydi: narx, nom, listing, buyurtma holati — hech biri o'zgarmaydi.

## Uzum Market tokeni

1. seller.uzum.uz saytiga kiring
2. **Sozlamalar → API integratsiya** bo'limiga o'ting
3. Yangi kalit yarating va nom bering (masalan: «Daromadchi»)
4. Token ko'rsatiladi — nusxalab oling

<warning>Token faqat bir marta ko'rsatiladi. Darhol nusxalab saqlang.</warning>

## Yandex Market tokeni

Yandex Market uchun ikkita qiymat kerak:

- **OAuth Token** — Yandex Market Partner API tokeni
- **Campaign ID** — kampaniya raqami, faqat raqamlardan iborat

Campaign ID noto'g'ri bo'lsa (email yoki havola kiritilsa), saqlashda darhol xato ko'rsatiladi.

## Daromadchi'ga kiritish

**Sozlamalar** sahifasida kerakli marketplace kartochkasini toping:

1. Token maydoniga tokenni joylashtiring
2. Yandex uchun Campaign ID ni ham kiriting
3. **Saqlash** tugmasini bosing
4. **Sinxronlash** tugmasi bilan birinchi yuklashni boshlang

Kartochkada do'kon holati («Ulangan» / «Ulanmagan») va oxirgi sinxronizatsiya vaqti ko'rinadi.

## Tokenni yangilash

Token eskirgan yoki bekor qilingan bo'lsa, marketplace kabinetida yangisini oling va shu maydonga kiritib saqlang. Eski ma'lumotlar yo'qolmaydi.

## Ixtiyoriy: «Ostatok sinxronizatsiyasi (tahrir rejimi)»

Bir jismoniy tovar ikki marketplace'da sotilayotgan bo'lsa, bir joyda sotilgani ikkinchisida ham kamayishi kerak. Buning uchun do'kon uchun **tahrir rejimi**ni yoqish mumkin.

Yoqishdan oldin tasdiqlash katagini belgilashingiz talab qilinadi. Yoqilganda:

- Daromadchi faqat **ostatok (qoldiq soni)** ni yangilaydi
- Narx, nom, listing, buyurtma holati, hisob-fakturalar — hech qachon o'zgarmaydi
- Har bir yozuv jurnalga yoziladi

Oxirgi umumiy birlik qanday taqsimlanishini ham tanlaysiz: oxirgisini bloklash, kanallar orasida bo'lish, yoki o'chirish.

Uzum uchun bu rejim tokendan **SKU_UPDATE** huquqini talab qiladi.

<warning>Tahrir rejimi standart holatda o'chirilgan. Siz uni o'zingiz yoqmaguningizcha, hech qanday do'koningizga hech narsa yozilmaydi.</warning>

## Bir nechta do'kon

Uzum va Yandex Market kartochkalari alohida — ikkalasini bir vaqtda ulash mumkin. Dashboard'dagi marketplace tugmalari orqali ma'lumotni alohida ko'rasiz.
`,
  },
  {
    slug: 'jamoa-boshqaruvi',
    title: "Jamoa boshqaruvi",
    category: 'Hisob Sozlamalari',
    categorySlug: 'hisob-sozlamalari',
    summary: "Bo'lim tayyorlanmoqda. Hozircha ma'lumotni qanday ulashish mumkin.",
    content: `
## Jamoa boshqaruvi — tez orada

**Dashboard → Jamoa** sahifasi hozircha «Yaqin orada» holatida. Bo'lim ustida ishlanmoqda va tayyor bo'lganda bildiramiz.

## Hozircha qanday ishlaydi

Bitta Daromadchi hisobi — bitta foydalanuvchi. Bir hisobga bir nechta **do'kon** ulash mumkin (Uzum va Yandex Market, har biri alohida token bilan), lekin hisobning o'zi bitta kirish ma'lumotiga ega.

## Hamkasbga ma'lumot ko'rsatish kerak bo'lsa

### Hisobotni eksport qiling
Ko'pchilik jadvallarda **Eksport** tugmasi bor — F&Z hisobot, ogohlantirishlar, qidiruv iboralari, buyurtmalar. Faylni yuborish hisobga kirish huquqini bermaydi.

### Telegram bildirishnomalaridan foydalaning
Kunlik hisobot va ogohlantirishlar Telegram orqali keladi — omborchi yoki menejerga kerakli ma'lumot shu tarzda yetib boradi.

<warning>Parolingizni bo'lishmang. Xavfsizlik sozlamalari «Hisob xavfsizligi» maqolasida tasvirlangan.</warning>
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

O'chirish so'rov orqali amalga oshiriladi — tugmani bosishingiz bilan darhol o'chib ketmaydi.

## O'chirishdan oldin

- Kerakli hisobotlarni eksport qiling — o'chirilgandan keyin tiklab bo'lmaydi
- Aktiv obunani bekor qiling (**Tarif va to'lov → Tarifni bekor qilish**)
- Marketplace kabinetidagi Daromadchi tokenini bekor qiling

## So'rov yuborish

**Dashboard → Hisob** sahifasidagi **«Hisobni o'chirish so'rovi»** tugmasini bosing.

So'rov operatorga yuboriladi va sizga qabul qilingani haqida tasdiq ko'rsatiladi. O'chirish nazorat ostidagi jarayon — u qo'lda bajariladi.

## Muqobil: privacy@daromadchi.uz

So'rovni to'g'ridan-to'g'ri **privacy@daromadchi.uz** manziliga ham yuborishingiz mumkin. Javob muddati — 15 ish kuni (ZRU-547 Qonuni talabi).

## Nima o'chiriladi

Shaxsiy ma'lumotlaringiz va do'kon ma'lumotlaringiz o'chiriladi. To'lov yozuvlari qonun talabiga ko'ra **anonimlashtirilgan holda** saqlanadi — ular sizga bog'lanmaydi.

## Obunani bekor qilish — bu boshqa narsa

Obunani bekor qilsangiz hisobingiz o'chirilmaydi. Biz hisoblarni avtomatik o'chirmaymiz: ma'lumotlaringiz hisob mavjud bo'lgunicha saqlanadi va istalgan vaqtda qayta obuna bo'lishingiz mumkin.

<warning>O'chirish bajarilgandan keyin ma'lumotlar tiklanmaydi. Kerakli narsani oldindan eksport qiling.</warning>
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

Quyidagilar hisobingizni himoya qilishning amaldagi yo'llari.

## Kuchli parol

Yaxshi parol:
- Kamida 12 ta belgi
- Katta va kichik harflar
- Raqamlar
- Maxsus belgilar (!@#$)

Parolni **Kirish → «Parolni unutdingizmi?»** orqali istalgan vaqt yangilashingiz mumkin.

<info>Ikki faktorli autentifikatsiya (2FA), sessiyalar ro'yxati va kirish jurnali Profil sahifasida ko'rinadi, lekin hali ishga tushirilmagan. Ular tayyor bo'lganda shu maqola yangilanadi.</info>

## Barcha qurilmalardan chiqish

**Chiqish** tugmasi sessiyani barcha qurilmada tugatadi — cookie'lar butun domen bo'ylab tozalanadi. Boshqa odam ishlatgan kompyuterda ishni tugatgach chiqishni unutmang.

## API tokenlaringiz

- Token shifrlangan holda saqlanadi
- Sukut bo'yicha faqat o'qish uchun ishlatiladi — «Ostatok sinxronizatsiyasi» rejimini o'zingiz yoqmaguningizcha hech narsa yozilmaydi
- Tokendan shubhalansangiz, marketplace kabinetida uni bekor qiling va yangisini oling

## Fishingdan ehtiyot bo'ling

Daromadchi hech qachon so'ramaydi:
- Parolingizni
- API tokeningizni (uni faqat siz Sozlamalar sahifasiga kiritasiz)
- Kartangizning to'liq raqamini yoki SMS kodini

Rasmiy manzillar: **daromadchi.uz**, Telegram kanali **@daromadchi_uz**.

## Shubhali holat bo'lsa

1. Parolni darhol yangilang
2. Marketplace tokenlarini bekor qilib, yangisini oling
3. **support@daromadchi.uz** manziliga yozing

<warning>Daromadchi hech qachon parol yoki API token so'ramaydi. Bunday so'rov kelsa — bu fishing.</warning>
`,
  },
]

const CATEGORY_NAMES: Record<string, Record<string, string>> = {
  boshlash:               { uz: 'Boshlash',              ru: 'Начало работы',         en: 'Getting started' },
  bildirishnomalar:       { uz: 'Bildirishnomalar',       ru: 'Уведомления',           en: 'Notifications' },
  'chrome-kengaytmasi':   { uz: 'Chrome Kengaytmasi',    ru: 'Расширение Chrome',     en: 'Chrome Extension' },
  'reklama-tahlili':      { uz: 'Reklama xarajatlari',    ru: 'Расходы на рекламу',   en: 'Ad spend' },
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
  'bildirishnomalar':       { ru: { title: 'Типы уведомлений и настройки',            summary: 'Заказы, отмены, остатки и отчёты — и где всё это настраивается.' },        en: { title: 'Notification types and settings',        summary: 'Orders, cancellations, stock and reports — and where to configure them.' } },
  'telegram-ulash':         { ru: { title: 'Подключение Telegram-бота',               summary: 'Получайте уведомления Daromadchi через Telegram.' },                      en: { title: 'Connect Telegram bot',                   summary: 'Receive Daromadchi notifications via Telegram.' } },
  'chrome-kengaytma':       { ru: { title: 'О расширении Chrome',                     summary: 'Расширение, считающее юнит-экономику на страницах Uzum и Yandex Market.' }, en: { title: 'About the Chrome extension',             summary: 'Extension that computes unit economics on Uzum and Yandex Market pages.' } },
  'vidzhet-nima-korsatadi': { ru: { title: 'Что показывает виджет',                   summary: 'Что означает каждая строка панели на странице товара.' },                  en: { title: 'What the widget shows',                  summary: 'What every line of the product-page panel means.' } },
  'vidzhet-ornatish':       { ru: { title: 'Установка расширения',                    summary: 'Руководство по установке и настройке расширения Chrome.' },               en: { title: 'Install the extension',                  summary: 'Guide to installing and configuring the Chrome extension.' } },
  'qurilmalar-boshqaruvi':  { ru: { title: 'Управление устройствами',                 summary: 'Расширение на нескольких компьютерах: что в аккаунте, а что в браузере.' }, en: { title: 'Device management',                      summary: 'The extension across computers: what lives in the account, what in the browser.' } },
  'reklama-tahlili':        { ru: { title: 'Основы рекламных расходов',               summary: 'Что означают ДРР, CPC, CPO и где рекламный расход попадает в расчёты.' }, en: { title: 'Ad spend basics',                        summary: 'What DRR, CPC and CPO mean, and where ad spend enters the maths.' } },
  'drr-nima':               { ru: { title: 'Что такое DRR и как его снизить',          summary: 'Показатель DRR и методы его оптимизации.' },                            en: { title: 'What is DRR and how to reduce it',       summary: 'DRR metric and how to optimize it.' } },
  'samarasiz-xarajatlar':   { ru: { title: 'Выявление неэффективных рекламных расходов', summary: 'Сопоставить расход из кабинета с прибылью в Daromadchi и найти трату.' }, en: { title: 'Finding ineffective ad spend',           summary: 'Pair cabinet spend with Daromadchi profit to find the waste.' } },
  'kampaniya-byudjeti':     { ru: { title: 'Управление рекламным бюджетом',           summary: 'Расчёт бюджета через прибыль и CPO. Сам бюджет задаётся в кабинете.' },  en: { title: 'Managing your ad budget',                summary: 'Deriving the budget from profit and CPO. The budget itself lives in the cabinet.' } },
  'qoldiq-boshqaruvi':      { ru: { title: 'Управление остатками',                    summary: 'Остатки товаров на складе, уровни запасов и система оповещений.' },      en: { title: 'Stock management',                       summary: 'Warehouse stock levels and alert system.' } },
  'qoldiq-ogohlantirish':   { ru: { title: 'Оповещения об остатках',                  summary: 'Настройка оповещений о низких остатках и получение их в Telegram.' },    en: { title: 'Stock alerts',                           summary: 'Setting up low-stock alerts and receiving them in Telegram.' } },
  'fbo-fbs-rfbs':           { ru: { title: 'Разница между FBO, FBS и rFBS',           summary: 'Uzum FBO/FBS и Yandex FBY/FBS/DBS: кто собирает и на что это влияет.' }, en: { title: 'FBO, FBS and rFBS differences',          summary: 'Uzum FBO/FBS and Yandex FBY/FBS/DBS: who packs, and why it matters.' } },
  'tovar-aylanmasi':        { ru: { title: 'Оборачиваемость товаров и прогноз заказа',summary: 'Скорость оборота остатков и расчёт времени следующего заказа.' },        en: { title: 'Stock turnover and order forecast',      summary: 'Stock rotation speed and calculating when to reorder.' } },
  'birlik-iqtisodiyoti':    { ru: { title: 'Калькулятор юнит-экономики',              summary: 'Расчёт чистой прибыли, маржи и точки безубыточности для каждого товара.' }, en: { title: 'Unit economics calculator',            summary: 'Calculate net profit, margin and break-even for each product.' } },
  'zararsizlik-narxi':     { ru: { title: 'Расчёт точки безубыточности',             summary: 'Как определить минимальную прибыльную цену продажи.' },                   en: { title: 'Break-even price calculation',           summary: 'How to find the minimum profitable selling price.' } },
  'marja-hisoblash':       { ru: { title: 'Расчёт маржи прибыли',                   summary: 'Показатели маржи прибыли на уровне товара и магазина.' },                  en: { title: 'Profit margin calculation',              summary: 'Profit margin metrics at product and store level.' } },
  'logistika-xarajatlari': { ru: { title: 'Расчёт расходов на логистику',           summary: 'Добавление тарифов FBO и FBS в калькулятор юнит-экономики.' },             en: { title: 'Calculating logistics costs',            summary: 'Adding FBO and FBS rates to the unit economics calculator.' } },
  'dashboard-korsatkichlari': { ru: { title: 'Понимание показателей дашборда',      summary: 'Основные карточки дашборда и их значение.' },                             en: { title: 'Understanding dashboard metrics',        summary: 'Main dashboard cards and what they mean.' } },
  'pnl-hisobot':           { ru: { title: 'Отчёт P&L (Прибыли и убытки)',           summary: 'Как читать и анализировать ежемесячный отчёт о прибылях и убытках.' },    en: { title: 'P&L report (Profit & Loss)',             summary: 'How to read and analyse the monthly profit and loss report.' } },
  'kategoriya-tahlili':    { ru: { title: 'Анализ категорий и товаров',             summary: 'Выручка по категориям, классификация ABC и страница ABC-XYZ.' },           en: { title: 'Category and product analysis',          summary: 'Revenue by category, ABC classification and the ABC-XYZ page.' } },
  'tovar-tahlili-jadvali':   { ru: { title: 'Таблица аналитики товаров',          summary: '14 столбцов, настройки таблицы и правка цены / себестоимости / остатка на месте.' }, en: { title: 'Product analytics table',                summary: '14 columns, table settings, and editing price / cost / stock in place.' } },
  'qidiruv-iboralari':     { ru: { title: 'Анализ поисковых запросов',             summary: 'Что показывает страница и почему она пуста до открытия API.' },             en: { title: 'Search query (keyword) analysis',        summary: 'What the page shows, and why it stays empty until the API opens.' } },
  'tariflar':              { ru: { title: 'Тарифы и цены',                          summary: 'Тарифы по обороту, цены и что остаётся на бесплатном тарифе.' },           en: { title: 'Plans and pricing',                      summary: 'Turnover-based tiers, prices, and what the Free tier keeps.' } },
  'tolov-usullari':        { ru: { title: 'Способы оплаты',                         summary: 'Привязка карты, автопродление, помесячная и годовая оплата.' },            en: { title: 'Payment methods',                        summary: 'Binding a card, auto-renew, monthly and yearly billing.' } },
  'tarifni-ozgartirish':   { ru: { title: 'Смена или отмена тарифа',               summary: 'Обновление, понижение или отмена подписки.' },                             en: { title: 'Change or cancel plan',                  summary: 'Upgrading, downgrading or cancelling your subscription.' } },
  'bepul-sinov':           { ru: { title: 'Бесплатный пробный период',             summary: `Как воспользоваться бесплатным пробным периодом на ${TRIAL_RU}.` },             en: { title: 'Free trial period',                      summary: `How to use the ${TRIAL_EN} free trial.` } },
  'hisob-sozlamalari':     { ru: { title: 'Настройки аккаунта и профиля',          summary: 'Обновление данных профиля, пароля и настроек безопасности.' },             en: { title: 'Account and profile settings',           summary: 'Updating profile details, password, and security settings.' } },
  'api-token-sozlash':     { ru: { title: 'Добавление и управление API-токеном',   summary: 'Токены Uzum и Yandex Market, их обновление и режим записи.' },             en: { title: 'Add and manage API token',               summary: 'Uzum and Yandex Market tokens, refreshing them, and write mode.' } },
  'jamoa-boshqaruvi':      { ru: { title: 'Управление командой',                   summary: 'Раздел в разработке. Как пока делиться данными с коллегой.' },             en: { title: 'Team management',                        summary: 'Section still in development. How to share data meanwhile.' } },
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

Daromadchi — аналитическая платформа для продавцов Uzum Market и Yandex Market. Начните работу за 4 шага.

## Шаг 1: Создать аккаунт

Перейдите на страницу регистрации и создайте аккаунт с помощью email и пароля. Ссылка для подтверждения будет отправлена на вашу почту.

<info>Регистрация бесплатна и не требует данных банковской карты.</info>

## Шаг 2: Подключить магазин

После входа откройте страницу **Настройки** — там есть отдельная карточка для каждого маркетплейса:

- **Uzum Market** — *API Token*: seller.uzum.uz → Настройки → API-интеграция
- **Yandex Market** — *OAuth Token* и *Campaign ID* (только цифры)

Введите токен и нажмите «Сохранить». Можно подключить несколько магазинов — у каждого свой токен.

<info>Токен используется только для чтения. Подробнее — в статье «Добавление и управление API-токеном».</info>

## Шаг 3: Синхронизировать данные

После подключения магазина нажмите **«Синхронизировать»**. Платформа загрузит:

- Товары, SKU и варианты
- Заказы и их статусы (включая отменённые)
- Остатки и склады
- Цены, комиссии и данные о выплатах (settlements)

Первая синхронизация может занять 1–3 минуты.

## Шаг 4: Начать анализ

После синхронизации дашборд готов:

- **Выручка и заказы** за выбранный период
- **Прибыль и маржа** по каждому товару (если введена себестоимость)
- **Остатки** и на сколько дней их хватит
- **Отчёт P&L** — месячная выручка и расходы

<info>Дальше данные обновляются автоматически — синхронизация запускается каждые 5 минут.</info>
`,
  'malumotlar-sinxronizatsiyasi': `
## Процесс синхронизации

Daromadchi получает данные через API Uzum Market и Yandex Market. Платформа поддерживает два режима синхронизации.

## Автоматическая синхронизация

Синхронизация запускается в фоне **каждые 5 минут**. Никакого расписания или «часа обновления» нет — новый заказ или отмена обычно появляются в течение нескольких минут.

Время последней синхронизации по каждому маркетплейсу видно на странице **Дашборд → Синхронизация**.

## Ручная синхронизация

Чтобы не ждать, нажмите **«Синхронизировать»** на карточке магазина на странице **Настройки**.

## Какие данные загружаются?

| Тип данных | Комментарий |
|---|---|
| Товары, SKU и варианты | Название, артикул, цвет/размер |
| Заказы и их статусы | Новый, в сборке, доставлен, возврат, отменён |
| Остатки | По складам |
| Цены и комиссии | Значения, рассчитанные маркетплейсом |
| Выплаты (settlements) | Для P&L и страницы «Выплаты» |

<info>Рекламная статистика не загружается — рекламные API Uzum и Yandex Market пока не подключены.</info>

## Ошибка синхронизации

Если синхронизация не удалась:

1. Посмотрите текст ошибки на странице **Дашборд → Синхронизация**
2. Проверьте, действителен ли ещё ваш токен
3. Получите новый токен в кабинете маркетплейса
4. Сохраните новый токен на странице **Настройки**

<warning>Если токен истёк или отозван, данные не обновляются, и дашборд продолжает показывать старые цифры.</warning>
`,
  'fikr-va-xato': `
## Ваше мнение важно

Чтобы улучшать платформу, нам нужны ваши отзывы. Нашли ошибку или есть предложение — сообщите одним из способов ниже.

## Форма в приложении — самый быстрый путь

У **правого края** дашборда, на середине высоты экрана, есть вкладка **«Отзыв»**. Нажмите её и выберите одно из двух:

- **Сообщить об ошибке** — что-то работает неправильно
- **Предложить идею** — новая функция или улучшение

Опишите суть и **прикрепите скриншот** — это самый быстрый способ объяснить проблему. После отправки появится подтверждение «Спасибо! Ваше сообщение получено».

## Telegram-канал

Новости и анонсы: **@daromadchi_uz** (https://t.me/daromadchi_uz)

## По электронной почте

Подробные или технические вопросы: **support@daromadchi.uz**

Для запросов о персональных данных и удалении аккаунта отдельный адрес: **privacy@daromadchi.uz**

## Что полезно указать

1. Что вы ожидали и что произошло?
2. Какой магазин / маркетплейс?
3. Какой период был выбран?
4. Скриншот

<info>Мы разбираем обращения как можно быстрее. Приоритетная поддержка доступна на Pro+ и выше.</info>
`,
  'bildirishnomalar': `
## Что такое уведомления?

Daromadchi сообщает о важных событиях. Уведомления приходят в двух местах: в **Telegram-боте** и **внутри приложения** (колокольчик в верхней панели → страница «Уведомления»).

## Уведомления в Telegram

### 🛒 Новые заказы
Новые заказы, найденные при синхронизации, собираются в одно сообщение: маркетплейс, товар, количество.

### ❌ Отменённые заказы
При отмене заказа приходит **отдельное сообщение** — оно не подмешивается в сообщение о новых заказах. Причина простая: «соберите и отправьте» и «не отправляйте» — противоположные указания, и склеивание их в одно сообщение — самый надёжный способ пропустить отмену.

По каждому заказу сообщение об отмене отправляется **только один раз**, сколько бы раз ни отработала синхронизация. Отменённые заказы исключаются из выручки в отчётах.

<info>Уведомления об отменах включаются и выключаются вместе с настройкой «Новые заказы».</info>

### 📦 Низкий остаток
Когда остаток опускается ниже заданного порога. Одна строка на один физический товар — даже если он представлен несколькими листингами.

### 🔄 Синхронизация остатков
Когда товар, проданный на одном маркетплейсе, уменьшается и на другом (если для магазина включён режим «Синхронизация остатков») — что изменилось и с каким результатом.

### 📊 Ежедневный отчёт
Каждый день в выбранное вами время: выручка, заказы, прибыль, комиссия, отмены, разбивка по категориям.

### 📈 Еженедельный отчёт
То же самое, но за неделю. По умолчанию выключен.

## Настройка Telegram-уведомлений

Настройки живут **в самом боте**, а не в дашборде:

1. Напишите боту **/start** в Telegram
2. Откройте настройки уведомлений в меню бота
3. Включайте и выключайте каждый тип кнопкой ✅ / ❌:
   📦 Низкий остаток · 📊 Ежедневный отчёт · 🛒 Новые заказы · 📈 Еженедельный отчёт
4. Выберите время ежедневного отчёта

<info>Без подключённого Telegram сообщения не приходят. См. статью «Подключение Telegram-бота».</info>

## Уведомления внутри приложения

На странице **Дашборд → Уведомления** показаны оповещения о низких остатках и новые заказы. Открытие страницы сбрасывает счётчик на колокольчике.

Получать ли уведомление об изменении остатка в приложении и/или в Telegram, вы выбираете двумя переключателями на странице **Дашборд → Оповещения**.
`,
  'telegram-ulash': `
## Подключение Telegram-бота

Уведомления приходят через Telegram. Подключение занимает несколько нажатий — копировать токен не нужно.

## Шаги подключения

### Шаг 1: откройте Настройки
Внизу страницы **Дашборд → Настройки** есть карточка **Telegram**.

### Шаг 2: нажмите «Подключить Telegram»
Daromadchi подготовит вашу персональную ссылку.

### Шаг 3: откройте ссылку
Ссылка открывает бота в Telegram с уже готовым запросом на подключение — остаётся нажать **Start**.

### Шаг 4: выберите язык
Бот спросит язык уведомлений. После выбора подключение завершено, а страница Настроек обновится сама: на карточке появятся **«Подключён ✓»** и ваш ник в Telegram.

## Проверка

После подключения на карточке появляется кнопка **«Отправить тест»**. Нажмите её — бот сразу пришлёт тестовое сообщение. Если оно не пришло, проверьте, не заблокирован ли бот.

## Отключение

Кнопка **«Отключить»** на той же карточке. После неё сообщения не отправляются.

## Настройка уведомлений

Какие именно сообщения приходят, настраивается **в самом боте** — отправьте боту **/start** и выберите в меню. Подробнее — в статье «Типы уведомлений и настройки».

<info>К одному аккаунту Daromadchi подключается один аккаунт Telegram.</info>

## Если что-то не так

- Если срок действия ссылки истёк, нажмите «Подключить Telegram» ещё раз и получите новую
- Если бот заблокирован, разблокируйте его и повторите
- Кнопка «Подключить Telegram» в расширении ведёт на эту же страницу
`,
  'chrome-kengaytma': `
## Что такое расширение Chrome?

Расширение Daromadchi считает **юнит-экономику**, не уводя вас со страницы маркетплейса. На странице товара открывается панель и показывает по нему комиссию, доставку, чистую прибыль и маржу.

## Где работает

- **uzum.uz** — страницы товаров Uzum Market
- **market.yandex.ru / market.yandex.uz** — страницы товаров Yandex Market
- **partner.market.yandex.ru** — кабинет партнёра Yandex Market
- **daromadchi.uz** — для связи с вашим аккаунтом

На других сайтах расширение вообще не запускается.

## Что оно даёт

### Панель на странице товара
Цену она считывает со страницы сама. Вы вводите себестоимость, упаковку, процент комиссии и объём — панель тут же пересчитывает чистую прибыль и маржу. Кнопки **FBO / FBS** переключают модель расходов.

### Попап (по клику на значок)
Краткая статистика по магазину и оповещения. Здесь же кнопка подключения Telegram.

### Настройки (Options)
Собственные оповещения расширения: порог низкого остатка, падение продаж, процент возвратов, «тихие часы» и ежедневная сводка. Эти настройки хранятся в браузере.

## Браузеры

Chrome и браузеры на Chromium: Edge, Brave, Opera.

<info>Расчёт в панели использует те же формулы, что и страница **Юнит-экономика** в Daromadchi. Кнопка в панели открывает полный калькулятор.</info>
`,
  'vidzhet-nima-korsatadi': `
## Из чего состоит панель

Что вы видите, когда панель Daromadchi открыта на странице товара.

## Верхняя часть

- Название товара
- **Цена**, считанная со страницы
- Кнопки языка (UZ / RU / EN), темы и обновления

## Выбор модели

Кнопки **FBO** или **FBS** переключают модель расходов. На страницах Yandex используется соответствующая модель.

## Что вводите вы

| Поле | Зачем нужно |
|---|---|
| **Себестоимость** | Во сколько товар обошёлся вам |
| **Упаковка** | Расход на упаковку одной единицы |
| **Комиссия (%)** | Комиссия маркетплейса; подставляется по категории |
| **Объём** | Для расчёта стоимости доставки |

## Результат расчёта

| Строка | Что означает |
|---|---|
| Цена | Цена продажи со страницы |
| Комиссия (%) | Комиссия маркетплейса |
| Доставка | Логистика — помечается как **ориентировочная** |
| Итого маркетплейс | Комиссия + доставка |
| Итого расходы | Итого маркетплейс + себестоимость + упаковка |
| **Чистая прибыль** | Итоговый результат, с цветной полосой |
| **Маржа** | Доля прибыли в цене (%) |

Цвет маржи показывает состояние: зелёный — здорово, жёлтый — на грани, красный — убыток.

## Чего в панели нет

В панели **нет рекламных показателей (ДРР, CPC, CPO), кампаний и цен конкурентов**. Маркетплейсы не отдают эти данные по API.

<info>При изменении любого значения прибыль и маржа пересчитываются сразу — сохранять ничего не нужно.</info>
`,
  'vidzhet-ornatish': `
## 1. Установка из Chrome Web Store

Расширение опубликовано в Chrome Web Store под названием «Daromadchi — Uzum & Yandex»:

https://chromewebstore.google.com/detail/daromadchi-%E2%80%94-uzum-yandex/kdgmhemligckdjibcojbdiofokjjnaed

Откройте ссылку и нажмите **«Добавить в Chrome»**. Та же ссылка есть на главной странице Daromadchi и на странице **Юнит-экономика**.

## 2. Войдите в аккаунт

Нажмите на значок расширения. Если вы не авторизованы, попап покажет кнопку **«Войти»** и откроет daromadchi.uz. После входа попап начнёт показывать вашу статистику.

## 3. Активируйте расширение

1. Подпишитесь на канал **@daromadchi_uz** в Telegram
2. Отправьте боту **/activate**
3. Бот пришлёт 6-значный код
4. Введите код в расширении

<info>Код одноразовый и с ограниченным сроком. Если срок истёк, отправьте боту **/activate** ещё раз.</info>

## 4. Опционально: ввод API-ключей

На странице **Настроек (Options)** расширения можно отдельно сохранить ключи маркетплейсов:

- **API-ключ Yandex Market** — кабинет продавца → Настройки → API и модули
- **Токен Uzum Seller API** — seller.uzum.uz → Профиль → API-ключи

Рядом с каждым полем есть кнопка **«Проверить»** — она сразу проверяет ключ.

## 5. Проверьте

Откройте страницу любого товара на uzum.uz или market.yandex.ru. Панель Daromadchi должна появиться. Если она закрыта, её возвращает кнопка **«D»** сбоку.

## Если что-то не так

- Обновите страницу — панель добавляется после загрузки
- Выключите и снова включите расширение
- Chrome → Дополнительные инструменты → Расширения → Daromadchi → Подробнее
`,
  'qurilmalar-boshqaruvi': `
## Использование на нескольких устройствах

Расширение можно установить на любое число компьютеров — ограничения нет, и список устройств в Daromadchi не ведётся.

Вместо этого каждый браузер настраивается независимо.

## Что где хранится

| Данные | Где хранятся |
|---|---|
| Данные магазина, заказы, остатки | В аккаунте Daromadchi — одинаковы везде |
| Подключение Telegram | В аккаунте — подключается один раз, работает везде |
| Настройки оповещений расширения | **Только в этом браузере** |
| API-ключи в расширении | **Только в этом браузере** |
| Выбор языка и темы | **Только в этом браузере** |

То есть после установки расширения на новом компьютере пороги на его странице **Настроек** придётся задать заново. Данные магазина подтянутся сами.

## Подключение нового устройства

1. Установите расширение
2. Войдите в аккаунт Daromadchi
3. Отправьте боту **/activate**, получите новый код и введите его

Расширение на прежнем устройстве продолжит работать — новая активация его не отключает.

## Отключение устройства

Отключить устройство удалённо нельзя. На самом устройстве нужно:

- Удалить расширение из Chrome, либо
- Отключить Telegram через попап и выйти из аккаунта Daromadchi

<warning>На чужом компьютере не забудьте выйти из аккаунта — расширение работает через сессию браузера.</warning>
`,
  'reklama-tahlili': `
## Важно: Daromadchi не подключается к рекламному кабинету

В Daromadchi **нет** таблицы рекламных кампаний, и рекламная статистика не загружается по API. Ни Uzum Market, ни Yandex Market пока не открыли API с рекламными данными — кнопка «Синхронизировать рекламу» на странице **Настройки** сообщает ровно об этом.

Кампании, клики и дневной расход вы смотрите **в кабинете маркетплейса**. Эта статья объясняет, как читать те цифры и как учесть их в расчёте прибыли в Daromadchi.

## Основные показатели

### ДРР (доля рекламных расходов)
\`ДРР = Расход на рекламу / Выручка × 100\`

- **ДРР < 10%** — хорошо
- **ДРР 10–20%** — приемлемо
- **ДРР > 20%** — высоко, кампанию стоит проверить

### CPC (цена клика)
\`CPC = Общий расход / Количество кликов\`

### CPO (цена заказа)
\`CPO = Общий расход / Количество заказов\`

### ROAS (окупаемость рекламы)
\`ROAS = Выручка / Расход на рекламу\`

Все эти сокращения также расшифрованы в разделе **Сокращения** на дашборде.

## Где рекламный расход попадает в Daromadchi?

### 1. Калькулятор юнит-экономики
В поле **Реклама (%)** на странице **Дашборд → Калькулятор** вы вводите свой ДРР. Калькулятор учитывает его как расход и пересчитывает чистую прибыль и точку безубыточности.

### 2. Отчёт P&L
Если маркетплейс удержал рекламные деньги из вашей выплаты, они попадают в строку **«Прочие удержания маркетплейса»** (вместе с эквайрингом и штрафами). Это фактическое удержание из отчёта маркетплейса, а не оценка.

<info>То есть: анализ на уровне кампаний — в кабинете, влияние на прибыль — в Daromadchi.</info>
`,
  'drr-nima': `
## Что такое ДРР?

**ДРР** (доля рекламных расходов) — доля расходов на рекламу в выручке.

**Формула:** \`ДРР = Расход на рекламу / Выручка × 100\`

**Пример:** выручка 1 000 000 сум, реклама 80 000 сум → ДРР = 8%

<info>ДРР вы берёте из отчёта по кампаниям в кабинете маркетплейса — Daromadchi не подключён к рекламному кабинету и не может посчитать это сам.</info>

## Какой ДРР считается нормальным?

Зависит от категории:

| Категория | Рекомендуемый ДРР |
|---|---|
| Электроника | 5-10% |
| Одежда | 8-15% |
| Товары для дома | 6-12% |
| Продукты питания | 3-8% |
| Косметика | 10-18% |

## Как найти свой предельный ДРР

Таблица выше — усреднённый ориентир. Точный ответ зависит от вашей маржи:

1. Откройте **Дашборд → Калькулятор** и выберите товар
2. Поставьте **Реклама (%)** = 0 — это ваша чистая маржа
3. Постепенно повышайте процент, пока прибыль не приблизится к нулю

Эта точка — **безубыточный ДРР** для товара. Всё, что выше, — работа в минус.

## Способы снизить ДРР

### 1. Сменить цель кампании
Платить за заказ, а не за клик (CPC → CPO)

### 2. Отключить неэффективные ключевые слова
Слова, которые дают клики, но не дают заказов

### 3. Настроить расписание показов
Снижать бюджет в часы с низкими продажами

### 4. Проверить цену
Если конкуренты продают дешевле — скорректируйте цену

### 5. Улучшить фотографии товара
Хорошее фото повышает CTR — больше заказов при том же расходе

<warning>Все настройки кампаний меняются в кабинете маркетплейса. Daromadchi не изменяет и не останавливает кампании.</warning>
`,
  'samarasiz-xarajatlar': `
## Что такое неэффективные расходы?

Неэффективный рекламный расход — клики и показы, за которые заплачено, но которые не превратились в прибыль.

<info>Daromadchi не размечает кампании сам — рекламная статистика не приходит по API. Ниже описан способ сопоставить цифры из кабинета маркетплейса с цифрами прибыли в Daromadchi.</info>

## Порядок работы

### Шаг 1: возьмите расход по кампаниям из кабинета
В кабинете маркетплейса выгрузите расход по каждому товару за последние 7–30 дней.

### Шаг 2: посмотрите прибыль этого товара в Daromadchi
В таблице **Дашборд → Аналитика товаров** за тот же период:
- **Прибыль** — что остаётся после себестоимости и комиссий
- **Маржа %** — доля прибыли в выручке
- **Доля продаж** — сколько процентов общей выручки даёт товар
- **ABC** — класс A/B/C

### Шаг 3: сравните

| Ситуация | Вывод |
|---|---|
| Расход > Прибыль | Реклама работает в минус — остановите или пересмотрите цену |
| Расход ≈ Прибыль | Точка нуля — работаете только на оборот |
| Расход < Прибыль, ABC = A | Здоровая ситуация — бюджет можно увеличить |
| Расход есть, продаж нет | Самая явная трата — останавливайте в первую очередь |

## На что смотреть

### Реклама товара с заканчивающимся остатком
Проверьте список низких остатков на странице **Дашборд → Оповещения**. Рекламировать товар, которого хватит на пару дней, — потерянные деньги.

### Товары с высоким процентом возвратов
Столбец **% возвратов** в таблице аналитики товаров. Если возвратов много, заказ не равен прибыли — и реклама обходится вдвое дороже.

### Товары с низкой маржой
При марже ниже 10% даже небольшой ДРР уводит товар в минус. Посчитайте порог в **Калькуляторе**.

<warning>Не останавливайте разом все кампании с низкой конверсией — часть из них работает на узнаваемость бренда.</warning>
`,
  'kampaniya-byudjeti': `
## Где настраивается бюджет?

Рекламный бюджет настраивается **в кабинете маркетплейса**, а не в Daromadchi. Daromadchi не подключён к рекламному кабинету, поэтому не показывает бюджет, не меняет его и не предупреждает о его исчерпании.

Что даёт Daromadchi — **цифры прибыли, по которым бюджет можно посчитать**.

## Расчёт бюджета

### 1. Сколько прибыли даёт один заказ?
В **Дашборд → Калькулятор** выберите товар, введите себестоимость и цену, поставьте **Реклама (%)** = 0. Полученная чистая прибыль — то, что вы зарабатываете с заказа без рекламы.

### 2. Определите предельный CPO
\`Предельный CPO = чистая прибыль с одного заказа\`

Выше этого значения каждый заказ приносит убыток. На практике разумно не выходить за половину прибыли.

### 3. Посчитайте дневной бюджет
\`Дневной бюджет = целевой CPO × целевое число заказов в день\`

**Пример:** чистая прибыль 30 000 сум → целевой CPO 15 000 сум; нужно 10 заказов в день → бюджет 150 000 сум/день.

### 4. Сверьтесь с остатком
На странице **Дашборд → Оповещения** посмотрите, на сколько дней хватит остатка. Бюджет не должен разгонять продажи быстрее, чем позволяет склад.

## Контроль

Раз в неделю:
1. Возьмите фактический расход из кабинета
2. Посмотрите прибыль за тот же период в таблице **Продажи и маржа по товарам**
3. Пересчитайте ДРР и скорректируйте бюджет

## Сезонность

В праздники и во время акций продажи растут — прежде чем поднимать бюджет, убедитесь, что остатков хватит.

<info>Меняйте рекламный бюджет в разделе рекламы кабинета seller.uzum.uz или Yandex Market.</info>
`,
  'qoldiq-boshqaruvi': `
## Управление остатками

Daromadchi следит за остатками с учётом скорости продаж и подсказывает, когда пора заказывать товар.

## На сколько дней хватит остатка

Для каждого товара:

\`Дни = Остаток / Средние продажи в день\`

На странице **Оповещения** это число показано цветным бейджем:

| Статус | Дни | Цвет |
|---|---|---|
| **Критично** | Меньше 3 дней или остаток 0 | Красный |
| **Предупреждение** | 3-7 дней | Жёлтый |
| **Наблюдение** | Больше 7 дней | Синий |

## Модели маркетплейсов

Из какого склада идёт заказ и остаток, показывают бейджи:

**Uzum Market**
- **FBO** — товар на складе Uzum, сборка и доставка на стороне Uzum
- **FBS** — товар на вашем складе, вы собираете заказ сами

**Yandex Market**
- **FBY** — товар на складе Yandex, всё делает Yandex
- **FBS** — ваш склад, логистика Yandex (Экспресс тоже относится сюда)
- **DBS** — и хранение, и доставка на вас

<info>Сообщение «соберите и отправьте» приходит только по моделям, где собирает продавец (FBS, DBS) — по заказам FBO и FBY от вас ничего не требуется.</info>

## Один товар — несколько листингов

Один физический товар может стоять на двух маркетплейсах или несколькими листингами на одном. На странице **Дашборд → Склады** вы объединяете их в группу — после этого остаток считается по группе, и оповещения не дублируются.

## Синхронизация остатков (опционально)

Если она включена для магазина, товар, проданный на одном маркетплейсе, уменьшается и на другом. Это единственное, что Daromadchi записывает в листинг маркетплейса, и только количество остатка. Подробнее — в статье «Добавление и управление API-токеном».

<info>Остатки обновляются вместе с синхронизацией.</info>
`,
  'qoldiq-ogohlantirish': `
## Оповещения об остатках

Когда остаток опускается ниже заданного порога, Daromadchi предупреждает.

## Настройка порога

На странице **Дашборд → Оповещения** введите порог в штуках (по умолчанию **15 шт.**) и сохраните. Список сразу пересчитывается по новому порогу.

Для товаров, объединённых в группу, отдельный порог задаётся на странице **Остатки**.

## Статус по дням

Помимо порога в каждой строке показано, на сколько дней хватит остатка: меньше 3 дней — красный, 3-7 дней — жёлтый, больше — синий. Эти границы фиксированные.

## Куда приходит оповещение

### В приложении
На страницах **Оповещения** и **Уведомления**, а также на колокольчике в верхней панели.

### В Telegram
Если Telegram подключён и в боте включён пункт **📦 Низкий остаток**. В сообщении указаны товар, остаток и на сколько дней его хватит.

Получать ли уведомление об изменении остатка в приложении и/или в Telegram, вы выбираете двумя переключателями на странице **Оповещения**.

## Без дублей

На один физический товар приходится одна строка — даже если он представлен несколькими листингами. Группы настраиваются на странице **Остатки**.

## Экспорт

Список оповещений можно выгрузить в виде таблицы.

<warning>Без подключённого Telegram оповещения видны только внутри приложения.</warning>
`,
  'fbo-fbs-rfbs': `
## Модели склада

Модель продажи определяет две вещи: где лежит товар и кто собирает заказ. Daromadchi показывает это бейджем рядом с каждым заказом и остатком.

## Uzum Market

### FBO (Fulfillment by Operator)
Товар **на складе Uzum**. Сборка и доставка на стороне Uzum.

- Быстрее доставка
- Товар нужно заранее отгрузить на склад Uzum
- Добавляются расходы на хранение

### FBS (Fulfillment by Seller)
Товар **на вашем складе**. Заказ вы собираете и передаёте сами.

- Хранение полностью под вашим контролем
- Каждый заказ требует действия

## Yandex Market

### FBY
Товар **на складе Yandex** — Yandex собирает и доставляет. От вас ничего не требуется.

### FBS
Товар на вашем складе, доставка логистикой Yandex. **Экспресс**-заказы относятся сюда же — это не отдельная модель.

### DBS (Delivery by Seller)
И хранение, и доставка на вас.

## Почему это важно

Сообщение **«соберите и отправьте»** в Telegram приходит только по моделям, где собирает продавец: Uzum FBS, Yandex FBS и DBS. По заказам FBO и FBY от вас ничего не требуется — поэтому такой заказ не присылается как требование действия.

## Где смотреть в Daromadchi

Бейджи видны в таблицах **Заказы** и **Остатки**. Один товар может одновременно стоять в нескольких моделях — общий остаток складывается, и оповещение даётся по сумме.

<info>rFBS — разновидность FBS. Маркетплейс не возвращает её отдельно, поэтому в Daromadchi она отображается как FBS.</info>
`,
  'tovar-aylanmasi': `
## Что такое оборачиваемость?

Оборачиваемость показывает, насколько быстро продаётся товар. Практический вопрос при этом простой: **на сколько дней хватит остатка и когда заказывать новую партию?**

## Как считает Daromadchi

Расчёт опирается на фактические продажи **за последние 30 дней**:

\`Продажи в день = Продано за 30 дней / 30\`

\`Дней остатка = Доступный остаток / Продажи в день\`

Обе цифры видны в строке каждого товара на странице **Дашборд → Оповещения**. Список сортируется по дням остатка — самые срочные сверху.

<info>В расчёте используется только **доступный** остаток: единицы, уже заказанные, но ещё не отгруженные, вычитаются. Иначе проданный товар выглядел бы так, будто он всё ещё на полке.</info>

Если за 30 дней продаж не было, вместо дней остатка показывается **«—»** — это значит «оценить нельзя», а не «запаса много».

## Когда заказывать

\`Дата заказа = Сегодня + (Дней остатка − Срок поставки)\`

**Пример:**
- Остаток: 100 шт.
- Продажи в день: 5 шт. → хватит на 20 дней
- Поставщик привозит за 5 дней
- **Заказывать через 15 дней**

Срок поставки знаете вы — Daromadchi его не знает, поэтому это вычитание делаете вы.

## Пороги оповещений

| Статус | Дней остатка |
|---|---|
| Критично | Меньше 3 дней или остаток 0 |
| Предупреждение | 3-7 дней |
| Наблюдение | Больше 7 дней |

## На что обратить внимание

- **Новый товар**: истории за 30 дней ещё нет, поэтому продажи в день занижены, а прогноз выглядит длиннее реального
- **Период акции**: продажи в акцию поднимают среднее, и остаток закончится быстрее ожидаемого
- **Один товар в нескольких листингах**: объедините их в группу на странице **Остатки**, иначе каждый считается отдельно

<info>Раздел «Сезонность» пока в статусе «Скоро» — сезонный коэффициент в расчёте не участвует.</info>
`,
  'birlik-iqtisodiyoti': `
## Что такое юнит-экономика?

Юнит-экономика — расчёт того, сколько прибыли остаётся с продажи одной единицы товара.

В Daromadchi для этого есть **два** инструмента.

## 1. Калькулятор прибыли — быстрый расчёт по одному товару

**Дашборд → Калькулятор**. Ничего подключать не нужно: выбираете маркетплейс (**Uzum** или **Yandex**) и категорию — процент комиссии подставляется сам.

Поля для ввода:
- Цена продажи
- Себестоимость
- Логистика
- Расход на рекламу
- Процент возвратов (%)
- Продажи в месяц (шт.)

На выходе:
- **Разбивка расходов на 1 шт.** — комиссия, себестоимость, логистика, потери на возвратах, реклама
- **Чистая прибыль (шт.)**, **Маржа**, **ROI**, **ДРР**, точка безубыточности
- **Reality Check** — реальная прибыль за месяц рядом с той, которую вы ожидали

Если маржа ниже 20% или цена уводит в минус, калькулятор предупреждает.

## 2. Таблица юнит-экономики — по всем товарам

**Дашборд → Юнит-экономика**. Здесь список товаров и полный расчёт по каждому: себестоимость, landed cost, комиссия, доставка, реклама, итого расходы, чистая прибыль, ROI, маржа, остаток и ссылка на поставщика.

### Расходы по умолчанию
Задаются один раз в настройках таблицы и применяются ко всем строкам:

| Настройка | По умолчанию |
|---|---|
| Эквайринг (%) | 1.5 |
| Реклама (%) | 5 |
| Налог (%) | 6 |
| Комиссия (%) | 10 |
| Последняя миля (%) | 0 |
| Тип налога | Доход (6%) или Доход − расход (15%) |

### Столбцы
Столбцы можно включать и выключать — вид собирается под вашу задачу.

## Связь с расширением Chrome

Панель расширения использует те же формулы и может добавить товар прямо в эту таблицу.

<warning>Все цифры в калькуляторе ориентировочные. Тарифы маркетплейсов меняются — перед важным решением сверьтесь с актуальным тарифом в кабинете.</warning>
`,
  'zararsizlik-narxi': `
## Что такое точка безубыточности?

Точка безубыточности — минимальная цена продажи, покрывающая все расходы. Продажа ниже неё означает убыток.

## Формула

\`Безубыточность = Себестоимость + Комиссия + Логистика + Потери на возвратах + Реклама + Налог\`

## Расчёт в Daromadchi

Откройте **Дашборд → Калькулятор**:

1. Выберите маркетплейс: **Uzum** или **Yandex**
2. Выберите категорию — процент комиссии подставится сам
3. Введите **себестоимость**
4. Введите **логистику** (из тарифов маркетплейса)
5. Введите **процент возвратов** — фактический возьмите из столбца **% возвратов** в таблице **Аналитика товаров**
6. Введите **расход на рекламу**

Калькулятор покажет **точку безубыточности** вместе с остальными показателями (маржа, ROI, ДРР).

## Добавляем целевую прибыль

\`Цена продажи = Безубыточность × (1 + Целевая маржа / 100)\`

**Пример:**
- Безубыточность: 45 000 сум
- Цель: маржа 20%
- **Цена продажи: 54 000 сум**

## Достаточна ли ваша текущая цена?

Блок **Reality Check** в калькуляторе показывает, сколько прибыли (или убытка) даёт текущая цена за месяц. Если цена убыточна, калькулятор подскажет, на сколько её поднять.

<info>Процент комиссии подставляется по категории, но его можно изменить вручную — процент из вашего договора точнее.</info>
`,
  'marja-hisoblash': `
## Что такое маржа?

Маржа — доля прибыли в выручке, в процентах. В Daromadchi маржа означает **чистую маржу**: то, что остаётся после себестоимости и удержаний маркетплейса.

\`Маржа = Чистая прибыль / Выручка × 100\`

## Маржа и наценка — не одно и то же

Их часто путают:

- **Маржа** — прибыль в процентах **от цены продажи**
- **Наценка** — прибыль в процентах **от себестоимости**

Купили за 50 000 сум, продали за 100 000: наценка 100%, а маржа 50%.

## Где смотреть маржу

### По товару
Столбец **Маржа** в таблице **Дашборд → Аналитика товаров**. Вверху страницы показаны **средняя маржа** по магазину и количество товаров с низкой и высокой маржой.

### По вариантам
Раскройте родительскую строку — маржа видна по каждому варианту (цвет, размер). Бывает, что один из них тянет вниз показатель всей группы.

### При планировании
**Калькулятор** и таблица **Юнит-экономика** считают маржу по введённым вами значениям.

## Без себестоимости маржи нет

У товара без себестоимости маржа завышена — самый крупный расход просто не учтён. Заполните её карандашом в таблице **Аналитика товаров** или на странице **Товары**.

## Какая маржа считается нормальной?

| Категория | Минимальная маржа | Рекомендуемая |
|---|---|---|
| Электроника | 8% | 15-20% |
| Одежда | 20% | 35-50% |
| Косметика | 25% | 40-60% |
| Товары для дома | 15% | 25-35% |

<info>Даже при низкой марже общая прибыль может быть высокой, если велик объём. Поэтому читайте маржу вместе со столбцом **доля продаж**.</info>
`,
  'logistika-xarajatlari': `
## Расходы на логистику

Стоимость доставки зависит от веса, объёма и модели склада (FBO/FBS, FBY/FBS/DBS). Это второе по размеру удержание после комиссии.

## Как Daromadchi учитывает логистику

### В калькуляторе — вручную
В поле **Логистика (сум)** на странице **Дашборд → Калькулятор** вы вводите стоимость доставки одной единицы. Цифру берёте из тарифов маркетплейса.

### В таблице юнит-экономики — вручную и процентом
В таблице **Юнит-экономика** доставка вынесена в отдельный столбец. А **Последняя миля (%)** из настроек добавляется процентом от цены — удобно, когда тариф процентный.

### В отчёте P&L — фактическая цифра
Строка **Доставка** в отчёте **P&L** — не оценка: она берётся из отчёта маркетплейса. Если итоговый отчёт ещё не пришёл, рядом стоит **≈**, и после его получения значение заменится фактическим.

<info>То есть: для планирования — оценка в калькуляторе, для оценки прошедшего периода — фактическая цифра в P&L.</info>

## Стоимость возвратов

Возвращённый товар оплачивает логистику дважды — туда и обратно.

\`Расход на возвраты = (Возвраты % / 100) × (Логистика × 2)\`

Процент возвратов вы вводите в калькулятор. Фактический процент берите из столбца **% возвратов** в таблице **Аналитика товаров** — он считается по вашим же данным.

## Где взять тарифы

- **Uzum Market**: раздел тарифов в кабинете seller.uzum.uz
- **Yandex Market**: раздел тарифов в кабинете партнёра

<warning>Тарифы меняются и зависят от региона. Daromadchi не обновляет их автоматически — периодически сверяйте введённое значение.</warning>
`,
  'dashboard-korsatkichlari': `
## Показатели дашборда

Основные карточки, которые вы видите при входе.

## Верхние карточки

### Выручка
Общая выручка за выбранный период. Рядом — сравнение с предыдущим периодом такой же длины, в процентах.

### Прибыль
Чистая прибыль после себестоимости и удержаний маркетплейса. Товары без введённой себестоимости занижают эту цифру — заполните её на странице **Товары**.

### Заказы
Количество заказов за период. Отменённые не учитываются.

### Остаток
Текущий суммарный остаток.

## Графики

### График продаж
Динамика выручки по дням за выбранный период.

### Анализ категорий
Сколько выручки приносит каждая категория — круговая диаграмма.

### Топ товаров
Товары, давшие больше всего выручки за период.

### Оповещения об остатках
Товары, у которых заканчивается остаток. Полный список — на странице **Оповещения**.

## Смена периода

Через фильтр дат вверху:
- Вчера
- 7 дней
- 30 дней
- 90 дней
- Текущий месяц

## Разбивка по маркетплейсам

Если подключено несколько магазинов, кнопки маркетплейсов вверху позволяют смотреть данные только по одному из них.

<info>Все цифры опираются на последнюю синхронизацию. Её время видно на странице «Синхронизация».</info>
`,
  'pnl-hisobot': `
## Что такое отчёт P&L?

Отчёт P&L (Profit & Loss) показывает финансовый результат магазина по месяцам. Открывается на странице **Дашборд → Отчёт P&L**.

## Из чего состоит отчёт

| Строка | Что означает |
|---|---|
| **Общая выручка** | Выручка по доставленным заказам |
| **Комиссия** | Комиссия маркетплейса |
| **Прочие** | Прочие удержания маркетплейса: эквайринг, реклама, штрафы |
| **Доставка** | Логистические расходы |
| **Выплата маркетплейса** | Выручка − комиссия − доставка − прочие |
| **Себестоимость (COGS)** | Себестоимость проданных товаров |
| **Чистая прибыль** | Итоговый результат |

## Строка «В процессе»

Недоставленные заказы показаны отдельно: их доход учтётся после доставки и пока не входит в прибыль. Именно это удерживает отчёт в соответствии с реальными деньгами.

## Знак «≈»

Рядом с некоторыми значениями может стоять **≈**. Это значит, что маркетплейс ещё не прислал итоговый отчёт и цифра рассчитана по процентам. Когда отчёт придёт, значение заменится фактическим.

## Редактирование себестоимости прямо в отчёте

Кнопка в строке себестоимости позволяет заполнить себестоимость за месяц на месте, не переходя в список товаров. Если себестоимость пуста, чистая прибыль будет завышена.

## Таблица по месяцам

В таблице ниже каждый месяц — отдельная строка: выручка, комиссия, прочие удержания, себестоимость и чистая прибыль. Рост или падение видно именно здесь.

## Экспорт

Кнопка **Экспорт** выгружает отчёт в виде таблицы.

<info>Без введённой себестоимости P&L показывает только удержания маркетплейса — прибыль будет выглядеть больше реальной.</info>
`,
  'kategoriya-tahlili': `
## Анализ категорий

Daromadchi разбивает продажи по категориям.

## На дашборде

На круговой диаграмме **Категории** видна доля выручки каждой категории, а рядом — список с суммами.

Ежедневный отчёт в Telegram тоже присылает разбивку по категориям.

## Анализ на уровне товаров

На странице **Дашборд → Аналитика товаров** сверху общие цифры, а ниже — таблица **Продажи и маржа по товарам**: продажи, выручка, прибыль, маржа и класс ABC по каждому товару. Подробнее — в статье «Таблица аналитики товаров».

## ABC-анализ

Товары классифицируются по их доле в выручке. Список сортируется по убыванию выручки, и дальше:

| Класс | Правило |
|---|---|
| **A** | Пока накопленная выручка не достигнет 80% |
| **B** | От 80% до 95% |
| **C** | Всё остальное |

Столбец ABC есть в таблице **Продажи и маржа по товарам**.

## Страница ABC-XYZ

Страница **Дашборд → ABC-XYZ** идёт дальше: показывает ABC (доход) вместе с XYZ (стабильность спроса). AX — стабильно и доходно, CZ — мало дохода и непредсказуемо.

## Топ товаров

Блок **Топ товаров** на дашборде — те, что дали больше всего выручки за период. Полный список и сортировка — на странице **Товары**.

<info>Категория берётся из данных маркетплейса. Товары без категории попадают в строку «Без категории».</info>
`,
  'tovar-tahlili-jadvali': `
## Таблица аналитики товаров

Главная таблица на странице **Дашборд → Аналитика товаров**. Раньше «Топ продаж» и «Анализ маржи по товарам» были двумя отдельными таблицами — теперь они объединены в одну, потому что отвечать на вопрос про один товар, глядя в два места, незачем.

Каждая строка — товар. Товар с вариантами (цвет, размер) сворачивается в одну родительскую строку; её можно раскрыть и посмотреть каждый вариант отдельно.

## Столбцы

| Столбец | Что означает |
|---|---|
| **Товар** | Название и вариант. Виден всегда |
| **Доставлено** | Доставлено штук за период |
| **В пути** | В доставке — в прибыль ещё не входит |
| **Отменено** | Отменённые заказы |
| **Возвраты** | Возвращено штук |
| **% возвратов** | Возвраты ÷ (доставлено + возвраты) |
| **Выручка** | Выручка за период |
| **Доля продаж** | Какой процент общей выручки даёт товар |
| **Ср. цена** | Выручка ÷ проданные штуки — фактическая цена после скидок |
| **Цена** | Текущая цена продажи |
| **Себестоимость** | Ваша себестоимость |
| **Прибыль** | Выручка − себестоимость − удержания маркетплейса |
| **Маржа** | Доля прибыли в выручке (%) |
| **ABC** | Класс A / B / C |

<info>Все эти столбцы считаются для обоих маркетплейсов. Показатели, которые может дать только один из них, в таблицу не включены — иначе строки Yandex всегда были бы пустыми.</info>

## Настройки таблицы

Кнопка **Настройки таблицы** над таблицей открывает панель включения и выключения столбцов. Снимаете галочку — столбец исчезает, ставите обратно — появляется.

Есть и готовые наборы:
- **Минимум** — продалось ли и зарабатывает ли
- **Продажи** — штуки, возвраты, доля, ABC
- **Деньги** — цена, себестоимость, прибыль, маржа

Выбор сохраняется в браузере и остаётся таким же при следующем входе. Столбец **Товар** отключить нельзя — иначе таблица превратилась бы в набор безымянных чисел.

## Редактирование значений

Три столбца можно менять прямо в таблице — при наведении на строку появляется **значок карандаша**:

- **Цена**
- **Себестоимость**
- **Остаток**

<warning>Эти правки остаются только внутри Daromadchi. В листинг маркетплейса ничего не отправляется — ни цена, ни название, ни что-либо ещё не меняется.</warning>

Цена и остаток приходят от маркетплейса, поэтому ваше значение хранится отдельно и накладывается сверху при отображении. Очистите поле — вернётся собственное число маркетплейса: правка скрывает фактическое значение, но не удаляет его.

В родительской строке редактирование **Цены** и **Себестоимости** применяется сразу ко всем вариантам. Для остатка карандаша в родительской строке нет: остатки вариантов разные, и приравнивать их к одному числу было бы неверно.

## Почему важна себестоимость

Если себестоимость не заполнена, столбцы **Прибыль** и **Маржа** показывают товар выгоднее, чем он есть. Заполните её здесь же или на странице **Товары**.
`,
  'qidiruv-iboralari': `
## Анализ поисковых запросов

Знать, по каким словам покупатели приходят к вашим товарам, важно для SEO и рекламы. В Daromadchi это страница **Дашборд → Поисковые фразы**.

## Что показывает страница

- Фраза и товар, к которому она относится
- Показы (impressions)
- Клики
- CTR (клики ÷ показы)
- Заказы
- Расход

<warning>Пока эта страница пустая. Данные по поисковым фразам приходят из рекламного/поискового API маркетплейса, а он ещё не подключён — ни Uzum Market, ни Yandex Market эти данные не отдают. Как только API откроется, страница заполнится автоматически.</warning>

## Что можно делать до этого

### Смотрите ключевые слова в кабинете маркетплейса
Поисковый отчёт в кабинете — пока единственный источник.

### Проверьте названия товаров
В списке **Дашборд → Товары** посмотрите, как записаны названия. Название напрямую влияет на поиск.

### Измеряйте результат по продажам
После изменения названия или фото следите в таблице **Продажи и маржа по товарам**, как изменились выручка и доля продаж этого товара. Это измерение работает и без данных о кликах.

<info>Сокращения на странице (CTR, CPC) расшифрованы в разделе «Сокращения» на дашборде.</info>
`,
  'tariflar': `
## Тариф определяется оборотом

В Daromadchi тариф не выбирают — он определяется вашим **чистым оборотом за последние 30 дней**. Растёт оборот — поднимается и тариф.

| Оборот за 30 дней | Тариф |
|---|---|
| До 12 млн сум | **Бесплатно** |
| 12–50 млн сум | **Pro** |
| 50–120 млн сум | **Pro+** |
| 120–180 млн сум | **Бизнес** |
| Свыше 180 млн сум | **Enterprise** |

## Цены

| Тариф | В месяц | При годовой оплате (за месяц) |
|---|---|---|
| Бесплатно | 0 сум | — |
| Pro | 150 000 сум | 125 000 сум |
| Pro+ | 250 000 сум | 225 000 сум |
| Бизнес | 500 000 сум | 450 000 сум |
| Enterprise | По договорённости | — |

<info>Для Enterprise нет единой публичной цены — этот тариф обсуждается отдельно.</info>

## Отличаются ли платные тарифы по возможностям?

По функциям — **нет**. Pro, Pro+, Бизнес и Enterprise дают одинаковый набор; различия — в обороте и цене. Начиная с Pro+ добавляется **приоритетная поддержка**.

## Что остаётся на бесплатном тарифе

Бесплатно навсегда:
- Дашборд (с выручкой и прибылью)
- Товары
- Заказы и уведомления по ним (новый заказ, отмена, низкий остаток)
- **Uzum и Yandex Market** — оба, на любом тарифе
- Расширение Chrome

Разделы, которые закрываются после пробного периода:
- Аналитика товаров
- Страница остатков и синхронизация остатков
- Финансы и выплаты (отчёт P&L)
- Юнит-экономика

<info>Все тарифы начинаются с бесплатного пробного периода на ${TRIAL_RU}. Данные карты не требуются.</info>
`,
  'tolov-usullari': `
## Способ оплаты

Daromadchi принимает оплату **банковской картой**. Карта привязывается через платёжную систему ATMOS.

## Привязка карты

На странице **Дашборд → Тариф и оплата**:

1. Выберите тариф и отметьте **Помесячно** или **Ежегодно**
2. Введите номер карты и срок действия
3. Введите код из SMS
4. После подтверждения тариф активируется сразу

<info>Номер карты не хранится в Daromadchi целиком — сохраняется безопасный идентификатор, выданный платёжной системой.</info>

## Автопродление

После привязки карты включается **Автоматическое продление**: списание проходит до окончания периода. Его можно выключить в любой момент — тогда следующего списания не будет.

## Помесячно и ежегодно

При годовой оплате цена за месяц ниже — точные суммы в таблице статьи «Тарифы и цены». Годовая подписка списывается один раз, полной суммой за 12 месяцев.

## Если платёж не прошёл

При неудачном списании на странице показывается причина, и попытку можно повторить. История платежей находится там же, списком.

<warning>Платёжные данные передаются по шифрованному соединению. Daromadchi никогда не спрашивает полный номер карты или ваш пароль.</warning>
`,
  'tarifni-ozgartirish': `
## Смена тарифа

На странице **Дашборд → Тариф и оплата**:

1. Откройте окно выбора тарифа
2. Тариф, соответствующий вашему обороту, будет выделен — выберите его или другой
3. Отметьте **Помесячно** или **Ежегодно**
4. Подтвердите

Новый тариф активируется сразу после прохождения платежа.

## Панель оборота

Панель оборота на странице показывает ваш чистый оборот за последние 30 дней и то, в какой тарифный диапазон он попадает. Панель только информирует — сама по себе она ничего не списывает и тариф не меняет. Когда оборот приближается к границе следующего тарифа, панель об этом предупреждает.

## Отмена подписки

Нажмите **Отменить тариф** и подтвердите.

Что означает отмена:
- **Следующего списания не будет**
- Все возможности остаются открытыми до конца оплаченного периода
- По его окончании аккаунт сам переходит на Бесплатный тариф

Это не возврат средств и не мгновенное отключение. Если оплаченного периода ещё нет, переход на Бесплатный происходит сразу.

## Отмена отмены

Пока оплаченный период не закончился, кнопка **Возобновить тариф** возвращает автопродление.

## Сохранность данных

После отмены подписки аккаунт и данные не удаляются — мы не удаляем аккаунты автоматически. Данные хранятся, пока существует аккаунт, и вы можете подписаться снова в любой момент.

Если вы хотите удалить аккаунт полностью, это можно сделать через «Запрос на удаление аккаунта» в настройках или письмом на privacy@daromadchi.uz.

<info>Об изменении цены действующих подписчиков предупреждают заранее — с вас не спишут сумму, отличную от согласованной.</info>
`,
  'bepul-sinov': `
## Бесплатный пробный период

Новые пользователи получают бесплатный пробный период на **${TRIAL_RU}**.

## Что входит?

На время пробного периода открыты и платные разделы:

- **Аналитика товаров** — таблица из 14 столбцов, ABC, маржа
- Страница **Остатки** и синхронизация остатков
- **Финансы и выплаты** — отчёт P&L
- Калькулятор **юнит-экономики**

## Что остаётся бесплатным и после пробного периода

- Дашборд (с выручкой и прибылью)
- Товары
- Заказы и уведомления (новый заказ, отмена, низкий остаток)
- **Uzum и Yandex Market** — оба
- Расширение Chrome

## Карта не нужна

Для пробного периода не требуются карта или платёжные данные. Достаточно регистрации по email.

## Что будет после

За ${TRIAL_REMINDER_DAYS} дн. до окончания придёт напоминание в приложении и в Telegram. Когда период закончится, при отсутствии выбранного тарифа четыре раздела выше закроются — а аккаунт продолжит работать на Бесплатном тарифе.

## Где посмотреть дату окончания

На странице **Тариф и оплата** показаны дата окончания пробного периода и тариф, соответствующий вашему обороту.

<info>Пробный период даётся один раз. Регистрация с другим email второго периода не даёт.</info>
`,
  'hisob-sozlamalari': `
## Где находится ваш аккаунт

Данные аккаунта — на двух страницах:

- **Дашборд → Аккаунт** — email, дата регистрации, текущий тариф и срок его действия
- **Дашборд → Профиль** — поля имени, email и телефона, а также раздел безопасности

## Состояние тарифа

На странице **Аккаунт** видны текущий тариф, дата окончания пробного периода и срок действия тарифа. Оплата и смена тарифа — на странице **Тариф и оплата**.

## Язык

Язык переключается кнопками **UZ / RU / EN** в верхней панели и применяется ко всему приложению.

Язык Telegram-уведомлений **отдельный** — он выбирается при подключении бота и меняется в самом боте.

## Смена пароля

Пароль меняется через ссылку восстановления:

1. Выйдите из аккаунта и откройте страницу **Входа**
2. Нажмите **«Забыли пароль?»**
3. Введите свой email
4. Задайте новый пароль по ссылке из письма

<info>Двухфакторная аутентификация (2FA), список сессий и журнал безопасности отображаются на странице Профиля, но пока не запущены — они в подготовке.</info>

## Подключения маркетплейсов

Токены магазинов и режим записи — на странице **Настройки**. Подробнее: «Добавление и управление API-токеном».

## Удаление аккаунта

Через кнопку «Запрос на удаление аккаунта» на странице **Аккаунт**. Подробнее: «Удаление аккаунта».
`,
  'api-token-sozlash': `
## Что такое API-токен?

API-токен — ключ, который разрешает Daromadchi **читать** данные из вашего кабинета маркетплейса. Для каждого магазина нужен свой токен.

## По умолчанию: только чтение

Только что подключённый магазин работает в режиме **«Только чтение»**. В этом режиме Daromadchi ничего не пишет: ни цену, ни название, ни листинг, ни статус заказа.

## Токен Uzum Market

1. Войдите на seller.uzum.uz
2. Откройте **Настройки → API-интеграция**
3. Создайте новый ключ и дайте ему название (например, «Daromadchi»)
4. Токен будет показан — скопируйте его

<warning>Токен показывается один раз. Скопируйте и сохраните его сразу.</warning>

## Токен Yandex Market

Для Yandex Market нужны два значения:

- **OAuth Token** — токен Yandex Market Partner API
- **Campaign ID** — номер кампании, только цифры

Если Campaign ID указан неверно (введён email или ссылка), при сохранении сразу появится ошибка.

## Ввод в Daromadchi

На странице **Настройки** найдите карточку нужного маркетплейса:

1. Вставьте токен в поле
2. Для Yandex введите ещё и Campaign ID
3. Нажмите **Сохранить**
4. Запустите первую загрузку кнопкой **Синхронизировать**

На карточке видны состояние магазина («Подключён» / «Не подключён») и время последней синхронизации.

## Обновление токена

Если токен истёк или отозван, получите новый в кабинете маркетплейса, вставьте его в то же поле и сохраните. Прежние данные не теряются.

## Опционально: «Синхронизация остатков (режим редактирования)»

Если один физический товар продаётся на двух маркетплейсах, продажа в одном месте должна уменьшать остаток и в другом. Для этого магазину можно включить **режим редактирования**.

Перед включением требуется отметить галочку подтверждения. При включении:

- Daromadchi обновляет только **остаток (количество)**
- Цена, название, листинг, статус заказа, счета — никогда не меняются
- Каждая запись фиксируется в журнале

Вы также выбираете, как распределяется последняя общая единица: блокировать последнюю, делить между каналами или отключить.

Для Uzum этот режим требует у токена право **SKU_UPDATE**.

<warning>Режим редактирования по умолчанию выключен. Пока вы не включите его сами, в ваш магазин ничего не записывается.</warning>

## Несколько магазинов

Карточки Uzum и Yandex Market независимы — можно подключить обе сразу. Кнопки маркетплейсов на дашборде позволяют смотреть данные по отдельности.
`,
  'jamoa-boshqaruvi': `
## Управление командой — скоро

Страница **Дашборд → Команда** пока в статусе «Скоро». Раздел в разработке, мы сообщим, когда он будет готов.

## Как это работает сейчас

Один аккаунт Daromadchi — один пользователь. К одному аккаунту можно подключить несколько **магазинов** (Uzum и Yandex Market, у каждого свой токен), но сам аккаунт имеет один вход.

## Если нужно показать данные коллеге

### Выгрузите отчёт
На большинстве таблиц есть кнопка **Экспорт** — отчёт P&L, оповещения, поисковые фразы, заказы. Отправка файла не даёт доступа к аккаунту.

### Используйте Telegram-уведомления
Ежедневный отчёт и оповещения приходят в Telegram — так нужная информация доходит до кладовщика или менеджера.

<warning>Не передавайте свой пароль. Настройки безопасности описаны в статье «Безопасность аккаунта».</warning>
`,
  'hisobni-ochirish': `
## Удаление аккаунта

Удаление выполняется по запросу — аккаунт не исчезает мгновенно по нажатию кнопки.

## Перед удалением

- Выгрузите нужные отчёты — после удаления восстановить их нельзя
- Отмените активную подписку (**Тариф и оплата → Отменить тариф**)
- Отзовите токен Daromadchi в кабинете маркетплейса

## Отправка запроса

Нажмите **«Запрос на удаление аккаунта»** на странице **Дашборд → Аккаунт**.

Запрос уходит оператору, а вам показывается подтверждение о получении. Удаление — контролируемая процедура и выполняется вручную.

## Альтернатива: privacy@daromadchi.uz

Запрос можно отправить и напрямую на **privacy@daromadchi.uz**. Срок ответа — 15 рабочих дней (требование Закона ЗРУ-547).

## Что удаляется

Ваши персональные данные и данные магазина удаляются. Платёжные записи по требованию закона сохраняются **в обезличенном виде** — с вами они не связаны.

## Отмена подписки — это другое

Отмена подписки не удаляет аккаунт. Мы не удаляем аккаунты автоматически: данные хранятся, пока существует аккаунт, и подписаться снова можно в любой момент.

<warning>После выполнения удаления данные не восстанавливаются. Выгрузите нужное заранее.</warning>
`,
  'xavfsizlik': `
## Безопасность аккаунта

Ниже — реально работающие способы защитить аккаунт.

## Надёжный пароль

Хороший пароль:
- Не менее 12 символов
- Заглавные и строчные буквы
- Цифры
- Спецсимволы (!@#$)

Пароль можно обновить в любой момент через **Вход → «Забыли пароль?»**.

<info>Двухфакторная аутентификация (2FA), список сессий и журнал входов отображаются на странице Профиля, но пока не запущены. Когда они появятся, эта статья будет обновлена.</info>

## Выход на всех устройствах

Кнопка **Выйти** завершает сессию на всех устройствах — cookie очищаются по всему домену. На чужом компьютере не забудьте выйти, когда закончите.

## Ваши API-токены

- Токен хранится в зашифрованном виде
- По умолчанию используется только для чтения — пока вы сами не включите режим «Синхронизация остатков», ничего не записывается
- Если есть сомнения в токене, отзовите его в кабинете маркетплейса и получите новый

## Осторожно с фишингом

Daromadchi никогда не просит:
- Ваш пароль
- Ваш API-токен (вы вводите его только сами на странице Настроек)
- Полный номер карты или код из SMS

Официальные адреса: **daromadchi.uz**, Telegram-канал **@daromadchi_uz**.

## Если что-то подозрительное

1. Сразу смените пароль
2. Отзовите токены маркетплейсов и получите новые
3. Напишите на **support@daromadchi.uz**

<warning>Daromadchi никогда не запрашивает пароль или API-токен. Такой запрос — фишинг.</warning>
`,
}

const ARTICLE_CONTENT_EN: Record<string, string> = {
  'tez-boshlash': `
## Welcome!

Daromadchi is an analytics platform for Uzum Market and Yandex Market sellers. Get started in 4 steps.

## Step 1: Create an account

Go to the sign-up page and create an account with your email and a password. A confirmation link will be sent to your inbox.

<info>Signing up is free and requires no card details.</info>

## Step 2: Connect a store

After signing in, open the **Settings** page — it has a separate card for each marketplace:

- **Uzum Market** — *API Token*: seller.uzum.uz → Settings → API integration
- **Yandex Market** — *OAuth Token* and *Campaign ID* (digits only)

Paste the token and press "Save". You can connect several stores — each with its own token.

<info>The token is used for reading only. See "Add and manage API token" for details.</info>

## Step 3: Sync your data

Once the store is connected, press **"Sync"**. The platform will import:

- Products, SKUs and variants
- Orders and their statuses (including cancelled ones)
- Stock quantities and warehouses
- Prices, commissions and settlement data

The first sync can take 1–3 minutes.

## Step 4: Start analysing

After the sync your dashboard is ready:

- **Revenue and orders** for the selected period
- **Profit and margin** per product (once cost price is filled in)
- **Stock** and how many days it will last
- **P&L report** — monthly revenue and costs

<info>From then on data refreshes automatically — the sync runs every 5 minutes.</info>
`,
  'malumotlar-sinxronizatsiyasi': `
## How syncing works

Daromadchi pulls data through the Uzum Market and Yandex Market APIs. The platform supports two sync modes.

## Automatic sync

The sync runs in the background **every 5 minutes**. There is no schedule or "refresh hour" — a new order or a cancellation usually shows up within a few minutes.

You can see the last sync time per marketplace on **Dashboard → Sync**.

## Manual sync

To avoid waiting, press **"Sync"** on the store card on the **Settings** page.

## What gets imported?

| Data type | Notes |
|---|---|
| Products, SKUs and variants | Title, article, colour/size |
| Orders and their statuses | New, packing, delivered, returned, cancelled |
| Stock quantities | Per warehouse |
| Prices and commission | As calculated by the marketplace |
| Settlements | Powers the P&L and Payouts pages |

<info>Ad statistics are not imported — the Uzum and Yandex Market advertising APIs are not connected yet.</info>

## Sync errors

If a sync fails:

1. Read the error text on **Dashboard → Sync**
2. Check that your token is still valid
3. Issue a fresh token in your marketplace cabinet
4. Save the new token on the **Settings** page

<warning>If the token has expired or been revoked, data stops updating and the dashboard keeps showing old numbers.</warning>
`,
  'fikr-va-xato': `
## Your feedback matters

We rely on your feedback to improve the platform. Found a bug or have a suggestion? Here's how to reach us.

## The in-app form — the fastest route

At the **right edge** of the dashboard, halfway down the screen, there is a **"Feedback"** tab. Click it and pick one of two options:

- **Report a mistake** — something is not working right
- **Suggest an idea** — a new feature or improvement

Describe it and **attach a screenshot** — that is the quickest way to explain a problem. After sending you'll see "Thank you! Your message was received."

## Telegram channel

News and announcements: **@daromadchi_uz** (https://t.me/daromadchi_uz)

## By email

For detailed or technical issues: **support@daromadchi.uz**

Data and account-deletion requests have their own address: **privacy@daromadchi.uz**

## What helps us

1. What did you expect, and what happened?
2. Which store / marketplace?
3. Which period was selected?
4. A screenshot

<info>We review reports as quickly as we can. Priority support is available on Pro+ and above.</info>
`,
  'bildirishnomalar': `
## What are notifications?

Daromadchi tells you about events that matter. Notifications appear in two places: in the **Telegram bot** and **inside the app** (the bell in the top bar → Notifications page).

## Telegram notifications

### 🛒 New orders
New orders found during a sync are grouped into one message: marketplace, product, quantity.

### ❌ Cancelled orders
When an order is cancelled you get a **separate message** — it is never folded into the new-orders message. The reason is simple: "pack and ship this" and "do not" are opposite instructions, and merging them into one message is the surest way for a cancellation to be missed.

Each order's cancellation message is sent **exactly once**, no matter how many times the sync runs. Cancelled orders are excluded from revenue in reports.

<info>Cancellation messages are turned on and off together with the "New orders" setting.</info>

### 📦 Low stock
When stock drops below your threshold. One line per physical product — even if it is listed several times.

### 🔄 Stock sync
When an item sold on one marketplace is also decremented on another (for stores with "Stock sync" mode enabled) — what changed and whether it worked.

### 📊 Daily report
Every day at the time you choose: revenue, orders, profit, commission, cancellations, category breakdown.

### 📈 Weekly report
The same, for the week. Off by default.

## Configuring Telegram notifications

The settings live **in the bot itself**, not in the dashboard:

1. Send **/start** to the bot in Telegram
2. Open the notification settings from the bot menu
3. Toggle each type with the ✅ / ❌ button:
   📦 Low stock · 📊 Daily report · 🛒 New orders · 📈 Weekly report
4. Pick the time for the daily report

<info>Nothing is delivered until Telegram is connected. See "Connect Telegram bot".</info>

## In-app notifications

**Dashboard → Notifications** lists low-stock alerts and new orders. Opening the page clears the badge on the bell.

Whether a stock-change notice reaches you in the app and/or in Telegram is set with the two toggles on **Dashboard → Alerts**.
`,
  'telegram-ulash': `
## Connecting the Telegram bot

Notifications are delivered through Telegram. Connecting takes a few clicks — no token to copy.

## Steps

### Step 1: open Settings
At the bottom of **Dashboard → Settings** there is a **Telegram** card.

### Step 2: press "Connect Telegram"
Daromadchi prepares your personal link.

### Step 3: open the link
The link opens the bot in Telegram with the connection request already prepared — just press **Start**.

### Step 4: choose a language
The bot asks which language to send notifications in. After you pick one the link is complete, and the Settings page refreshes itself: the card shows **"Connected ✓"** and your Telegram username.

## Checking it works

Once connected, a **"Send test"** button appears on the card. Press it and the bot sends a test message straight away. If nothing arrives, check that you have not blocked the bot.

## Disconnecting

The **"Disconnect"** button on the same card. After that no messages are sent.

## Configuring notifications

Which messages you receive is configured **in the bot itself** — send **/start** to the bot and choose from the menu. See "Notification types and settings" for details.

<info>One Daromadchi account links to one Telegram account.</info>

## Troubleshooting

- If the link has expired, press "Connect Telegram" again for a fresh one
- If the bot is blocked, unblock it and retry
- The extension's "Link Telegram" button leads to this same page
`,
  'chrome-kengaytma': `
## What is the Chrome extension?

The Daromadchi extension works out **unit economics** without taking you off the marketplace page. On a product page it opens a panel showing that product's commission, delivery, net profit and margin.

## Where it runs

- **uzum.uz** — Uzum Market product pages
- **market.yandex.ru / market.yandex.uz** — Yandex Market product pages
- **partner.market.yandex.ru** — the Yandex Market partner cabinet
- **daromadchi.uz** — to link it to your account

On any other site the extension does not run at all.

## What it gives you

### The product-page panel
It reads the price off the page itself. You enter cost price, packaging, commission percentage and volume — the panel recalculates net profit and margin immediately. The **FBO / FBS** buttons switch the cost model.

### The popup (clicking the icon)
A short summary of your store plus alerts. The Telegram link button is here too.

### Options
The extension's own alerts: low-stock threshold, sales drop, return rate, "quiet hours" and the daily summary. These settings live in your browser.

## Browsers

Chrome and Chromium-based browsers: Edge, Brave, Opera.

<info>The panel's maths uses the same formulas as the **Unit economics** page in Daromadchi. The button in the panel opens the full calculator.</info>
`,
  'vidzhet-nima-korsatadi': `
## What the panel contains

Here is what you see when the Daromadchi panel is open on a product page.

## The top

- Product title
- The **price** read from the page
- Language (UZ / RU / EN), theme and refresh buttons

## Model selector

The **FBO** or **FBS** buttons switch the cost model. On Yandex pages the matching model is used.

## What you enter

| Field | Why it is needed |
|---|---|
| **Cost price** | What the item cost you |
| **Packaging** | Packaging cost per unit |
| **Commission (%)** | Marketplace commission; prefilled by category |
| **Volume** | To work out the delivery cost |

## The calculated result

| Line | Meaning |
|---|---|
| Price | The selling price from the page |
| Commission (%) | Marketplace commission |
| Delivery | Logistics — flagged as **estimated** |
| Marketplace total | Commission + delivery |
| Total costs | Marketplace total + cost price + packaging |
| **Net profit** | The bottom line, with a coloured bar |
| **Margin** | Profit as a share of price (%) |

The margin colour reads as status: green is healthy, yellow is borderline, red is a loss.

## What the panel does not have

There are **no ad metrics (DRR, CPC, CPO), no campaigns and no competitor prices**. The marketplaces do not expose that data over their APIs.

<info>Change any value and profit and margin recalculate straight away — there is nothing to save.</info>
`,
  'vidzhet-ornatish': `
## 1. Install from the Chrome Web Store

The extension is published as "Daromadchi — Uzum & Yandex":

https://chromewebstore.google.com/detail/daromadchi-%E2%80%94-uzum-yandex/kdgmhemligckdjibcojbdiofokjjnaed

Open the link and press **"Add to Chrome"**. The same link is on the Daromadchi home page and on the **Unit economics** page.

## 2. Sign in

Click the extension icon. If you are not signed in, the popup shows a **"Sign in"** button and opens daromadchi.uz. Once signed in, the popup starts showing your stats.

## 3. Activate the extension

1. Join the **@daromadchi_uz** channel on Telegram
2. Send **/activate** to the bot
3. The bot replies with a 6-character code
4. Enter that code in the extension

<info>The code is single-use and expires. If it has expired, send **/activate** to the bot again.</info>

## 4. Optional: entering API keys

The extension's **Options** page can store marketplace keys separately:

- **Yandex Market API key** — Seller cabinet → Settings → API and modules
- **Uzum Seller API token** — seller.uzum.uz → Profile → API keys

Each field has a **"Check"** button that tests the key right away.

## 5. Verify

Open any product page on uzum.uz or market.yandex.ru. The Daromadchi panel should appear. If it is closed, the **"D"** button on the edge brings it back.

## Troubleshooting

- Reload the page — the panel is injected after the page loads
- Turn the extension off and on again
- Chrome → More tools → Extensions → Daromadchi → Details
`,
  'qurilmalar-boshqaruvi': `
## Using it on several devices

You can install the extension on any number of computers — there is no limit, and Daromadchi keeps no device list.

Instead, each browser is configured independently.

## What lives where

| Data | Where it lives |
|---|---|
| Store data, orders, stock | In your Daromadchi account — identical everywhere |
| Telegram link | In your account — linked once, works everywhere |
| Extension alert settings | **In that browser only** |
| API keys held in the extension | **In that browser only** |
| Language and theme choice | **In that browser only** |

So after installing the extension on a new computer you will need to set the thresholds on its **Options** page again. Store data appears on its own.

## Adding a new device

1. Install the extension
2. Sign in to your Daromadchi account
3. Send **/activate** to the bot, get a fresh code and enter it

The extension on your previous device keeps working — a new activation does not disable it.

## Disconnecting a device

There is no way to disconnect a device remotely. On the device itself:

- Remove the extension from Chrome, or
- Unlink Telegram from the popup and sign out of Daromadchi

<warning>On a shared computer, remember to sign out — the extension works off your browser session.</warning>
`,
  'reklama-tahlili': `
## Important: Daromadchi does not connect to your ad account

Daromadchi has **no** ad-campaign table, and ad statistics are not imported over the API. Neither Uzum Market nor Yandex Market has opened an advertising API yet — the "Sync ads" button on the **Settings** page says exactly that.

Campaigns, clicks and daily spend live **in your marketplace cabinet**. This article explains how to read those numbers and how to fold them into your profit maths in Daromadchi.

## Core metrics

### DRR (ad spend share)
\`DRR = Ad spend / Revenue × 100\`

- **DRR < 10%** — good
- **DRR 10–20%** — acceptable
- **DRR > 20%** — high, worth reviewing the campaign

### CPC (cost per click)
\`CPC = Total spend / Clicks\`

### CPO (cost per order)
\`CPO = Total spend / Orders\`

### ROAS (return on ad spend)
\`ROAS = Revenue / Ad spend\`

All of these abbreviations are also explained in the **Abbreviations** section on the dashboard.

## Where ad spend enters Daromadchi

### 1. Unit economics calculator
The **Ads (%)** field on **Dashboard → Calculator** is where you enter your own DRR. The calculator treats it as a cost and recalculates net profit and the break-even price accordingly.

### 2. P&L report
If the marketplace withheld ad money from your payout, it lands in the **"Other marketplace deductions"** line (alongside acquiring and penalties). That is an actual deduction taken from the marketplace's own report, not an estimate.

<info>In short: campaign-level analysis happens in the cabinet; its effect on profit shows up in Daromadchi.</info>
`,
  'drr-nima': `
## What is DRR?

**DRR** (from the Russian «доля рекламных расходов») is the share of revenue spent on advertising.

**Formula:** \`DRR = Ad spend / Revenue × 100\`

**Example:** 1,000,000 so'm revenue, 80,000 so'm on ads → DRR = 8%

<info>You take DRR from the campaign report in your marketplace cabinet — Daromadchi is not connected to the ad account and cannot compute it for you.</info>

## What is a healthy DRR?

It depends on the category:

| Category | Recommended DRR |
|---|---|
| Electronics | 5-10% |
| Clothing | 8-15% |
| Home goods | 6-12% |
| Groceries | 3-8% |
| Cosmetics | 10-18% |

## Finding your own ceiling

The table above is an average. The exact answer depends on your margin:

1. Open **Dashboard → Calculator** and pick a product
2. Set **Ads (%)** to 0 — that is your clean margin
3. Raise the percentage gradually until profit approaches zero

That point is the product's **break-even DRR**. Anything above it is a loss.

## How to reduce DRR

### 1. Change the campaign goal
Pay per order rather than per click (CPC → CPO)

### 2. Drop ineffective keywords
Keywords that bring clicks but no orders

### 3. Adjust the schedule
Lower the budget during hours with few sales

### 4. Check your price
If competitors sell cheaper, adjust

### 5. Improve product photos
A better photo lifts CTR — more orders for the same spend

<warning>All campaign settings are changed in the marketplace cabinet. Daromadchi never edits or stops campaigns.</warning>
`,
  'samarasiz-xarajatlar': `
## What counts as wasted spend?

Wasted ad spend is clicks and impressions you paid for that never turned into profit.

<info>Daromadchi does not flag campaigns itself — ad statistics do not arrive over the API. What follows is how to pair the numbers in your marketplace cabinet with the profit numbers in Daromadchi.</info>

## The workflow

### Step 1: pull campaign spend from the cabinet
In your marketplace cabinet, export spend per product for the last 7–30 days.

### Step 2: look up that product's profit in Daromadchi
In the **Dashboard → Product analytics** table, for the same period:
- **Profit** — what is left after cost price and commissions
- **Margin %** — profit as a share of revenue
- **Sales share** — what percentage of total revenue this product carries
- **ABC** — its A/B/C class

### Step 3: compare

| Situation | Conclusion |
|---|---|
| Spend > Profit | The ads run at a loss — stop them or revisit the price |
| Spend ≈ Profit | Break-even — you are buying turnover, not profit |
| Spend < Profit, ABC = A | Healthy — the budget can go up |
| Spend but no sales | The clearest waste — stop this first |

## What to watch

### Advertising a product that is about to run out
Check the low-stock list on **Dashboard → Alerts**. Advertising an item with a few days of cover is money thrown away.

### Products with a high return rate
The **Return %** column in the product analytics table. When returns are high an order is not profit — and the advertising costs you twice.

### Low-margin products
Below a 10% margin even a small DRR pushes the product into a loss. Work out the threshold in the **Calculator**.

<warning>Do not stop every low-conversion campaign at once — some of them are building brand recognition.</warning>
`,
  'kampaniya-byudjeti': `
## Where the budget is set

Your ad budget is set **in the marketplace cabinet**, not in Daromadchi. Daromadchi is not connected to the ad account, so it cannot show your budget, change it, or warn you when it runs out.

What Daromadchi gives you is **the profit figures the budget should be derived from**.

## Working out the budget

### 1. How much profit does one order make?
In **Dashboard → Calculator**, pick the product, enter cost price and selling price, and set **Ads (%)** to 0. The net profit shown is what one order earns before advertising.

### 2. Find your maximum CPO
\`Max CPO = net profit per order\`

Above that, every order loses money. In practice, staying under half the profit is sensible.

### 3. Derive the daily budget
\`Daily budget = target CPO × target orders per day\`

**Example:** net profit 30,000 so'm → target CPO 15,000 so'm; you want 10 orders a day → budget 150,000 so'm/day.

### 4. Check it against stock
On **Dashboard → Alerts**, see how many days of cover the product has. The budget should not drive sales faster than the warehouse can supply.

## Keeping it in check

Once a week:
1. Pull actual spend from the cabinet
2. Look up profit for the same period in the **Product performance** table
3. Recompute DRR and adjust the budget

## Seasonality

Holidays and promotions lift sales — before raising the budget, make sure stock can cover it.

<info>Change your ad budget in the advertising section of the seller.uzum.uz or Yandex Market cabinet.</info>
`,
  'qoldiq-boshqaruvi': `
## Stock management

Daromadchi tracks stock against your sales rate and tells you when to reorder.

## How many days of cover

For each product:

\`Days = Stock on hand / Average daily sales\`

On the **Alerts** page this number appears as a coloured badge:

| Status | Days | Colour |
|---|---|---|
| **Critical** | Under 3 days, or zero stock | Red |
| **Warning** | 3-7 days | Yellow |
| **Watch** | Over 7 days | Blue |

## Marketplace models

Badges show which warehouse an order and its stock come from:

**Uzum Market**
- **FBO** — stock sits in Uzum's warehouse; Uzum picks and ships
- **FBS** — stock is in your warehouse; you pack each order

**Yandex Market**
- **FBY** — stock sits in Yandex's warehouse; Yandex does everything
- **FBS** — your warehouse, Yandex logistics (Express arrives as FBS too)
- **DBS** — you both store and deliver

<info>The "pack and ship" message only fires for seller-fulfilled models (FBS, DBS) — FBO and FBY orders need nothing from you.</info>

## One product, several listings

A single physical product can sit on two marketplaces, or across several listings on one. On **Dashboard → Inventory** you group them together — after that stock is counted per group and alerts stop duplicating.

## Stock sync (optional)

When enabled for a store, an item sold on one marketplace is also decremented on the other. This is the only thing Daromadchi ever writes to a marketplace listing, and it is the stock quantity alone. See "Add and manage API token" for details.

<info>Stock figures refresh along with the sync.</info>
`,
  'qoldiq-ogohlantirish': `
## Stock alerts

When stock drops below your threshold, Daromadchi warns you.

## Setting the threshold

On **Dashboard → Alerts**, enter the threshold in units (default: **15 units**) and save. The list is recalculated against the new threshold immediately.

For products grouped together, a separate threshold can be set on the **Inventory** page.

## Days-of-cover status

Beyond the threshold, each row shows how many days the stock will last: under 3 days is red, 3-7 days yellow, more than that blue. Those boundaries are fixed.

## Where alerts arrive

### In the app
On the **Alerts** and **Notifications** pages, and on the bell in the top bar.

### In Telegram
If Telegram is connected and **📦 Low stock** is enabled in the bot. The message names the product, the quantity left and how many days it covers.

Whether a stock-change notice reaches you in the app and/or in Telegram is set with the two toggles on the **Alerts** page.

## No duplicates

One physical product gets one row — even when it is listed several times. Groups are configured on the **Inventory** page.

## Export

The alert list can be downloaded as a spreadsheet.

<warning>Without Telegram connected, alerts only appear inside the app.</warning>
`,
  'fbo-fbs-rfbs': `
## Fulfillment models

The model decides two things: where the stock sits and who packs the order. Daromadchi shows it as a badge next to every order and stock figure.

## Uzum Market

### FBO (Fulfillment by Operator)
Stock sits **in Uzum's warehouse**. Uzum picks and ships.

- Faster delivery
- You must ship stock into Uzum's warehouse in advance
- Storage costs apply

### FBS (Fulfillment by Seller)
Stock sits **in your warehouse**. You pack and hand over each order yourself.

- Storage fully under your control
- Every order needs an action

## Yandex Market

### FBY
Stock sits **in Yandex's warehouse** — Yandex picks and ships. Nothing is required from you.

### FBS
Stock is in your warehouse, delivery runs on Yandex logistics. **Express** orders arrive as FBS too — it is not a separate model.

### DBS (Delivery by Seller)
You both store and deliver.

## Why it matters

The **"pack and ship"** Telegram message only fires for seller-fulfilled models: Uzum FBS, Yandex FBS and DBS. FBO and FBY orders need nothing from you — so they are never sent as a call to action.

## Where to see it

The badges appear in the **Orders** and **Inventory** tables. One product can sit in several models at once — total stock is their sum, and alerts fire on the total.

<info>rFBS is a flavour of FBS. The marketplace does not return it separately, so Daromadchi shows it as FBS.</info>
`,
  'tovar-aylanmasi': `
## What is stock turnover?

Turnover shows how quickly a product sells. The practical question is simpler: **how many days of cover is left, and when should you reorder?**

## How Daromadchi calculates it

The maths uses actual sales over the **last 30 days**:

\`Daily sales = Units sold in 30 days / 30\`

\`Days of cover = Available stock / Daily sales\`

Both figures appear on every product row on **Dashboard → Alerts**. The list is sorted by days of cover — the most urgent first.

<info>Only **available** stock is used: units already ordered but not yet shipped are subtracted. Otherwise sold goods would look as if they were still on the shelf.</info>

If there were no sales in those 30 days, days of cover shows **"—"** — that means "cannot be estimated", not "plenty left".

## When to reorder

\`Reorder date = Today + (Days of cover − Supplier lead time)\`

**Example:**
- Stock: 100 units
- Daily sales: 5 units → 20 days of cover
- Your supplier takes 5 days
- **Reorder in 15 days**

You know your lead time — Daromadchi does not, so that subtraction is yours to make.

## Alert thresholds

| Status | Days of cover |
|---|---|
| Critical | Under 3 days, or zero stock |
| Warning | 3-7 days |
| Watch | Over 7 days |

## Things to watch

- **A new product**: with less than 30 days of history, daily sales come out low and the forecast looks longer than it is
- **A promotion period**: promo sales lift the average, and stock runs out sooner than expected
- **One product across several listings**: group them on the **Inventory** page, otherwise each is counted on its own

<info>The Seasonality section is still marked "Coming soon" — no seasonal coefficient is applied.</info>
`,
  'birlik-iqtisodiyoti': `
## What is unit economics?

Unit economics is the calculation of how much profit is left from selling a single unit.

Daromadchi gives you **two** tools for it.

## 1. Profit calculator — a quick check on one product

**Dashboard → Calculator**. Nothing needs connecting: pick the marketplace (**Uzum** or **Yandex**) and the category, and the commission percentage fills itself in.

Fields you enter:
- Selling price
- Cost price
- Logistics
- Ad spend
- Return rate (%)
- Monthly units sold

What comes out:
- **Cost breakdown per unit** — commission, cost price, logistics, return losses, advertising
- **Net profit per unit**, **Margin**, **ROI**, **DRR**, break-even price
- **Reality Check** — the real monthly profit next to the one you assumed

If margin falls below 20% or the price runs at a loss, the calculator warns you.

## 2. Unit economics table — across all products

**Dashboard → Unit economics**. Here you get a product list with the full calculation on each: cost price, landed cost, commission, delivery, advertising, total costs, net profit, ROI, margin, stock and a supplier link.

### Default costs
Set once in the table settings and applied to every row:

| Setting | Default |
|---|---|
| Acquiring (%) | 1.5 |
| Ads (%) | 5 |
| Tax (%) | 6 |
| Commission (%) | 10 |
| Last mile (%) | 0 |
| Tax type | Income (6%) or Income − expense (15%) |

### Columns
Columns can be switched on and off, so the view fits the question you're asking.

## How the Chrome extension ties in

The extension's panel uses the same formulas and can add a product straight into this table.

<warning>Every figure in the calculator is an estimate. Marketplace rates change — check the current rate in your cabinet before an important decision.</warning>
`,
  'zararsizlik-narxi': `
## What is the break-even price?

The break-even price is the lowest selling price that still covers every cost. Selling below it is a loss.

## Formula

\`Break-even = Cost price + Commission + Logistics + Return losses + Advertising + Tax\`

## Calculating it in Daromadchi

Open **Dashboard → Calculator**:

1. Pick the marketplace: **Uzum** or **Yandex**
2. Pick the category — the commission percentage fills itself in
3. Enter the **cost price**
4. Enter **logistics** (from the marketplace's rate card)
5. Enter the **return rate** — take your real one from the **Return %** column in the **Product performance** table
6. Enter **ad spend**

The calculator shows the **break-even** figure alongside the other metrics (margin, ROI, DRR).

## Adding a target profit

\`Selling price = Break-even × (1 + Target margin / 100)\`

**Example:**
- Break-even: 45,000 so'm
- Target: 20% margin
- **Selling price: 54,000 so'm**

## Is your current price enough?

The **Reality Check** block in the calculator shows how much profit (or loss) the current price produces over a month. If the price runs at a loss, the calculator tells you how much to raise it by.

<info>The commission percentage is prefilled by category, but you can override it — the rate in your own contract is more accurate.</info>
`,
  'marja-hisoblash': `
## What is margin?

Margin is profit as a share of revenue, in percent. In Daromadchi margin means **net margin**: what is left after cost price and marketplace deductions.

\`Margin = Net profit / Revenue × 100\`

## Margin and markup are not the same

They are easy to confuse:

- **Margin** — profit as a percentage of the **selling price**
- **Markup** — profit as a percentage of the **cost price**

Buy at 50,000 so'm and sell at 100,000: the markup is 100%, the margin is 50%.

## Where to see margin

### Per product
The **Margin** column in the **Dashboard → Product analytics** table. At the top of the page you also get the store's **average margin** and counts of low- and high-margin products.

### Per variant
Expand a parent row and margin shows per variant (colour, size) — often one of them is dragging the whole group down.

### When planning
The **Calculator** and the **Unit economics** table compute margin from the values you enter.

## No cost price, no margin

A product with no cost price shows an inflated margin — the largest cost simply isn't counted. Fill it in with the pencil in the **Product performance** table, or on the **Products** page.

## What margin is healthy?

| Category | Minimum margin | Recommended |
|---|---|---|
| Electronics | 8% | 15-20% |
| Clothing | 20% | 35-50% |
| Cosmetics | 25% | 40-60% |
| Home goods | 15% | 25-35% |

<info>Even a low margin can produce a lot of profit at volume. So read margin alongside the **sales share** column.</info>
`,
  'logistika-xarajatlari': `
## Logistics costs

Delivery cost depends on weight, volume and the fulfillment model (FBO/FBS, FBY/FBS/DBS). It is the second-largest deduction after commission.

## How Daromadchi accounts for logistics

### In the calculator — manually
The **Logistics (so'm)** field on **Dashboard → Calculator** is where you enter delivery cost per unit. You take the figure from the marketplace's rate card.

### In the unit economics table — manually and as a percentage
In the **Unit economics** table, delivery is its own column. The **Last mile (%)** setting adds a percentage of the price on top — handy when the rate is percentage-based.

### In the P&L report — the actual figure
The **Delivery** line in the **P&L** report is not an estimate: it comes from the marketplace's own report. If the final report has not arrived, the value carries a **≈** and is replaced with the actual one once it does.

<info>So: use the calculator's estimate to plan, and the P&L's actual figure to judge a period that has passed.</info>

## Return costs

A returned item pays logistics twice — out and back.

\`Return cost = (Return % / 100) × (Logistics × 2)\`

You enter the return rate into the calculator. For your actual rate, use the **Return %** column in the **Product performance** table — it is computed from your own data.

## Where to find the rates

- **Uzum Market**: the rates section of the seller.uzum.uz cabinet
- **Yandex Market**: the rates section of the partner cabinet

<warning>Rates change and vary by region. Daromadchi does not refresh them automatically — re-check the value you entered from time to time.</warning>
`,
  'dashboard-korsatkichlari': `
## Dashboard metrics

The main cards you see when you sign in.

## Top cards

### Revenue
Total sales revenue for the selected period, with a percentage comparison against the previous period of the same length.

### Profit
Net profit after cost price and marketplace deductions. Products with no cost price drag this number down — fill it in on the **Products** page.

### Orders
Order count for the period. Cancelled orders are excluded.

### Stock
Current total stock on hand.

## Charts

### Sales chart
Daily revenue trend across the selected period.

### Category analysis
How much revenue each category brings — a donut chart.

### Top products
The products that generated the most revenue in the period.

### Stock alerts
Products running low. The full list is on the **Alerts** page.

## Changing the period

Using the date filter at the top:
- Yesterday
- 7 days
- 30 days
- 90 days
- This month

## Splitting by marketplace

With several stores connected, the marketplace buttons at the top let you view one marketplace at a time.

<info>Every number reflects the last sync. You can see when that was on the "Sync" page.</info>
`,
  'pnl-hisobot': `
## What is the P&L report?

The P&L (Profit & Loss) report shows your store's financial result month by month. Open it at **Dashboard → P&L report**.

## What the report contains

| Line | Meaning |
|---|---|
| **Total revenue** | Revenue from delivered orders |
| **Commission** | Marketplace commission |
| **Other** | Other marketplace deductions: acquiring, advertising, penalties |
| **Delivery** | Logistics costs |
| **Marketplace payout** | Revenue − commission − delivery − other |
| **COGS** | Cost of goods sold |
| **Net profit** | The bottom line |

## The "In progress" line

Undelivered orders are shown separately: their revenue counts once delivered and is not in profit yet. This is what keeps the report aligned with real money.

## The "≈" marker

Some values may carry a **≈**. It means the marketplace has not sent its final report yet and the figure is estimated from percentages. Once the report arrives, the number is replaced with the actual one.

## Editing cost price inside the report

The button on the cost-price line lets you fill in that month's cost price in place, without going to the product list. With cost price empty, net profit comes out too high.

## Month-by-month table

In the table below, each month is a row: revenue, commission, other deductions, cost price and net profit. Growth or decline shows up here.

## Export

The **Export** button downloads the report as a spreadsheet.

<info>Without cost price, the P&L only reflects marketplace deductions — profit will look larger than it is.</info>
`,
  'kategoriya-tahlili': `
## Category analysis

Daromadchi breaks your sales down by category.

## On the dashboard

The **Categories** donut chart shows each category's share of revenue, with the amounts listed beside it.

The daily Telegram report also includes a category breakdown.

## Product-level analysis

On **Dashboard → Product analytics** the totals sit at the top and the **Product performance** table below: sales, revenue, profit, margin and ABC class per product. See "Product analytics table" for details.

## ABC analysis

Products are classified by their share of revenue. The list is sorted by revenue descending, then:

| Class | Rule |
|---|---|
| **A** | Until cumulative revenue reaches 80% |
| **B** | From 80% up to 95% |
| **C** | Everything else |

The ABC column lives in the **Product performance** table.

## The ABC-XYZ page

**Dashboard → ABC-XYZ** goes a step further: it pairs ABC (revenue) with XYZ (demand stability). AX is steady and profitable; CZ is low-revenue and unpredictable.

## Top products

The **Top products** block on the dashboard lists what earned the most in the period. The full list and sorting live on the **Products** page.

<info>Categories come from the marketplace's own data. Products without one fall into the "Uncategorised" row.</info>
`,
  'tovar-tahlili-jadvali': `
## The product analytics table

The main table on **Dashboard → Product analytics**. "Top sold" and "Margin analysis by product" used to be two separate tables — they are now merged into one, because answering a question about a single product should not require looking in two places.

Each row is a product. A product with variants (colour, size) collapses into one parent row that you can expand to see each variant.

## Columns

| Column | Meaning |
|---|---|
| **Product** | Title and variant. Always visible |
| **Delivered** | Units delivered in the period |
| **In transit** | Out for delivery — not in profit yet |
| **Cancelled** | Cancelled orders |
| **Returned** | Units returned |
| **Return %** | Returned ÷ (delivered + returned) |
| **Revenue** | Revenue for the period |
| **Sales share** | What percentage of total revenue this product carries |
| **Avg. price** | Revenue ÷ units sold — the real price after discounts |
| **Price** | Current selling price |
| **Cost price** | Your cost |
| **Profit** | Revenue − cost price − marketplace deductions |
| **Margin** | Profit as a share of revenue (%) |
| **ABC** | A / B / C class |

<info>Every one of these columns is computed for both marketplaces. Metrics only one marketplace can supply were left out — otherwise the Yandex rows would always be blank.</info>

## Table settings

The **Table settings** button above the table opens a panel for switching columns on and off. Untick one and the column disappears; tick it again and it comes back.

There are ready-made presets too:
- **Minimal** — did it sell, does it earn
- **Sales** — units, returns, share, ABC
- **Money** — price, cost, profit, margin

Your choice is stored in the browser and is still there next time you sign in. The **Product** column cannot be switched off — the table would become a set of anonymous numbers.

## Editing values

Three columns can be changed straight in the table — hovering a row reveals a **pencil icon**:

- **Price**
- **Cost price**
- **Stock**

<warning>These edits stay inside Daromadchi. Nothing is sent to your marketplace listing — price, title and everything else are left untouched.</warning>

Price and stock come from the marketplace, so your value is stored separately and layered on top for display. Clear the field and the marketplace's own number returns — an edit hides the real value, it never destroys it.

On a parent row, editing **Price** and **Cost price** applies to every variant at once. Stock has no parent pencil: variants hold different quantities, and flattening them to one number would be wrong.

## Why cost price matters

With cost price empty, the **Profit** and **Margin** columns make a product look better than it is. Fill it in here or on the **Products** page.
`,
  'qidiruv-iboralari': `
## Search query analysis

Knowing which words bring customers to your products matters for SEO and advertising. In Daromadchi this is the **Dashboard → Search phrases** page.

## What the page shows

- The phrase and the product it belongs to
- Impressions
- Clicks
- CTR (clicks ÷ impressions)
- Orders
- Spend

<warning>For now this page stays empty. Search-phrase data comes from the marketplace's advertising/search API, and that is not connected yet — neither Uzum Market nor Yandex Market exposes it. Once the API opens up, the page fills in automatically.</warning>

## What you can do meanwhile

### Read keywords in your marketplace cabinet
The cabinet's search report is the only source for now.

### Check your product titles
In the **Dashboard → Products** list, look at how titles are written. The title feeds search directly.

### Measure the result through sales
After changing a title or photo, watch how that product's revenue and sales share move in the **Product performance** table. That measurement works without click data.

<info>The abbreviations on the page (CTR, CPC) are explained in the "Abbreviations" section on the dashboard.</info>
`,
  'tariflar': `
## Your tier follows your turnover

In Daromadchi you do not pick a plan — it is derived from your **net turnover over the last 30 days**. As turnover grows, the tier moves up.

| 30-day turnover | Tier |
|---|---|
| Under 12 mln so'm | **Free** |
| 12–50 mln so'm | **Pro** |
| 50–120 mln so'm | **Pro+** |
| 120–180 mln so'm | **Biznes** |
| Above 180 mln so'm | **Enterprise** |

## Prices

| Tier | Monthly | Billed yearly (per month) |
|---|---|---|
| Free | 0 so'm | — |
| Pro | 150,000 so'm | 125,000 so'm |
| Pro+ | 250,000 so'm | 225,000 so'm |
| Biznes | 500,000 so'm | 450,000 so'm |
| Enterprise | By agreement | — |

<info>Enterprise has no single published price — that tier is agreed separately.</info>

## Do the paid tiers differ in features?

In capability — **no**. Pro, Pro+, Biznes and Enterprise all carry the same feature set; they differ by turnover and price. From Pro+ upward you also get **priority support**.

## What the Free tier keeps

Free forever:
- The dashboard (including revenue and profit)
- Products
- Orders and their notifications (new order, cancellation, low stock)
- **Uzum and Yandex Market** — both, on every tier
- The Chrome extension

Sections that lock once the trial ends:
- Product analytics
- The Inventory page and stock sync
- Finance and payouts (the P&L report)
- Unit economics

<info>Every tier starts with a ${TRIAL_EN} free trial. No card details required.</info>
`,
  'tolov-usullari': `
## Payment method

Daromadchi accepts payment by **bank card**. The card is bound through the ATMOS payment system.

## Binding a card

On **Dashboard → Plan & billing**:

1. Choose your tier and pick **Monthly** or **Yearly**
2. Enter the card number and expiry
3. Enter the code from the SMS
4. Once confirmed, the plan activates immediately

<info>The card number is not stored in full by Daromadchi — what is kept is a secure identifier issued by the payment system.</info>

## Auto-renew

Once a card is bound, **Auto-renew** turns on: the charge is taken before the period ends. You can switch it off at any time — no further charge is then made.

## Monthly and yearly

Billed yearly, the per-month price is lower — exact amounts are in the table in "Plans and pricing". A yearly subscription is charged once, in full, for 12 months.

## If a payment fails

When a charge fails, the page shows the reason and you can retry. Payment history sits on the same page as a list.

<warning>Payment details travel over an encrypted connection. Daromadchi never asks for your full card number or your password.</warning>
`,
  'tarifni-ozgartirish': `
## Changing your plan

On **Dashboard → Plan & billing**:

1. Open the plan chooser
2. The tier matching your turnover is highlighted — pick it or another one
3. Select **Monthly** or **Yearly**
4. Confirm

The new plan activates as soon as the payment goes through.

## The turnover panel

The turnover panel on the page shows your net turnover over the last 30 days and which tier band it falls into. The panel is informational — on its own it charges nothing and switches nothing. When your turnover approaches the next tier's boundary, the panel says so.

## Cancelling your subscription

Press **Cancel plan** and confirm.

What cancelling means:
- **You will not be charged again**
- Everything stays unlocked until the period you paid for ends
- After that the account moves to Free on its own

It is not a refund and not an immediate cut-off. If there is no paid period yet, the move to Free is immediate.

## Undoing a cancellation

While the paid period is still running, **Resume plan** turns auto-renew back on.

## Your data is kept

Cancelling does not delete your account or your data — we never delete accounts automatically. Your data is kept for as long as the account exists, and you can resubscribe at any time.

If you want the account removed entirely, use "Request account deletion" in settings or write to privacy@daromadchi.uz.

<info>Existing subscribers are told in advance if a price changes — you are never charged an amount other than the one agreed.</info>
`,
  'bepul-sinov': `
## Free trial period

New accounts get a **${TRIAL_EN}** free trial.

## What is included?

During the trial the paid sections are open too:

- **Product analytics** — the 14-column table, ABC, margin
- The **Inventory** page and stock sync
- **Finance and payouts** — the P&L report
- The **unit economics** calculator

## What stays free after the trial

- The dashboard (including revenue and profit)
- Products
- Orders and notifications (new order, cancellation, low stock)
- **Uzum and Yandex Market** — both
- The Chrome extension

## No card required

The trial needs no card or payment details. Signing up with an email is enough.

## When the trial ends

${TRIAL_REMINDER_DAYS} days before it runs out you get a reminder in the app and in Telegram. Once it ends, if you have not picked a plan, the four sections above lock — and the account keeps working on the Free tier.

## Seeing your trial end date

The **Plan & billing** page shows the trial end date and the tier matching your turnover.

<info>The trial is granted once. Signing up with a different email does not give you a second one.</info>
`,
  'hisob-sozlamalari': `
## Where your account lives

Account details sit on two pages:

- **Dashboard → Account** — email, join date, current tier and how long it runs
- **Dashboard → Profile** — name, email and phone fields, plus the security section

## Plan status

The **Account** page shows your current tier, the trial end date and the plan's expiry. Payment and plan changes happen on **Plan & billing**.

## Language

The language switches with the **UZ / RU / EN** buttons in the top bar and applies across the app.

The Telegram notification language is **separate** — you pick it when linking the bot, and change it in the bot.

## Changing your password

The password is changed through the reset link:

1. Sign out and open the **Sign in** page
2. Click **"Forgot password?"**
3. Enter your email
4. Set a new password from the link in the email

<info>Two-factor authentication (2FA), the session list and the security log appear on the Profile page but are not live yet — they are still being built.</info>

## Marketplace connections

Store tokens and write mode live on the **Settings** page. See "Add and manage API token".

## Deleting your account

Through the "Request account deletion" button on the **Account** page. See "Delete account".
`,
  'api-token-sozlash': `
## What is an API token?

An API token is a key that lets Daromadchi **read** data from your marketplace cabinet. Each store needs its own token.

## The default: read-only

A newly connected store runs in **"Read-only"** mode. In that mode Daromadchi writes nothing: not price, not title, not the listing, not order status.

## Uzum Market token

1. Sign in to seller.uzum.uz
2. Open **Settings → API integration**
3. Create a new key and give it a name (for example "Daromadchi")
4. The token is shown once — copy it

<warning>The token is displayed only once. Copy and store it immediately.</warning>

## Yandex Market token

Yandex Market needs two values:

- **OAuth Token** — your Yandex Market Partner API token
- **Campaign ID** — the campaign number, digits only

If the Campaign ID is wrong (an email or a URL), saving fails straight away with an error.

## Entering them in Daromadchi

On the **Settings** page, find the card for the marketplace:

1. Paste the token into the field
2. For Yandex, also enter the Campaign ID
3. Press **Save**
4. Start the first import with **Sync**

The card shows the store's state ("Connected" / "Not connected") and the last sync time.

## Refreshing a token

If a token expires or is revoked, issue a new one in the marketplace cabinet, paste it into the same field and save. Existing data is not lost.

## Optional: "Stock-sync (edit mode)"

When one physical product sells on two marketplaces, a sale in one place should decrement the other. For that you can enable **edit mode** for a store.

Before it turns on you must tick a confirmation box. Once enabled:

- Daromadchi updates only the **stock quantity (ostatok)**
- Price, title, listing, order status and invoices are never touched
- Every write is recorded in an audit log

You also choose how the last shared unit is allocated: lock the last one, partition across channels, or off.

For Uzum this mode requires the **SKU_UPDATE** permission on the token.

<warning>Edit mode is off by default. Until you turn it on yourself, nothing is ever written to any of your stores.</warning>

## Several stores

The Uzum and Yandex Market cards are independent — you can connect both at once. The marketplace buttons on the dashboard let you view each separately.
`,
  'jamoa-boshqaruvi': `
## Team management — coming soon

The **Dashboard → Team** page is still marked "Coming soon". The section is being built and you'll hear from us once it ships.

## How it works today

One Daromadchi account is one user. You can connect several **stores** to a single account (Uzum and Yandex Market, each with its own token), but the account itself has one set of credentials.

## If you need to show data to a colleague

### Export the report
Most tables have an **Export** button — the P&L report, alerts, search phrases, orders. Sending a file does not grant account access.

### Use Telegram notifications
The daily report and alerts arrive in Telegram — that is how the right information reaches a warehouse keeper or a manager.

<warning>Do not share your password. Security settings are covered in "Account security".</warning>
`,
  'hisobni-ochirish': `
## Deleting your account

Deletion runs as a request — the account does not vanish the moment you press a button.

## Before you delete

- Export the reports you need — they cannot be recovered afterwards
- Cancel any active subscription (**Plan & billing → Cancel plan**)
- Revoke the Daromadchi token in your marketplace cabinet

## Sending the request

Press **"Request account deletion"** on the **Dashboard → Account** page.

The request goes to the operator and you get a confirmation that it was received. Deletion is a controlled procedure carried out manually.

## Alternative: privacy@daromadchi.uz

You can also send the request straight to **privacy@daromadchi.uz**. The response time is 15 working days (as required by Law ZRU-547).

## What gets deleted

Your personal data and store data are removed. Payment records are retained **anonymised**, as the law requires — they are no longer linked to you.

## Cancelling a subscription is different

Cancelling does not delete your account. We never delete accounts automatically: your data is kept for as long as the account exists, and you can resubscribe at any time.

<warning>Once deletion has been carried out, the data cannot be restored. Export what you need beforehand.</warning>
`,
  'xavfsizlik': `
## Account security

Here is what actually protects your account today.

## A strong password

A good password has:
- At least 12 characters
- Upper and lower case letters
- Numbers
- Special characters (!@#$)

You can change it at any time via **Sign in → "Forgot password?"**.

<info>Two-factor authentication (2FA), the session list and the sign-in log appear on the Profile page but are not live yet. This article will be updated when they ship.</info>

## Signing out everywhere

The **Sign out** button ends the session on every device — cookies are cleared across the whole domain. On a shared computer, remember to sign out when you're done.

## Your API tokens

- Tokens are stored encrypted
- By default they are used for reading only — nothing is written until you turn on "Stock sync" yourself
- If you have any doubt about a token, revoke it in the marketplace cabinet and issue a new one

## Watch out for phishing

Daromadchi will never ask for:
- Your password
- Your API token (you only ever enter it yourself on the Settings page)
- Your full card number or an SMS code

Official addresses: **daromadchi.uz**, Telegram channel **@daromadchi_uz**.

## If something looks wrong

1. Change your password immediately
2. Revoke your marketplace tokens and issue new ones
3. Write to **support@daromadchi.uz**

<warning>Daromadchi never asks for your password or API token. Any such request is phishing.</warning>
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
