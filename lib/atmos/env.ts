/**
 * ATMOS credentials + endpoints. All secrets come from ENV — never hardcoded,
 * never logged. Validated LAZILY (on first use), so a missing var fails a single
 * payment attempt with a clear error instead of crashing the app at boot or
 * breaking the build in environments without payment creds.
 *
 * ── ENV VARS (confirm the exact credentials you hold map to these) ──
 *   ATMOS_CONSUMER_KEY      OAuth consumer key      (client_credentials)
 *   ATMOS_CONSUMER_SECRET   OAuth consumer secret
 *   ATMOS_STORE_ID          merchant store_id       (used in invoice + sign)
 *   ATMOS_CALLBACK_API_KEY  api_key for verifying the callback `sign` (NOT the
 *                           OAuth secret — a separate ATMOS secret)
 *   ATMOS_AUTH_URL          OAuth token endpoint    (default partner.atmos.uz/token)
 *   ATMOS_BASE_URL          API base                (default apigw.atmos.uz)
 *   ATMOS_CALLBACK_CIDR     allowed callback source (default 92.63.207.0/24)
 *   ATMOS_MPS_APIKEY        (Phase 2, Visa/MC only) — not required here
 */

export interface AtmosEnv {
  authUrl: string
  baseUrl: string
  consumerKey: string
  consumerSecret: string
  storeId: string
  callbackApiKey: string
  callbackCidr: string
}

// Unit of the `amount` field ATMOS sends in the billing callback.
//   'tiyin' | 'som' → the callback amount is checked with STRICT equality.
//   'unknown'       → TEMPORARY: the check is non-blocking (accepts tiyin OR
//                     so'm) and logs a WARN on every callback so it reads as an
//                     open question, not a silent accept.
// TODO(atmos): confirm the unit with ATMOS, then set this to 'tiyin' (or 'som').
export type AmountUnit = 'tiyin' | 'som' | 'unknown'
export const ATMOS_CALLBACK_AMOUNT_UNIT: AmountUnit = 'unknown'

export class AtmosConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AtmosConfigError'
  }
}

function required(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new AtmosConfigError(`ATMOS is not configured: missing env var ${name}`)
  return v.trim()
}

export function getAtmosEnv(): AtmosEnv {
  return {
    authUrl:        process.env.ATMOS_AUTH_URL?.trim()      || 'https://partner.atmos.uz/token',
    baseUrl:        process.env.ATMOS_BASE_URL?.trim()      || 'https://apigw.atmos.uz',
    consumerKey:    required('ATMOS_CONSUMER_KEY'),
    consumerSecret: required('ATMOS_CONSUMER_SECRET'),
    storeId:        required('ATMOS_STORE_ID'),
    callbackApiKey: required('ATMOS_CALLBACK_API_KEY'),
    callbackCidr:   process.env.ATMOS_CALLBACK_CIDR?.trim() || '92.63.207.0/24',
  }
}
