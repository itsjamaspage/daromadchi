// Pure decision for the apex→www canonical-host redirect used by proxy.ts.
// Extracted into its own module (no next-auth / db imports) so it can be
// unit-tested in isolation — without depending on production being reachable.
//
// Returns the https://www URL to 301-redirect to, or null to pass through.
// Rules (must stay loop-safe and POST-safe):
//   • only the exact apex host `daromadchi.uz` redirects — www / localhost /
//     anything else passes through, so an already-www request never loops;
//   • `/api/` is never redirected — a 301 can turn a POST into a GET and drop
//     the body, and the extension/API clients POST to those routes.
export function apexToWwwRedirect(
  host: string | null | undefined,
  url: { href: string; pathname: string },
): URL | null {
  if ((host ?? '').toLowerCase() !== 'daromadchi.uz') return null
  if (url.pathname.startsWith('/api/')) return null
  const dest = new URL(url.href)
  dest.protocol = 'https:'
  dest.host = 'www.daromadchi.uz'
  dest.port = ''
  return dest
}
