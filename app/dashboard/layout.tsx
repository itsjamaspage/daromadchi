import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'
import MobileNav from '@/components/dashboard/MobileNav'
import BottomNav from '@/components/dashboard/BottomNav'
import FeedbackWidget from '@/components/dashboard/FeedbackWidget'
import ChannelGate from '@/components/dashboard/ChannelGate'
import { getCurrentUser } from '@/lib/auth/session'
import { getStockAlerts } from '@/lib/db/alerts'
import { lockedNavKeys } from '@/lib/billing/nav-gating'
import { getActiveNotice } from '@/lib/billing/nudge'
import NudgeBanner from '@/components/dashboard/NudgeBanner'
import EnterpriseOutreachModal from '@/components/dashboard/EnterpriseOutreachModal'
import FrozenGate from '@/components/dashboard/FrozenGate'
import { isFrozen } from '@/lib/billing/lifecycle'

// Keep the entire authenticated dashboard out of search. Inherited by every
// /dashboard/* route → <meta name="robots" content="noindex, nofollow">.
// Paired with allowing the crawl in robots.ts so Google can actually read this.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Require a real session to enter the dashboard. Without this, an
  // unrecognised session (e.g. a mobile browser whose cookie isn't being sent)
  // fell through to a misleading empty "connect your store" dashboard instead
  // of a login prompt — the proxy's route gate is a no-op (its '/' public route
  // matches every path), so this layout is where the dashboard is actually
  // gated. Loop-safe: we redirect only when there is NO session at all, so a
  // valid session that resolves a user never bounces back to /login.
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = await getCurrentUser()

  // Total in-app notifications shown as a badge next to the theme toggle.
  // Currently the notifications page surfaces stock alerts, so the count is
  // simply how many alerts the seller has right now. Best-effort: a DB hiccup
  // must never break the whole dashboard shell, so fall back to 0.
  let notificationCount = 0
  try {
    notificationCount = (await getStockAlerts()).length
  } catch { /* best-effort — show no badge on failure */ }

  // Which sidebar entries lead to a locked page. Computed here, in the one
  // server component every dashboard route already renders, so the nav marks
  // them instead of letting a seller walk into a wall with no warning.
  //
  // Best-effort, like the alert count above: this only decorates the nav, and a
  // DB hiccup must not take the whole dashboard shell down. Failing open costs
  // nothing — every gated page re-checks entitlement itself.
  let locked: string[] = []
  try {
    locked = await lockedNavKeys(user?.id ?? null)
  } catch { /* best-effort — show no locks on failure */ }

  // The newest nudge the seller has not dismissed. Best-effort for the same
  // reason as the two above: this is a suggestion, and nothing about the
  // dashboard should fail because a suggestion could not be loaded.
  let notice: Awaited<ReturnType<typeof getActiveNotice>> = null
  try {
    if (user?.id) notice = await getActiveNotice(user.id)
  } catch { /* best-effort — show no banner on failure */ }

  // A frozen account sees the restore screen instead of the dashboard. NOT
  // best-effort in the other direction: if this lookup fails we show the
  // dashboard, because locking a paying seller out on a DB hiccup is far worse
  // than a frozen one seeing their data for another day.
  let frozen = false
  try {
    if (user?.id) frozen = await isFrozen(user.id)
  } catch { /* on failure, do not gate */ }

  return (
    <ChannelGate>
      <div className="min-h-screen">
        {/* Desktop sidebar — icon-only (56px), hover-expands to 240px over content */}
        <div className="hidden lg:block fixed left-0 top-0 h-full z-40">
          <Sidebar lockedKeys={locked} />
        </div>

        {/* Desktop top bar — profile pill + dropdown */}
        <DashboardTopBar userName={user?.full_name ?? user?.email?.split('@')[0] ?? 'User'} userEmail={user?.email ?? ''} notificationCount={notificationCount} />

        {/* Mobile: top bar with hamburger + slide-in drawer */}
        <MobileNav lockedKeys={locked} />

        {/* Main content — offset by collapsed sidebar width only */}
        <main className="lg:ml-14 pt-14 pb-20 lg:pb-0 min-w-0">
          <div className="p-4 sm:p-6 lg:p-8">
            {frozen ? <FrozenGate /> : <>
            {/* Above the page, not over it: a seller who has just been told
                their trial is ending is trying to use the product. */}
            {notice && notice.kind !== 'enterprise_outreach' && (
              <NudgeBanner kind={notice.kind} detail={notice.detail} />
            )}
            {/* The one nudge that interrupts — see the component for why. */}
            {notice?.kind === 'enterprise_outreach' && (
              <EnterpriseOutreachModal detail={notice.detail} />
            )}
            {children}
            </>}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <BottomNav lockedKeys={locked} />

        {/* Feedback widget — right side */}
        <FeedbackWidget />
      </div>
    </ChannelGate>
  )
}
