// content-daromadchi.js — checks if user is logged in and notifies background
(function () {
  function sync() {
    fetch('https://www.daromadchi.uz/api/extension/me', {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          chrome.runtime.sendMessage({ action: 'daromadchi_connected', email: data.email })
        }
      })
      .catch(() => {})
  }

  sync()
})()
