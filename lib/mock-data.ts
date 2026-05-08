export const kpiData = {
  revenue: { value: 124_500_000, change: 12.4 },
  profit:  { value: 38_200_000,  change: 8.7  },
  orders:  { value: 1842,        change: 5.2  },
  stock:   { value: 3410,        change: -2.1 },
}

export const dailyRevenue = [
  { date: 'Apr 26', revenue: 3_800_000 },
  { date: 'Apr 27', revenue: 4_200_000 },
  { date: 'Apr 28', revenue: 3_100_000 },
  { date: 'Apr 29', revenue: 5_600_000 },
  { date: 'Apr 30', revenue: 4_900_000 },
  { date: 'May 1',  revenue: 6_200_000 },
  { date: 'May 2',  revenue: 5_800_000 },
]

export const products = [
  { id: 1, name: 'Nike Air Max 270',     sku: 'NK-AM270-42', category: 'Krossovkalar', price: 890_000,   cost: 520_000,  profit: 370_000, sold: 128, stock: 45 },
  { id: 2, name: 'Adidas Ultraboost 22', sku: 'AD-UB22-41',  category: 'Krossovkalar', price: 1_120_000, cost: 680_000,  profit: 440_000, sold: 94,  stock: 23 },
  { id: 3, name: 'Samsung Galaxy A54',   sku: 'SM-A54-128',  category: 'Elektronika',  price: 3_200_000, cost: 2_450_000,profit: 750_000, sold: 67,  stock: 12 },
  { id: 4, name: 'Apple AirPods Pro',    sku: 'AP-AIP-2',    category: 'Elektronika',  price: 2_800_000, cost: 2_100_000,profit: 700_000, sold: 52,  stock: 30 },
  { id: 5, name: 'Xiaomi Redmi Watch 3', sku: 'XM-RW3-BLK',  category: 'Soatlar',      price: 680_000,   cost: 390_000,  profit: 290_000, sold: 201, stock: 88 },
  { id: 6, name: "Levi's 501 Original",  sku: 'LV-501-32',   category: 'Kiyim',        price: 540_000,   cost: 280_000,  profit: 260_000, sold: 176, stock: 64 },
  { id: 7, name: 'Sony WH-1000XM5',      sku: 'SN-WH5-BLK',  category: 'Elektronika',  price: 3_600_000, cost: 2_800_000,profit: 800_000, sold: 38,  stock: 9  },
  { id: 8, name: 'Puma RS-X Toys',       sku: 'PM-RSX-43',   category: 'Krossovkalar', price: 760_000,   cost: 430_000,  profit: 330_000, sold: 115, stock: 41 },
]

// Advertising data per product (ad spend in so'm, clicks, ad-attributed orders)
export const productAds: Record<number, {
  adSpend: number
  clicks: number
  adOrders: number   // orders attributed to ads
}> = {
  1: { adSpend: 12_400_000, clicks: 3_840, adOrders: 48 },  // 37.5% of sales from ads
  2: { adSpend: 18_900_000, clicks: 2_210, adOrders: 35 },  // high spend, good conversion
  3: { adSpend:  4_200_000, clicks:   890, adOrders: 12 },  // low spend, premium product
  4: { adSpend:  6_800_000, clicks: 1_100, adOrders: 18 },
  5: { adSpend: 38_500_000, clicks: 8_920, adOrders: 98 },  // overspend — DRR 28%
  6: { adSpend:  5_100_000, clicks: 2_640, adOrders: 55 },  // good ROI
  7: { adSpend:  1_200_000, clicks:   180, adOrders:  0 },  // spend without sales ⚠️
  8: { adSpend:  9_600_000, clicks: 2_850, adOrders: 42 },
}

export const orders = [
  { id: 'UZM-001842', customer: 'Bobur Toshmatov',   product: 'Nike Air Max 270',     date: '2026-05-02', status: 'delivered', amount: 890_000   },
  { id: 'UZM-001841', customer: 'Malika Yusupova',   product: 'Samsung Galaxy A54',   date: '2026-05-02', status: 'processing',amount: 3_200_000 },
  { id: 'UZM-001840', customer: 'Jasur Nazarov',     product: 'Apple AirPods Pro',    date: '2026-05-01', status: 'shipped',   amount: 2_800_000 },
  { id: 'UZM-001839', customer: 'Dilnoza Karimova',  product: "Levi's 501 Original",  date: '2026-05-01', status: 'delivered', amount: 540_000   },
  { id: 'UZM-001838', customer: 'Sherzod Alimov',    product: 'Xiaomi Redmi Watch 3', date: '2026-04-30', status: 'delivered', amount: 680_000   },
  { id: 'UZM-001837', customer: 'Nargiza Xolmatova', product: 'Sony WH-1000XM5',      date: '2026-04-30', status: 'cancelled', amount: 3_600_000 },
  { id: 'UZM-001836', customer: 'Ulugbek Rahimov',   product: 'Adidas Ultraboost 22', date: '2026-04-29', status: 'delivered', amount: 1_120_000 },
  { id: 'UZM-001835', customer: 'Feruza Saidova',    product: 'Puma RS-X Toys',       date: '2026-04-29', status: 'processing',amount: 760_000   },
  { id: 'UZM-001834', customer: 'Otabek Mirzayev',   product: 'Nike Air Max 270',     date: '2026-04-28', status: 'shipped',   amount: 890_000   },
  { id: 'UZM-001833', customer: 'Gulnora Hamidova',  product: 'Samsung Galaxy A54',   date: '2026-04-28', status: 'delivered', amount: 3_200_000 },
]

// Uzum Market commission rates by category (%)
export const uzumCommissions: Record<string, number> = {
  'Krossovkalar': 8,
  'Elektronika':  5,
  'Soatlar':      9,
  'Kiyim':        10,
  'Sport':        8,
  'Uy-joy':       7,
  'Boshqa':       10,
}

// ── Unit Economics mock data ──────────────────────────────────────────────────
import type { UnitEconomicsItem, AdCampaign, SearchPhrase, SyncDay } from './types'

export const unitEconomicsItems: UnitEconomicsItem[] = [
  {
    id: 'ue-1',
    title: 'Nike Air Max 270',
    image: undefined,
    sku: 'NK-AM270-42',
    category: 'Krossovkalar',
    marketplace: 'uzum',
    sellingPrice: 890_000,
    costPrice: 520_000,
    commissionPct: 8,
    commission: 71_200,
    delivery: 35_600,
    lastMile: 12_000,
    acquiring: 13_350,
    adSpend: 44_500,
    tax: 13_437,
    netProfit: 179_913,
    roi: 34,
    margin: 20,
    stock: 45,
    weight: 0.9,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/nike-air-max-270-123456',
    addedAt: '2026-05-01T09:00:00Z',
  },
  {
    id: 'ue-2',
    title: 'Adidas Ultraboost 22',
    sku: 'AD-UB22-41',
    category: 'Krossovkalar',
    marketplace: 'uzum',
    sellingPrice: 1_120_000,
    costPrice: 680_000,
    commissionPct: 8,
    commission: 89_600,
    delivery: 44_800,
    lastMile: 12_000,
    acquiring: 16_800,
    adSpend: 78_400,
    tax: 29_880,
    netProfit: 168_520,
    roi: 24,
    margin: 15,
    stock: 23,
    weight: 1.0,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/adidas-ultraboost-234567',
    addedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'ue-3',
    title: 'Samsung Galaxy A54',
    sku: 'SM-A54-128',
    category: 'Elektronika',
    marketplace: 'uzum',
    sellingPrice: 3_200_000,
    costPrice: 2_450_000,
    commissionPct: 5,
    commission: 160_000,
    delivery: 25_000,
    lastMile: 12_000,
    acquiring: 48_000,
    adSpend: 96_000,
    tax: 24_450,
    netProfit: 384_550,
    roi: 15,
    margin: 12,
    stock: 12,
    weight: 0.2,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/samsung-galaxy-a54-345678',
    addedAt: '2026-05-02T08:00:00Z',
  },
  {
    id: 'ue-4',
    title: 'Xiaomi Redmi Watch 3',
    sku: 'XM-RW3-BLK',
    category: 'Soatlar',
    marketplace: 'uzum',
    sellingPrice: 680_000,
    costPrice: 390_000,
    commissionPct: 9,
    commission: 61_200,
    delivery: 27_200,
    lastMile: 12_000,
    acquiring: 10_200,
    adSpend: 68_000,
    tax: 27_690,
    netProfit: 83_710,
    roi: 21,
    margin: 12,
    stock: 88,
    weight: 0.08,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/xiaomi-redmi-watch-456789',
    addedAt: '2026-05-02T11:00:00Z',
  },
  {
    id: 'ue-5',
    title: "Levi's 501 Original",
    sku: 'LV-501-32',
    category: 'Kiyim',
    marketplace: 'uzum',
    sellingPrice: 540_000,
    costPrice: 280_000,
    commissionPct: 10,
    commission: 54_000,
    delivery: 21_600,
    lastMile: 12_000,
    acquiring: 8_100,
    adSpend: 27_000,
    tax: 41_760,
    netProfit: 95_540,
    roi: 34,
    margin: 17,
    stock: 64,
    weight: 0.6,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/levis-501-567890',
    addedAt: '2026-05-03T14:00:00Z',
  },
  {
    id: 'ue-6',
    title: 'Sony WH-1000XM5',
    sku: 'SN-WH5-BLK',
    category: 'Elektronika',
    marketplace: 'uzum',
    sellingPrice: 3_600_000,
    costPrice: 2_800_000,
    commissionPct: 5,
    commission: 180_000,
    delivery: 28_000,
    lastMile: 12_000,
    acquiring: 54_000,
    adSpend: 36_000,
    tax: 28_800,
    netProfit: 461_200,
    roi: 16,
    margin: 12,
    stock: 9,
    weight: 0.25,
    supplierUrl: '',
    productUrl: 'https://uzum.uz/product/sony-wh1000xm5-678901',
    addedAt: '2026-05-03T15:00:00Z',
  },
]

// ── Advertising campaigns mock data ──────────────────────────────────────────
export const adCampaigns: AdCampaign[] = [
  {
    id: 'ad-1', name: 'Nike Air Max — Krossovkalar', type: 'cpc', status: 'active',
    productTitle: 'Nike Air Max 270',
    spend: 12_400_000, impressions: 184_200, clicks: 3_840, ctr: 2.08,
    orders: 48, revenue: 42_720_000, drr: 29.0, startDate: '2026-04-01',
  },
  {
    id: 'ad-2', name: 'Adidas Ultraboost promo', type: 'cpc', status: 'active',
    productTitle: 'Adidas Ultraboost 22',
    spend: 18_900_000, impressions: 96_400, clicks: 2_210, ctr: 2.29,
    orders: 35, revenue: 39_200_000, drr: 48.2, startDate: '2026-04-05',
  },
  {
    id: 'ad-3', name: 'Samsung A54 — Elektronika', type: 'cpc', status: 'paused',
    productTitle: 'Samsung Galaxy A54',
    spend: 4_200_000, impressions: 32_100, clicks: 890, ctr: 2.77,
    orders: 12, revenue: 38_400_000, drr: 10.9, startDate: '2026-04-10',
  },
  {
    id: 'ad-4', name: 'Xiaomi Watch — buyurtma uchun', type: 'cpo', status: 'active',
    productTitle: 'Xiaomi Redmi Watch 3',
    spend: 38_500_000, impressions: 412_000, clicks: 8_920, ctr: 2.16,
    orders: 98, revenue: 66_640_000, drr: 57.8, startDate: '2026-04-01',
  },
  {
    id: 'ad-5', name: "Levi's 501 — Kiyim aksiyasi", type: 'cpo', status: 'active',
    productTitle: "Levi's 501 Original",
    spend: 5_100_000, impressions: 128_400, clicks: 2_640, ctr: 2.05,
    orders: 55, revenue: 29_700_000, drr: 17.1, startDate: '2026-04-15',
  },
  {
    id: 'ad-6', name: 'Sony XM5 — test kampaniya', type: 'cpc', status: 'stopped',
    productTitle: 'Sony WH-1000XM5',
    spend: 1_200_000, impressions: 8_400, clicks: 180, ctr: 2.14,
    orders: 0, revenue: 0, drr: 0, startDate: '2026-04-20',
  },
  {
    id: 'ad-7', name: 'Puma RS-X — sezon aksiya', type: 'cpo', status: 'active',
    productTitle: 'Puma RS-X Toys',
    spend: 9_600_000, impressions: 156_000, clicks: 2_850, ctr: 1.82,
    orders: 42, revenue: 31_920_000, drr: 30.1, startDate: '2026-04-08',
  },
]

// ── Search phrases mock data ──────────────────────────────────────────────────
export const searchPhrases: SearchPhrase[] = [
  { id: 'sp-1',  productId: '1', productTitle: 'Nike Air Max 270',     phrase: 'nike air max krossovka',         impressions: 42_100, clicks: 920,   ctr: 2.18, orders: 18, spend: 3_200_000 },
  { id: 'sp-2',  productId: '1', productTitle: 'Nike Air Max 270',     phrase: 'krossovka erkaklar uzum',        impressions: 31_400, clicks: 680,   ctr: 2.16, orders: 12, spend: 2_100_000 },
  { id: 'sp-3',  productId: '1', productTitle: 'Nike Air Max 270',     phrase: 'sport poyabzal nike',            impressions: 28_600, clicks: 540,   ctr: 1.88, orders: 9,  spend: 1_800_000 },
  { id: 'sp-4',  productId: '2', productTitle: 'Adidas Ultraboost 22', phrase: 'adidas ultraboost yugurish',     impressions: 38_200, clicks: 840,   ctr: 2.20, orders: 15, spend: 5_600_000 },
  { id: 'sp-5',  productId: '2', productTitle: 'Adidas Ultraboost 22', phrase: 'yengil krossovka adidas',        impressions: 22_900, clicks: 410,   ctr: 1.79, orders: 8,  spend: 3_400_000 },
  { id: 'sp-6',  productId: '3', productTitle: 'Samsung Galaxy A54',   phrase: 'samsung galaxy a54 128gb',       impressions: 18_400, clicks: 510,   ctr: 2.77, orders: 8,  spend: 2_100_000 },
  { id: 'sp-7',  productId: '3', productTitle: 'Samsung Galaxy A54',   phrase: 'samsung telefon uzum arzon',     impressions: 12_100, clicks: 290,   ctr: 2.39, orders: 4,  spend: 1_400_000 },
  { id: 'sp-8',  productId: '4', productTitle: 'Xiaomi Redmi Watch 3', phrase: 'xiaomi soat arzon',              impressions: 98_400, clicks: 2_140, ctr: 2.17, orders: 42, spend: 14_200_000 },
  { id: 'sp-9',  productId: '4', productTitle: 'Xiaomi Redmi Watch 3', phrase: 'smart soat erkaklar',            impressions: 76_200, clicks: 1_680, ctr: 2.20, orders: 31, spend: 11_400_000 },
  { id: 'sp-10', productId: '4', productTitle: 'Xiaomi Redmi Watch 3', phrase: 'redmi watch 3 narxi',           impressions: 54_100, clicks: 1_180, ctr: 2.18, orders: 18, spend: 8_200_000 },
  { id: 'sp-11', productId: '5', productTitle: "Levi's 501 Original",  phrase: "levi's 501 original ko'k",      impressions: 34_200, clicks: 710,   ctr: 2.07, orders: 22, spend: 2_400_000 },
  { id: 'sp-12', productId: '5', productTitle: "Levi's 501 Original",  phrase: 'jinsi shim uzum',               impressions: 28_100, clicks: 580,   ctr: 2.06, orders: 18, spend: 1_900_000 },
  { id: 'sp-13', productId: '6', productTitle: 'Sony WH-1000XM5',      phrase: 'sony quloqchin noise canceling', impressions: 4_100,  clicks: 92,    ctr: 2.24, orders: 0,  spend: 420_000  },
  { id: 'sp-14', productId: '7', productTitle: 'Puma RS-X Toys',       phrase: 'puma krossovka rsx',            impressions: 41_200, clicks: 760,   ctr: 1.84, orders: 14, spend: 3_200_000 },
  { id: 'sp-15', productId: '7', productTitle: 'Puma RS-X Toys',       phrase: 'sport poyabzal rangli',         impressions: 38_900, clicks: 680,   ctr: 1.74, orders: 12, spend: 2_900_000 },
]

// ── Data State mock data ──────────────────────────────────────────────────────
function makeSyncDays(): SyncDay[] {
  const days: SyncDay[] = []
  const now = new Date('2026-05-07')
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const rand = Math.random()
    const status: SyncDay['status'] =
      rand < 0.04 ? 'error' : rand < 0.08 ? 'degraded' : i === 0 ? 'pending' : 'ready'
    days.push({
      date: dateStr,
      status,
      productsCount: status === 'error' ? undefined : Math.floor(Math.random() * 20) + 480,
      revenue: status === 'error' ? undefined : Math.floor(Math.random() * 8_000_000) + 3_000_000,
      adSpend: status === 'error' ? undefined : Math.floor(Math.random() * 2_000_000) + 500_000,
      errorMessage: status === 'error' ? 'API timeout — Uzum server xatosi' : undefined,
    })
  }
  return days
}

export const syncDays: SyncDay[] = makeSyncDays()

// ── Stock Alerts mock data ────────────────────────────────────────────────────
export interface StockAlert {
  productId: string
  productTitle: string
  sku: string
  currentStock: number
  threshold: number
  daysLeft: number      // estimated days until stockout at current sales rate
  dailySales: number    // avg daily sales
  marketplace: 'uzum' | 'yandex_market'
}

export const stockAlerts: StockAlert[] = [
  { productId: '3', productTitle: 'Samsung Galaxy A54',  sku: 'SM-A54-128',  currentStock: 12, threshold: 15, daysLeft: 5,  dailySales: 2.2, marketplace: 'uzum' },
  { productId: '7', productTitle: 'Sony WH-1000XM5',     sku: 'SN-WH5-BLK',  currentStock: 9,  threshold: 15, daysLeft: 3,  dailySales: 3.0, marketplace: 'uzum' },
  { productId: '2', productTitle: 'Adidas Ultraboost 22',sku: 'AD-UB22-41',  currentStock: 23, threshold: 25, daysLeft: 11, dailySales: 2.1, marketplace: 'uzum' },
]

// ── Payout Reconciliation mock data ──────────────────────────────────────────
export interface PayoutEntry {
  id: string
  period: string        // e.g. "2026 may 1–15"
  grossRevenue: number
  commission: number
  delivery: number
  returns: number
  adSpend: number
  acquiring: number
  tax: number
  otherDeductions: number
  netPayout: number
  ordersCount: number
  status: 'paid' | 'pending' | 'processing'
  payoutDate: string | null
}

export const payoutEntries: PayoutEntry[] = [
  { id: 'pay-1', period: '2026 may 1–15',    grossRevenue: 62_400_000, commission: 4_992_000, delivery: 2_496_000, returns: 3_120_000, adSpend: 8_960_000, acquiring: 936_000,  tax: 3_744_000, otherDeductions: 0,       netPayout: 38_152_000, ordersCount: 84,  status: 'pending',    payoutDate: null },
  { id: 'pay-2', period: '2026 apr 16–30',   grossRevenue: 58_200_000, commission: 4_656_000, delivery: 2_328_000, returns: 2_910_000, adSpend: 7_840_000, acquiring: 873_000,  tax: 3_492_000, otherDeductions: 120_000, netPayout: 35_981_000, ordersCount: 76,  status: 'processing', payoutDate: null },
  { id: 'pay-3', period: '2026 apr 1–15',    grossRevenue: 51_800_000, commission: 4_144_000, delivery: 2_072_000, returns: 2_590_000, adSpend: 6_400_000, acquiring: 777_000,  tax: 3_108_000, otherDeductions: 0,       netPayout: 32_709_000, ordersCount: 68,  status: 'paid',       payoutDate: '2026-04-18' },
  { id: 'pay-4', period: '2026 mar 16–31',   grossRevenue: 44_600_000, commission: 3_568_000, delivery: 1_784_000, returns: 2_230_000, adSpend: 5_200_000, acquiring: 669_000,  tax: 2_676_000, otherDeductions: 0,       netPayout: 28_473_000, ordersCount: 59,  status: 'paid',       payoutDate: '2026-04-03' },
  { id: 'pay-5', period: '2026 mar 1–15',    grossRevenue: 38_100_000, commission: 3_048_000, delivery: 1_524_000, returns: 1_905_000, adSpend: 4_100_000, acquiring: 571_500,  tax: 2_286_000, otherDeductions: 0,       netPayout: 24_665_500, ordersCount: 51,  status: 'paid',       payoutDate: '2026-03-18' },
]

// ── Dashboard dynamics mock data ──────────────────────────────────────────────
export const dynamicsData = [
  { date: 'Apr 21', revenue: 3_100_000, profit: 820_000, adSpend: 480_000, drr: 15.5, clicks: 2_100, impressions: 98_000, avgCheck: 620_000 },
  { date: 'Apr 22', revenue: 3_800_000, profit: 1_100_000, adSpend: 610_000, drr: 16.0, clicks: 2_480, impressions: 112_000, avgCheck: 640_000 },
  { date: 'Apr 23', revenue: 4_200_000, profit: 1_300_000, adSpend: 720_000, drr: 17.1, clicks: 2_920, impressions: 128_000, avgCheck: 660_000 },
  { date: 'Apr 24', revenue: 3_600_000, profit: 980_000,   adSpend: 590_000, drr: 16.4, clicks: 2_340, impressions: 104_000, avgCheck: 630_000 },
  { date: 'Apr 25', revenue: 4_900_000, profit: 1_520_000, adSpend: 840_000, drr: 17.1, clicks: 3_200, impressions: 141_000, avgCheck: 700_000 },
  { date: 'Apr 26', revenue: 3_800_000, profit: 1_040_000, adSpend: 630_000, drr: 16.6, clicks: 2_480, impressions: 108_000, avgCheck: 640_000 },
  { date: 'Apr 27', revenue: 4_200_000, profit: 1_210_000, adSpend: 680_000, drr: 16.2, clicks: 2_740, impressions: 121_000, avgCheck: 655_000 },
  { date: 'Apr 28', revenue: 3_100_000, profit: 830_000,   adSpend: 510_000, drr: 16.5, clicks: 2_050, impressions: 94_000,  avgCheck: 620_000 },
  { date: 'Apr 29', revenue: 5_600_000, profit: 1_740_000, adSpend: 910_000, drr: 16.2, clicks: 3_640, impressions: 162_000, avgCheck: 730_000 },
  { date: 'Apr 30', revenue: 4_900_000, profit: 1_490_000, adSpend: 800_000, drr: 16.3, clicks: 3_190, impressions: 144_000, avgCheck: 710_000 },
  { date: 'May 1',  revenue: 6_200_000, profit: 1_980_000, adSpend: 1_040_000, drr: 16.8, clicks: 4_020, impressions: 182_000, avgCheck: 760_000 },
  { date: 'May 2',  revenue: 5_800_000, profit: 1_820_000, adSpend: 950_000,   drr: 16.4, clicks: 3_760, impressions: 169_000, avgCheck: 740_000 },
  { date: 'May 3',  revenue: 5_100_000, profit: 1_580_000, adSpend: 860_000,   drr: 16.9, clicks: 3_310, impressions: 152_000, avgCheck: 720_000 },
  { date: 'May 4',  revenue: 6_400_000, profit: 2_060_000, adSpend: 1_080_000, drr: 16.9, clicks: 4_160, impressions: 188_000, avgCheck: 780_000 },
  { date: 'May 5',  revenue: 5_900_000, profit: 1_860_000, adSpend: 980_000,   drr: 16.6, clicks: 3_830, impressions: 174_000, avgCheck: 750_000 },
  { date: 'May 6',  revenue: 4_800_000, profit: 1_440_000, adSpend: 810_000,   drr: 16.9, clicks: 3_120, impressions: 142_000, avgCheck: 710_000 },
  { date: 'May 7',  revenue: 2_100_000, profit: 610_000,   adSpend: 360_000,   drr: 17.1, clicks: 1_360, impressions: 62_000,  avgCheck: 700_000 },
]

// ── Price Tracking mock data ──────────────────────────────────────────────────
export interface CompetitorPrice {
  id: string
  productId: string
  productTitle: string
  sku: string
  myPrice: number
  minCompetitorPrice: number
  avgCompetitorPrice: number
  maxCompetitorPrice: number
  competitorCount: number
  pricePosition: 'lowest' | 'competitive' | 'high' | 'highest'
  priceDiff: number          // my price - min competitor (positive = I'm more expensive)
  priceDiffPct: number       // priceDiff / myPrice * 100
  lastChecked: string
  history: { date: string; myPrice: number; minPrice: number }[]
}

export const competitorPrices: CompetitorPrice[] = [
  {
    id: 'cp-1', productId: '1', productTitle: 'Nike Air Max 270', sku: 'NK-AM270-42',
    myPrice: 890_000, minCompetitorPrice: 820_000, avgCompetitorPrice: 875_000, maxCompetitorPrice: 960_000,
    competitorCount: 7, pricePosition: 'high', priceDiff: 70_000, priceDiffPct: 7.9,
    lastChecked: '2026-05-07T14:00:00Z',
    history: [
      { date: 'Apr 22', myPrice: 890_000, minPrice: 850_000 },
      { date: 'Apr 25', myPrice: 890_000, minPrice: 840_000 },
      { date: 'Apr 28', myPrice: 890_000, minPrice: 830_000 },
      { date: 'May 1',  myPrice: 890_000, minPrice: 825_000 },
      { date: 'May 4',  myPrice: 890_000, minPrice: 820_000 },
      { date: 'May 7',  myPrice: 890_000, minPrice: 820_000 },
    ],
  },
  {
    id: 'cp-2', productId: '2', productTitle: 'Adidas Ultraboost 22', sku: 'AD-UB22-41',
    myPrice: 1_120_000, minCompetitorPrice: 1_090_000, avgCompetitorPrice: 1_140_000, maxCompetitorPrice: 1_250_000,
    competitorCount: 4, pricePosition: 'competitive', priceDiff: 30_000, priceDiffPct: 2.7,
    lastChecked: '2026-05-07T14:00:00Z',
    history: [
      { date: 'Apr 22', myPrice: 1_120_000, minPrice: 1_100_000 },
      { date: 'Apr 25', myPrice: 1_120_000, minPrice: 1_095_000 },
      { date: 'Apr 28', myPrice: 1_120_000, minPrice: 1_090_000 },
      { date: 'May 1',  myPrice: 1_120_000, minPrice: 1_090_000 },
      { date: 'May 4',  myPrice: 1_120_000, minPrice: 1_090_000 },
      { date: 'May 7',  myPrice: 1_120_000, minPrice: 1_090_000 },
    ],
  },
  {
    id: 'cp-3', productId: '3', productTitle: 'Samsung Galaxy A54', sku: 'SM-A54-128',
    myPrice: 3_200_000, minCompetitorPrice: 3_180_000, avgCompetitorPrice: 3_240_000, maxCompetitorPrice: 3_450_000,
    competitorCount: 12, pricePosition: 'competitive', priceDiff: 20_000, priceDiffPct: 0.6,
    lastChecked: '2026-05-07T14:00:00Z',
    history: [
      { date: 'Apr 22', myPrice: 3_200_000, minPrice: 3_150_000 },
      { date: 'Apr 25', myPrice: 3_200_000, minPrice: 3_160_000 },
      { date: 'Apr 28', myPrice: 3_200_000, minPrice: 3_170_000 },
      { date: 'May 1',  myPrice: 3_200_000, minPrice: 3_180_000 },
      { date: 'May 4',  myPrice: 3_200_000, minPrice: 3_180_000 },
      { date: 'May 7',  myPrice: 3_200_000, minPrice: 3_180_000 },
    ],
  },
  {
    id: 'cp-4', productId: '4', productTitle: 'Xiaomi Redmi Watch 3', sku: 'XM-RW3-BLK',
    myPrice: 680_000, minCompetitorPrice: 720_000, avgCompetitorPrice: 748_000, maxCompetitorPrice: 810_000,
    competitorCount: 9, pricePosition: 'lowest', priceDiff: -40_000, priceDiffPct: -5.9,
    lastChecked: '2026-05-07T14:00:00Z',
    history: [
      { date: 'Apr 22', myPrice: 700_000, minPrice: 730_000 },
      { date: 'Apr 25', myPrice: 700_000, minPrice: 728_000 },
      { date: 'Apr 28', myPrice: 690_000, minPrice: 725_000 },
      { date: 'May 1',  myPrice: 680_000, minPrice: 722_000 },
      { date: 'May 4',  myPrice: 680_000, minPrice: 720_000 },
      { date: 'May 7',  myPrice: 680_000, minPrice: 720_000 },
    ],
  },
  {
    id: 'cp-5', productId: '6', productTitle: 'Sony WH-1000XM5', sku: 'SN-WH5-BLK',
    myPrice: 3_600_000, minCompetitorPrice: 3_200_000, avgCompetitorPrice: 3_450_000, maxCompetitorPrice: 3_800_000,
    competitorCount: 5, pricePosition: 'highest', priceDiff: 400_000, priceDiffPct: 11.1,
    lastChecked: '2026-05-07T14:00:00Z',
    history: [
      { date: 'Apr 22', myPrice: 3_600_000, minPrice: 3_300_000 },
      { date: 'Apr 25', myPrice: 3_600_000, minPrice: 3_280_000 },
      { date: 'Apr 28', myPrice: 3_600_000, minPrice: 3_250_000 },
      { date: 'May 1',  myPrice: 3_600_000, minPrice: 3_220_000 },
      { date: 'May 4',  myPrice: 3_600_000, minPrice: 3_200_000 },
      { date: 'May 7',  myPrice: 3_600_000, minPrice: 3_200_000 },
    ],
  },
]
