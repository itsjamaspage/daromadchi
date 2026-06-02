// Daromadchi Extension — Background Service Worker v2
// Smart alert engine + Telegram notification bridge + Marketplace API sync

const API             = 'https://daromadchi.uz/api';
const YANDEX_API      = 'https://api.partner.market.yandex.ru';
const UZUM_SELLER_API = 'https://api-seller.uzum.uz/api/seller-openapi';
const WB_COMMON_API   = 'https://common-api.wildberries.ru';
const WB_STATS_API    = 'https://statistics-api.wildberries.ru';

// ─── ALERT DEFINITIONS ───────────────────────────────────────────────────────

const ALERT_RULES = [
  {
    id: 'low_stock_with_ad',
    priority: 'critical',
    label: '🚨 Reklama + Kam zaxira',
    check: (p, settings) =>
      p.stock <= (settings.lowStockThreshold || 5) && p.hasActiveAd,
    message: (p) =>
      `🚨 KRITIK: "${p.name}" mahsulotida faqat ${p.stock} dona qoldi, lekin reklama ishlayapti! Reklama pulini behuda sarflayapsiz.`
  },
  {
    id: 'out_of_stock',
    priority: 'critical',
    label: '📦 Mahsulot tugadi',
    check: (p) => p.stock === 0,
    message: (p) =>
      `📦 TUGADI: "${p.name}" omborda qolmadi. Buyurtmalar bekor qilinishi mumkin.`
  },
  {
    id: 'low_stock',
    priority: 'warning',
    label: '⚠️ Kam zaxira',
    check: (p, settings) =>
      p.stock > 0 && p.stock <= (settings.lowStockThreshold || 5) && !p.hasActiveAd,
    message: (p) =>
      `⚠️ Kam zaxira: "${p.name}" — ${p.stock} dona qoldi. Tez buyurtma bering.`
  },
  {
    id: 'sales_drop',
    priority: 'warning',
    label: '📉 Savdo pasaydi',
    check: (p, settings) =>
      p.salesDropPct >= (settings.salesDropThreshold || 40),
    message: (p) =>
      `📉 Savdo pasaydi: "${p.name}" bugun ${p.salesDropPct}% kamroq sotilyapti.`
  },
  {
    id: 'ad_no_sales',
    priority: 'warning',
    label: '💸 Reklama bepusht',
    check: (p) => p.hasActiveAd && p.adSpendToday > 0 && p.salesToday === 0,
    message: (p) =>
      `💸 Reklama bepusht: "${p.name}" bugun ${formatPrice(p.adSpendToday)} sarflandi, lekin 0 sotuv.`
  },
  {
    id: 'high_return_rate',
    priority: 'warning',
    label: '↩️ Yuqori qaytarish',
    check: (p, settings) =>
      p.returnRate >= (settings.returnRateThreshold || 15),
    message: (p) =>
      `↩️ Yuqori qaytarish: "${p.name}" — ${p.returnRate}% qaytarilmoqda. Sabab tekshiring.`
  },
  {
    id: 'competitor_price_cut',
    priority: 'info',
    label: '🏷️ Raqib narx tushirdi',
    check: (p) => p.competitorPriceDrop > 0,
    message: (p) =>
      `🏷️ Raqib: "${p.name}" kategoriyasida narx ${p.competitorPriceDrop}% tushirildi.`
  },
  {
    id: 'new_review',
    priority: 'info',
    label: '⭐ Yangi sharh',
    check: (p, settings) =>
      settings.notifyNewReviews && p.newReviews > 0,
    message: (p) =>
      `⭐ Yangi sharh: "${p.name}" mahsulotiga ${p.newReviews} ta yangi sharh qoldirildi.`
  }
];

function formatPrice(n) {
  if (!n) return '0';
  return n.toLocaleString('uz-UZ') + ' so\'m';
}

// ─── DAROMADCHI BACKEND FETCH ────────────────────────────────────────────────

async function apiFetch(path, token) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── YANDEX MARKET PARTNER API ───────────────────────────────────────────────
// Auth: Api-Key header (recommended over OAuth — see yandex.ru/dev/market/partner-api)
// Base URL: https://api.partner.market.yandex.ru

async function yandexApiFetch(path, apiKey, method = 'GET', body = null) {
  try {
    const res = await fetch(`${YANDEX_API}${path}`, {
      method,
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      ...(body !== null ? { body: JSON.stringify(body) } : {})
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getOrCacheYandexCampaignId(apiKey) {
  const { yandexCampaignId } = await chrome.storage.local.get('yandexCampaignId');
  if (yandexCampaignId) return yandexCampaignId;

  // Auto-discover: GET /campaigns returns all shops for this API key
  const data = await yandexApiFetch('/campaigns', apiKey);
  if (data?.campaigns?.length) {
    const id = data.campaigns[0].id;
    chrome.storage.local.set({
      yandexCampaignId: id,
      yandexCampaigns: data.campaigns
    });
    return id;
  }
  return null;
}

async function syncYandexMarket() {
  const { yandexApiKey } = await chrome.storage.local.get('yandexApiKey');
  if (!yandexApiKey) return;

  const campaignId = await getOrCacheYandexCampaignId(yandexApiKey);
  if (!campaignId) {
    chrome.storage.local.set({ yandexConnected: false });
    return;
  }

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Fetch order stats and current offers in parallel
  // Order stats endpoint: POST /campaigns/{campaignId}/stats/orders
  // Offers endpoint:      POST /campaigns/{campaignId}/offers
  const [orderData, offerData] = await Promise.all([
    yandexApiFetch(
      `/campaigns/${campaignId}/stats/orders`,
      yandexApiKey, 'POST',
      { dateFrom: yesterday, dateTo: today, limit: 200 }
    ),
    yandexApiFetch(
      `/campaigns/${campaignId}/offers`,
      yandexApiKey, 'POST',
      { limit: 200 }
    )
  ]);

  // Aggregate today's orders only (API may return yesterday + today)
  const orders = (orderData?.result?.orders || []).filter(o =>
    (o.creationDate || '').startsWith(today)
  );

  let todayRevenue = 0, todayCommissions = 0, todayReturns = 0;
  for (const order of orders) {
    for (const item of (order.items || [])) {
      todayRevenue     += item.prices?.buyerTotal || 0;
      todayCommissions += (item.commissions || []).reduce((s, c) => s + (c.actual || 0), 0);
    }
    if (['CANCELLED_IN_DELIVERY', 'RETURNED', 'PARTIALLY_RETURNED'].includes(order.status)) {
      todayReturns++;
    }
  }

  // Map offers to alert-rule product shape for stock alerts
  const offers = offerData?.offers || offerData?.offerMappings || [];
  const yandexProducts = offers.map(o => ({
    id:          `yandex-${o.offer?.offerId || o.mapping?.marketSku || o.id}`,
    name:        o.offer?.name || 'Yandex mahsuloti',
    // CHECK: stock field path — verify against current API response if alerts stop firing
    stock:       o.stocks?.[0]?.count ?? o.stockInfo?.count ?? 0,
    hasActiveAd: false,  // requires separate boost API call
    adSpendToday: 0,
    salesToday:  0,
    salesDropPct: 0,
    returnRate:  0,
    source:      'yandex'
  }));
  const lowStock = yandexProducts.filter(p => p.stock > 0 && p.stock <= 5).length;

  const stats = {
    todayRevenue,
    todayProfit:  todayRevenue - todayCommissions,
    todayOrders:  orders.length,
    todayReturns,
    marginPct:    todayRevenue > 0
      ? Math.round(((todayRevenue - todayCommissions) / todayRevenue) * 100)
      : 0,
    lowStock,
    adSpendToday: 0,
    lastSynced:   new Date().toLocaleTimeString('uz-UZ'),
    source:       'yandex'
  };

  chrome.storage.local.set({
    yandexStats:     stats,
    yandexStatsTime: Date.now(),
    yandexConnected: true,
    yandexProducts
  });

  // Run stock-based alert rules against Yandex products
  runMarketplaceAlerts(yandexProducts, 'yandex');
}

// ─── UZUM SELLER API ─────────────────────────────────────────────────────────
// Auth: Authorization: {token}  — NO "Bearer " prefix per Uzum spec
// Base URL: https://api-seller.uzum.uz/api/seller-openapi
//
// Confirmed endpoints & response shapes (from Swagger UI):
//
//   GET  /v1/shops
//     → [ { id: number, name: string } ]
//
//   GET  /v1/finance/orders?shopIds={id}&dateFrom={ms}&dateTo={ms}&size=200
//     → { orderItems: [ {} ], totalElements: number }
//     dateFrom/dateTo are Unix millisecond timestamps; shopIds is REQUIRED
//
//   GET  /v2/fbs/sku/stocks
//     → { payload: { skuAmountList: [ { skuId, skuTitle, productTitle,
//          barcode, amount, fbsAllowed, dbsAllowed, fbsLinked,
//          dbsLinked, sellerSkuCode } ] }, errors: [...] }
//     Stock quantity field: amount

async function uzumSellerFetch(path, token, method = 'GET', body = null) {
  try {
    const res = await fetch(`${UZUM_SELLER_API}${path}`, {
      method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(body !== null ? { body: JSON.stringify(body) } : {})
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getOrCacheUzumShopId(token) {
  const { uzumShopId } = await chrome.storage.local.get('uzumShopId');
  if (uzumShopId) return uzumShopId;

  // GET /v1/shops → plain array [{ id, name }]
  const data = await uzumSellerFetch('/v1/shops', token);
  if (Array.isArray(data) && data.length > 0) {
    const id   = data[0].id;
    const name = data[0].name;
    chrome.storage.local.set({ uzumShopId: id, uzumShopName: name, uzumShops: data });
    return id;
  }
  return null;
}

async function syncUzumSeller() {
  const { uzumSellerToken } = await chrome.storage.local.get('uzumSellerToken');
  if (!uzumSellerToken) return;

  const shopId = await getOrCacheUzumShopId(uzumSellerToken);
  if (!shopId) {
    chrome.storage.local.set({ uzumConnected: false });
    return;
  }

  // dateFrom/dateTo must be Unix timestamps in milliseconds
  const now          = Date.now();
  const todayStartMs = now - (now % 86400000); // start of UTC day
  const todayEndMs   = todayStartMs + 86400000;

  // GET /v1/finance/orders — shopIds is required; fetch today's orders only
  // GET /v2/fbs/sku/stocks — no params needed; returns all SKU stock levels
  const ordersPath = `/v1/finance/orders?shopIds=${shopId}&dateFrom=${todayStartMs}&dateTo=${todayEndMs}&size=200`;

  const [ordersData, stocksData] = await Promise.all([
    uzumSellerFetch(ordersPath, uzumSellerToken),
    uzumSellerFetch('/v2/fbs/sku/stocks', uzumSellerToken)
  ]);

  if (!ordersData && !stocksData) {
    chrome.storage.local.set({ uzumConnected: false });
    return;
  }

  // Orders: { orderItems: [...], totalElements: number }
  const orderItems = ordersData?.orderItems ?? [];
  // sellerPrice is the confirmed revenue field from the Uzum OpenAPI spec
  const todayRevenue = orderItems.reduce((s, o) => s + (o.sellerPrice ?? 0), 0);

  // Stocks: { payload: { skuAmountList: [{ skuId, productTitle, skuTitle, amount }] } }
  const skuList = stocksData?.payload?.skuAmountList ?? [];

  const uzumProducts = skuList.map(sku => ({
    id:           `uzum-${sku.skuId}`,
    name:         sku.productTitle || sku.skuTitle || 'Uzum mahsuloti',
    stock:        sku.amount,          // confirmed field name from swagger
    hasActiveAd:  false,
    adSpendToday: 0,
    salesToday:   0,
    salesDropPct: 0,
    returnRate:   0,
    source:       'uzum-direct'
  }));
  const lowStock = uzumProducts.filter(p => p.stock > 0 && p.stock <= 5).length;

  const stats = {
    todayRevenue,
    todayOrders:  orderItems.length,
    todayReturns: 0,
    lowStock,
    lastSynced:   new Date().toLocaleTimeString('uz-UZ'),
    source:       'uzum-direct'
  };

  chrome.storage.local.set({
    uzumDirectStats:     stats,
    uzumDirectStatsTime: now,
    uzumConnected:       true,
    uzumShopId:          shopId,
    uzumProducts
  });

  runMarketplaceAlerts(uzumProducts, 'uzum');
}

// ─── WILDBERRIES API ─────────────────────────────────────────────────────────
// Auth: Authorization: {token}  — NO "Bearer " prefix per WB spec
// Tokens are IP-whitelisted by WB; test from seller's own machine.
//
// Endpoints used:
//   GET  /api/v1/seller-info          (common-api) — seller identity
//   GET  /api/v1/supplier/orders      (statistics-api) — order list, dateFrom param
//   GET  /api/v1/supplier/stocks      (statistics-api) — warehouse stock
//   GET  /api/v1/supplier/sales       (statistics-api) — completed sales

async function wbApiFetch(base, path, token) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: {
        'Authorization': token,
        'Content-Type':  'application/json',
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function syncWildberries() {
  const { wbToken } = await chrome.storage.local.get('wbToken');
  if (!wbToken) return;

  // WB stats API requires ISO datetime string for dateFrom
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateFrom = today.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS

  const [sellerInfo, orders, stocks] = await Promise.all([
    wbApiFetch(WB_COMMON_API, '/api/v1/seller-info', wbToken),
    wbApiFetch(WB_STATS_API,  `/api/v1/supplier/orders?dateFrom=${dateFrom}`, wbToken),
    wbApiFetch(WB_STATS_API,  `/api/v1/supplier/stocks?dateFrom=${dateFrom}`, wbToken),
  ]);

  if (!orders && !stocks && !sellerInfo) {
    chrome.storage.local.set({ wbConnected: false });
    return;
  }

  // Orders today — WB returns array; each order has totalPrice in kopecks → convert to rubles
  // isCancel=false excludes cancellations; date field is ISO string
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = (orders || []).filter(o =>
    !o.isCancel && (o.date || '').startsWith(todayStr)
  );
  // totalPrice is in RUB (not kopecks) per WB OpenAPI spec
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const todayReturns = (orders || []).filter(o => o.isCancel && (o.date || '').startsWith(todayStr)).length;

  // Map stocks to alert-rule product shape
  // WB stocks: nmId, subject, supplierArticle, quantity (warehouse qty), quantityFull
  const wbProducts = (stocks || []).map(s => ({
    id:           `wb-${s.nmId}-${s.barcode || ''}`,
    name:         s.subject || s.supplierArticle || 'WB mahsuloti',
    stock:        s.quantity ?? 0,
    hasActiveAd:  false,
    adSpendToday: 0,
    salesToday:   0,
    salesDropPct: 0,
    returnRate:   0,
    source:       'wb'
  }));

  const lowStock = wbProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = wbProducts.filter(p => p.stock === 0).length;

  const stats = {
    todayRevenue,
    todayOrders:  todayOrders.length,
    todayReturns,
    lowStock,
    outOfStock,
    totalSkus:    wbProducts.length,
    sellerName:   sellerInfo?.supplierName || sellerInfo?.name || '',
    tradeMark:    sellerInfo?.tradeMark || '',
    lastSynced:   new Date().toLocaleTimeString('uz-UZ'),
    source:       'wb'
  };

  chrome.storage.local.set({
    wbStats:     stats,
    wbStatsTime: Date.now(),
    wbConnected: true,
    wbProducts,
    wbSellerInfo: sellerInfo,
  });

  runMarketplaceAlerts(wbProducts, 'wb');
}

// ─── SHARED ALERT RUNNER (used by both marketplace syncs) ────────────────────

async function runMarketplaceAlerts(products, source) {
  const { alertSettings = {}, sentAlertIds = [] } =
    await chrome.storage.local.get(['alertSettings', 'sentAlertIds']);

  const newAlerts = [];
  const now = Date.now();

  for (const product of products) {
    for (const rule of ALERT_RULES) {
      if (!['low_stock_with_ad', 'out_of_stock', 'low_stock'].includes(rule.id)) continue;
      if (!isAlertEnabled(rule.id, alertSettings)) continue;

      const alertKey   = `${source}:${rule.id}:${product.id}`;
      const alreadySent = sentAlertIds.find(a => a.key === alertKey && now - a.ts < 3600000);

      if (rule.check(product, alertSettings) && !alreadySent) {
        newAlerts.push({
          key:       alertKey,
          priority:  rule.priority,
          label:     rule.label,
          message:   rule.message(product),
          productId: product.id,
          ts:        now,
          source
        });
      }
    }
  }

  if (!newAlerts.length) return;

  const existing = (await chrome.storage.local.get('activeAlerts')).activeAlerts || [];
  const newSentIds = [
    ...sentAlertIds.filter(a => now - a.ts < 86400000),
    ...newAlerts.map(a => ({ key: a.key, ts: a.ts }))
  ];
  chrome.storage.local.set({
    activeAlerts: [...newAlerts, ...existing].slice(0, 50),
    sentAlertIds: newSentIds
  });

  const criticals = newAlerts.filter(a => a.priority === 'critical');
  for (const alert of criticals.slice(0, 3)) {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Daromadchi — ' + alert.label,
      message: alert.message, priority: 2
    });
  }

  updateBadge(criticals.length);
  if (newAlerts.length) sendTelegramAlerts(newAlerts, null, source);
}

// ─── MAIN SYNC + ALERT CHECK ──────────────────────────────────────────────────

async function runSync() {
  // Fire marketplace syncs independently — they store results in storage
  // and don't need a Daromadchi account to function
  syncYandexMarket();
  syncUzumSeller();
  syncWildberries();

  const { daromadchi_token, alertSettings = {}, sentAlertIds = [] } =
    await chrome.storage.local.get(['daromadchi_token', 'alertSettings', 'sentAlertIds']);

  if (!daromadchi_token) return;

  const [stats, products] = await Promise.all([
    apiFetch('/extension/stats', daromadchi_token),
    apiFetch('/extension/products', daromadchi_token)
  ]);

  if (stats) {
    chrome.storage.local.set({ cachedStats: stats, cacheTime: Date.now() });
  }

  if (!products) return;

  const newAlerts = [];
  const now = Date.now();

  for (const product of products) {
    for (const rule of ALERT_RULES) {
      if (!isAlertEnabled(rule.id, alertSettings)) continue;

      const alertKey    = `${rule.id}:${product.id}`;
      const alreadySent = sentAlertIds.find(a => a.key === alertKey && now - a.ts < 3600000);

      if (rule.check(product, alertSettings) && !alreadySent) {
        newAlerts.push({
          key:       alertKey,
          priority:  rule.priority,
          label:     rule.label,
          message:   rule.message(product),
          productId: product.id,
          ts:        now,
          source:    'daromadchi'
        });
      }
    }
  }

  if (newAlerts.length === 0) {
    updateBadge(0);
    return;
  }

  const existingAlerts = (await chrome.storage.local.get('activeAlerts')).activeAlerts || [];
  const merged = [...newAlerts, ...existingAlerts].slice(0, 50);

  const newSentIds = [
    ...sentAlertIds.filter(a => now - a.ts < 86400000),
    ...newAlerts.map(a => ({ key: a.key, ts: a.ts }))
  ];

  chrome.storage.local.set({
    activeAlerts: merged,
    sentAlertIds: newSentIds
  });

  const criticalAlerts = newAlerts.filter(a => a.priority === 'critical');
  for (const alert of criticalAlerts.slice(0, 3)) {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Daromadchi — ' + alert.label,
      message: alert.message, priority: 2
    });
  }

  if (newAlerts.length > 0) {
    sendTelegramAlerts(newAlerts, daromadchi_token, 'daromadchi');
  }

  updateBadge(newAlerts.filter(a => a.priority === 'critical').length);
}

function isAlertEnabled(ruleId, settings) {
  if (settings.disabledAlerts && settings.disabledAlerts.includes(ruleId)) return false;

  if (settings.quietHoursStart !== undefined && settings.quietHoursEnd !== undefined) {
    const hour = new Date().getHours();
    const { quietHoursStart, quietHoursEnd } = settings;
    if (quietHoursStart <= quietHoursEnd) {
      if (hour >= quietHoursStart && hour < quietHoursEnd) return false;
    } else {
      if (hour >= quietHoursStart || hour < quietHoursEnd) return false;
    }
  }
  return true;
}

async function sendTelegramAlerts(alerts, token, source) {
  const { daromadchi_token: storedToken, lastMarketplace } =
    await chrome.storage.local.get(['daromadchi_token', 'lastMarketplace']);
  const bearerToken = token || storedToken;
  if (!bearerToken) return;

  try {
    await fetch(`${API}/extension/send-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        alerts: alerts.map(a => ({ message: a.message, priority: a.priority })),
        marketplace: source || lastMarketplace || 'uzum'
      })
    });
  } catch {
    // fail silently
  }
}

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── DAILY SUMMARY ────────────────────────────────────────────────────────────

async function sendDailySummary() {
  const { daromadchi_token, alertSettings = {} } =
    await chrome.storage.local.get(['daromadchi_token', 'alertSettings']);
  if (!daromadchi_token || alertSettings.disableDailySummary) return;

  const stats = await apiFetch('/extension/stats', daromadchi_token);
  if (!stats) return;

  await fetch(`${API}/extension/send-daily-summary`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${daromadchi_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats })
  }).catch(() => {});
}

// ─── ALARMS ───────────────────────────────────────────────────────────────────

chrome.alarms.create('sync', { periodInMinutes: 15 });
chrome.alarms.create('dailySummary', { when: getNextSummaryTime(), periodInMinutes: 1440 });

function getNextSummaryTime() {
  const now = new Date();
  const next = new Date();
  next.setHours(20, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') runSync();
  if (alarm.name === 'dailySummary') sendDailySummary();
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action === 'sync') runSync().then(() => reply({ ok: true }));
  if (msg.action === 'clearAlerts') {
    chrome.storage.local.set({ activeAlerts: [] });
    updateBadge(0);
  }
  if (msg.action === 'connectTelegram') {
    fetch(`${API}/extension/telegram-link`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${msg.token}`, 'Content-Type': 'application/json' }
    }).then(r => r.json()).then(d => reply(d)).catch(() => reply({ error: true }));
    return true;
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  runSync();
});
