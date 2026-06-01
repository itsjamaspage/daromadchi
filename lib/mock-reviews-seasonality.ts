export interface ReviewEntry {
  id: string
  productId: string
  productTitle: string
  rating: number          // 1–5
  text: string
  author: string
  date: string
  marketplace: 'uzum' | 'yandex_market'
  replied: boolean
  replyText?: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export const reviewEntries: ReviewEntry[] = [
  { id: 'rv-1', productId: '1', productTitle: 'Nike Air Max 270',     rating: 5, text: "Juda yaxshi mahsulot! Sifati ajoyib, tez yetib keldi. Tavsiya qilaman!", author: "Bobur T.", date: "2026-05-06", marketplace: 'uzum', replied: true,  replyText: "Rahmat! Yana xarid qilishingizni kutamiz.", sentiment: 'positive' },
  { id: 'rv-2', productId: '1', productTitle: 'Nike Air Max 270',     rating: 4, text: "Yaxshi krossovka, lekin o'lchami biroz katta keldi. Keyingi safar kichikroq olaman.", author: "Malika Y.", date: "2026-05-05", marketplace: 'uzum', replied: false, sentiment: 'positive' },
  { id: 'rv-3', productId: '2', productTitle: 'Adidas Ultraboost 22', rating: 2, text: "Rasmda ko'rsatilgandan farq qiladi. Rangi boshqacha. Juda hafsalam pir bo'ldi.", author: "Jasur N.", date: "2026-05-05", marketplace: 'uzum', replied: false, sentiment: 'negative' },
  { id: 'rv-4', productId: '3', productTitle: 'Samsung Galaxy A54',   rating: 5, text: "Telefon super! Narxi uchun juda zo'r. Kamera sifati ajoyib.", author: "Dilnoza K.", date: "2026-05-04", marketplace: 'uzum', replied: true,  replyText: "Rahmat! Xaridingizdan mamnun bo'lganingizdan xursandmiz.", sentiment: 'positive' },
  { id: 'rv-5', productId: '3', productTitle: 'Samsung Galaxy A54',   rating: 1, text: "Soxta mahsulot! Original emas. Pulimni qaytarib bering!!!", author: "Sherzod A.", date: "2026-05-04", marketplace: 'uzum', replied: false, sentiment: 'negative' },
  { id: 'rv-6', productId: '4', productTitle: 'Xiaomi Redmi Watch 3', rating: 3, text: "O'rtacha mahsulot. Batareya tez tugaydi. Boshqa tomonlari yaxshi.", author: "Nargiza X.", date: "2026-05-03", marketplace: 'uzum', replied: false, sentiment: 'neutral' },
  { id: 'rv-7', productId: '5', productTitle: "Levi's 501 Original",  rating: 5, text: "Original Levi's! Narxi boshqa do'konlarga qaraganda arzonroq. Tez keldi.", author: "Ulugbek R.", date: "2026-05-03", marketplace: 'uzum', replied: true,  replyText: "Rahmat Ulugbek aka!", sentiment: 'positive' },
  { id: 'rv-8', productId: '6', productTitle: 'Sony WH-1000XM5',      rating: 2, text: "Quloqchin ishlaydi lekin qadoqlash buzilgan holda keldi. Sotuvchi ehtiyotkor bo'lsin.", author: "Feruza S.", date: "2026-05-02", marketplace: 'uzum', replied: false, sentiment: 'negative' },
  { id: 'rv-9', productId: '1', productTitle: 'Nike Air Max 270',     rating: 5, text: "Ikkinchi marta xarid qildim. Har doim sifatli. Rahmat!", author: "Otabek M.", date: "2026-05-01", marketplace: 'uzum', replied: true, replyText: "Doimiy mijozimiz uchun rahmat!", sentiment: 'positive' },
  { id: 'rv-10',productId: '2', productTitle: 'Adidas Ultraboost 22', rating: 4, text: "Yaxshi yugurish krossovkasi. Bir oz qimmatroq lekin sifati bor.", author: "Gulnora H.", date: "2026-04-30", marketplace: 'uzum', replied: false, sentiment: 'positive' },
]

export interface SeasonalityPoint {
  month: string
  revenue: number
  orders: number
  avgCheck: number
}

export interface ProductSeasonality {
  productId: string
  productTitle: string
  category: string
  data: SeasonalityPoint[]
  peakMonth: string
  lowMonth: string
  growthPct: number  // year-over-year or last 6 months trend
}

export const seasonalityData: ProductSeasonality[] = [
  {
    productId: '1', productTitle: 'Nike Air Max 270', category: 'Krossovkalar',
    peakMonth: 'Aprel', lowMonth: 'Yanvar', growthPct: 22,
    data: [
      { month: 'Iyl',     revenue: 12_400_000, orders: 14, avgCheck: 886_000 },
      { month: 'Avg',     revenue: 18_600_000, orders: 21, avgCheck: 886_000 },
      { month: 'Sen',     revenue: 24_100_000, orders: 27, avgCheck: 893_000 },
      { month: 'Okt',     revenue: 31_200_000, orders: 35, avgCheck: 891_000 },
      { month: 'Noy',     revenue: 52_400_000, orders: 59, avgCheck: 888_000 },
      { month: 'Dek',     revenue: 68_900_000, orders: 77, avgCheck: 895_000 },
      { month: 'Yan',     revenue: 19_200_000, orders: 22, avgCheck: 873_000 },
      { month: 'Fev',     revenue: 22_400_000, orders: 25, avgCheck: 896_000 },
      { month: 'Mar',     revenue: 38_700_000, orders: 43, avgCheck: 900_000 },
      { month: 'Apr',     revenue: 89_600_000, orders: 101, avgCheck: 887_000 },
      { month: 'May',     revenue: 114_000_000, orders: 128, avgCheck: 891_000 },
      { month: 'Iyn',     revenue: 76_200_000, orders: 86, avgCheck: 886_000 },
    ],
  },
  {
    productId: '3', productTitle: 'Samsung Galaxy A54', category: 'Elektronika',
    peakMonth: 'Dekabr', lowMonth: 'Avgust', growthPct: 15,
    data: [
      { month: 'Iyl',     revenue: 96_000_000,  orders: 30, avgCheck: 3_200_000 },
      { month: 'Avg',     revenue: 89_600_000,  orders: 28, avgCheck: 3_200_000 },
      { month: 'Sen',     revenue: 102_400_000, orders: 32, avgCheck: 3_200_000 },
      { month: 'Okt',     revenue: 118_400_000, orders: 37, avgCheck: 3_200_000 },
      { month: 'Noy',     revenue: 147_200_000, orders: 46, avgCheck: 3_200_000 },
      { month: 'Dek',     revenue: 195_200_000, orders: 61, avgCheck: 3_200_000 },
      { month: 'Yan',     revenue: 108_800_000, orders: 34, avgCheck: 3_200_000 },
      { month: 'Fev',     revenue: 96_000_000,  orders: 30, avgCheck: 3_200_000 },
      { month: 'Mar',     revenue: 115_200_000, orders: 36, avgCheck: 3_200_000 },
      { month: 'Apr',     revenue: 131_200_000, orders: 41, avgCheck: 3_200_000 },
      { month: 'May',     revenue: 214_400_000, orders: 67, avgCheck: 3_200_000 },
      { month: 'Iyn',     revenue: 121_600_000, orders: 38, avgCheck: 3_200_000 },
    ],
  },
  {
    productId: '5', productTitle: "Levi's 501 Original", category: 'Kiyim',
    peakMonth: 'Mart', lowMonth: 'Avgust', growthPct: 31,
    data: [
      { month: 'Iyl',     revenue: 38_880_000,  orders: 72,  avgCheck: 540_000 },
      { month: 'Avg',     revenue: 32_400_000,  orders: 60,  avgCheck: 540_000 },
      { month: 'Sen',     revenue: 62_640_000,  orders: 116, avgCheck: 540_000 },
      { month: 'Okt',     revenue: 87_480_000,  orders: 162, avgCheck: 540_000 },
      { month: 'Noy',     revenue: 72_900_000,  orders: 135, avgCheck: 540_000 },
      { month: 'Dek',     revenue: 54_000_000,  orders: 100, avgCheck: 540_000 },
      { month: 'Yan',     revenue: 37_800_000,  orders: 70,  avgCheck: 540_000 },
      { month: 'Fev',     revenue: 62_100_000,  orders: 115, avgCheck: 540_000 },
      { month: 'Mar',     revenue: 108_000_000, orders: 200, avgCheck: 540_000 },
      { month: 'Apr',     revenue: 95_040_000,  orders: 176, avgCheck: 540_000 },
      { month: 'May',     revenue: 67_500_000,  orders: 125, avgCheck: 540_000 },
      { month: 'Iyn',     revenue: 43_200_000,  orders: 80,  avgCheck: 540_000 },
    ],
  },
]
