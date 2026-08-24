/**
 * Every scope a session cookie of ours could have been written under.
 *
 * ── The bug ─────────────────────────────────────────────────────────────────
 * Signing out appeared to work and then landed the user straight back in the
 * dashboard. Nothing re-authenticated them: the session cookie was never
 * cleared, and /login bounces anyone with a live session onward
 * (app/login/page.tsx). So the loop is a SURVIVING cookie, not a new login.
 *
 * It survives because one name can exist twice in the same browser at
 * different scopes. lib/auth/config.ts pins the cookie to `.daromadchi.uz` so
 * one login works on the apex and on www — but that scoping was added after
 * the fact, and a browser that logged in before it still holds a HOST-ONLY
 * cookie of the same name. Cookies are matched on (name, domain, path), so the
 * browser sends both and Auth.js's own sign-out — which deletes using the
 * currently configured options — removes only the domain-scoped one. The
 * host-only leftover keeps validating.
 *
 * A deletion must therefore be attempted under EVERY scope the cookie could
 * have been written with, not just today's. Expiring a cookie that does not
 * exist is a no-op, so over-sweeping is free; under-sweeping is what locked
 * people in.
 *
 * ── Why the names are listed rather than derived ────────────────────────────
 * `__Secure-` is prefixed only in production, so a cookie written by an older
 * build, a preview deploy, or a local run can carry either form. We clear both
 * regardless of the current NODE_ENV: the risk of leaving one behind is a user
 * who cannot sign out, and the cost of clearing one that was never set is
 * nothing.
 */

/** Cookie names Auth.js may have used for the session and its callback URL. */
export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  // Pre-v5 names, in case a long-lived browser still carries one.
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
] as const

/**
 * Domain scopes to attempt, given the host the sign-out request arrived on.
 *
 * `undefined` means host-only (no Domain attribute) — a DIFFERENT cookie from
 * one scoped to the parent domain, which is the whole point.
 */
export function domainScopesFor(host: string | null | undefined): (string | undefined)[] {
  const scopes: (string | undefined)[] = [undefined]           // host-only
  const hostname = (host ?? '').split(':')[0].trim().toLowerCase()
  if (!hostname || hostname === 'localhost') return scopes

  // An IP literal has no cookie-domain hierarchy to walk up.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return scopes

  // Walk up the labels: www.daromadchi.uz → daromadchi.uz, and the dot-prefixed
  // form of each, since a cookie can be stored either way. Stop before the
  // public suffix — no browser accepts a Domain of `.uz`, and asking to delete
  // one is meaningless.
  const parts = hostname.split('.')
  for (let i = 0; i + 1 < parts.length; i++) {
    const candidate = parts.slice(i).join('.')
    if (candidate.split('.').length < 2) break
    scopes.push(candidate, `.${candidate}`)
  }
  return scopes
}

/**
 * `Set-Cookie` values that expire one cookie under one scope.
 *
 * Path is always `/` because that is the only path our config writes. Both
 * Secure and non-Secure variants are emitted: a `__Secure-`-prefixed cookie is
 * only accepted WITH the flag, and a cookie originally set without it is only
 * matched without — so sending one form alone can miss.
 */
export function expiredCookieHeaders(host: string | null | undefined): string[] {
  const out: string[] = []
  for (const name of SESSION_COOKIE_NAMES) {
    for (const domain of domainScopesFor(host)) {
      const base = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
      const withDomain = domain ? `${base}; Domain=${domain}` : base
      out.push(withDomain)
      // A `__Secure-` cookie is REJECTED without the flag, so the secure form
      // is the only one that can clear it.
      out.push(`${withDomain}; Secure`)
    }
  }
  return out
}
