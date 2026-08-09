'use client'

import { useSyncExternalStore } from 'react'

// Single source of truth for the visitor's cookie/analytics consent choice.
// Persisted in localStorage under one key, shared by the consent banner
// (components/CookieConsent.tsx) and the analytics loader
// (app/components/Analytics.tsx) so GA only ever loads after an explicit opt-in.

export const CONSENT_KEY = 'cookie-consent'

// '' = no choice made yet · 'accepted' = analytics allowed · 'declined' = refused
export type Consent = '' | 'accepted' | 'declined'

let listeners: Array<() => void> = []

function subscribe(cb: () => void): () => void {
  listeners.push(cb)
  // Reflect a choice made in another tab/window.
  if (typeof window !== 'undefined') window.addEventListener('storage', cb)
  return () => {
    listeners = listeners.filter(l => l !== cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb)
  }
}

function getSnapshot(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'declined' ? v : ''
  } catch {
    // localStorage blocked (private mode / cookies disabled): treat as declined
    // so analytics never loads without a real, storable opt-in.
    return 'declined'
  }
}

function set(v: Exclude<Consent, ''>): void {
  try { localStorage.setItem(CONSENT_KEY, v) } catch { /* ignore */ }
  listeners.forEach(l => l())
}

export function acceptCookies(): void { set('accepted') }
export function declineCookies(): void { set('declined') }

// Two SSR snapshots for two different needs, sharing one client store:

// Banner: assume "decided" on the server so returning visitors never see a
// flash of the banner before hydration re-reads localStorage.
const serverDecided = (): Consent => 'accepted'
export function useConsentBanner(): Consent {
  return useSyncExternalStore(subscribe, getSnapshot, serverDecided)
}

// Analytics: never assume consent on the server. GA mounts client-side only,
// and only once the stored choice is explicitly 'accepted'.
const serverUnset = (): Consent => ''
export function useConsentGA(): Consent {
  return useSyncExternalStore(subscribe, getSnapshot, serverUnset)
}
