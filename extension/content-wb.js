// Daromadchi — Wildberries seller page overlay
// Shows a compact stats widget on seller.wildberries.ru pages
// Token is read from chrome.storage.local — never hardcoded

(function () {
  'use strict';

  if (document.getElementById('drm-wb-widget')) return;

  function fp(n) {
    if (!n && n !== 0) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' mln ₽';
    if (n >= 1000) return (n / 1000).toFixed(0) + ' ming ₽';
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  function createWidget(stats, sellerInfo) {
    const w = document.createElement('div');
    w.id = 'drm-wb-widget';
    w.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #0d0d19;
      border: 1px solid rgba(168,85,247,0.35);
      border-radius: 14px;
      padding: 14px 16px;
      min-width: 220px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(168,85,247,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #e2e8f0;
      cursor: default;
      transition: opacity .2s;
    `;

    const name = sellerInfo?.supplierName || sellerInfo?.name || 'WB';

    w.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <img src="${chrome.runtime.getURL('icons/icon16.png')}" style="width:16px;height:16px;border-radius:4px"/>
        <span style="font-weight:700;font-size:13px;background:linear-gradient(135deg,#c084fc,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          Daromadchi
        </span>
        <span style="margin-left:auto;font-size:10px;color:#a855f7">WB</span>
        <button id="drm-wb-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 4px">×</button>
      </div>
      ${stats ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:#1e293b;border-radius:8px;padding:8px">
            <div style="color:#64748b;font-size:10px;margin-bottom:2px">Bugungi daromad</div>
            <div style="font-weight:700;color:#c084fc">${fp(stats.todayRevenue)}</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px">
            <div style="color:#64748b;font-size:10px;margin-bottom:2px">Buyurtmalar</div>
            <div style="font-weight:700;color:#38bdf8">${stats.todayOrders || 0}</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px">
            <div style="color:#64748b;font-size:10px;margin-bottom:2px">Kam zaxira</div>
            <div style="font-weight:700;color:${stats.lowStock > 0 ? '#f87171' : '#4ade80'}">${stats.lowStock || 0}</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px">
            <div style="color:#64748b;font-size:10px;margin-bottom:2px">Bekor</div>
            <div style="font-weight:700;color:#94a3b8">${stats.todayReturns || 0}</div>
          </div>
        </div>
        <div style="color:#334155;font-size:10px;margin-top:8px;text-align:right">
          ${stats.lastSynced ? `Yangilangan: ${stats.lastSynced}` : ''}
        </div>
      ` : `
        <div style="color:#64748b;font-size:11px;text-align:center;padding:8px 0">
          Ma'lumot yuklanmoqda...
        </div>
      `}
      <a href="https://daromadchi.uz/dashboard" target="_blank"
        style="display:block;margin-top:10px;text-align:center;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:6px;color:#c084fc;text-decoration:none;font-size:11px;font-weight:600">
        To'liq dashboard →
      </a>
    `;

    document.body.appendChild(w);

    document.getElementById('drm-wb-close').onclick = (e) => {
      e.stopPropagation();
      w.style.opacity = '0';
      setTimeout(() => w.remove(), 200);
      // Remember closed state for this session
      try { sessionStorage.setItem('drm-wb-closed', '1'); } catch {}
    };
  }

  async function init() {
    try {
      if (sessionStorage.getItem('drm-wb-closed')) return;
    } catch {}

    const data = await chrome.storage.local.get(['wbStats', 'wbConnected', 'wbSellerInfo']);
    if (!data.wbConnected && !data.wbStats) return;

    createWidget(data.wbStats || null, data.wbSellerInfo || null);
  }

  // Wait for page load, then show
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }

  // Listen for storage updates (e.g., after background sync completes)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.wbStats && document.getElementById('drm-wb-widget')) {
      const existing = document.getElementById('drm-wb-widget');
      if (existing) existing.remove();
      init();
    }
  });
})();
