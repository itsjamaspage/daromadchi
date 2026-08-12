/**
 * ATMOS API result + error types.
 *
 * Every ATMOS response carries a `result` object { code, description }. Success
 * is code "OK"; anything else is an error we surface with its code + description.
 *
 * ⚠️ FLAG: the STPIMS-ERR-* code catalogue below is a STARTER map to fill in from
 * the ATMOS error table — only "OK" is relied on for the success/failure branch.
 * Unknown codes map to a generic error carrying the raw code so nothing is
 * silently swallowed.
 */

export interface AtmosResult {
  code: string
  description?: string
}

export interface AtmosResponse<T = unknown> {
  result: AtmosResult
  // Endpoint-specific payload fields live alongside `result`.
  data?: T
  [key: string]: unknown
}

export const ATMOS_OK_CODE = 'OK'

// Human labels for known codes. TODO(atmos): complete from the official table.
export const ATMOS_ERROR_LABELS: Record<string, string> = {
  OK: 'success',
  // 'STPIMS-ERR-001': '…',
}

export class AtmosApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly description: string,
    public readonly httpStatus?: number,
  ) {
    super(`ATMOS ${code}: ${description}`)
    this.name = 'AtmosApiError'
  }
}

export function isOkResult(result: AtmosResult | undefined | null): boolean {
  return !!result && result.code === ATMOS_OK_CODE
}
