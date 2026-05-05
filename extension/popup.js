const OVERLAY_KEY = '__dm_overlay_enabled__'

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

async function init() {
  show('view-loading')

  const res = await chrome.runtime.sendMessage({ type: 'GET_AUTH' })

  if (res.loggedIn) {
    document.getElementById('user-email').textContent = res.email || ''
    const enabled = (await chrome.storage.sync.get([OVERLAY_KEY]))[OVERLAY_KEY] !== false
    document.getElementById('overlay-toggle').checked = enabled
    show('view-connected')
  } else {
    show('view-login')
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email    = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  const btn      = document.getElementById('login-btn')
  const errEl    = document.getElementById('login-error')

  btn.disabled = true
  btn.textContent = 'Yuklanmoqda…'
  errEl.classList.add('hidden')

  const res = await chrome.runtime.sendMessage({ type: 'LOGIN', email, password })

  if (res.ok) {
    document.getElementById('user-email').textContent = res.email || email
    document.getElementById('overlay-toggle').checked = true
    show('view-connected')
  } else {
    errEl.textContent = res.error || 'Xato yuz berdi'
    errEl.classList.remove('hidden')
    btn.disabled = false
    btn.textContent = 'Kirish'
  }
})

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' })
  show('view-login')
  document.getElementById('login-form').reset()
})

// ── Overlay toggle ────────────────────────────────────────────────────────────

document.getElementById('overlay-toggle').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ [OVERLAY_KEY]: e.target.checked })
})

// ── Boot ──────────────────────────────────────────────────────────────────────

init()
