// Daromadchi Extension — Yandex Market Content Script v1

(function () {
  'use strict';

  // ── URL DETECTION ─────────────────────────────────────────────────────────

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  const IS_PARTNER = hostname === 'partner.market.yandex.ru';
  const IS_BUYER   = hostname === 'market.yandex.ru' || hostname === 'market.yandex.uz';
  const IS_PRODUCT_PAGE = (IS_PARTNER && (
    pathname.includes('/products/') ||
    pathname.includes('/offer') ||
    /\/business\/\d+\//.test(pathname)
  )) || (IS_BUYER && (
    pathname.includes('/product--') ||
    pathname.includes('/product/') ||
    /\/product\b/.test(pathname) ||
    pathname.includes('/offer/') ||
    /\/sku\//.test(pathname)
  ));

  // On buyer pages: always try — Yandex is a SPA and URL may not match on first load
  if (!IS_PARTNER && !IS_BUYER) return;

  // ── DATA EXTRACTION ───────────────────────────────────────────────────────

  function parseTitle() {
    const selectors = [
      '[data-auto="offerTitle"]',
      'h1',
      '[class*="title"]',
      '[class*="Title"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 2) {
        return el.innerText.trim().slice(0, 80);
      }
    }
    return null;
  }

  function parsePrice() {
    // Try data-auto="price" first
    const autoPrice = document.querySelector('[data-auto="price"]');
    if (autoPrice) {
      const raw = autoPrice.innerText.replace(/[^\d]/g, '');
      if (raw.length >= 2 && raw.length <= 12) return parseInt(raw);
    }

    // Fallback: class-based price selectors, skip old/crossed prices
    const priceEls = document.querySelectorAll(
      '[class*="price"], [class*="Price"], [class*="cost"], [class*="amount"]'
    );
    for (const el of priceEls) {
      const cls = el.className.toLowerCase();
      if (cls.includes('old') || cls.includes('cross') || cls.includes('strike') || cls.includes('prev')) continue;
      const raw = el.innerText.replace(/[^\d]/g, '');
      if (raw.length >= 2 && raw.length <= 12) return parseInt(raw);
    }
    return null;
  }

  function parseSku() {
    // Try data-auto="sku"
    const autoSku = document.querySelector('[data-auto="sku"]');
    if (autoSku) return autoSku.innerText.trim();

    // Look for text nodes / spans containing "SKU" or "Артикул"
    const allEls = document.querySelectorAll('span, div, td, p');
    for (const el of allEls) {
      const text = el.innerText || '';
      if (/артикул|sku/i.test(text) && text.length < 120) {
        const match = text.match(/(?:артикул|sku)[:\s]*([^\s,\n]+)/i);
        if (match && match[1]) return match[1].trim();
      }
    }
    return null;
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────

  async function loadSettings() {
    const data = await chrome.storage.local.get(['ueSettings']);
    return data.ueSettings || { costPrice: 0, adPct: 5, taxPct: 6, lastMile: 0 };
  }

  // ── PROFIT CALCULATION ────────────────────────────────────────────────────

  // Yandex Market commission is approximately 15% (varies by category)
  const YM_COMMISSION_PCT = 15;

  function calcProfit(sellingPrice, costPrice) {
    const commission = Math.round(sellingPrice * YM_COMMISSION_PCT / 100);
    const profit = sellingPrice - commission - costPrice;
    const marginPct = Math.round((profit / sellingPrice) * 100);
    const roi = costPrice > 0 ? Math.round((profit / costPrice) * 100) : null;
    return { commission, profit, marginPct, roi };
  }

  function marginColor(pct) {
    return pct >= 25 ? '#22c55e' : pct >= 10 ? '#f59e0b' : '#ef4444';
  }

  function roiColor(roi) {
    if (roi === null) return '#64748b';
    return roi >= 80 ? '#22c55e' : roi >= 30 ? '#f59e0b' : '#ef4444';
  }

  function fp(n) {
    if (!n && n !== 0) return '—';
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  // ── WIDGET ────────────────────────────────────────────────────────────────

  function removeExisting() {
    document.getElementById('drm-ym-widget')?.remove();
  }

  async function buildWidget() {
    removeExisting();

    const title = parseTitle();
    const price = parsePrice();
    const sku   = parseSku();
    const settings = await loadSettings();
    const { costPrice = 0 } = settings;

    const eco = price ? calcProfit(price, costPrice) : null;
    const mColor = eco ? marginColor(eco.marginPct) : '#64748b';
    const rColor = eco?.roi !== null && eco?.roi !== undefined ? roiColor(eco.roi) : '#64748b';

    const wrap = document.createElement('div');
    wrap.id = 'drm-ym-widget';

    // Inline styles to avoid CSS class conflicts with Yandex Market page styles.
    // We reuse the same dark palette as the Uzum widget.
    Object.assign(wrap.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '300px',
      background: '#13131f',
      border: '1px solid #1e293b',
      borderRadius: '14px',
      boxShadow: '0 24px 64px rgba(0,0,0,.7)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: '12.5px',
      color: '#e2e8f0',
      zIndex: '2147483647',
      overflow: 'hidden',
      maxHeight: '85vh',
      transition: 'opacity .2s, transform .2s',
    });

    wrap.innerHTML = `
      <!-- HEADER -->
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 14px;background:#1e293b;border-bottom:1px solid #334155;">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#f1f5f9;">
          <span style="width:8px;height:8px;border-radius:50%;background:#7c3aed;
                       box-shadow:0 0 8px #7c3aed;display:inline-block;
                       animation:drm-ym-blink 2s infinite;"></span>
          Daromadchi
          <span style="font-size:10px;color:#64748b;font-weight:400;margin-left:2px;">Yandex Market</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button id="drm-ym-cfg-toggle" title="Настройки"
            style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;
                   padding:2px 5px;border-radius:4px;">⚙</button>
          <button id="drm-ym-refresh" title="Обновить"
            style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;
                   padding:2px 5px;border-radius:4px;">↻</button>
          <button id="drm-ym-close" title="Закрыть"
            style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;
                   padding:2px 5px;border-radius:4px;">✕</button>
        </div>
      </div>

      <!-- INLINE SETTINGS -->
      <div id="drm-ym-cfg-panel" style="display:none;padding:10px 12px;
           border-bottom:1px solid #1e293b;background:#0a0f1e;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;
                    letter-spacing:.7px;margin-bottom:8px;">Настройки расчёта</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;color:#94a3b8;">Себестоимость (₽)</span>
            <input id="drm-ym-cost" type="number" value="${costPrice || ''}" placeholder="0"
              style="width:80px;background:#1e293b;border:1px solid #334155;border-radius:5px;
                     padding:3px 6px;color:#e2e8f0;font-size:11px;text-align:right;"/>
          </div>
          <button id="drm-ym-cfg-save"
            style="width:100%;padding:7px;background:#7c3aed;color:#fff;border:none;
                   border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;margin-top:2px;">
            Пересчитать
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;
                  max-height:calc(85vh - 44px);overflow-y:auto;">

        ${title ? `
        <div style="background:#1e293b;border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.7px;
                      color:#475569;margin-bottom:4px;">Товар</div>
          <div style="font-size:12px;color:#f1f5f9;line-height:1.4;">${title}</div>
          ${sku ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">Артикул: ${sku}</div>` : ''}
        </div>` : ''}

        ${!price ? `
        <div style="color:#64748b;text-align:center;padding:16px 0;font-size:12px;line-height:1.6;">
          Цена не найдена.<br>Обновите страницу или перейдите на страницу товара.
        </div>` : `

        <!-- PRICE BLOCK -->
        <div style="background:#1e293b;border-radius:10px;padding:10px 12px;
                    display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#94a3b8;font-size:11.5px;">Цена продажи</span>
            <span style="font-size:13.5px;font-weight:700;color:#e2e8f0;">${fp(price)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#94a3b8;font-size:11.5px;">Комиссия YM (${YM_COMMISSION_PCT}%)</span>
            <span style="font-size:12px;color:#f87171;">−${fp(eco.commission)}</span>
          </div>
          ${costPrice ? `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#94a3b8;font-size:11.5px;">Себестоимость</span>
            <span style="font-size:12px;color:#f87171;">−${fp(costPrice)}</span>
          </div>` : ''}
        </div>

        <!-- PROFIT BOX -->
        <div style="border:1px solid ${mColor}30;background:${mColor}0d;border-radius:10px;
                    padding:12px;text-align:center;">
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;
                      letter-spacing:.5px;margin-bottom:4px;">Прибыль с продажи</div>
          <div style="font-size:20px;font-weight:800;color:${mColor};line-height:1;">${fp(eco.profit)}</div>
          <div style="background:#1e293b;border-radius:4px;height:4px;margin:8px 0 4px;overflow:hidden;">
            <div style="height:100%;border-radius:4px;background:${mColor};
                        width:${Math.max(0, Math.min(100, eco.marginPct))}%;
                        transition:width .6s;"></div>
          </div>
          <div style="display:flex;justify-content:center;gap:16px;">
            <div style="font-size:12px;opacity:.8;color:${mColor};">${eco.marginPct}% маржа</div>
            ${eco.roi !== null ? `<div style="font-size:12px;opacity:.8;color:${rColor};">ROI ${eco.roi}%</div>` : ''}
          </div>
          ${!costPrice ? `<div style="font-size:10px;color:#64748b;margin-top:6px;">
            Укажите себестоимость для точного расчёта ROI
          </div>` : ''}
        </div>

        `}

        <!-- COMPETITOR ANALYSIS -->
        ${price ? (() => {
          const reviewEl = document.querySelector('[class*="rating"], [class*="Rating"], [class*="reviewCount"], [data-auto="reviewCount"]');
          const reviewRaw = reviewEl ? parseInt(reviewEl.innerText.replace(/[^\d]/g,'')) : 0;
          const estMonthlySales = reviewRaw > 0 ? Math.round(reviewRaw * 30 / 12) : null;
          const estRevenue = estMonthlySales ? estMonthlySales * price : null;
          return estRevenue ? `
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:10px 12px;">
            <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">🔥 Raqib tahlili</div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;">
              <span style="color:#94a3b8;">Taxminiy oylik daromad</span>
              <span style="color:#38bdf8;font-weight:700;">${fp(estRevenue)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;">
              <span style="color:#94a3b8;">Taxminiy oylik sotuv</span>
              <span style="color:#94a3b8;">${estMonthlySales} dona</span>
            </div>
          </div>` : '';
        })() : ''}

        <!-- ACTIONS -->
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button id="drm-ym-ue"
            style="border:none;border-radius:8px;padding:9px 12px;font-size:12px;
                   font-weight:600;cursor:pointer;background:#7c3aed;color:#fff;
                   font-family:inherit;transition:opacity .15s;">
            📊 Unit-ekonomikaga qo'shish
          </button>
          <button id="drm-ym-market"
            style="border:1px solid rgba(56,189,248,0.3);border-radius:8px;padding:9px 12px;font-size:12px;
                   font-weight:600;cursor:pointer;background:rgba(56,189,248,0.1);color:#38bdf8;
                   font-family:inherit;transition:opacity .15s;">
            🔍 Bozor tahlili →
          </button>
          <button id="drm-ym-dash"
            style="border:1px solid #334155;border-radius:8px;padding:9px 12px;font-size:12px;
                   font-weight:600;cursor:pointer;background:#1e293b;color:#94a3b8;
                   font-family:inherit;transition:opacity .15s;">
            Dashboard →
          </button>
        </div>

        <div style="font-size:10px;color:#475569;text-align:center;">
          Приблизительный расчёт. <a href="https://daromadchi.uz" target="_blank"
            style="color:#7c3aed;text-decoration:none;">Точный анализ →</a>
        </div>
      </div>

      <style>
        @keyframes drm-ym-blink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        #drm-ym-widget button:hover { opacity: .85; }
        #drm-ym-cfg-toggle:hover,
        #drm-ym-refresh:hover,
        #drm-ym-close:hover { background:#334155 !important; color:#e2e8f0 !important; }
        #drm-ym-widget div::-webkit-scrollbar { width:3px; }
        #drm-ym-widget div::-webkit-scrollbar-thumb { background:#334155;border-radius:2px; }
      </style>
    `;

    // ── EVENTS ────────────────────────────────────────────────────────────────

    wrap.querySelector('#drm-ym-close').onclick = () => {
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(10px)';
      wrap.style.pointerEvents = 'none';
      chrome.storage.local.set({ ymWidgetClosed: Date.now() });
    };

    wrap.querySelector('#drm-ym-refresh').onclick = () => {
      wrap.remove();
      setTimeout(init, 400);
    };

    const cfgPanel = wrap.querySelector('#drm-ym-cfg-panel');
    wrap.querySelector('#drm-ym-cfg-toggle').onclick = () => {
      cfgPanel.style.display = cfgPanel.style.display === 'none' ? 'block' : 'none';
    };

    wrap.querySelector('#drm-ym-cfg-save').onclick = async () => {
      const newSettings = {
        ...(await loadSettings()),
        costPrice: parseFloat(wrap.querySelector('#drm-ym-cost').value) || 0,
      };
      await chrome.storage.local.set({ ueSettings: newSettings });
      buildWidget();
    };

    wrap.querySelector('#drm-ym-dash').onclick = () => {
      window.open('https://daromadchi.uz/dashboard', '_blank');
    };

    wrap.querySelector('#drm-ym-market')?.addEventListener('click', () => {
      window.open(`https://daromadchi.uz/dashboard/market?q=${encodeURIComponent(title || '')}&source=yandex`, '_blank');
    });

    wrap.querySelector('#drm-ym-ue').onclick = () => {
      const params = new URLSearchParams({
        source: 'yandex_market',
        title: title || '',
        price: String(price || ''),
        url: location.href,
        costPrice: String(costPrice || ''),
        margin: String(eco?.marginPct ?? ''),
        roi: String(eco?.roi ?? ''),
      });
      if (sku) params.set('sku', sku);
      window.open(`https://daromadchi.uz/dashboard/unit-economics?${params}`, '_blank');
    };

    document.body.appendChild(wrap);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────

  async function init() {
    // Respect close state for 30 minutes
    const { ymWidgetClosed } = await chrome.storage.local.get('ymWidgetClosed');
    if (ymWidgetClosed && Date.now() - ymWidgetClosed < 1800000) return;

    await buildWidget();
  }

  // Use MutationObserver to handle SPA navigation on Yandex Market
  let lastUrl = location.href;
  let initTimer = null;

  function scheduleInit(delay = 1800) {
    clearTimeout(initTimer);
    initTimer = setTimeout(init, delay);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Check if the new URL is a product page
      const newPathname = window.location.pathname;
      const isNowProduct = (
        newPathname.includes('/products/') ||
        newPathname.includes('/offer') ||
        newPathname.includes('/product') ||
        /\/business\/\d+\//.test(newPathname) ||
        /\/sku\//.test(newPathname)
      );
      removeExisting();
      if (isNowProduct || IS_BUYER) scheduleInit();
    }
  }).observe(document, { subtree: true, childList: true });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleInit());
  } else {
    scheduleInit();
  }

})();
