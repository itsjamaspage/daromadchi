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
