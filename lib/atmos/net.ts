/**
 * Pure network helpers for the ATMOS callback: IPv4 CIDR matching and extracting
 * the real client IP from behind the VPS reverse proxy. No side effects — fully
 * unit-testable.
 */

// Parse an IPv4 dotted-quad to a uint32, or null if malformed.
export function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    n = (n << 8) | octet
  }
  return n >>> 0
}

// True iff `ip` falls within the IPv4 `cidr` (e.g. "92.63.207.0/24").
export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt === null || baseInt === null) return false
  if (bits === 0) return true
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

// The originating client IP for a request that traversed the reverse proxy.
// ATMOS's callback hits nginx/PM2, so the true source is the LEFTMOST entry of
// X-Forwarded-For; fall back to a directly-observed address when there is no XFF.
export function clientIpFromForwarded(xff: string | null | undefined, fallback?: string | null): string | null {
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return fallback?.trim() || null
}
