// Daromadchi Extension — Background Service Worker v2
// Smart alert engine + Telegram notification bridge

const API = 'https://daromadchi.uz/api';

// ─── ALERT DEFINITIONS ───────────────────────────────────────────────────────
// Each alert has: id, priority (critical/warning/info), check function, message builder

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

// ─── FETCH HELPERS ─────────────────────────────────────────────────────────

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

// ─── MAIN SYNC + ALERT CHECK ──────────────────────────────────────────────

async function runSync() {
  const { authToken, alertSettings = {}, sentAlertIds = [] } = 
    await chrome.storage.local.get(['authToken', 'alertSettings', 'sentAlertIds']);

  if (!authToken) return;

  // Fetch latest data
  const [stats, products] = await Promise.all([
    apiFetch('/extension/stats', authToken),
    apiFetch('/extension/products', authToken)
  ]);

  if (stats) {
    chrome.storage.local.set({ cachedStats: stats, cacheTime: Date.now() });
  }

  if (!products) return;

  // Run alert rules against each product
  const newAlerts = [];
  const now = Date.now();

  for (const product of products) {
    for (const rule of ALERT_RULES) {
      if (!isAlertEnabled(rule.id, alertSettings)) continue;

      const alertKey = `${rule.id}:${product.id}`;
      const alreadySent = sentAlertIds.find(a => a.key === alertKey && now - a.ts < 3600000); // 1hr cooldown

      if (rule.check(product, alertSettings) && !alreadySent) {
        newAlerts.push({
          key: alertKey,
          priority: rule.priority,
          label: rule.label,
          message: rule.message(product),
          productId: product.id,
          ts: now
        });
      }
    }
  }

  if (newAlerts.length === 0) {
    updateBadge(0);
    return;
  }

  // Save alerts to storage for popup
  const existingAlerts = (await chrome.storage.local.get('activeAlerts')).activeAlerts || [];
  const merged = [...newAlerts, ...existingAlerts].slice(0, 50);
  
  const newSentIds = [
    ...sentAlertIds.filter(a => now - a.ts < 86400000), // keep 24h
    ...newAlerts.map(a => ({ key: a.key, ts: a.ts }))
  ];

  chrome.storage.local.set({ 
    activeAlerts: merged,
    sentAlertIds: newSentIds
  });

  // Browser notifications for critical alerts
  const criticalAlerts = newAlerts.filter(a => a.priority === 'critical');
  for (const alert of criticalAlerts.slice(0, 3)) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Daromadchi — ' + alert.label,
      message: alert.message,
      priority: 2
    });
  }

  // Send to Telegram via backend
  if (newAlerts.length > 0) {
    sendTelegramAlerts(newAlerts, authToken);
  }

  updateBadge(newAlerts.filter(a => a.priority === 'critical').length);
}

function isAlertEnabled(ruleId, settings) {
  if (settings.disabledAlerts && settings.disabledAlerts.includes(ruleId)) return false;
  
  // Quiet hours check
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

async function sendTelegramAlerts(alerts, token) {
  try {
    await fetch(`${API}/extension/send-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ alerts: alerts.map(a => ({ message: a.message, priority: a.priority })) })
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

// ─── DAILY SUMMARY ───────────────────────────────────────────────────────

async function sendDailySummary() {
  const { authToken, alertSettings = {} } = await chrome.storage.local.get(['authToken', 'alertSettings']);
  if (!authToken || alertSettings.disableDailySummary) return;

  const stats = await apiFetch('/extension/stats', authToken);
  if (!stats) return;

  await fetch(`${API}/extension/send-daily-summary`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats })
  }).catch(() => {});
}

// ─── ALARMS ──────────────────────────────────────────────────────────────

chrome.alarms.create('sync', { periodInMinutes: 15 });
chrome.alarms.create('dailySummary', { when: getNextSummaryTime(), periodInMinutes: 1440 });

function getNextSummaryTime() {
  const now = new Date();
  const next = new Date();
  next.setHours(20, 0, 0, 0); // 8 PM daily summary
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') runSync();
  if (alarm.name === 'dailySummary') sendDailySummary();
});

// ─── MESSAGES ────────────────────────────────────────────────────────────

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
