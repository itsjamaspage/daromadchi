// Daromadchi Extension — Popup v2

const API = 'https://daromadchi.uz/api';

function fp(n, short = false) {
  if (!n && n !== 0) return '—';
  if (short) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + ' mln';
    if (n >= 1000) return (n/1000).toFixed(0) + ' ming';
  }
  return n.toLocaleString('uz-UZ') + ' so\'m';
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'Hozirgina';
  if (s < 3600) return `${Math.round(s/60)} daq oldin`;
  if (s < 86400) return `${Math.round(s/3600)} soat oldin`;
  return `${Math.round(s/86400)} kun oldin`;
}

function change(pct) {
  if (!pct) return '';
  return `<span class="${pct>=0?'up':'dn'}">${pct>=0?'+':''}${pct}%</span>`;
}

// ─── TABS ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ─── STATS PANEL ─────────────────────────────────────────────────────────────
async function renderStats(token, stats) {
  const panel = document.getElementById('panel-stats');

  if (!token) {
    document.getElementById('status-badge').className = 'badge badge-off';
    document.getElementById('status-badge').textContent = 'Ulanmagan';
    panel.innerHTML = `
      <div class="login-box">
        <p>Statistikangizni ko'rish uchun Daromadchi hisobingizga kiring</p>
        <a href="https://daromadchi.uz/login" target="_blank" class="btn-login">Kirish →</a>
      </div>
      <div class="links">
        <a href="https://daromadchi.uz/unit-economics" target="_blank" class="lnk">📊 Unit-ekonomika</a>
        <a href="https://daromadchi.uz/dashboard" target="_blank" class="lnk">📈 Dashboard</a>
      </div>`;
    return;
  }

  document.getElementById('status-badge').className = 'badge badge-ok';
  document.getElementById('status-badge').textContent = '● Ulangan';

  if (!stats) {
    panel.innerHTML = `<div style="padding:20px;text-align:center;color:#64748b;font-size:12px">Ma'lumot yuklanmadi. Internet yoki API tekshiring.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-lbl">Bugungi daromad</div>
        <div class="stat-val">${fp(stats.todayRevenue, true)}</div>
        <div class="stat-sub">${change(stats.revenueChange)} kechagiga</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Sof foyda</div>
        <div class="stat-val up">${fp(stats.todayProfit, true)}</div>
        <div class="stat-sub">Marja: ${stats.marginPct||'—'}%</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Buyurtmalar</div>
        <div class="stat-val">${stats.todayOrders||0}</div>
        <div class="stat-sub">${change(stats.ordersChange)} kechagiga</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Reklama sarfi</div>
        <div class="stat-val">${fp(stats.adSpendToday, true)}</div>
        <div class="stat-sub">DRR: ${stats.drr||'—'}%</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Kam zaxira</div>
        <div class="stat-val ${stats.lowStock>0?'dn':''}">${stats.lowStock||0}</div>
        <div class="stat-sub">mahsulot</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Qaytarishlar</div>
        <div class="stat-val">${stats.todayReturns||0}</div>
        <div class="stat-sub">${stats.returnRate||'—'}% tizim</div>
      </div>
    </div>

    <div class="links">
      <a href="https://daromadchi.uz/dashboard" target="_blank" class="lnk">📈 Dashboard</a>
      <a href="https://daromadchi.uz/orders" target="_blank" class="lnk">📦 Buyurtmalar</a>
      <a href="https://daromadchi.uz/products" target="_blank" class="lnk">🛍️ Mahsulotlar</a>
      <a href="https://daromadchi.uz/analytics/ads" target="_blank" class="lnk">📢 Reklama</a>
      <a href="https://daromadchi.uz/unit-economics" target="_blank" class="lnk">📊 Unit-eko</a>
      <a href="https://daromadchi.uz/analytics/stock" target="_blank" class="lnk">🏭 Zaxira</a>
      <a href="https://daromadchi.uz/analytics" target="_blank" class="lnk lnk-full">📉 To'liq tahlilni ochish →</a>
    </div>

    <div class="sync-row">
      <span class="sync-lbl">Yangilangan: ${stats.lastSynced||'—'}</span>
      <button class="sync-btn" id="sync-now">🔄 Yangilash</button>
    </div>
  `;

  document.getElementById('sync-now').onclick = async () => {
    document.getElementById('sync-now').textContent = '⏳ ...';
    chrome.runtime.sendMessage({ action: 'sync' });
    setTimeout(() => loadAll(), 2500);
  };
}

// ─── ALERTS PANEL ─────────────────────────────────────────────────────────────
function renderAlerts(alerts, plan) {
  const panel = document.getElementById('panel-alerts');

  // Free plan: show Telegram upgrade CTA, then local alerts below
  if (plan === 'free') {
    panel.innerHTML = `
      <div style="padding:20px 16px;text-align:center;border-bottom:1px solid #e2e8f0;margin-bottom:8px">
        <div style="font-size:28px;margin-bottom:10px">📱</div>
        <p style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:6px">Telegram ogohlantirishlari</p>
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin-bottom:14px">
          Pro tarifida mavjud.<br>Kam zaxira, savdo pasayishi va boshqa<br>ogohlantirishlar Telegramga yuboriladi.
        </p>
        <a href="https://daromadchi.uz/pricing" target="_blank" class="btn-login">Pro ga o'tish →</a>
      </div>
    `;

    if (alerts.length > 0) {
      const priorityOrder = { critical: 0, warning: 1, info: 2 };
      const sorted = [...alerts].sort((a,b) => (priorityOrder[a.priority]??2) - (priorityOrder[b.priority]??2));
      panel.insertAdjacentHTML('beforeend', `
        <div class="alert-list" style="padding:0 4px 8px">
          ${sorted.map(a => `
            <div class="alert-item alert-${a.priority}">
              <span class="alert-icon">${a.priority==='critical'?'🚨':a.priority==='warning'?'⚠️':'ℹ️'}</span>
              <div class="alert-text">
                <div class="alert-msg">${a.message}</div>
                <div class="alert-time">${timeAgo(a.ts)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `);
    } else {
      panel.insertAdjacentHTML('beforeend', `
        <div class="no-alerts" style="padding:12px">🎉 Hozircha ogohlantirish yo'q.</div>
      `);
    }
    return;
  }

  const count = alerts.filter(a => a.priority === 'critical').length;

  const alertCountEl = document.getElementById('alert-count-tab');
  alertCountEl.textContent = alerts.length > 0 ? ` (${alerts.length})` : '';

  if (alerts.length === 0) {
    panel.innerHTML = `<div class="no-alerts">🎉 Hamma yaxshi!<br>Hech qanday ogohlantirish yo'q.</div>`;
    return;
  }

  const priorityOrder = { critical: 0, warning: 1, info: 2 };
  const sorted = [...alerts].sort((a,b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  panel.innerHTML = `
    <div class="alerts-header">
      <span class="alerts-title">${sorted.length} ta xabar${count > 0 ? ` · ${count} kritik` : ''}</span>
      <button class="alerts-clear" id="clear-alerts">Hammasini o'chirish</button>
    </div>
    <div class="alert-list">
      ${sorted.map(a => `
        <div class="alert-item alert-${a.priority}">
          <span class="alert-icon">${a.priority==='critical'?'🚨':a.priority==='warning'?'⚠️':'ℹ️'}</span>
          <div class="alert-text">
            <div class="alert-msg">${a.message}</div>
            <div class="alert-time">${timeAgo(a.ts)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('clear-alerts').onclick = () => {
    chrome.runtime.sendMessage({ action: 'clearAlerts' });
    renderAlerts([], plan);
  };
}

// ─── MARKETPLACE API STATUS PANEL ────────────────────────────────────────────
function renderMarketplaceStatus(panel, yandexStats, uzumDirectStats, yandexConnected, uzumConnected, yandexCampaignId, uzumShopName) {
  const rows = [];

  if (yandexConnected || yandexStats) {
    const s = yandexStats;
    rows.push(`
      <div class="mkt-row">
        <span class="mkt-badge mkt-ym">YM</span>
        <span class="mkt-name">Yandex Market</span>
        <span class="mkt-dot ${yandexConnected ? 'mkt-on' : 'mkt-off'}">
          ${yandexConnected ? `● Ulangan${yandexCampaignId ? ` · ${yandexCampaignId}` : ''}` : '○ Ulanmagan'}
        </span>
        ${s ? `<span class="mkt-rev">${fp(s.todayRevenue, true)} / ${s.todayOrders || 0} buyurtma</span>` : ''}
      </div>`);
  }

  if (uzumConnected || uzumDirectStats) {
    const s = uzumDirectStats;
    rows.push(`
      <div class="mkt-row">
        <span class="mkt-badge mkt-uz">UZ</span>
        <span class="mkt-name">Uzum (to'g'ridan)</span>
        <span class="mkt-dot ${uzumConnected ? 'mkt-on' : 'mkt-off'}">
          ${uzumConnected ? `● Ulangan${uzumShopName ? ` · ${uzumShopName}` : ''}` : '○ Ulanmagan'}
        </span>
        ${s ? `<span class="mkt-rev">${fp(s.todayRevenue, true)} / ${s.todayOrders || 0} buyurtma</span>` : ''}
      </div>`);
  }

  if (!rows.length) {
    panel.insertAdjacentHTML('beforeend', `
      <div class="mkt-empty">
        <span>API ulanishlari sozlanmagan.</span>
        <a href="options.html" target="_blank" class="mkt-cfg-link">Sozlash →</a>
      </div>`);
  } else {
    panel.insertAdjacentHTML('beforeend', `
      <div class="mkt-section">
        <div class="mkt-title">Marketplace API</div>
        ${rows.join('')}
        <a href="options.html" target="_blank" class="mkt-cfg-link">API kalitlarini boshqarish →</a>
      </div>`);
  }
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
async function renderSettings(token, settings, tgStatus) {
  const panel = document.getElementById('panel-settings');
  const tgConnected = tgStatus?.connected;
  const tgUsername = tgStatus?.username;

  // Update header badge for Telegram
  if (tgConnected) {
    document.getElementById('status-badge').className = 'badge badge-tg';
    document.getElementById('status-badge').textContent = '📱 TG ulangan';
  }

  panel.innerHTML = `
    <div class="settings">

      <!-- TELEGRAM -->
      <div class="s-section">
        <div class="s-section-title">📱 Telegram Xabarnomalar</div>
        <div class="tg-box">
          <div class="tg-status">
            <span>${tgConnected ? '✅' : '⭕'}</span>
            <span class="tg-status-text">${tgConnected ? `Ulangan: ` : 'Telegram ulanmagan'}</span>
            ${tgConnected ? `<span class="tg-username">@${tgUsername}</span>` : ''}
          </div>
          ${!token ? `<p style="font-size:11px;color:#64748b;margin-bottom:8px">Avval Daromadchiga kiring</p>` : ''}
          <button class="btn-tg ${tgConnected?'btn-tg-disc':''}" id="tg-btn">
            ${tgConnected ? '🔌 Telegram\'ni uzish' : '📱 Telegram\'ga ulash'}
          </button>
          ${tgConnected ? `<p style="font-size:10px;color:#475569;margin-top:8px;line-height:1.5">
            Quyidagi xabarnomalar Telegram botingizga yuboriladi
          </p>` : `<p style="font-size:10px;color:#475569;margin-top:8px;line-height:1.5">
            Kam zaxira, reklama muammolari va muhim ogohlantirishlar telefonga keladi
          </p>`}
        </div>
      </div>

      <!-- THRESHOLDS -->
      <div class="s-section">
        <div class="s-section-title">🎛️ Chegaralar</div>
        <div class="num-row"><span class="num-lbl">Kam zaxira ogohlantirish (dona)</span>
          <input class="num-in" id="s-lowstock" type="number" min="1" max="100" value="${settings.lowStockThreshold||5}"/></div>
        <div class="num-row"><span class="num-lbl">Savdo pasayishi ogohlantirish (%)</span>
          <input class="num-in" id="s-salesdrop" type="number" min="10" max="90" value="${settings.salesDropThreshold||40}"/></div>
        <div class="num-row"><span class="num-lbl">Qaytarish foizi ogohlantirish (%)</span>
          <input class="num-in" id="s-returnrate" type="number" min="5" max="50" value="${settings.returnRateThreshold||15}"/></div>
      </div>

      <!-- ALERT TOGGLES -->
      <div class="s-section">
        <div class="s-section-title">🔔 Xabarnomalar sozlamalari</div>
        ${[
          ['low_stock_with_ad', '🚨 Reklama + Kam zaxira (kritik)'],
          ['out_of_stock', '📦 Mahsulot tugadi'],
          ['low_stock', '⚠️ Kam zaxira'],
          ['sales_drop', '📉 Savdo pasaydi'],
          ['ad_no_sales', '💸 Reklama bepusht'],
          ['high_return_rate', '↩️ Yuqori qaytarish'],
          ['competitor_price_cut', '🏷️ Raqib narx tushirdi'],
          ['new_review', '⭐ Yangi sharh']
        ].map(([id, label]) => `
          <div class="toggle-row">
            <span class="toggle-lbl">${label}</span>
            <label class="toggle">
              <input type="checkbox" data-alert-id="${id}" ${!(settings.disabledAlerts||[]).includes(id) ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        `).join('')}
        <div class="toggle-row">
          <span class="toggle-lbl">📊 Kunlik sotuv hisoboti (har kuni 20:00)</span>
          <label class="toggle">
            <input type="checkbox" id="s-daily" ${!settings.disableDailySummary ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- QUIET HOURS -->
      <div class="s-section">
        <div class="s-section-title">🌙 Jim rejim</div>
        <div class="num-row"><span class="num-lbl">Boshlanishi (soat)</span>
          <input class="num-in" id="s-qstart" type="number" min="0" max="23" value="${settings.quietHoursStart??23}"/></div>
        <div class="num-row"><span class="num-lbl">Tugashi (soat)</span>
          <input class="num-in" id="s-qend" type="number" min="0" max="23" value="${settings.quietHoursEnd??7}"/></div>
      </div>

      <button class="save-btn" id="save-settings">💾 Saqlash</button>
      <div class="saved-msg" id="saved-msg">✅ Saqlandi!</div>
    </div>
  `;

  // Telegram connect/disconnect
  document.getElementById('tg-btn').onclick = async () => {
    if (!token) { window.open('https://daromadchi.uz/login', '_blank'); return; }
    if (tgConnected) {
      await fetch(`${API}/extension/telegram-unlink`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      }).catch(()=>{});
      chrome.storage.local.set({ tgStatus: { connected: false } });
      loadAll();
    } else {
      const btn = document.getElementById('tg-btn');
      btn.textContent = '⏳ Havola yaratilmoqda...';
      btn.disabled = true;
      try {
        const res = await fetch(`${API}/extension/telegram-link`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
          btn.textContent = '✅ Telegram\'ni oching';
        } else {
          btn.textContent = '❌ Xato. Qayta urinib ko\'ring';
        }
      } catch {
        btn.textContent = '❌ Xato yuz berdi';
      }
      btn.disabled = false;
    }
  };

  // Save settings
  document.getElementById('save-settings').onclick = async () => {
    const disabledAlerts = [];
    document.querySelectorAll('[data-alert-id]').forEach(cb => {
      if (!cb.checked) disabledAlerts.push(cb.dataset.alertId);
    });

    const newSettings = {
      lowStockThreshold: parseInt(document.getElementById('s-lowstock').value) || 5,
      salesDropThreshold: parseInt(document.getElementById('s-salesdrop').value) || 40,
      returnRateThreshold: parseInt(document.getElementById('s-returnrate').value) || 15,
      quietHoursStart: parseInt(document.getElementById('s-qstart').value) ?? 23,
      quietHoursEnd: parseInt(document.getElementById('s-qend').value) ?? 7,
      disableDailySummary: !document.getElementById('s-daily').checked,
      disabledAlerts
    };

    await chrome.storage.local.set({ alertSettings: newSettings });
    
    const msg = document.getElementById('saved-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);
  };
}

// ─── LOGIN GATE ───────────────────────────────────────────────────────────────
function showLoginGate() {
  document.querySelector('.tabs').style.display = 'none';
  document.querySelectorAll('.panel').forEach(p => { p.style.display = 'none'; });
  document.getElementById('status-badge').className = 'badge badge-off';
  document.getElementById('status-badge').textContent = 'Ulanmagan';

  const gate = document.createElement('div');
  gate.style.cssText = 'padding:28px 18px;text-align:center';
  gate.innerHTML = `
    <div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:20px">📊</div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-bottom:16px">
      Statistika, ogohlantirishlar va Telegram xabarnomalar uchun tizimga kiring
    </p>
    <a href="https://daromadchi.uz/login" target="_blank" class="btn-login">
      Daromadchiga kirish →
    </a>
    <p style="font-size:10px;color:#475569;margin-top:12px;line-height:1.4">
      Kirganingizdan so'ng <a href="options.html" target="_blank" style="color:#6366f1">Sozlamalar</a>dan tokenni qo'shing
    </p>
  `;
  document.querySelector('body').appendChild(gate);
}

// ─── LOAD ALL ─────────────────────────────────────────────────────────────────
async function loadAll() {
  const data = await chrome.storage.local.get([
    'daromadchi_token', 'daromadchi_plan', 'cachedStats', 'cacheTime',
    'activeAlerts', 'alertSettings', 'tgStatus',
    'yandexStats', 'yandexStatsTime', 'yandexConnected', 'yandexCampaignId',
    'uzumDirectStats', 'uzumDirectStatsTime', 'uzumConnected', 'uzumShopName'
  ]);

  const {
    daromadchi_token, daromadchi_plan = 'free', cachedStats, cacheTime,
    activeAlerts = [], alertSettings = {}, tgStatus = {},
    yandexStats, yandexConnected, yandexCampaignId,
    uzumDirectStats, uzumConnected, uzumShopName
  } = data;

  // No token → full-screen login gate
  if (!daromadchi_token) {
    showLoginGate();
    return;
  }

  // Validate token — only block on explicit 401; pass through on network errors
  let plan = daromadchi_plan;
  try {
    const vRes = await fetch(`${API}/extension/validate`, {
      headers: { 'Authorization': `Bearer ${daromadchi_token}` }
    });
    if (vRes.status === 401) {
      chrome.storage.local.remove('daromadchi_token');
      showLoginGate();
      return;
    }
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.plan) {
        plan = vData.plan;
        chrome.storage.local.set({ daromadchi_plan: vData.plan });
      }
    }
  } catch { /* offline — proceed */ }

  // Use Daromadchi backend stats if connected, refreshing when stale
  let stats = cachedStats;
  const stale = Date.now() - (cacheTime || 0) > 300000;

  if (stale) {
    try {
      const res = await fetch(`${API}/extension/stats`, {
        headers: { 'Authorization': `Bearer ${daromadchi_token}` }
      });
      if (res.ok) {
        stats = await res.json();
        chrome.storage.local.set({ cachedStats: stats, cacheTime: Date.now() });
      }
    } catch {}

    try {
      const res = await fetch(`${API}/extension/telegram-status`, {
        headers: { 'Authorization': `Bearer ${daromadchi_token}` }
      });
      if (res.ok) {
        const tg = await res.json();
        chrome.storage.local.set({ tgStatus: tg });
        tgStatus.connected = tg.connected;
        tgStatus.username  = tg.username;
      }
    } catch {}
  }

  renderStats(daromadchi_token, stats);
  renderAlerts(activeAlerts, plan);
  renderSettings(daromadchi_token, alertSettings, tgStatus);

  // Inject marketplace API status at the bottom of the stats panel
  const statsPanel = document.getElementById('panel-stats');
  if (statsPanel) {
    renderMarketplaceStatus(statsPanel, yandexStats, uzumDirectStats, yandexConnected, uzumConnected, yandexCampaignId, uzumShopName);
  }
}

loadAll();
