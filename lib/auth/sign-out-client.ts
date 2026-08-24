'use client'

/**
 * The one sign-out flow, for every place that offers a sign-out button.
 *
 * It exists because there were two. The desktop menu
 * (components/dashboard/DashboardTopBar.tsx) and the mobile account dropdown
 * (components/dashboard/MobileNav.tsx) each carried their own copy of this
 * handler, so the cookie-scope fix in #323 landed on one and left the other
 * still looping — mobile sign-out stayed broken while the bug looked fixed.
 * Two copies of a security-relevant flow will drift again; one will not.
 *
 * The three steps, and why each is needed:
 *
 *  1. Auth.js signOut() — its own session events and CSRF handling. `redirect:
 *     false` because v5 builds an absolute redirect URL from AUTH_URL, and a
 *     stale value there sends the browser to the wrong host.
 *
 *  2. The cookie sweep — Auth.js deletes the session cookie using the options
 *     configured TODAY, and a browser that signed in before the cookie was
 *     scoped to the parent domain still holds a host-only cookie of the same
 *     name that survives. See lib/auth/cookie-sweep.ts.
 *
 *  3. /login?signedout=1 — tells the login page to render the form rather than
 *     honour a session it may still see for a moment, so a cookie that has not
 *     finished clearing cannot bounce the user straight back in.
 *
 * Both network steps are best-effort. If either fails we still navigate away:
 * leaving the user stranded in the dashboard is a worse outcome than a
 * sign-out that did not fully take, and step 3 means they land on the form
 * either way.
 */
import { signOut } from 'next-auth/react'

export async function signOutEverywhere(): Promise<void> {
  await signOut({ redirect: false }).catch(() => {})
  await fetch('/api/auth/signout-sweep', { method: 'POST', cache: 'no-store' }).catch(() => {})
  window.location.assign('/login?signedout=1')
}
