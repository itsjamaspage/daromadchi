/**
 * The server-side door to hasFeature().
 *
 * lib/billing/features.ts is deliberately pure — it takes a row and answers a
 * question. This module is the half that touches the database: it loads the
 * entitlement row for a user and answers the same question by id, so a page, an
 * API route and a cron job all reach the rule the same way instead of each
 * writing its own plan check. Adding a fourth copy of "is this account paid?"
 * is exactly what the spec set out to stop.
 *
 * Nothing here reads users.derived_tier. That column is a RECOMMENDATION built
 * from turnover; entitlement is what the seller paid for. Letting the
 * recommendation grant access would hand a high-turnover free account the paid
 * product without a payment.
 */
/**
 * Plan entitlement rules against the database.
 *
 * DELIBERATELY FREE OF THE AUTH STACK. Every function here takes an explicit
 * userId. The one that did not — currentUserAccess, which resolves the signed-in
 * user — now lives in ./current-user-access, because importing
 * lib/db/shop-context dragged in lib/auth/session → lib/auth/config → next-auth
 * → next/navigation, and that chain cannot be loaded outside Next's own runtime:
 * plain node dies on next/headers ("cannot be imported from a Client Component")
 * and --conditions=react-server dies on React's server build having no
 * createContext.
 *
 * The cost was that entitlement.integration.test.ts could not run at all, so the
 * plan-gating rules were the one part of the suite CI had to skip. Billing rules
 * have no business depending on how a request is authenticated; keeping this
 * module importable is what makes them testable.
 */
import { eq, and, ne, or, isNull } from 'drizzle-orm'
import { db, users, shops } from '@/lib/db'
import { hasFeature, isOnTrial, type EntitlementInput, type Feature } from './features'

/** Load the four fields entitlement depends on. Nothing else is selected. */
export async function loadEntitlement(userId: string): Promise<EntitlementInput> {
  const [row] = await db.select({
    plan: users.plan,
    plan_expires_at: users.plan_expires_at,
    trial_ends_at: users.trial_ends_at,
    is_grandfathered: users.is_grandfathered,
  }).from(users).where(eq(users.id, userId))

  return {
    plan: row?.plan ?? 'free',
    planExpiresAt: row?.plan_expires_at ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
    isGrandfathered: row?.is_grandfathered ?? false,
  }
}

/** May this user use `feature` right now? */
export async function userHasFeature(userId: string, feature: Feature, now: Date = new Date()): Promise<boolean> {
  return hasFeature(await loadEntitlement(userId), feature, now)
}

/** What a gated page needs to render: the verdict, plus why it was refused. */

/**
 * True when the account has no shop that stock-sync could ever write to.
 *
 * The Stocks page survives a gate as long as ONE active shop is in stock_sync
 * mode — that seller still has live write-back to look at, and hiding the page
 * would take away something they can see working. A seller whose shops are all
 * read_only never had write-back at all, so after the trial the page has
 * nothing left to show them and becomes an upgrade prompt.
 *
 * DEMO shops are excluded the same way lib/api/auth.ts excludes them, so a
 * seeded demo store cannot decide a real seller's gate.
 */
export async function everyActiveShopIsReadOnly(userId: string): Promise<boolean> {
  const rows = await db.select({ api_mode: shops.api_mode }).from(shops).where(and(
    eq(shops.user_id, userId),
    eq(shops.is_active, true),
    or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')),
  ))
  // No shops at all counts as read-only: there is nothing syncing, so the page
  // would be empty either way and the upgrade prompt is the more useful screen.
  return rows.every(r => r.api_mode !== 'stock_sync')
}
