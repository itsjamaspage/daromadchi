// Daromadchi — Uzum Market content script (Yoolip style v4)
(function () {
  'use strict';

  /* ── URL detection ───────────────────────────────────────────────── */
  if (window.location.hostname.includes('seller.')) return;

  const path = window.location.pathname;
  const IS_PRODUCT =
    path.includes('/product/') ||
    path.includes('/item/') ||
    /\/-\d{5,}/.test(path) ||
    /\/[a-z]{2,3}\/[^/]+-\d{5,}/.test(path);

  if (!IS_PRODUCT) return;

  const WIDGET_ID  = 'drm-widget';
  const CLOSED_KEY = 'widgetClosed';

  /* ── CSS isolation ───────────────────────────────────────────────── */
  function injectStyles(id) {
    if (document.getElementById('drm-style-' + id)) return;
    const s = document.createElement('style');
    s.id = 'drm-style-' + id;
    s.textContent = `
      #${id}, #${id} * {
        all: initial !important;
        box-sizing: border-box !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      }
      #${id} {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── i18n ────────────────────────────────────────────────────────── */
  const LANGS = {
    uz: {
      fbo: 'FBO', fbs: 'FBS',
      params: 'HISOB PARAMETRLARI',
      costLabel: "Tannarx (so'm)", packLabel: "Qadoqlash (so'm)", adLabel: 'Reklama %',
      breakdown: 'XARAJATLAR TAQSIMOTI',
      narx: 'Narx', comm: 'Komissiya', delivery: 'Yetkazib berish',
      returns: 'Qaytarishlar (~2%)', acquiring: 'Ekvayring (1.5%)',
      reklama: 'Reklama', tax: 'Soliq (6%)', saqlash: 'Saqlash narxi alohida',
      totalMkt: 'Jami Uzum', totalCost: 'Jami xarajat',
      profitLabel: 'TAXMINIY SOF FOYDA', marja: 'marja',
      ueBtn: "+ Unit-ekonomikaga qo'shish", marketBtn: '🛒 Bozor tahlili →',
      noPrice: 'Narx aniqlanmadi. Sahifani yangilang.',
      footer: 'Taxminiy hisob \xb7 daromadchi.uz', taxminiy: 'taxminiy',
    },
    ru: {
      fbo: 'FBO', fbs: 'FBS',
      params: 'ПАРАМЕТРЫ РАСЧЁТА',
      costLabel: 'Себестоимость (сум)', packLabel: 'Упаковка (сум)', adLabel: 'Реклама %',
      breakdown: 'СТРУКТУРА ЗАТРАТ',
      narx: 'Цена', comm: 'Комиссия', delivery: 'Доставка',
      returns: 'Возвраты (~2%)', acquiring: 'Эквайринг (1.5%)',
      reklama: 'Реклама', tax: 'Налог (6%)', saqlash: 'Хранение — отдельно',
      totalMkt: 'Итого Uzum', totalCost: 'Всего расходов',
      profitLabel: 'ОЦ. ЧИСТАЯ ПРИБЫЛЬ', marja: 'маржа',
      ueBtn: '+ В юнит-экономику', marketBtn: '🛒 Анализ рынка →',
      noPrice: 'Цена не определена. Обновите страницу.',
      footer: 'Примерный расчёт \xb7 daromadchi.uz', taxminiy: 'прибл.',
    },
    en: {
      fbo: 'FBO', fbs: 'FBS',
      params: 'CALCULATION PARAMS',
      costLabel: 'Cost price (som)', packLabel: 'Packaging (som)', adLabel: 'Ad spend %',
      breakdown: 'COST BREAKDOWN',
      narx: 'Price', comm: 'Commission', delivery: 'Delivery',
      returns: 'Returns (~2%)', acquiring: 'Acquiring (1.5%)',
      reklama: 'Advertising', tax: 'Tax (6%)', saqlash: 'Storage billed separately',
      totalMkt: 'Total Uzum fees', totalCost: 'Total costs',
      profitLabel: 'EST. NET PROFIT', marja: 'margin',
      ueBtn: '+ Add to unit economics', marketBtn: '🛒 Market analysis →',
      noPrice: 'Price not found. Refresh the page.',
      footer: 'Estimated \xb7 daromadchi.uz', taxminiy: 'approx.',
    },
  };

  /* ── Commission by category ──────────────────────────────────────── */
  const COMM_MAP = [
    [/kozmetika|parfyum|gozellik|beauty/i,   12],
    [/elektronika|telefon|kompyuter/i,        10],
    [/oziq|ovqat/i,                            8],
    [/kiyim|ayollar|erkaklar|bolalar/i,       13],
    [/uy|maishiy|mebel/i,                     14],
    [/sport/i,                                13],
    [/avto/i,                                 11],
  ];
  const DEFAULT_COMM = 15;

  /* ── Theme ───────────────────────────────────────────────────────── */
  const THEME = {
    dark:  { bg: '#0f1117', card: '#1a1f2e', border: '#2a3040', text: '#e2e8f0', muted: '#94a3b8', red: '#f87171', green: '#4ade80', amber: '#f59e0b' },
    light: { bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', red: '#dc2626', green: '#16a34a', amber: '#d97706' },
  };

  let langKey = 'uz', theme = 'dark';
  function L() { return LANGS[langKey]; }
  function T() { return THEME[theme]; }

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function getCommission() {
    const bc = document.querySelector(
      '[class*="readcrumb"],[class*="ategory"],[class*="Breadcrumb"],[class*="breadcrumb"]'
    );
    if (bc) {
      const txt = bc.innerText;
      for (const [re, pct] of COMM_MAP) if (re.test(txt)) return pct;
    }
    return DEFAULT_COMM;
  }

  function parsePrice() {
    const els = document.querySelectorAll('[class*="price"],[class*="Price"],[class*="cost"],[class*="amount"]');
    for (const el of els) {
      const cn = (el.className || '').toLowerCase();
      if (/old|cross|credit|installment|kartasiz/.test(cn)) continue;
      // Direct text nodes only — avoids concatenating child element text
      const direct = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent)
        .join('');
      const raw = direct.replace(/[^\d]/g, '');
      if (raw.length >= 4 && raw.length <= 9) return parseInt(raw, 10);
      // Leaf elements
      if (el.children.length === 0) {
        const r2 = (el.innerText || '').replace(/[^\d]/g, '');
        if (r2.length >= 4 && r2.length <= 9) return parseInt(r2, 10);
      }
    }
    return null;
  }

  function parseTitle() {
    return (document.querySelector('h1') || {}).innerText?.trim().slice(0, 70) || 'Mahsulot';
  }

  function getProductId() {
    const m = window.location.pathname.match(/-(\d{5,})/);
    return m ? m[1] : null;
  }

  function fp(n) {
    if (n === null || n === undefined) return '—';
    return Math.round(n).toLocaleString('uz-UZ') + " so'm";
  }

  function profitColor(margin) {
    const t = T();
    return margin >= 25 ? t.green : margin >= 10 ? t.amber : t.red;
  }

  /* ── Calculation ─────────────────────────────────────────────────── */
  function calcUzum(price, { costPrice = 0, packaging = 0, adPct = 5, fbo = true } = {}) {
    const commPct    = getCommission();
    const commission = Math.round(price * commPct / 100);
    const delivery   = fbo ? 10000 : 0;
    const returns    = Math.round(price * 0.02);
    const acquiring  = Math.round(price * 0.015);
    const adSpend    = Math.round(price * adPct / 100);
    const tax        = Math.round(price * 0.06);
    const mktTotal   = commission + delivery + returns + acquiring;
    const jamiTotal  = mktTotal + adSpend + tax + packaging + costPrice;
    const netProfit  = price - jamiTotal;
    const margin     = Math.round((netProfit / price) * 100);
    const roi        = costPrice > 0 ? Math.round((netProfit / costPrice) * 100) : null;
    return { commPct, commission, delivery, returns, acquiring, adSpend, tax, packaging, costPrice, mktTotal, jamiTotal, netProfit, margin, roi };
  }

  /* ── Widget ──────────────────────────────────────────────────────── */
  function buildWidget() {
    let fbo = true, costPrice = 0, packaging = 0, adPct = 5;

    injectStyles(WIDGET_ID);

    const wrap = document.createElement('div');
    wrap.id = WIDGET_ID;
    document.body.appendChild(wrap);

    const title     = parseTitle();
    const productId = getProductId();

    chrome.storage.local.get(['ueSettings', 'drmLang', 'drmTheme'], data => {
      if (data.ueSettings) {
        costPrice = data.ueSettings.costPrice || 0;
        packaging = data.ueSettings.packaging || 0;
        adPct     = data.ueSettings.adPct     || 5;
        fbo       = data.ueSettings.fbo !== undefined ? data.ueSettings.fbo : true;
      }
      if (data.drmLang)  langKey = data.drmLang;
      if (data.drmTheme) theme   = data.drmTheme;
      render();
    });

    function getInputs() {
      return {
        costPrice: parseFloat(wrap.querySelector('#drm-inp-cost')?.value) || 0,
        packaging: parseFloat(wrap.querySelector('#drm-inp-pack')?.value) || 0,
        adPct:     parseFloat(wrap.querySelector('#drm-inp-ad')?.value)   || 5,
      };
    }

    function liveRecalc() {
      const price = parsePrice();
      if (!price) return;
      const eco   = calcUzum(price, { ...getInputs(), fbo });
      const color = profitColor(eco.margin);
      const set   = (id, v) => { const e = wrap.querySelector('#drm-v-' + id); if (e) e.textContent = v; };
      const recolor = (id, c) => { const e = wrap.querySelector('#drm-v-' + id); if (e) e.style.color = c; };

      set('comm',     '−' + fp(eco.commission));
      set('delivery', '−' + fp(eco.delivery));
      set('returns',  '−' + fp(eco.returns));
      set('acq',      '−' + fp(eco.acquiring));
      set('ad',       '−' + fp(eco.adSpend));
      set('tax',      '−' + fp(eco.tax));
      set('mkt',      '−' + fp(eco.mktTotal));
      set('total',    '−' + fp(eco.jamiTotal));
      set('profit',   fp(eco.netProfit));
      set('margin',   eco.margin + '% ' + L().marja);
      recolor('profit', color);
      recolor('margin', color);

      const bar = wrap.querySelector('#drm-profit-bar');
      if (bar) {
        bar.style.width      = Math.max(0, Math.min(100, eco.margin)) + '%';
        bar.style.background = color;
      }
    }

    function render() {
      const price = parsePrice();
      const t = T(), l = L();
      const eco   = price ? calcUzum(price, { costPrice, packaging, adPct, fbo }) : null;
      const color = eco ? profitColor(eco.margin) : t.muted;
      const barW  = eco ? Math.max(0, Math.min(100, eco.margin)) : 0;

      const inp = (id, val, ph, step) =>
        `<input id="${id}" type="number" step="${step || '1'}" value="${val || ''}" placeholder="${ph || '0'}"
          style="display:block;width:90px;background:${t.card};border:1px solid ${t.border};
                 border-radius:6px;padding:4px 8px;color:${t.text};font-size:12px;
                 text-align:right;outline:none"/>`;

      const amberBadge = `<span style="display:inline;color:${t.amber};font-size:10px;margin-left:3px">${l.taxminiy}</span>`;

      const row = (label, id, val, badge) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
           <span style="color:${t.muted}">${label}${badge || ''}</span>
           <span id="drm-v-${id}" style="color:${t.red};font-weight:500">${val}</span>
         </div>`;

      wrap.innerHTML = `
        <div style="display:block;width:360px;max-height:92vh;overflow-y:auto;background:${t.bg};
             border:1px solid ${t.border};border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);
             font-size:13px;color:${t.text};scrollbar-width:thin">

          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
               border-bottom:1px solid ${t.border};position:sticky;top:0;background:${t.bg};z-index:1">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;font-size:14px;color:${t.text}">Daromadchi</span>
              <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;background:#7c3aed;color:#fff;border-radius:20px">Uzum</span>
            </div>
            <div style="display:flex;align-items:center;gap:3px">
              ${['uz', 'ru', 'en'].map(k =>
                `<button id="drm-lang-${k}" style="display:inline-block;padding:2px 5px;border-radius:4px;
                  border:1px solid ${langKey === k ? '#7c3aed' : t.border};
                  background:${langKey === k ? '#7c3aed' : 'transparent'};
                  color:${langKey === k ? '#fff' : t.muted};font-size:10px;cursor:pointer;font-weight:600">
                  ${k.toUpperCase()}</button>`
              ).join('')}
              <button id="drm-theme" style="display:inline-block;padding:3px 7px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px;cursor:pointer">${theme === 'dark' ? '☀️' : '🌙'}</button>
              <button id="drm-refresh" style="display:inline-block;padding:3px 7px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px;cursor:pointer">↻</button>
              <button id="drm-close" style="display:inline-block;padding:3px 7px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px;cursor:pointer">✕</button>
            </div>
          </div>

          <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">

            <div>
              <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:${t.text}">${title}</div>
              ${price
                ? `<div style="font-size:22px;font-weight:800;color:#a78bfa">${fp(price)}</div>`
                : `<div style="color:${t.red};font-size:12px">${l.noPrice}</div>`}
            </div>

            <div style="display:flex;gap:6px">
              <button id="drm-fbo" style="flex:1;padding:7px;border-radius:8px;
                border:1px solid ${fbo ? '#7c3aed' : t.border};
                background:${fbo ? '#7c3aed' : 'transparent'};
                color:${fbo ? '#fff' : t.muted};font-size:12px;font-weight:600;cursor:pointer">${l.fbo}</button>
              <button id="drm-fbs" style="flex:1;padding:7px;border-radius:8px;
                border:1px solid ${!fbo ? '#7c3aed' : t.border};
                background:${!fbo ? '#7c3aed' : 'transparent'};
                color:${!fbo ? '#fff' : t.muted};font-size:12px;font-weight:600;cursor:pointer">${l.fbs}</button>
            </div>

            <div>
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.params}</div>
              <div style="display:flex;flex-direction:column;gap:7px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:12px;color:${t.muted}">${l.costLabel}</span>
                  ${inp('drm-inp-cost', costPrice)}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:12px;color:${t.muted}">${l.packLabel}</span>
                  ${inp('drm-inp-pack', packaging)}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:12px;color:${t.muted}">${l.adLabel}</span>
                  ${inp('drm-inp-ad', adPct, '5', '0.5')}
                </div>
              </div>
            </div>

            ${!eco ? '' : `
            <div>
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.breakdown}</div>
              <div style="display:flex;flex-direction:column;gap:5px">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
                  <span style="color:${t.muted}">${l.narx}</span>
                  <span style="color:${t.text};font-weight:600">${fp(price)}</span>
                </div>
                ${row(l.comm + ' (' + eco.commPct + '%)', 'comm', '−' + fp(eco.commission))}
                ${row(l.delivery + ' (FBO)', 'delivery', '−' + fp(eco.delivery), amberBadge)}
                ${row(l.returns, 'returns', '−' + fp(eco.returns), amberBadge)}
                ${row(l.acquiring, 'acq', '−' + fp(eco.acquiring))}
                ${row(l.reklama + ' (' + adPct + '%)', 'ad', '−' + fp(eco.adSpend))}
                ${row(l.tax, 'tax', '−' + fp(eco.tax))}
                <div style="font-size:10px;color:${t.muted};font-style:italic">${l.saqlash}</div>
                <div style="height:1px;background:${t.border};margin:2px 0"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600">
                  <span style="color:${t.muted}">${l.totalMkt}</span>
                  <span id="drm-v-mkt" style="color:${t.red}">−${fp(eco.mktTotal)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600">
                  <span style="color:${t.muted}">${l.totalCost}</span>
                  <span id="drm-v-total" style="color:${t.red}">−${fp(eco.jamiTotal)}</span>
                </div>
              </div>
            </div>

            <div style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:14px;text-align:center">
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:6px">${l.profitLabel}</div>
              <div id="drm-v-profit" style="font-size:26px;font-weight:800;color:${color};margin-bottom:6px">${fp(eco.netProfit)}</div>
              <div style="height:4px;background:${t.border};border-radius:4px;margin-bottom:6px;overflow:hidden">
                <div id="drm-profit-bar" style="height:4px;border-radius:4px;background:${color};width:${barW}%;transition:width .3s"></div>
              </div>
              <div id="drm-v-margin" style="color:${color};font-size:13px;font-weight:600">${eco.margin}% ${l.marja}</div>
            </div>
            `}

            <button id="drm-ue"
              style="display:block;width:100%;padding:11px;background:#16a34a;color:#fff;border:none;
                     border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;text-align:center">
              ${l.ueBtn}
            </button>
            <button id="drm-market"
              style="display:block;width:100%;padding:10px;background:${t.card};color:${t.text};
                     border:1px solid ${t.border};border-radius:10px;font-size:13px;cursor:pointer;text-align:center">
              ${l.marketBtn}
            </button>

            <div style="text-align:center;font-size:10px;color:${t.muted}">${l.footer}</div>
          </div>
        </div>
      `;

      wrap.querySelector('#drm-close').onclick = () => {
        wrap.remove();
        chrome.storage.local.set({ [CLOSED_KEY]: Date.now() });
      };

      wrap.querySelector('#drm-refresh').onclick = () => {
        wrap.remove();
        setTimeout(init, 400);
      };

      wrap.querySelector('#drm-theme').onclick = () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ drmTheme: theme });
        render();
      };

      ['uz', 'ru', 'en'].forEach(k => {
        wrap.querySelector('#drm-lang-' + k)?.addEventListener('click', () => {
          langKey = k;
          chrome.storage.local.set({ drmLang: k });
          render();
        });
      });

      wrap.querySelector('#drm-fbo').onclick = () => { fbo = true;  render(); };
      wrap.querySelector('#drm-fbs').onclick = () => { fbo = false; render(); };

      ['#drm-inp-cost', '#drm-inp-pack', '#drm-inp-ad'].forEach(id => {
        wrap.querySelector(id)?.addEventListener('input', liveRecalc);
      });

      wrap.querySelector('#drm-ue')?.addEventListener('click', async () => {
        const vals  = getInputs();
        const p2    = parsePrice();
        const eco2  = p2 ? calcUzum(p2, { ...vals, fbo }) : null;
        await chrome.storage.local.set({ ueSettings: { ...vals, fbo } });
        const params = new URLSearchParams({
          source:     'uzum',
          title,
          url:        location.href,
          price:      String(p2              || ''),
          commPct:    String(eco2?.commPct   || ''),
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
        if (productId) params.set('productId', productId);
        window.open('https://daromadchi.uz/dashboard/unit-economics?' + params, '_blank');
      });

      wrap.querySelector('#drm-market')?.addEventListener('click', () => {
        window.open('https://daromadchi.uz/dashboard/market?q=' + encodeURIComponent(title) + '&source=uzum', '_blank');
      });
    } // end render()
  } // end buildWidget()

  /* ── Init & SPA navigation ───────────────────────────────────────── */
  async function init() {
    if (document.getElementById(WIDGET_ID)) return;
    const data = await chrome.storage.local.get(CLOSED_KEY);
    if (Date.now() - (data[CLOSED_KEY] || 0) < 1800000) return;
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
  } else {
    setTimeout(init, 1200);
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const p = window.location.pathname;
    const isP = p.includes('/product/') || p.includes('/item/') ||
                /\/-\d{5,}/.test(p) || /\/[a-z]{2,3}\/[^/]+-\d{5,}/.test(p);
    setTimeout(() => {
      document.getElementById(WIDGET_ID)?.remove();
      if (isP) init();
    }, 1500);
  }).observe(document, { subtree: true, childList: true });

})();
