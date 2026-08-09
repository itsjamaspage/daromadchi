'use client'

import { GoogleAnalytics } from '@next/third-parties/google'
import { useConsentGA } from '@/lib/cookie-consent'

// Measurement ID comes from env only (never hardcoded). NEXT_PUBLIC_* is inlined
// at build time, so this must be set in the environment when the app is built.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

/**
 * Loads Google Analytics 4 via @next/third-parties, but ONLY when every gate passes:
 *   1. running in production (NODE_ENV === 'production') — so dev traffic isn't tracked
 *   2. a Measurement ID is configured in env
 *   3. the visitor has explicitly accepted analytics cookies
 *
 * Rendering nothing until consent means the gtag.js script is never even fetched
 * for visitors who decline or haven't chosen yet. No PII (emails, user IDs, shop
 * names) is ever passed to GA — only default, anonymous page-view collection.
 */
export default function Analytics() {
  const consent = useConsentGA()

  if (process.env.NODE_ENV !== 'production') return null
  if (!GA_ID) return null
  if (consent !== 'accepted') return null

  return <GoogleAnalytics gaId={GA_ID} />
}
