// Client-side "notifications seen" marker.
//
// The notification badge count is computed on the server (getStockAlerts().length)
// and passed to the top bar as a fixed prop, so it can't clear itself when the
// user opens the notifications page. We track how many alerts the user has
// already seen in localStorage: opening /dashboard/notifications records the
// current count as seen, and the top bar hides the badge while the live count
// is still <= what was seen. When new alerts push the count higher, the badge
// reappears showing only the unseen delta.
//
// Count-based (not per-alert-id) on purpose: stock alerts are derived live and
// carry no stable per-alert read state, so a single "seen count" is the
// pragmatic marker. Exposed through the useSyncExternalStore contract so the
// top bar re-renders the instant the page marks them seen (same tab) or another
// tab updates the value (storage event).

const KEY = 'notif-seen-count'

let listeners: Array<() => void> = []

function emit() { listeners.forEach(l => l()) }

export function subscribeNotifSeen(cb: () => void): () => void {
  listeners.push(cb)
  // Cross-tab: another tab marking notifications seen updates this badge too.
  if (typeof window !== 'undefined') window.addEventListener('storage', cb)
  return () => {
    listeners = listeners.filter(l => l !== cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb)
  }
}

export function getSeenCount(): number {
  try { return Number(localStorage.getItem(KEY) ?? '0') || 0 } catch { return 0 }
}

// Server render can't know per-user localStorage, so it reports 0 seen → the
// badge shows the full count on first paint, then reconciles after hydration.
export function getServerSeenCount(): number { return 0 }

export function markNotificationsSeen(count: number): void {
  try { localStorage.setItem(KEY, String(count)) } catch { /* ignore */ }
  emit()
}
