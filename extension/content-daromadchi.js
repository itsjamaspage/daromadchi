// content-daromadchi.js — fetches session token from daromadchi.uz API and sends to background
(function () {
  function sync() {
    console.log('[Daromadchi] Fetching token from /api/extension/token');
    fetch('https://www.daromadchi.uz/api/extension/token', {
      credentials: 'include',
    })
      .then(r => {
        console.log('[Daromadchi] /api/extension/token status:', r.status);
        return r.json();
      })
      .then(data => {
        if (data.token) {
          console.log('[Daromadchi] Got token, sending to background');
          chrome.runtime.sendMessage({ action: 'daromadchi_authed', token: data.token }, (resp) => {
            if (chrome.runtime.lastError) {
              console.log('[Daromadchi] sendMessage error:', chrome.runtime.lastError.message);
            } else {
              console.log('[Daromadchi] background replied:', resp);
            }
          });
        } else {
          console.log('[Daromadchi] Not authenticated:', data.error);
        }
      })
      .catch(err => {
        console.log('[Daromadchi] fetch error:', err);
      });
  }

  sync();
})();
