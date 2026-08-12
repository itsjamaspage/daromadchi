/**
 * USD → UZS foreign-exchange rate for pricing display.
 *
 * Subscription prices are denominated in USD (lib/billing/plans.ts); the pricing
 * page shows them in UZS converted at the live rate. This helper fetches the rate
 * from a free, key-less FX API at most once per day (via Next's data cache) and
 * falls back to a conservative constant if the fetch fails — so the page always
 * renders a sane so'm price and never shows a stale hardcoded number.
 *
 * Server-only: relies on `fetch` with Next's `revalidate` cache and is imported
 * solely by the server-rendered pricing page.
 */

// Fallback rate used ONLY when the live fetch fails (network error, bad payload,
// non-2xx). A round number near the current market rate — intentionally not a
// precise value we'd have to keep updating.
export const FALLBACK_USD_UZS = 12_600

const FX_URL = 'https://open.er-api.com/v6/latest/USD'
const ONE_DAY_SECONDS = 60 * 60 * 24

interface ErApiResponse {
  result?: string
  rates?: Record<string, number>
}

/**
 * Current USD→UZS rate, refreshed at most once a day. Never throws — returns
 * FALLBACK_USD_UZS on any failure so callers can render unconditionally.
 */
export async function getUsdToUzsRate(): Promise<number> {
  try {
    const res = await fetch(FX_URL, { next: { revalidate: ONE_DAY_SECONDS } })
    if (res.ok) {
      const data = (await res.json()) as ErApiResponse
      const rate = data?.rates?.UZS
      if (data.result === 'success' && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        return rate
      }
    }
  } catch {
    // fall through to the fallback below
  }
  return FALLBACK_USD_UZS
}
