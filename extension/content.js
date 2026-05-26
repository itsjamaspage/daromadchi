// Daromadchi Extension — Content Script v2

(function () {
  'use strict';

  function getMarketplace() {
    if (window.location.hostname.includes('uzum.uz')) return 'uzum';
    if (window.location.hostname.includes('market.yandex.uz')) return 'yandex';
    return null;
  }
  const marketplace = getMarketplace();
  if (!marketplace) return;

  const IS_SELLER = marketplace === 'uzum' && (
    window.location.hostname.includes('seller.uzum') ||
    window.location.pathname.includes('/seller/')
  );

  function isProductPage() {
    if (marketplace === 'uzum') {
      return !IS_SELLER && (
        window.location.pathname.includes('/product/') ||
        window.location.pathname.includes('/item/') ||
        /\/[a-z]{2,3}\/[^/]+-\d+/.test(window.location.pathname)
      );
    }
    // Yandex Market: CHECK /product/ and /offer/ URL patterns if widget stops working after a Yandex DOM update
    if (marketplace === 'yandex') {
      return window.location.pathname.includes('/product/') ||
             window.location.pathname.includes('/offer/');
    }
    return false;
  }

  // For Uzum: bail early on irrelevant pages to avoid MutationObserver overhead.
  // For Yandex: always keep running so the observer can catch SPA navigation to product pages.
  if (marketplace === 'uzum' && !isProductPage() && !IS_SELLER) return;

  // Commission by category keyword
  const COMMISSIONS = {
    'kiyim': 12, 'elektronika': 10, 'uy': 14, 'sport': 13,
    "go'zallik": 12, 'oziq': 8, 'avto': 11, 'bolalar': 13, 'default': 15
  };

  function getCommission() {
    const bc = document.querySelector('[class*="readcrumb"], [class*="ategory"]');
    if (bc) {
      const t = bc.innerText.toLowerCase();
      for (const [k, v] of Object.entries(COMMISSIONS)) if (t.includes(k)) return v;
    }
    return COMMISSIONS.default;
  }

  function parsePrice() {
    const els = document.querySelectorAll('[class*="price"], [class*="Price"], [class*="cost"], [class*="amount"]');
    for (const el of els) {
      if (el.className.toLowerCase().includes('old') || el.className.toLowerCase().includes('cross')) continue;
      const raw = el.innerText.replace(/[^\d]/g, '');
      if (raw.length >= 4 && raw.length <= 12) return parseInt(raw);
    }
    return null;
  }

  function parseOldPrice() {
    const el = document.querySelector('[class*="old"], [class*="Old"], [class*="cross"], s');
    if (!el) return null;
    const raw = el.innerText.replace(/[^\d]/g, '');
    return raw.length >= 4 ? parseInt(raw) : null;
  }

  function parseTitle() {
    return (document.querySelector('h1') || {}).innerText?.trim().slice(0, 65) || 'Mahsulot';
  }

  function parseRating() {
    const el = document.querySelector('[class*="rating"], [class*="Rating"], [class*="star"], [class*="Star"]');
    return el ? el.innerText.trim().split('\n')[0] : null;
  }

  function parseReviewCount() {
    const el = document.querySelector('[class*="review"], [class*="Review"], [class*="opinion"]');
    if (!el) return null;
    const n = el.innerText.match(/\d+/);
    return n ? parseInt(n[0]) : null;
  }

  function parseSellerCount() {
    // Multiple sellers selling same product
    const els = document.querySelectorAll('[class*="seller"], [class*="Seller"], [class*="merchant"]');
    return els.length > 1 ? els.length : null;
  }

  function getProductIdFromUrl() {
    const m = window.location.pathname.match(/-(\d{5,})/);
    return m ? m[1] : null;
  }

  // ── YANDEX MARKET PARSERS ─────────────────────────────────────────────────

  function parseYandexPrice() {
    // CHECK: [data-auto="price-value"] is the primary selector — verify on market.yandex.uz if widget stops working
    const primary = document.querySelector('[data-auto="price-value"]');
    if (primary) {
      const raw = primary.innerText.replace(/[^\d]/g, '');
      if (raw.length >= 4 && raw.length <= 12) return parseInt(raw);
    }
    // Fallback: CHECK span[class*="price"] / div[class*="price"] selectors if primary fails
    const els = document.querySelectorAll('span[class*="price"], div[class*="price"], span[class*="Price"], div[class*="Price"]');
    for (const el of els) {
      const cls = el.className.toLowerCase();
      if (cls.includes('old') || cls.includes('cross') || cls.includes('before')) continue;
      const raw = el.innerText.replace(/[^\d]/g, '');
      if (raw.length >= 4 && raw.length <= 12) return parseInt(raw);
    }
    return null;
  }

  function parseYandexOldPrice() {
    // CHECK: [data-auto="price-old"] and class-based selectors if widget stops working after a Yandex DOM update
    const el = document.querySelector('[data-auto="price-old"], [class*="priceBefore"], [class*="priceOld"], [class*="price-before"]');
    if (el) {
      const raw = el.innerText.replace(/[^\d]/g, '');
      return raw.length >= 4 ? parseInt(raw) : null;
    }
    return null;
  }

  function getYandexProductIdFromUrl() {
    // Yandex Market URLs: /product--slug/12345678 or /product/12345678
    const m = window.location.pathname.match(/\/product[^/]*\/(\d+)/);
    if (m) return m[1];
    // Offer pages: /offer/ABCDE123 — CHECK if offer ID format changes
    const o = window.location.pathname.match(/\/offer\/([^/?]+)/);
    return o ? o[1] : null;
  }

  // ── SHARED UTILS ──────────────────────────────────────────────────────────

  function calcEco(price) {
    const commPct = getCommission();
    const comm = Math.round(price * commPct / 100);
    const delivery = Math.round(price * 0.04);
    const returns = Math.round(price * 0.02);
    const acquiring = Math.round(price * 0.015);
    const total = comm + delivery + returns + acquiring;
    const profit = price - total;
    const pct = Math.round((profit / price) * 100);
    return { commPct, comm, delivery, returns, acquiring, total, profit, pct };
  }

  function marginColor(pct) {
    return pct >= 25 ? '#22c55e' : pct >= 12 ? '#f59e0b' : '#ef4444';
  }

  function fp(n, short = false) {
    if (!n && n !== 0) return '—';
    if (short && n >= 1000000) return (n/1000000).toFixed(1) + ' mln';
    if (short && n >= 1000) return (n/1000).toFixed(0) + ' ming';
    return n.toLocaleString('uz-UZ') + ' so\'m';
  }

  // ── PRODUCT WIDGET ────────────────────────────────────────────────────────

  function buildWidget() {
    const price    = marketplace === 'yandex' ? parseYandexPrice()    : parsePrice();
    const oldPrice = marketplace === 'yandex' ? parseYandexOldPrice() : parseOldPrice();
    const title    = parseTitle();
    const rating   = parseRating();
    const reviews  = parseReviewCount();
    const sellers  = parseSellerCount();
    const productId = marketplace === 'yandex' ? getYandexProductIdFromUrl() : getProductIdFromUrl();
    const eco      = price ? calcEco(price) : null;
    const color    = eco ? marginColor(eco.pct) : '#64748b';
    const discount = (oldPrice && price) ? Math.round((1 - price/oldPrice)*100) : null;
    const commLabel = marketplace === 'yandex'
      ? `Yandex komissiyasi (${eco?.commPct}%)`
      : `Uzum komissiyasi (${eco?.commPct}%)`;

    const wrap = document.createElement('div');
    wrap.id = 'drm-widget';

    wrap.innerHTML = `
      <div class="drm-hd">
        <div class="drm-brand"><span class="drm-pulse"></span>Daromadchi</div>
        <div class="drm-hd-right">
          <button class="drm-ico-btn" id="drm-refresh" title="Yangilash">↻</button>
          <button class="drm-ico-btn" id="drm-close" title="Yopish">✕</button>
        </div>
      </div>

      <div class="drm-bd" id="drm-body">
        ${!price ? `<div class="drm-empty">Narx aniqlanmadi. <br>Sahifani yangilang.</div>` : `

        <!-- PRICE BLOCK -->
        <div class="drm-card">
          <div class="drm-row"><span class="drm-l">Sotuv narxi</span><span class="drm-v drm-bold">${fp(price)}</span></div>
          ${oldPrice ? `<div class="drm-row"><span class="drm-l">Eski narx</span><span class="drm-v drm-strike">${fp(oldPrice)}</span></div>` : ''}
          ${discount ? `<div class="drm-row"><span class="drm-l">Chegirma</span><span class="drm-v drm-green">−${discount}%</span></div>` : ''}
          ${rating ? `<div class="drm-row"><span class="drm-l">Reyting</span><span class="drm-v">⭐ ${rating}${reviews ? ` (${reviews} ta sharh)` : ''}</span></div>` : ''}
          ${sellers ? `<div class="drm-row"><span class="drm-l">Sotuvchilar</span><span class="drm-v drm-amber">${sellers} ta raqib</span></div>` : ''}
        </div>

        <!-- COST BREAKDOWN -->
        <div class="drm-section-lbl">Xarajatlar taqsimoti</div>
        <div class="drm-card">
          <div class="drm-row"><span class="drm-l">${commLabel}</span><span class="drm-v drm-red">−${fp(eco.comm)}</span></div>
          <div class="drm-row"><span class="drm-l">Yetkazib berish</span><span class="drm-v drm-red">−${fp(eco.delivery)}</span></div>
          <div class="drm-row"><span class="drm-l">Qaytarishlar (~2%)</span><span class="drm-v drm-red">−${fp(eco.returns)}</span></div>
          <div class="drm-row"><span class="drm-l">Ekvayring (1.5%)</span><span class="drm-v drm-red">−${fp(eco.acquiring)}</span></div>
          <div class="drm-divider"></div>
          <div class="drm-row drm-bold-row"><span class="drm-l">Jami xarajatlar</span><span class="drm-v drm-red">−${fp(eco.total)}</span></div>
        </div>

        <!-- PROFIT BOX -->
        <div class="drm-profit" style="border-color:${color}30;background:${color}0d">
          <div class="drm-profit-lbl">Taxminiy sof foyda</div>
          <div class="drm-profit-val" style="color:${color}">${fp(eco.profit)}</div>
          <div class="drm-profit-bar-wrap"><div class="drm-profit-bar" style="width:${Math.max(0,Math.min(100,eco.pct))}%;background:${color}"></div></div>
          <div class="drm-profit-pct" style="color:${color}">${eco.pct}% marja</div>
        </div>

        <!-- OWN PRODUCT BLOCK (loaded async) -->
        <div id="drm-own-block"></div>

        `}

        <!-- ACTIONS -->
        <div class="drm-actions">
          <button class="drm-btn drm-pri" id="drm-ue">📊 Unit-ekonomikaga qo'shish</button>
          <div class="drm-btn-row">
            <button class="drm-btn drm-sec" id="drm-dash">Dashboard</button>
            <button class="drm-btn drm-sec" id="drm-comp">Raqiblar</button>
          </div>
        </div>

        <div class="drm-note">Taxminiy hisob. <a href="https://daromadchi.uz" target="_blank">Aniq tahlil →</a></div>
      </div>
    `;

    // Events
    wrap.querySelector('#drm-close').onclick = () => {
      wrap.classList.add('drm-gone');
      chrome.storage.local.set({ widgetClosed: Date.now() });
    };
    wrap.querySelector('#drm-refresh').onclick = () => {
      wrap.remove();
      setTimeout(init, 300);
    };
    wrap.querySelector('#drm-dash').onclick = () => window.open('https://daromadchi.uz/dashboard', '_blank');
    wrap.querySelector('#drm-comp').onclick = () => {
      window.open(`https://daromadchi.uz/competitors?product=${encodeURIComponent(title)}`, '_blank');
    };
    wrap.querySelector('#drm-ue')?.addEventListener('click', () => {
      const params = new URLSearchParams({ price: price||'', title, url: location.href, marketplace });
      if (productId) params.set('id', productId);
      window.open(`https://daromadchi.uz/unit-economics?${params}`, '_blank');
    });

    // Load own-product data async
    if (price) loadOwnProductData(productId, price, wrap);

    return wrap;
  }

  async function loadOwnProductData(productId, price, wrap) {
    const { authToken } = await chrome.storage.local.get('authToken');
    if (!authToken || !productId) return;

    try {
      const res = await fetch(
        `https://daromadchi.uz/api/extension/product/${productId}?marketplace=${marketplace}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      if (!res.ok) return;
      const data = await res.json();

      const block = wrap.querySelector('#drm-own-block');
      if (!block) return;

      const stockColor = data.stock <= 3 ? '#ef4444' : data.stock <= 10 ? '#f59e0b' : '#22c55e';
      const daysColor  = data.daysOfStock <= 5 ? '#ef4444' : data.daysOfStock <= 14 ? '#f59e0b' : '#22c55e';

      block.innerHTML = `
        <div class="drm-section-lbl">Sizning mahsulotingiz</div>
        <div class="drm-card drm-own">
          <div class="drm-row">
            <span class="drm-l">Ombordagi zaxira</span>
            <span class="drm-v drm-bold" style="color:${stockColor}">${data.stock} dona</span>
          </div>
          <div class="drm-row">
            <span class="drm-l">Zaxira kunlari</span>
            <span class="drm-v" style="color:${daysColor}">${data.daysOfStock ?? '—'} kun</span>
          </div>
          <div class="drm-row">
            <span class="drm-l">Bugungi sotuv</span>
            <span class="drm-v">${data.salesToday ?? 0} ta</span>
          </div>
          <div class="drm-row">
            <span class="drm-l">Reklama holati</span>
            <span class="drm-v ${data.hasActiveAd ? 'drm-green' : 'drm-muted'}">${data.hasActiveAd ? '✅ Faol' : '⭕ Faol emas'}</span>
          </div>
          ${data.hasActiveAd && data.adSpendToday ? `
          <div class="drm-row">
            <span class="drm-l">Bugungi reklama sarfi</span>
            <span class="drm-v drm-amber">−${fp(data.adSpendToday, true)}</span>
          </div>` : ''}
          ${data.hasActiveAd && data.stock <= 5 ? `
          <div class="drm-alert-row">
            🚨 Reklama ishlayapti, lekin zaxira kam! Reklamani to'xtating yoki tez buyurtma bering.
          </div>` : ''}
          ${data.returnRate ? `
          <div class="drm-row">
            <span class="drm-l">Qaytarish foizi</span>
            <span class="drm-v ${data.returnRate>10?'drm-red':'drm-muted'}">${data.returnRate}%</span>
          </div>` : ''}
        </div>
      `;
    } catch {}
  }

  // ── SELLER CABINET BAR ────────────────────────────────────────────────────

  async function buildSellerBar() {
    const bar = document.createElement('div');
    bar.id = 'drm-bar';
    bar.innerHTML = `
      <div class="drm-bar-in">
        <span class="drm-bar-brand">📊 Daromadchi</span>
        <div class="drm-bar-stats" id="drm-bar-stats">
          <span class="drm-bar-item drm-bar-dim">Yuklanmoqda...</span>
        </div>
        <div class="drm-bar-right">
          <span class="drm-bar-alerts" id="drm-bar-alerts" style="display:none"></span>
          <a href="https://daromadchi.uz/dashboard" target="_blank" class="drm-bar-cta">To'liq tahlil →</a>
        </div>
      </div>
    `;
    document.body.prepend(bar);
    document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop)||0) + 44 + 'px';

    const { authToken, cachedStats, activeAlerts } =
      await chrome.storage.local.get(['authToken', 'cachedStats', 'activeAlerts']);

    if (!authToken) {
      bar.querySelector('#drm-bar-stats').innerHTML =
        `<a href="https://daromadchi.uz/login" target="_blank" class="drm-bar-cta">Daromadchiga kirish →</a>`;
      return;
    }

    if (cachedStats) renderBarStats(cachedStats);

    const criticals = (activeAlerts||[]).filter(a => a.priority === 'critical');
    if (criticals.length > 0) {
      const alertEl = bar.querySelector('#drm-bar-alerts');
      alertEl.style.display = 'flex';
      alertEl.innerHTML = `<span class="drm-bar-alert-badge">${criticals.length} kritik xabar</span>`;
      alertEl.onclick = () => window.open('https://daromadchi.uz/alerts', '_blank');
    }
  }

  function renderBarStats(s) {
    const el = document.getElementById('drm-bar-stats');
    if (!el) return;
    el.innerHTML = `
      <span class="drm-bar-item">Bugun: <b>${fp(s.todayRevenue, true)}</b></span>
      <span class="drm-bar-sep">|</span>
      <span class="drm-bar-item">Foyda: <b class="drm-g">${fp(s.todayProfit, true)}</b></span>
      <span class="drm-bar-sep">|</span>
      <span class="drm-bar-item">Buyurtma: <b>${s.todayOrders||0}</b></span>
      ${s.lowStock > 0 ? `<span class="drm-bar-sep">|</span><span class="drm-bar-item"><b class="drm-r">⚠️ ${s.lowStock} kam zaxira</b></span>` : ''}
    `;
  }

  // ── INIT ──────────────────────────────────────────────────────────────────

  function init() {
    // Persist marketplace so background.js can include it in outbound API calls
    chrome.storage.local.set({ lastMarketplace: marketplace });

    if (isProductPage()) {
      chrome.storage.local.get('widgetClosed', ({ widgetClosed }) => {
        const w = buildWidget();
        if (Date.now() - (widgetClosed||0) < 1800000) w.classList.add('drm-gone');
        document.body.appendChild(w);
      });
    } else if (IS_SELLER) {
      buildSellerBar();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
  } else {
    setTimeout(init, 1200);
  }

  // SPA nav handler — covers both Uzum and Yandex Market React routing
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        document.getElementById('drm-widget')?.remove();
        init();
      }, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
