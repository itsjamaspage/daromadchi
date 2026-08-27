import { getCurrentUserId } from '@/lib/db/shop-context'
import { loadEntitlement } from './entitlement'
import { hasFeature, isOnTrial, type Feature } from './features'

/**
 * The signed-in user's access — the one entitlement helper that needs a session.
 *
 * Split out of ./entitlement so THAT module stays importable outside Next's
 * runtime. getCurrentUserId reaches lib/auth/session → lib/auth/config →
 * next-auth → next/navigation, which cannot be loaded by a plain test process;
 * keeping it here means the rules can be tested and only the thin
 * session-resolving wrapper cannot.
 */
export interface FeatureAccess {
  allowed: boolean
  /** True when access is running on the trial clock rather than a payment. */
  onTrial: boolean
  /** True when a trial existed and has run out — "you lost this", not "you never had this". */
  trialEnded: boolean
}

/**
 * The signed-in user's access to `feature`.
 *
 * A signed-out caller is refused rather than thrown at: these run inside
 * dashboard pages that the proxy has already authenticated, so a missing id
 * means the session went away mid-request, and a locked panel is a better
 * answer than a 500.
 */
export async function currentUserAccess(feature: Feature, now: Date = new Date()): Promise<FeatureAccess> {
  const userId = await getCurrentUserId()
  if (!userId) return { allowed: false, onTrial: false, trialEnded: false }
  const entitlement = await loadEntitlement(userId)
  const ends = entitlement.trialEndsAt == null ? null : new Date(entitlement.trialEndsAt)
  return {
    allowed: hasFeature(entitlement, feature, now),
    onTrial: isOnTrial(entitlement, now),
    trialEnded: ends !== null && !Number.isNaN(ends.getTime()) && ends <= now,
  }
}
