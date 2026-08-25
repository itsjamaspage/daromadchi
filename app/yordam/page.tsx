import { permanentRedirect } from 'next/navigation'

// /yordam is the Uzbek-language alias for /help. It is a permanent rename, not
// a temporary detour, so it answers 308 rather than the 307 that
// `redirect()` sends: a 307 tells a crawler the alias may become its own page
// again later, which leaks the link equity /help should be consolidating.
//
// 308 over 301 because both are permanent and 308 also preserves the request
// method — matching the www→apex redirect in proxy.ts, which is method-safe for
// the same reason (see lib/seo/canonical-host.ts).
export default function YordamPage() {
  permanentRedirect('/help')
}
