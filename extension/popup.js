// Daromadchi Extension — Popup v2

const API = 'https://daromadchi.uz/api';

const LANG = {
  uz: {
    ulangan:'● Ulangan', ulanmagan:'Ulanmagan', tgBadge:'📱 TG ulangan',
    noStats:"Ma'lumot yuklanmadi. Internet yoki API tekshiring.",
    loginHint:'Avval Daromadchiga kiring',
    tgSection:'📱 Telegram Xabarnomalar', tgConnectedLabel:'Ulangan:', tgDisconnected:'Telegram ulanmagan',
    tgConnectBtn:'📱 Telegramni ulash (sayt orqali)', tgDisconnectBtn:"🔌 Telegram'ni uzish",
    tgHint:'Kam zaxira, reklama muammolari va muhim ogohlantirishlar telefonga keladi',
    tgHintConnected:"Quyidagi xabarnomalar Telegram botingizga yuboriladi",
    thresholds:'🎛️ Chegaralar', lowStock:'Kam zaxira ogohlantirish (dona)',
    salesDrop:'Savdo pasayishi ogohlantirish (%)', returnRate:'Qaytarish foizi ogohlantirish (%)',
    alertsSection:'🔔 Xabarnomalar sozlamalari', quietSection:'🌙 Jim rejim',
    quietStart:'Boshlanishi (soat)', quietEnd:'Tugashi (soat)',
    saveBtn:'💾 Saqlash', savedMsg:'✅ Saqlandi!',
    channelSection:'📢 Daromadchi kanali', channelSub:'Yangiliklar, tahlillar va maslahatlar', channelBtn:"Kanalga o'tish →",
    langSection:'🌐 Til', themeSection:'🎨 Mavzu', themeDark:'🌙 Qoʻngʻir', themeLight:'☀️ Yorqin',
    alertLabels:{
      low_stock_with_ad:'🚨 Reklama + Kam zaxira (kritik)', out_of_stock:'📦 Mahsulot tugadi',
      low_stock:'⚠️ Kam zaxira', sales_drop:'📉 Savdo pasaydi', ad_no_sales:'💸 Reklama bepusht',
      high_return_rate:'↩️ Yuqori qaytarish', competitor_price_cut:'🏷️ Raqib narx tushirdi',
      new_review:'⭐ Yangi sharh', daily_summary:'📊 Kunlik sotuv hisoboti (har kuni 20:00)',
    },
  },
  ru: {
    ulangan:'● Подключён', ulanmagan:'Не подключён', tgBadge:'📱 TG подключён',
    noStats:'Нет данных. Проверьте интернет или API.',
    loginHint:'Сначала войдите в Daromadchi',
    tgSection:'📱 Telegram Уведомления', tgConnectedLabel:'Подключён:', tgDisconnected:'Telegram не подключён',
    tgConnectBtn:'📱 Подключить Telegram (через сайт)', tgDisconnectBtn:'🔌 Отключить Telegram',
    tgHint:'Мало товара, проблемы с рекламой и важные оповещения придут в Telegram',
    tgHintConnected:'Следующие уведомления будут отправляться в ваш Telegram бот',
    thresholds:'🎛️ Пороги', lowStock:'Уведомление о малом запасе (шт.)',
    salesDrop:'Уведомление о падении продаж (%)', returnRate:'Уведомление о высоком возврате (%)',
    alertsSection:'🔔 Настройки уведомлений', quietSection:'🌙 Тихие часы',
    quietStart:'Начало (час)', quietEnd:'Конец (час)',
    saveBtn:'💾 Сохранить', savedMsg:'✅ Сохранено!',
    channelSection:'📢 Канал Daromadchi', channelSub:'Новости, аналитика и советы', channelBtn:'Перейти в канал →',
    langSection:'🌐 Язык', themeSection:'🎨 Тема', themeDark:'🌙 Тёмная', themeLight:'☀️ Светлая',
    alertLabels:{
      low_stock_with_ad:'🚨 Реклама + Мало товара (критично)', out_of_stock:'📦 Товар закончился',
      low_stock:'⚠️ Мало товара', sales_drop:'📉 Падение продаж', ad_no_sales:'💸 Реклама без продаж',
      high_return_rate:'↩️ Высокий возврат', competitor_price_cut:'🏷️ Конкурент снизил цену',
      new_review:'⭐ Новый отзыв', daily_summary:'📊 Ежедневный отчёт (каждый день в 20:00)',
    },
  },
  en: {
    ulangan:'● Connected', ulanmagan:'Not connected', tgBadge:'📱 TG connected',
    noStats:'No data. Check internet or API.',
    loginHint:'Sign in to Daromadchi first',
    tgSection:'📱 Telegram Notifications', tgConnectedLabel:'Connected:', tgDisconnected:'Telegram not linked',
    tgConnectBtn:'📱 Link Telegram (via website)', tgDisconnectBtn:'🔌 Unlink Telegram',
    tgHint:'Low stock, ad issues and important alerts will come to Telegram',
    tgHintConnected:'These notifications will be sent to your Telegram bot',
    thresholds:'🎛️ Thresholds', lowStock:'Low stock alert (units)',
    salesDrop:'Sales drop alert (%)', returnRate:'Return rate alert (%)',
    alertsSection:'🔔 Notification settings', quietSection:'🌙 Quiet hours',
    quietStart:'Start (hour)', quietEnd:'End (hour)',
    saveBtn:'💾 Save', savedMsg:'✅ Saved!',
    channelSection:'📢 Daromadchi channel', channelSub:'News, analytics and tips', channelBtn:'Open channel →',
    langSection:'🌐 Language', themeSection:'🎨 Theme', themeDark:'🌙 Dark', themeLight:'☀️ Light',
    alertLabels:{
      low_stock_with_ad:'🚨 Ad + Low stock (critical)', out_of_stock:'📦 Out of stock',
      low_stock:'⚠️ Low stock', sales_drop:'📉 Sales drop', ad_no_sales:'💸 Ad no sales',
      high_return_rate:'↩️ High return rate', competitor_price_cut:'🏷️ Competitor price cut',
      new_review:'⭐ New review', daily_summary:'📊 Daily sales report (every day at 20:00)',
    },
  },
};

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
async function renderStats(token, stats, lang = 'uz') {
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
    panel.innerHTML = `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">${(LANG[lang]||LANG.uz).noStats}</div>`;
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
      <div style="padding:20px 16px;text-align:center;border-bottom:1px solid #1e293b;margin-bottom:8px">
        <div style="font-size:28px;margin-bottom:10px">📱</div>
        <p style="font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:6px">Telegram ogohlantirishlari</p>
        <p style="font-size:11px;color:#94a3b8;line-height:1.5;margin-bottom:14px">
          Pro tarifida mavjud.<br>Kam zaxira, savdo pasayishi va boshqa<br>ogohlantirishlar Telegramga yuboriladi.
        </p>
        <a href="https://daromadchi.uz/pricing" target="_blank" class="btn-login" style="display:block;text-align:center">Pro ga o'tish →</a>
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
function renderMarketplaceStatus(panel, yandexStats, uzumDirectStats, yandexConnected, uzumConnected, yandexCampaignId, uzumShopName, wbStats, wbConnected, wbSellerInfo) {
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

  if (wbConnected || wbStats) {
    const s = wbStats;
    const wbName = wbSellerInfo?.supplierName || wbSellerInfo?.name || '';
    rows.push(`
      <div class="mkt-row">
        <span class="mkt-badge mkt-wb">WB</span>
        <span class="mkt-name">Wildberries</span>
        <span class="mkt-dot ${wbConnected ? 'mkt-on' : 'mkt-off'}">
          ${wbConnected ? `● Ulangan${wbName ? ` · ${wbName}` : ''}` : '○ Ulanmagan'}
        </span>
        ${s ? `<span class="mkt-rev">${fp(s.todayRevenue, true)} / ${s.todayOrders || 0} buyurtma</span>` : ''}
      </div>`);
  }

  if (!rows.length) {
    panel.insertAdjacentHTML('beforeend', `
      <div class="mkt-empty">
        <span>API ulanishlari sozlanmagan</span>
        <a href="options.html" target="_blank" class="mkt-cfg-link" style="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;padding:5px 16px;border-radius:7px;font-size:11px;font-weight:600;display:inline-block;text-align:center">Sozlash →</a>
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
async function renderSettings(token, settings, tgStatus, lang = 'uz') {
  const s = LANG[lang] || LANG.uz;
  const panel = document.getElementById('panel-settings');
  const tgConnected = tgStatus?.connected;
  const tgUsername = tgStatus?.username;
  const theme = document.body.classList.contains('theme-light') ? 'light' : 'dark';

  if (tgConnected) {
    document.getElementById('status-badge').className = 'badge badge-tg';
    document.getElementById('status-badge').textContent = s.tgBadge;
  }

  const pill = (active) => {
    if (active) return 'padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:#6366f1;color:#fff;border:none';
    return theme === 'light'
      ? 'padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;background:#e2e8f0;color:#475569;border:1px solid #cbd5e1'
      : 'padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;background:#1e293b;color:#94a3b8;border:1px solid #334155';
  };

  panel.innerHTML = `
    <div class="settings">

      <!-- LANG + THEME ROW -->
      <div class="s-section">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div class="s-section-title" style="margin-bottom:8px">${s.langSection}</div>
            <div style="display:flex;gap:5px">
              <button style="${pill(lang==='uz')}" data-setlang="uz">UZ</button>
              <button style="${pill(lang==='ru')}" data-setlang="ru">RU</button>
              <button style="${pill(lang==='en')}" data-setlang="en">EN</button>
            </div>
          </div>
          <div>
            <div class="s-section-title" style="margin-bottom:8px">${s.themeSection}</div>
            <div style="display:flex;gap:5px">
              <button style="${pill(theme==='dark')}" data-settheme="dark">${s.themeDark}</button>
              <button style="${pill(theme==='light')}" data-settheme="light">${s.themeLight}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- CHANNEL -->
      <div class="s-section">
        <div class="s-section-title">${s.channelSection}</div>
        <div class="tg-box" style="display:flex;align-items:center;gap:12px">
          <span style="font-size:22px;flex-shrink:0">📣</span>
          <div style="flex:1">
            <p style="font-size:12px;font-weight:600;color:${theme==='light'?'#1e293b':'#e2e8f0'};margin-bottom:3px">@daromadchi_uz</p>
            <p style="font-size:10.5px;color:#94a3b8;line-height:1.4;margin-bottom:8px">${s.channelSub}</p>
            <a href="https://t.me/daromadchi_uz" target="_blank"
              style="display:inline-block;background:#0ea5e9;color:#fff;padding:5px 14px;border-radius:7px;font-size:11px;font-weight:600;text-decoration:none">
              ${s.channelBtn}
            </a>
          </div>
        </div>
      </div>

      <!-- TELEGRAM -->
      <div class="s-section">
        <div class="s-section-title">${s.tgSection}</div>
        <div class="tg-box">
          <div class="tg-status">
            <span>${tgConnected ? '✅' : '⭕'}</span>
            <span class="tg-status-text">${tgConnected ? s.tgConnectedLabel : s.tgDisconnected}</span>
            ${tgConnected ? `<span class="tg-username">@${tgUsername}</span>` : ''}
          </div>
          ${!token ? `<p style="font-size:11px;color:#94a3b8;margin-bottom:8px">${s.loginHint}</p>` : ''}
          <button class="btn-tg ${tgConnected?'btn-tg-disc':''}" id="tg-btn">
            ${tgConnected ? s.tgDisconnectBtn : s.tgConnectBtn}
          </button>
          <p style="font-size:10px;color:#64748b;margin-top:8px;line-height:1.5">
            ${tgConnected ? s.tgHintConnected : s.tgHint}
          </p>
        </div>
      </div>

      <!-- THRESHOLDS -->
      <div class="s-section">
        <div class="s-section-title">${s.thresholds}</div>
        <div class="num-row"><span class="num-lbl">${s.lowStock}</span>
          <input class="num-in" id="s-lowstock" type="number" min="1" max="100" value="${settings.lowStockThreshold||5}"/></div>
        <div class="num-row"><span class="num-lbl">${s.salesDrop}</span>
          <input class="num-in" id="s-salesdrop" type="number" min="10" max="90" value="${settings.salesDropThreshold||40}"/></div>
        <div class="num-row"><span class="num-lbl">${s.returnRate}</span>
          <input class="num-in" id="s-returnrate" type="number" min="5" max="50" value="${settings.returnRateThreshold||15}"/></div>
      </div>

      <!-- ALERT TOGGLES -->
      <div class="s-section">
        <div class="s-section-title">${s.alertsSection}</div>
        ${Object.entries(s.alertLabels).filter(([id]) => id !== 'daily_summary').map(([id, label]) => `
          <div class="toggle-row">
            <span class="toggle-lbl">${label}</span>
            <label class="toggle">
              <input type="checkbox" data-alert-id="${id}" ${!(settings.disabledAlerts||[]).includes(id) ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        `).join('')}
        <div class="toggle-row">
          <span class="toggle-lbl">${s.alertLabels.daily_summary}</span>
          <label class="toggle">
            <input type="checkbox" id="s-daily" ${!settings.disableDailySummary ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- QUIET HOURS -->
      <div class="s-section">
        <div class="s-section-title">${s.quietSection}</div>
        <div class="num-row"><span class="num-lbl">${s.quietStart}</span>
          <input class="num-in" id="s-qstart" type="number" min="0" max="23" value="${settings.quietHoursStart??23}"/></div>
        <div class="num-row"><span class="num-lbl">${s.quietEnd}</span>
          <input class="num-in" id="s-qend" type="number" min="0" max="23" value="${settings.quietHoursEnd??7}"/></div>
      </div>

      <button class="save-btn" id="save-settings">${s.saveBtn}</button>
      <div class="saved-msg" id="saved-msg">${s.savedMsg}</div>

    </div>
  `;

  // Language buttons
  document.querySelectorAll('[data-setlang]').forEach(btn => {
    btn.onclick = async () => {
      await chrome.storage.local.set({ ext_lang: btn.dataset.setlang });
      loadAll();
    };
  });

  // Theme buttons
  document.querySelectorAll('[data-settheme]').forEach(btn => {
    btn.onclick = async () => {
      await chrome.storage.local.set({ ext_theme: btn.dataset.settheme });
      document.body.classList.toggle('theme-light', btn.dataset.settheme === 'light');
      loadAll();
    };
  });

  // Telegram connect/disconnect
  document.getElementById('tg-btn').onclick = async () => {
    if (tgConnected) {
      await fetch(`${API}/telegram-unlink`, { method: 'POST', credentials: 'include' }).catch(()=>{});
      chrome.storage.local.set({ tgStatus: { connected: false } });
      loadAll();
    } else {
      window.open('https://daromadchi.uz/dashboard/settings', '_blank');
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
    'daromadchi_token', 'daromadchi_connected', 'daromadchi_email', 'daromadchi_plan', 'cachedStats', 'cacheTime',
    'activeAlerts', 'alertSettings', 'tgStatus', 'ext_lang', 'ext_theme',
    'yandexStats', 'yandexStatsTime', 'yandexConnected', 'yandexCampaignId',
    'uzumDirectStats', 'uzumDirectStatsTime', 'uzumConnected', 'uzumShopName',
    'wbStats', 'wbStatsTime', 'wbConnected', 'wbSellerInfo'
  ]);

  const {
    daromadchi_token, daromadchi_connected, daromadchi_email, daromadchi_plan = 'free', cachedStats, cacheTime,
    activeAlerts = [], alertSettings = {}, tgStatus = {}, ext_lang = 'uz', ext_theme = 'dark',
    yandexStats, yandexConnected, yandexCampaignId,
    uzumDirectStats, uzumConnected, uzumShopName,
    wbStats, wbConnected, wbSellerInfo
  } = data;

  const lang = ['uz','ru','en'].includes(ext_lang) ? ext_lang : 'uz';
  document.body.classList.toggle('theme-light', ext_theme === 'light');

  // No token → full-screen login gate
  if (!daromadchi_connected && !daromadchi_token) {
    showLoginGate();
    return;
  }

  const plan = daromadchi_plan;
  const token = daromadchi_token || (daromadchi_connected ? 'connected' : null);

  // Render immediately from cache — popup shows content instantly
  renderStats(token, cachedStats, lang);
  renderAlerts(activeAlerts, plan);
  renderSettings(token, alertSettings, tgStatus, lang);
  const statsPanel = document.getElementById('panel-stats');
  if (statsPanel) renderMarketplaceStatus(statsPanel, yandexStats, uzumDirectStats, yandexConnected, uzumConnected, yandexCampaignId, uzumShopName, wbStats, wbConnected, wbSellerInfo);

  // Background refresh when cache is stale — does not block UI
  const stale = Date.now() - (cacheTime || 0) > 300000;
  if (stale && daromadchi_token) {
    (async () => {
      try {
        const res = await fetch(`${API}/extension/stats`, { headers: { 'Authorization': `Bearer ${daromadchi_token}` } });
        if (res.ok) {
          const fresh = await res.json();
          chrome.storage.local.set({ cachedStats: fresh, cacheTime: Date.now() });
          renderStats(token, fresh, lang);
          const sp = document.getElementById('panel-stats');
          if (sp) renderMarketplaceStatus(sp, yandexStats, uzumDirectStats, yandexConnected, uzumConnected, yandexCampaignId, uzumShopName, wbStats, wbConnected, wbSellerInfo);
        }
      } catch {}
      try {
        const res = await fetch(`${API}/extension/telegram-status`, { headers: { 'Authorization': `Bearer ${daromadchi_token}` } });
        if (res.ok) {
          const tg = await res.json();
          chrome.storage.local.set({ tgStatus: tg });
          if (tg.connected !== tgStatus.connected) renderSettings(token, alertSettings, tg, lang);
        }
      } catch {}
    })();
  }
}

// Simply load — login gate is handled inside loadAll() via showLoginGate()
loadAll()

// Re-run when the background stores a fresh token from the content script
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.daromadchi_token?.newValue || changes.daromadchi_connected?.newValue)) {
    loadAll()
  }
})
