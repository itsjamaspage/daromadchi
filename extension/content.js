// ── Product ID extraction ─────────────────────────────────────────────────────

function getUzumProductId() {
  // URL: /uz/product/some-slug-12345678 or /ru/product/slug-12345678
  const m = location.pathname.match(/\/product\/[^/]+-(\d+)\/?$/)
  if (m) return m[1]
  // Fallback: last numeric segment
  const parts = location.pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  const digits = last?.match(/(\d+)$/)
  return digits ? digits[1] : null
}

function getYandexProductId() {
  // URL: /product/slug/12345678 or /product/12345678
  const m = location.pathname.match(/\/product\/(?:[^/]+-)?(\d+)\/?/)
  return m ? m[1] : null
}

function detectMarketplace() {
  const host = location.hostname
  if (host.includes('uzum.uz')) return 'uzum'
  if (host.includes('yandex.ru') || host.includes('yandex.uz')) return 'yandex'
  return null
}

function getProductId(marketplace) {
  return marketplace === 'uzum' ? getUzumProductId() : getYandexProductId()
}

// ── Overlay ───────────────────────────────────────────────────────────────────

let shadowHost = null
let shadowRoot = null

function ensureShadow() {
  if (shadowHost) return shadowRoot
  shadowHost = document.createElement('div')
  shadowHost.id = '__daromadchi_host__'
  shadowHost.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:sans-serif;'
  document.body.appendChild(shadowHost)
  shadowRoot = shadowHost.attachShadow({ mode: 'closed' })
  return shadowRoot
}

function removeOverlay() {
  if (shadowHost) {
    shadowHost.remove()
    shadowHost = null
    shadowRoot = null
  }
}

const STYLES = `
  .panel {
    background: rgba(13,13,25,0.95);
    border: 1px solid rgba(139,92,246,0.35);
    border-radius: 16px;
    padding: 14px 16px 12px;
    width: 260px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    color: #e2e8f0;
    font-size: 12px;
    line-height: 1.4;
    backdrop-filter: blur(12px);
    transition: opacity 0.2s;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .logo {
    font-weight: 700;
    font-size: 13px;
    background: linear-gradient(135deg,#a78bfa,#38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .close-btn {
    cursor: pointer;
    color: #64748b;
    font-size: 16px;
    line-height: 1;
    background: none;
    border: none;
    padding: 0 2px;
    transition: color 0.15s;
  }
  .close-btn:hover { color: #e2e8f0; }
  .section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
    margin: 8px 0 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .row:last-child { border-bottom: none; }
  .label { color: #94a3b8; }
  .val { font-weight: 600; color: #f1f5f9; }
  .val.good { color: #34d399; }
  .val.warn { color: #fbbf24; }
  .val.bad  { color: #f87171; }
  .null { color: #475569; }
  .loading {
    text-align: center;
    color: #64748b;
    padding: 20px 0;
    font-size: 12px;
  }
  .error-msg {
    text-align: center;
    color: #f87171;
    padding: 12px 0;
    font-size: 12px;
  }
  .login-link {
    display: block;
    text-align: center;
    color: #a78bfa;
    text-decoration: none;
    font-size: 11px;
    margin-top: 8px;
  }
  .divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin: 8px 0;
  }
  .badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(139,92,246,0.2);
    color: #a78bfa;
    border: 1px solid rgba(139,92,246,0.3);
  }
`

function fmt(n, suffix = '') {
  if (n == null) return null
  return `${n.toLocaleString('uz')}${suffix}`
}

function colorClass(val, goodAbove, badBelow) {
  if (val == null) return ''
  if (val >= goodAbove) return 'good'
  if (val <= badBelow) return 'bad'
  return 'warn'
}

function renderPanel(data) {
  const root = ensureShadow()

  const styleEl = document.createElement('style')
  styleEl.textContent = STYLES

  const panel = document.createElement('div')
  panel.className = 'panel'

  const { ownProduct: op, marketData: md } = data

  let inner = `
    <div class="header">
      <span class="logo">Daromadchi</span>
      <button class="close-btn" id="__dm_close__">✕</button>
    </div>
  `

  if (op) {
    const marginClass = colorClass(op.margin, 30, 10)
    const drrClass    = colorClass(op.drr, null, null) // lower is better, invert logic
    const drrColor    = op.drr == null ? '' : op.drr <= 15 ? 'good' : op.drr <= 30 ? 'warn' : 'bad'
    const stockClass  = colorClass(op.stockDaysRemaining, 30, 7)

    inner += `<div class="section-label">Sizning do'koningiz <span class="badge">Shaxsiy</span></div>`
    inner += row('Narx', fmt(op.sellingPrice, " so'm"))
    if (op.costPrice != null) inner += row('Tannarx', fmt(op.costPrice, " so'm"))
    inner += row('Marja', op.margin != null ? `<span class="val ${marginClass}">${op.margin}%</span>` : nullVal(), false)
    inner += row('DRR (30k)', op.drr != null ? `<span class="val ${drrColor}">${op.drr}%</span>` : nullVal(), false)
    inner += row('Sotuv (7k)', fmt(op.sales7d, ' ta'))
    inner += row('Qoldiq', fmt(op.stockQuantity, ' ta'))
    inner += row('Tugaydi', op.stockDaysRemaining != null ? `<span class="val ${stockClass}">${op.stockDaysRemaining} kun</span>` : nullVal(), false)
  } else {
    inner += `<div class="section-label">Sizning do'koningiz</div>`
    inner += `<div class="null" style="font-size:11px;color:#64748b;padding:4px 0">Bu mahsulot sizning do'konlaringizda topilmadi.</div>`
  }

  if (md) {
    inner += `<hr class="divider"><div class="section-label">Bozor ma'lumotlari <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border-color:rgba(56,189,248,0.3)">Ommaviy</span></div>`
    if (md.minPrice || md.maxPrice) {
      inner += row('Narx diapazoni', `${fmt(md.minPrice)} – ${fmt(md.maxPrice)} so'm`)
    }
    if (md.avgRating != null) inner += row('Reyting', `⭐ ${md.avgRating}`)
    if (md.reviewCount != null) inner += row('Sharhlar', fmt(md.reviewCount, ' ta'))
    if (md.ordersAmount != null) inner += row('Buyurtmalar', fmt(md.ordersAmount, ' ta'))
  }

  inner += `
    <a class="login-link" href="https://daromadchi.uz/dashboard" target="_blank">
      Batafsil dashboard →
    </a>
  `

  panel.innerHTML = inner
  root.innerHTML = ''
  root.appendChild(styleEl)
  root.appendChild(panel)

  root.getElementById('__dm_close__').addEventListener('click', () => {
    removeOverlay()
    sessionStorage.setItem('__dm_closed__', '1')
  })
}

function row(label, val, raw = true) {
  const valHtml = raw ? `<span class="val">${val ?? '<span class="null">—</span>'}</span>` : (val ?? '<span class="null">—</span>')
  return `<div class="row"><span class="label">${label}</span>${valHtml}</div>`
}

function nullVal() {
  return '<span class="null">—</span>'
}

function renderLoading() {
  const root = ensureShadow()
  const styleEl = document.createElement('style')
  styleEl.textContent = STYLES
  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.innerHTML = `
    <div class="header">
      <span class="logo">Daromadchi</span>
      <button class="close-btn" id="__dm_close__">✕</button>
    </div>
    <div class="loading">Yuklanmoqda…</div>
  `
  root.innerHTML = ''
  root.appendChild(styleEl)
  root.appendChild(panel)
  root.getElementById('__dm_close__').addEventListener('click', () => {
    removeOverlay()
    sessionStorage.setItem('__dm_closed__', '1')
  })
}

function renderAuthNeeded() {
  const root = ensureShadow()
  const styleEl = document.createElement('style')
  styleEl.textContent = STYLES
  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.innerHTML = `
    <div class="header">
      <span class="logo">Daromadchi</span>
      <button class="close-btn" id="__dm_close__">✕</button>
    </div>
    <div class="error-msg">
      Kirish talab etiladi.<br>
      <small style="color:#64748b">Kengaytma ikonasini bosing.</small>
    </div>
  `
  root.innerHTML = ''
  root.appendChild(styleEl)
  root.appendChild(panel)
  root.getElementById('__dm_close__').addEventListener('click', () => {
    removeOverlay()
    sessionStorage.setItem('__dm_closed__', '1')
  })
}

// ── Main logic ────────────────────────────────────────────────────────────────

let lastUrl = ''

async function run() {
  const marketplace = detectMarketplace()
  if (!marketplace) return

  const productId = getProductId(marketplace)
  if (!productId) return

  // Same page, same product — don't re-render
  const key = `${marketplace}:${productId}`
  if (key === lastUrl) return
  lastUrl = key

  // User manually closed this session
  if (sessionStorage.getItem('__dm_closed__')) {
    removeOverlay()
    return
  }

  // Respect the overlay toggle from popup settings
  const { __dm_overlay_enabled__: enabled } = await chrome.storage.sync.get(['__dm_overlay_enabled__'])
  if (enabled === false) {
    removeOverlay()
    return
  }

  renderLoading()

  const data = await chrome.runtime.sendMessage({
    type: 'FETCH_PRODUCT',
    marketplace,
    productId,
  })

  if (!data || data.error === 'auth') {
    renderAuthNeeded()
    return
  }

  renderPanel(data)
}

// Run on load
run()

// SPA navigation: watch for URL changes via MutationObserver on <title> and pushState
let titleObserver = null
function watchSpa() {
  if (titleObserver) return
  titleObserver = new MutationObserver(() => {
    const key = `${detectMarketplace()}:${getProductId(detectMarketplace())}`
    if (key !== lastUrl) {
      sessionStorage.removeItem('__dm_closed__')
      run()
    }
  })
  const titleEl = document.querySelector('title')
  if (titleEl) titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true })

  // Also patch history methods
  const orig = history.pushState.bind(history)
  history.pushState = function (...args) {
    orig(...args)
    setTimeout(() => {
      sessionStorage.removeItem('__dm_closed__')
      run()
    }, 500)
  }
}

if (document.readyState === 'complete') {
  watchSpa()
} else {
  window.addEventListener('load', watchSpa)
}
