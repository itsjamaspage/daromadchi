// Daromadchi — Wildberries overlay
// Seller portal: stats widget. Buyer product pages: unit economics calculator.

(function () {
  'use strict';

  if (document.getElementById('drm-wb-widget') || document.getElementById('drm-wb-ue')) return;

  const IS_SELLER  = location.hostname.includes('seller.wildberries');
  const IS_PRODUCT = !IS_SELLER && /\/catalog\/\d+\/detail/.test(location.pathname);

  if (!IS_SELLER && !IS_PRODUCT) return;

  // ── PRODUCT PAGE: unit economics widget (same style as Uzum) ────────────────
  if (IS_PRODUCT) {
    function fpUZ(n) {
      if (!n && n !== 0) return '—';
      return n.toLocaleString('ru-RU') + ' ₽';
    }
    function parseWbPrice() {
      const sel = document.querySelector('.price-block__final-price, [class*="price-block__final"], ins.price__lower-price');
      if (sel) { const raw = sel.innerText.replace(/[^\d]/g,''); if (raw.length >= 3) return parseInt(raw); }
      const els = document.querySelectorAll('[class*="price"], [class*="Price"]');
      for (const el of els) {
        if (/old|cross|origin|before/i.test(el.className)) continue;
        const raw = el.innerText.replace(/[^\d]/g,'');
        if (raw.length >= 3 && raw.length <= 10) return parseInt(raw);
      }
      return null;
    }
    function parseWbTitle() {
      return (document.querySelector('h1') || {}).innerText?.trim().slice(0, 65) || 'Mahsulot';
    }
    function calcWb(price, opts = {}) {
      const { commPct = 15, adPct = 5, taxPct = 6, costPrice = 0 } = opts;
      const comm     = Math.round(price * commPct / 100);
      const delivery = Math.round(price * 0.06);
      const returns  = Math.round(price * 0.03);
      const acquiring= Math.round(price * 0.015);
      const adSpend  = Math.round(price * adPct / 100);
      const preTax   = price - comm - delivery - returns - acquiring - adSpend - costPrice;
      const tax      = Math.round(Math.max(0, preTax) * taxPct / 100);
      const profit   = preTax - tax;
      const pct      = Math.round((profit / price) * 100);
      const roi      = costPrice > 0 ? Math.round((profit / costPrice) * 100) : null;
      const total    = comm + delivery + returns + acquiring + adSpend + tax + costPrice;
      return { commPct, comm, delivery, returns, acquiring, adSpend, tax, costPrice, total, profit, pct, roi };
    }
    function mc(pct) { return pct >= 25 ? '#22c55e' : pct >= 12 ? '#f59e0b' : '#ef4444'; }

    async function buildWbUEWidget() {
      const price = parseWbPrice();
      const title = parseWbTitle();
      const settings = await chrome.storage.local.get(['ueSettings']).then(d => d.ueSettings || {});
      const { adPct = 5, taxPct = 6, costPrice = 0 } = settings;
      const eco = price ? calcWb(price, { adPct, taxPct, costPrice }) : null;
      const color = eco ? mc(eco.pct) : '#64748b';

      const wrap = document.createElement('div');
      wrap.id = 'drm-wb-ue';
      wrap.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:999999;width:268px;
        background:#0d0d19;border:1px solid rgba(168,85,247,0.35);border-radius:14px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;
        color:#e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow:hidden`;

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #1e293b">
          <img src="${chrome.runtime.getURL('icons/icon16.png')}" style="width:16px;height:16px;border-radius:4px"/>
          <span style="font-weight:700;font-size:13px;background:linear-gradient(135deg,#c084fc,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Daromadchi</span>
          <span style="margin-left:auto;font-size:10px;color:#a855f7">WB</span>
          <button id="drm-wb-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:0 0 0 4px">×</button>
        </div>
        ${!price ? `<div style="padding:16px;text-align:center;color:#64748b">Narx aniqlanmadi</div>` : `
        <div style="padding:10px 12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#64748b">Sotuv narxi</span><span style="font-weight:700">${fpUZ(price)}</span>
          </div>
          <div style="font-size:10px;color:#64748b;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1e293b">Xarajatlar taqsimoti</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">WB komissiyasi (${eco.commPct}%)</span><span style="color:#f87171">−${fpUZ(eco.comm)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">Yetkazib berish (~6%)</span><span style="color:#f87171">−${fpUZ(eco.delivery)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">Qaytarishlar (~3%)</span><span style="color:#f87171">−${fpUZ(eco.returns)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">Ekvayring (1.5%)</span><span style="color:#f87171">−${fpUZ(eco.acquiring)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">Reklama (${adPct}%)</span><span style="color:#f87171">−${fpUZ(eco.adSpend)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:#94a3b8">Soliq (${taxPct}%)</span><span style="color:#f87171">−${fpUZ(eco.tax)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid #1e293b;padding-top:6px;margin-top:4px">
            <span>Jami xarajat</span><span style="color:#f87171">−${fpUZ(eco.total)}</span>
          </div>
          <div style="background:${color}0d;border:1px solid ${color}30;border-radius:8px;padding:10px;text-align:center;margin-top:10px">
            <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Taxminiy sof foyda</div>
            <div style="font-size:18px;font-weight:800;color:${color}">${fpUZ(eco.profit)}</div>
            <div style="background:#1e293b;border-radius:4px;height:4px;margin:6px 0">
              <div style="height:4px;border-radius:4px;background:${color};width:${Math.max(0,Math.min(100,eco.pct))}%"></div>
            </div>
            <div style="font-size:11px;color:${color};font-weight:700">${eco.pct}% marja${eco.roi !== null ? ` · ROI ${eco.roi}%` : ''}</div>
          </div>
        </div>
        <div style="padding:0 12px 12px">
          <a href="https://daromadchi.uz/dashboard/unit-economics?source=wb&title=${encodeURIComponent(title)}&price=${price}&commPct=${eco.commPct}" target="_blank"
            style="display:block;text-align:center;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:6px;color:#c084fc;text-decoration:none;font-size:11px;font-weight:600">
            📊 Unit-ekonomikaga qo'shish →
          </a>
        </div>`}
      `;

      wrap.querySelector('#drm-wb-close').onclick = () => wrap.remove();
      document.body.appendChild(wrap);
    }

    buildWbUEWidget();

    // SPA nav
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => {
          document.getElementById('drm-wb-ue')?.remove();
          if (/\/catalog\/\d+\/detail/.test(location.pathname)) buildWbUEWidget();
        }, 1500);
      }
    }).observe(document, { subtree: true, childList: true });

    return; // don't run seller code on product pages
  }

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

  // Wait for page load, then show (only if activated)
  chrome.storage.local.get('tg_activated', ({ tg_activated }) => {
    if (!tg_activated) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 1500);
    }
  });

  // Listen for storage updates (e.g., after background sync completes)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.wbStats && document.getElementById('drm-wb-widget')) {
      const existing = document.getElementById('drm-wb-widget');
      if (existing) existing.remove();
      init();
    }
  });
})();
