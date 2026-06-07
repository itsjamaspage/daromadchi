// Daromadchi — Yandex Market content script (Yoolip style v2)
(function () {
  'use strict';

  const hostname = window.location.hostname;
  const IS_UZ     = hostname === 'market.yandex.uz';
  const IS_BUYER  = IS_UZ || hostname === 'market.yandex.ru';
  const IS_PARTNER = hostname === 'partner.market.yandex.ru';

  if (!IS_BUYER && !IS_PARTNER) return;
  if (document.getElementById('drm-ym-ue')) return;

  (function injectCSS() {
    if (document.getElementById('drm-ym-style')) return;
    const s = document.createElement('style');
    s.id = 'drm-ym-style';
    s.textContent = `
      #drm-ym-ue {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        display: block !important;
        width: 360px !important;
        max-height: 92vh !important;
        overflow-y: auto !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 60px rgba(0,0,0,.5) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        background: #0f1117 !important;
        border: 1px solid #2a3040 !important;
        color: #e2e8f0 !important;
      }
      #drm-ym-ue * { box-sizing: border-box !important; font-family: inherit !important; }
      #drm-ym-ue input, #drm-ym-ue button, #drm-ym-ue a { all: revert; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; cursor: pointer; }
      #drm-ym-ue input { cursor: text; }
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  const THEME = { bg:'#0f1117', card:'#1a1f2e', border:'#2a3040', text:'#e2e8f0', muted:'#94a3b8', red:'#f87171', green:'#4ade80', amber:'#f59e0b' };

  function fp(n) {
    if (n===null||n===undefined) return '—';
    if (IS_UZ) return Math.round(n).toLocaleString('uz-UZ') + " so'm";
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function T() { return THEME; }

  function parseYmPrice() {
    const selectors = [
      '[data-auto="price"]',
      '[data-auto="snippet-price-current"]',
      '[data-zone-name="price"]',
      '[class*="YpcPrice"]',
      '[class*="ypcPrice"]',
      '[class*="priceView"]',
      '[class*="PriceView"]',
      '[class*="priceBlock"]',
      '[class*="PriceBlock"]',
      '[class*="price-value"]',
      '[class*="priceValue"]',
      'span[class*="price"]:not([class*="old"]):not([class*="Old"]):not([class*="cross"])',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const raw = el.innerText.replace(/[^\d]/g, '');
          if (raw.length >= 2 && raw.length <= 12) return parseInt(raw);
        }
      } catch (_) {}
    }
    // Fallback: scan spans for currency symbol
    const currency = IS_UZ ? /сум|so'm/i : /₽|руб/i;
    const allEls = document.querySelectorAll('span, div, p, strong, b');
    for (const el of allEls) {
      if (el.children.length > 3) continue;
      const text = el.innerText || '';
      if (currency.test(text)) {
        const raw = text.replace(/[^\d]/g, '');
        if (raw.length >= 2 && raw.length <= 12) {
          const cls = (el.className || '').toLowerCase();
          if (cls.includes('old')||cls.includes('cross')||cls.includes('strike')||cls.includes('prev')) continue;
          return parseInt(raw);
        }
      }
    }
    return null;
  }

  function parseYmTitle() {
    const sels = ['[data-auto="offerTitle"]', 'h1', '[class*="title"]', '[class*="Title"]'];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 2) return el.innerText.trim().slice(0, 80);
    }
    return null;
  }

  function calcYm(price, { costPrice=0, packaging=0, adPct=5, volume=1, fby=true }={}) {
    const commPct    = 15;
    const commission = Math.round(price * commPct / 100);
    const delivery   = fby ? Math.round(volume * 15000) : Math.round(volume * 10000);
    const returns    = Math.round(price * 0.02);
    const acquiring  = Math.round(price * 0.005);
    const adSpend    = Math.round(price * adPct / 100);
    const tax        = Math.round(price * 0.06);
    const mktTotal   = commission + delivery + returns + acquiring;
    const jamiTotal  = mktTotal + adSpend + tax + packaging + costPrice;
    const netProfit  = price - jamiTotal;
    const margin     = Math.round((netProfit / price) * 100);
    const roi        = costPrice > 0 ? Math.round((netProfit / costPrice) * 100) : null;
    return { commPct, commission, delivery, returns, acquiring, adSpend, tax, packaging, costPrice, mktTotal, jamiTotal, netProfit, margin, roi };
  }

  function pColor(m) { const t=T(); return m>=25?t.green:m>=10?t.amber:t.red; }

  function inp(id, val, ph='0', step='1') {
    const t=T();
    return `<input id="${id}" type="number" step="${step}" value="${val||''}" placeholder="${ph}" style="width:88px;background:${t.card};border:1px solid ${t.border};border-radius:6px;padding:5px 8px;color:${t.text};font-size:12px;text-align:right;outline:none;display:block">`;
  }

  function row(label, id, val, extra='') {
    const t=T();
    return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:1px 0"><span style="color:${t.muted}">${label}${extra}</span><span id="drm-ym-v-${id}" style="color:${t.red}">${val}</span></div>`;
  }

  function buildYmWidget() {
    const price = parseYmPrice();
    const title = parseYmTitle();
    if (!price) return; // no price = not a product page, exit silently

    let fby=true, costPrice=0, packaging=0, adPct=5, volume=1;

    const wrap = document.createElement('div');
    wrap.id = 'drm-ym-ue';
    document.body.appendChild(wrap);

    chrome.storage.local.get(['ueSettings'], data => {
      if (data.ueSettings) {
        costPrice = data.ueSettings.costPrice || 0;
        packaging = data.ueSettings.packaging || 0;
        adPct     = data.ueSettings.adPct     || 5;
        volume    = data.ueSettings.volume     || 1;
        fby       = data.ueSettings.fby !== undefined ? data.ueSettings.fby : true;
      }
      render();
    });

    function gi() {
      return {
        costPrice: parseFloat(wrap.querySelector('#drm-ym-cost')?.value) || 0,
        packaging: parseFloat(wrap.querySelector('#drm-ym-pack')?.value) || 0,
        adPct:     parseFloat(wrap.querySelector('#drm-ym-ad')?.value)   || 5,
        volume:    parseFloat(wrap.querySelector('#drm-ym-vol')?.value)  || 1,
      };
    }

    function liveRecalc() {
      if (!price) return;
      const eco = calcYm(price, { ...gi(), fby });
      const c = pColor(eco.margin);
      const S = (id, v) => { const e=wrap.querySelector('#drm-ym-v-'+id); if(e) e.textContent=v; };
      const C = (id, col) => { const e=wrap.querySelector('#drm-ym-v-'+id); if(e) e.style.color=col; };
      S('comm',    `−${fp(eco.commission)}`);
      S('delivery',`−${fp(eco.delivery)}`);
      S('returns', `−${fp(eco.returns)}`);
      S('acq',     `−${fp(eco.acquiring)}`);
      S('ad',      `−${fp(eco.adSpend)}`);
      S('tax',     `−${fp(eco.tax)}`);
      S('mkt',     `−${fp(eco.mktTotal)}`);
      S('total',   `−${fp(eco.jamiTotal)}`);
      S('profit',  fp(eco.netProfit));
      S('margin',  `${eco.margin}% marja`);
      C('profit',c); C('margin',c);
      const bar=wrap.querySelector('#drm-ym-bar');
      if(bar){bar.style.width=Math.max(0,Math.min(100,eco.margin))+'%';bar.style.background=c;}
    }

    function render() {
      const t = T();
      const eco = calcYm(price, { costPrice, packaging, adPct, volume, fby });
      const color = pColor(eco.margin);
      const barW  = Math.max(0, Math.min(100, eco.margin));

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid ${t.border};position:sticky;top:0;background:${t.bg};z-index:1">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-weight:700;font-size:14px;color:${t.text}">Daromadchi</span>
            <span style="font-size:10px;font-weight:600;padding:2px 7px;background:#f59e0b;color:#000;border-radius:20px;display:inline-block">YM</span>
          </div>
          <div style="display:flex;align-items:center;gap:3px">
            <button id="drm-ym-refresh" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">↻</button>
            <button id="drm-ym-close" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">✕</button>
          </div>
        </div>

        <div style="padding:13px 14px;display:flex;flex-direction:column;gap:11px">
          <div>
            <div style="font-weight:600;font-size:13px;color:${t.text};margin-bottom:4px">${title || 'Mahsulot'}</div>
            <div style="font-size:22px;font-weight:800;color:#fbbf24;display:block">${fp(price)}</div>
          </div>

          <div style="display:flex;gap:6px">
            <button id="drm-ym-fby" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${fby?'#f59e0b':t.border};background:${fby?'#f59e0b':'transparent'};color:${fby?'#000':t.muted};font-size:12px;font-weight:600">FBY</button>
            <button id="drm-ym-fbs" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${!fby?'#f59e0b':t.border};background:${!fby?'#f59e0b':'transparent'};color:${!fby?'#000':t.muted};font-size:12px;font-weight:600">FBS</button>
          </div>

          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">HISOB PARAMETRLARI</div>
            <div style="display:flex;flex-direction:column;gap:7px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">Tannarx (${IS_UZ?"so'm":'₽'})</span>${inp('drm-ym-cost',costPrice)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">Qadoqlash (${IS_UZ?"so'm":'₽'})</span>${inp('drm-ym-pack',packaging)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">Reklama %</span>${inp('drm-ym-ad',adPct,'5','0.5')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">Hajm (litr)</span>${inp('drm-ym-vol',volume,'1','0.1')}</div>
            </div>
          </div>

          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">XARAJATLAR TAQSIMOTI</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:${t.muted}">Narx</span><span style="color:${t.text};font-weight:600">${fp(price)}</span></div>
              ${row('Komissiya (15%)', 'comm', `−${fp(eco.commission)}`)}
              ${row(`Yetkazib berish (${fby?'FBY':'FBS'})`, 'delivery', `−${fp(eco.delivery)}`, ` <span style="color:${t.amber};font-size:10px">taxminiy</span>`)}
              ${row('Qaytarishlar (~2%)', 'returns', `−${fp(eco.returns)}`, ` <span style="color:${t.amber};font-size:10px">taxminiy</span>`)}
              ${row('Ekvayring (0.5%)', 'acq', `−${fp(eco.acquiring)}`)}
              ${row(`Reklama (${adPct}%)`, 'ad', `−${fp(eco.adSpend)}`)}
              ${row('Soliq (6%)', 'tax', `−${fp(eco.tax)}`)}
              <div style="height:1px;background:${t.border};margin:2px 0"></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">Jami YM</span><span id="drm-ym-v-mkt" style="color:${t.red}">−${fp(eco.mktTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">Jami xarajat</span><span id="drm-ym-v-total" style="color:${t.red}">−${fp(eco.jamiTotal)}</span></div>
            </div>
          </div>

          <div style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:13px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:5px">TAXMINIY SOF FOYDA</div>
            <div id="drm-ym-v-profit" style="font-size:26px;font-weight:800;color:${color};margin-bottom:5px;display:block">${fp(eco.netProfit)}</div>
            <div style="height:4px;background:${t.border};border-radius:4px;margin-bottom:5px"><div id="drm-ym-bar" style="height:4px;border-radius:4px;background:${color};width:${barW}%;display:block"></div></div>
            <div id="drm-ym-v-margin" style="color:${color};font-size:13px;font-weight:600">${eco.margin}% marja</div>
          </div>

          <button id="drm-ym-ue-btn" style="display:block;width:100%;padding:11px;background:#16a34a;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;text-align:center">+ Unit-ekonomikaga qo'shish</button>
          <button id="drm-ym-market" style="display:block;width:100%;padding:10px;background:${t.card};color:${t.text};border:1px solid ${t.border};border-radius:10px;font-size:13px;text-align:center">🛒 Bozor tahlili →</button>
          <div style="text-align:center;font-size:10px;color:${t.muted}">Taxminiy hisob · daromadchi.uz</div>
        </div>
      `;

      wrap.querySelector('#drm-ym-close').onclick   = () => { wrap.remove(); chrome.storage.local.set({ ymWidgetClosed: Date.now() }); };
      wrap.querySelector('#drm-ym-refresh').onclick = () => { wrap.remove(); setTimeout(tryInit, 300); };
      wrap.querySelector('#drm-ym-fby').onclick     = () => { fby=true;  render(); };
      wrap.querySelector('#drm-ym-fbs').onclick     = () => { fby=false; render(); };
      ['#drm-ym-cost','#drm-ym-pack','#drm-ym-ad','#drm-ym-vol'].forEach(id => {
        wrap.querySelector(id)?.addEventListener('input', liveRecalc);
      });

      wrap.querySelector('#drm-ym-ue-btn')?.addEventListener('click', async () => {
        const vals  = gi();
        const eco2  = calcYm(price, { ...vals, fby });
        await chrome.storage.local.set({ ueSettings: { ...vals, fby } });
        const params = new URLSearchParams({
          source: 'yandex_market', title: title || '', url: location.href,
          price:      String(price || ''),
          commPct:    String(eco2?.commPct    || ''),
          commission: String(eco2?.commission || ''),
          delivery:   String(eco2?.delivery   || ''),
          acquiring:  String(eco2?.acquiring  || ''),
          adSpend:    String(eco2?.adSpend    || ''),
          tax:        String(eco2?.tax        || ''),
          packaging:  String(eco2?.packaging  || ''),
          profit:     String(eco2?.netProfit  ?? ''),
          margin:     String(eco2?.margin     ?? ''),
          roi:        String(eco2?.roi        ?? ''),
        });
        window.open(`https://daromadchi.uz/dashboard/unit-economics?${params}`, '_blank');
      });

      wrap.querySelector('#drm-ym-market')?.addEventListener('click', () => {
        window.open(`https://daromadchi.uz/dashboard/market?q=${encodeURIComponent(title||'')}&source=yandex_market`, '_blank');
      });
    }
  }

  async function tryInit() {
    if (document.getElementById('drm-ym-ue')) return;
    const { ymWidgetClosed } = await chrome.storage.local.get('ymWidgetClosed');
    if (Date.now() - (ymWidgetClosed||0) < 1800000) return;
    buildYmWidget();
  }

  // SPA navigation
  let lastUrl = location.href;
  let initTimer = null;
  function scheduleInit(delay=1800) {
    clearTimeout(initTimer);
    initTimer = setTimeout(tryInit, delay);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('drm-ym-ue')?.remove();
      scheduleInit();
    }
  }).observe(document, { subtree: true, childList: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleInit());
  } else {
    scheduleInit();
  }
})();
