// Content script running on daromadchi.uz
// Reads Supabase session from localStorage and passes token to extension storage

(function () {
  function extractToken() {
    try {
      // Supabase stores session as: sb-<project-ref>-auth-token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          const token = parsed?.access_token
          if (token) return token
        }
      }
    } catch (_) {}
    return null
  }

  function sync() {
    const token = extractToken()
    if (token) {
      chrome.runtime.sendMessage({ action: 'daromadchi_authed', token })
    }
  }

  // Run immediately (user navigated to the page already logged in)
  sync()

  // Also listen for storage changes (user just logged in on this tab)
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) {
      sync()
    }
  })
})()
