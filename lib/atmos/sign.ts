/**
 * ATMOS callback signature.
 *
 * Per the ATMOS billing-callback doc, the `sign` field is a hash of
 *   store_id + transaction_id + account + amount + api_key
 * concatenated WITHOUT any separators. The doc does NOT state the hash algorithm.
 *
 * ⚠️ FLAG: the algorithm defaults to MD5 here and MUST be confirmed with ATMOS
 * before go-live (some deployments use SHA-1/SHA-256). It's isolated behind
 * ATMOS_SIGN_ALGO so a confirmation is a one-line change.
 *
 * ⚠️ FLAG: the `amount` in the sign must be byte-identical to what ATMOS sends in
 * the callback. We therefore verify using the amount FIELD FROM the callback
 * payload verbatim (not our stored value) so tiyin-vs-so'm formatting can't break
 * verification. A SEPARATE check (in the callback handler) confirms that same
 * amount equals the amount we intended to charge.
 */

import { createHash, timingSafeEqual } from 'crypto'

// TODO(atmos): confirm the hash algorithm with ATMOS before go-live.
export const ATMOS_SIGN_ALGO = 'md5'

export interface SignParts {
  storeId: string
  transactionId: string
  account: string
  amount: string | number
  apiKey: string
}

// The exact pre-hash string: fields joined with NO separators, in doc order.
export function buildSignPayload(p: SignParts): string {
  return `${p.storeId}${p.transactionId}${p.account}${p.amount}${p.apiKey}`
}

export function computeSign(p: SignParts): string {
  return createHash(ATMOS_SIGN_ALGO).update(buildSignPayload(p), 'utf8').digest('hex')
}

// Constant-time comparison of the callback's `sign` against the recomputed one.
// Case-insensitive on the hex; length-mismatch and non-hex fail closed.
export function verifySign(providedSign: string, p: SignParts): boolean {
  if (typeof providedSign !== 'string' || providedSign.length === 0) return false
  const expected = computeSign(p)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(providedSign.trim().toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
