// content-daromadchi.js — checks if user is logged in and notifies background
(function () {
  function sync() {
    fetch('https://www.daromadchi.uz/api/extension/me', {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          chrome.runtime.sendMessage({
            action: 'daromadchi_connected',
            email: data.email,
            tg: data.tg ?? null,
          })
        }
      })
      .catch(() => {})
  }

  sync()

  // Re-sync when the tab regains focus — catches the case where the user
  // went to Telegram to connect, then came back to the daromadchi tab.
  window.addEventListener('focus', () => setTimeout(sync, 600))
})()
