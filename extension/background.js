const SUPABASE_URL  = 'https://ajwtpyrucfcrdndedumt.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd3RweXJ1Y2ZjcmRuZGVkdW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDAyMDUsImV4cCI6MjA5MzQxNjIwNX0.8AvDWSlO-k9MJBoXkAOIQquOzza-7OFTqZ5DPXaep1s'
const API_BASE      = 'https://daromadchi.uz'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login xatosi')
  return { accessToken: data.access_token, refreshToken: data.refresh_token, email }
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error('Token yangilanmadi')
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

async function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['accessToken', 'refreshToken', 'email'], (items) => {
      resolve(items)
    })
  })
}

async function setStoredAuth(tokens) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(tokens, resolve)
  })
}

async function clearStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(['accessToken', 'refreshToken', 'email'], resolve)
  })
}

async function getValidToken() {
  const { accessToken, refreshToken } = await getStoredAuth()
  if (!accessToken) return null

  // Validate token with backend
  const res = await fetch(`${API_BASE}/api/extension/validate`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) return accessToken

  // Token expired — try refresh
  if (refreshToken) {
    try {
      const tokens = await refreshSession(refreshToken)
      await setStoredAuth(tokens)
      return tokens.accessToken
    } catch {
      await clearStoredAuth()
      return null
    }
  }

  await clearStoredAuth()
  return null
}

// ── Product data ──────────────────────────────────────────────────────────────

async function fetchProductData(marketplace, productId) {
  const token = await getValidToken()
  if (!token) return { error: 'auth' }

  const url = `${API_BASE}/api/extension/product?marketplace=${marketplace}&productId=${productId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) return { error: 'auth' }
  if (!res.ok) return { error: `HTTP ${res.status}` }

  return res.json()
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'LOGIN') {
    signIn(msg.email, msg.password)
      .then(async (tokens) => {
        await setStoredAuth(tokens)
        sendResponse({ ok: true, email: tokens.email })
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'LOGOUT') {
    clearStoredAuth().then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'GET_AUTH') {
    getStoredAuth().then((items) => {
      if (!items.accessToken) {
        sendResponse({ loggedIn: false })
      } else {
        sendResponse({ loggedIn: true, email: items.email })
      }
    })
    return true
  }

  if (msg.type === 'FETCH_PRODUCT') {
    fetchProductData(msg.marketplace, msg.productId)
      .then((data) => sendResponse(data))
    return true
  }
})
