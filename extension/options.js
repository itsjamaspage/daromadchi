async function loadSettings() {
  const { alertSettings = {} } = await chrome.storage.local.get('alertSettings');
  if (alertSettings.lowStockThreshold) document.getElementById('o-lowstock').value = alertSettings.lowStockThreshold;
  if (alertSettings.salesDropThreshold) document.getElementById('o-salesdrop').value = alertSettings.salesDropThreshold;
  if (alertSettings.returnRateThreshold) document.getElementById('o-returnrate').value = alertSettings.returnRateThreshold;
  if (alertSettings.quietHoursStart != null) document.getElementById('o-qstart').value = alertSettings.quietHoursStart;
  if (alertSettings.quietHoursEnd != null) document.getElementById('o-qend').value = alertSettings.quietHoursEnd;
  const disabled = alertSettings.disabledAlerts || [];
  document.querySelectorAll('[data-alert-id]').forEach(cb => {
    cb.checked = !disabled.includes(cb.dataset.alertId);
  });
}

document.getElementById('save-btn').onclick = async () => {
  const disabled = [];
  document.querySelectorAll('[data-alert-id]').forEach(cb => { if (!cb.checked) disabled.push(cb.dataset.alertId); });
  await chrome.storage.local.set({ alertSettings: {
    lowStockThreshold: +document.getElementById('o-lowstock').value || 5,
    salesDropThreshold: +document.getElementById('o-salesdrop').value || 40,
    returnRateThreshold: +document.getElementById('o-returnrate').value || 15,
    quietHoursStart: +document.getElementById('o-qstart').value,
    quietHoursEnd: +document.getElementById('o-qend').value,
    disabledAlerts: disabled
  }});

  const yKey   = document.getElementById('o-yandex-key').value.trim();
  const uToken = document.getElementById('o-uzum-token').value.trim();
  const wbTok  = document.getElementById('o-wb-token').value.trim();
  if (yKey && !yKey.startsWith('●'))    await chrome.storage.local.set({ yandexApiKey: yKey });
  if (uToken && !uToken.startsWith('●')) await chrome.storage.local.set({ uzumSellerToken: uToken });
  if (wbTok && !wbTok.startsWith('●'))  await chrome.storage.local.set({ wbToken: wbTok });

  const msg = document.getElementById('saved-msg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2000);
};

async function loadApiKeys() {
  const {
    yandexApiKey, yandexCampaignId, yandexConnected,
    uzumSellerToken, uzumConnected,
    wbToken, wbConnected, wbSellerInfo
  } = await chrome.storage.local.get([
    'yandexApiKey', 'yandexCampaignId', 'yandexConnected',
    'uzumSellerToken', 'uzumConnected',
    'wbToken', 'wbConnected', 'wbSellerInfo'
  ]);

  if (yandexApiKey) {
    document.getElementById('o-yandex-key').value = '●'.repeat(24);
    document.getElementById('yandex-status').innerHTML = yandexConnected
      ? `<span style="color:#22c55e">✅ Ulangan${yandexCampaignId ? ` · Kampaniya ID: ${yandexCampaignId}` : ''}</span>`
      : `<span style="color:#f59e0b">⚠️ Saqlangan, lekin tekshirilmagan</span>`;
  }
  if (uzumSellerToken) {
    document.getElementById('o-uzum-token').value = '●'.repeat(24);
    document.getElementById('uzum-status').innerHTML = uzumConnected
      ? `<span style="color:#22c55e">✅ Ulangan</span>`
      : `<span style="color:#f59e0b">⚠️ Saqlangan, lekin tekshirilmagan</span>`;
  }
  if (wbToken) {
    document.getElementById('o-wb-token').value = '●'.repeat(24);
    const wbName = wbSellerInfo?.supplierName || wbSellerInfo?.name || '';
    document.getElementById('wb-status').innerHTML = wbConnected
      ? `<span style="color:#22c55e">✅ Ulangan${wbName ? ` · ${wbName}` : ''}</span>`
      : `<span style="color:#f59e0b">⚠️ Saqlangan, lekin tekshirilmagan</span>`;
  }
}

document.getElementById('test-yandex').onclick = async () => {
  const key = document.getElementById('o-yandex-key').value.trim();
  if (!key || key.startsWith('●')) {
    document.getElementById('yandex-status').innerHTML = `<span style="color:#f59e0b">Yangi kalit kiriting</span>`;
    return;
  }
  const btn = document.getElementById('test-yandex');
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const res = await fetch('https://api.partner.market.yandex.ru/campaigns', {
      headers: { 'Api-Key': key, 'Content-Type': 'application/json' }
    });
    const data = res.ok ? await res.json() : null;
    if (data?.campaigns?.length > 0) {
      const campaign = data.campaigns[0];
      await chrome.storage.local.set({
        yandexApiKey: key, yandexCampaignId: campaign.id,
        yandexCampaigns: data.campaigns, yandexConnected: true
      });
      document.getElementById('yandex-status').innerHTML =
        `<span style="color:#22c55e">✅ Ulandi! Do'kon: ${campaign.domain || campaign.id}</span>`;
      document.getElementById('o-yandex-key').value = '●'.repeat(24);
    } else {
      document.getElementById('yandex-status').innerHTML =
        `<span style="color:#ef4444">❌ Noto'g'ri kalit yoki ruxsat yo'q (HTTP ${res.status})</span>`;
    }
  } catch {
    document.getElementById('yandex-status').innerHTML =
      `<span style="color:#ef4444">❌ Ulanish xatosi. CORS yoki tarmoqni tekshiring.</span>`;
  }
  btn.textContent = 'Tekshirish'; btn.disabled = false;
};

document.getElementById('clear-yandex').onclick = async () => {
  await chrome.storage.local.remove(['yandexApiKey', 'yandexCampaignId', 'yandexCampaigns', 'yandexConnected', 'yandexStats', 'yandexProducts']);
  document.getElementById('o-yandex-key').value = '';
  document.getElementById('yandex-status').innerHTML = `<span style="color:#64748b">O'chirildi</span>`;
};

document.getElementById('test-uzum').onclick = async () => {
  const token = document.getElementById('o-uzum-token').value.trim();
  if (!token || token.startsWith('●')) {
    document.getElementById('uzum-status').innerHTML = `<span style="color:#f59e0b">Yangi token kiriting</span>`;
    return;
  }
  const btn = document.getElementById('test-uzum');
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const res = await fetch('https://api-seller.uzum.uz/api/seller-openapi/v1/shops', {
      headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });
    const data = res.ok ? await res.json() : null;
    if (Array.isArray(data) && data.length > 0) {
      const shopId = data[0].id;
      const shopName = data[0].name;
      await chrome.storage.local.set({
        uzumSellerToken: token, uzumConnected: true,
        uzumShopId: shopId, uzumShopName: shopName, uzumShops: data
      });
      document.getElementById('uzum-status').innerHTML =
        `<span style="color:#22c55e">✅ Ulandi! Do'kon: ${shopName} (ID: ${shopId})</span>`;
      document.getElementById('o-uzum-token').value = '●'.repeat(24);
    } else {
      document.getElementById('uzum-status').innerHTML =
        `<span style="color:#ef4444">❌ Noto'g'ri token yoki do'kon topilmadi (HTTP ${res.status})</span>`;
    }
  } catch {
    document.getElementById('uzum-status').innerHTML = `<span style="color:#ef4444">❌ Ulanish xatosi</span>`;
  }
  btn.textContent = 'Tekshirish'; btn.disabled = false;
};

document.getElementById('clear-uzum').onclick = async () => {
  await chrome.storage.local.remove(['uzumSellerToken', 'uzumConnected', 'uzumDirectStats', 'uzumProducts']);
  document.getElementById('o-uzum-token').value = '';
  document.getElementById('uzum-status').innerHTML = `<span style="color:#64748b">O'chirildi</span>`;
};

document.getElementById('test-wb').onclick = async () => {
  const token = document.getElementById('o-wb-token').value.trim();
  if (!token || token.startsWith('●')) {
    document.getElementById('wb-status').innerHTML = `<span style="color:#f59e0b">Yangi token kiriting</span>`;
    return;
  }
  const btn = document.getElementById('test-wb');
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const res = await fetch('https://common-api.wildberries.ru/api/v1/seller-info', {
      headers: { 'Authorization': token }
    });
    if (res.ok) {
      const data = await res.json();
      const name = data?.supplierName || data?.name || data?.tradeMark || 'WB sotuvchi';
      await chrome.storage.local.set({ wbToken: token, wbConnected: true, wbSellerInfo: data });
      document.getElementById('wb-status').innerHTML =
        `<span style="color:#22c55e">✅ Ulandi! Sotuvchi: ${name}</span>`;
      document.getElementById('o-wb-token').value = '●'.repeat(24);
    } else if (res.status === 401) {
      document.getElementById('wb-status').innerHTML = `<span style="color:#ef4444">❌ Token yaroqsiz (401)</span>`;
    } else if (res.status === 403) {
      document.getElementById('wb-status').innerHTML =
        `<span style="color:#f59e0b">⚠️ IP-whitelist xatosi (403) — uy/ofis tarmoqingizdan urinib ko'ring</span>`;
    } else {
      document.getElementById('wb-status').innerHTML = `<span style="color:#ef4444">❌ Xato: HTTP ${res.status}</span>`;
    }
  } catch {
    document.getElementById('wb-status').innerHTML = `<span style="color:#ef4444">❌ Ulanish xatosi. Tarmoqni tekshiring.</span>`;
  }
  btn.textContent = 'Tekshirish'; btn.disabled = false;
};

document.getElementById('clear-wb').onclick = async () => {
  await chrome.storage.local.remove(['wbToken', 'wbConnected', 'wbStats', 'wbProducts', 'wbSellerInfo', 'wbStatsTime']);
  document.getElementById('o-wb-token').value = '';
  document.getElementById('wb-status').innerHTML = `<span style="color:#64748b">O'chirildi</span>`;
};

loadSettings();
loadApiKeys();
