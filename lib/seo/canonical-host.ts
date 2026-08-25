// Pure decision for the www→apex canonical-host redirect used by proxy.ts.
// Extracted into its own module (no next-auth / db imports) so it can be
// unit-tested in isolation — without depending on production being reachable.
//
// The canonical host is the APEX, `daromadchi.uz`. This module used to send the
// opposite way (apex→www) and was reversed with the canonicals: metadataBase,
// the sitemap and robots.txt all name the apex, so a middleware that redirected
// apex→www would have pointed crawlers away from every URL the site declares.
// The two must always agree — if the canonical host ever moves again, it moves
// here and in app/layout.tsx together.
//
// Returns the https apex URL to 301-redirect to, or null to pass through.
// Rules (must stay loop-safe and POST-safe):
//   • only the exact host `www.daromadchi.uz` redirects — the apex itself,
//     localhost and any other subdomain pass through, so a request already on
//     the apex never loops;
//   • `/api/` is never redirected — a 301 can turn a POST into a GET and drop
//     the body, and the extension/API clients POST to those routes.
const CANONICAL_HOST = 'daromadchi.uz'
const WWW_HOST = `www.${CANONICAL_HOST}`

export function wwwToApexRedirect(
  host: string | null | undefined,
  url: { href: string; pathname: string },
): URL | null {
  // Behind a proxy the forwarded host can carry a port (`www.daromadchi.uz:443`),
  // which would otherwise fail the equality check and silently skip the redirect.
  const bare = (host ?? '').toLowerCase().split(':')[0]
  if (bare !== WWW_HOST) return null
  if (url.pathname.startsWith('/api/')) return null
  const dest = new URL(url.href)
  dest.protocol = 'https:'
  dest.host = CANONICAL_HOST
  dest.port = ''
  return dest
}
