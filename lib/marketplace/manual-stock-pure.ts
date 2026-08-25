/**
 * Pure logic for the read-only "update your stock manually" reminder — no DB, no
 * network, no server imports, so it is unit-testable in isolation (like
 * stock-allocation.ts). The DB/dispatch wrapper lives in manual-stock-notify.ts.
 */

import { computeAvailable, type SyncMember } from '@/lib/marketplace/stock-allocation'
import { notifT, type NotifLang } from '@/lib/notif-i18n'
import type { MarketplaceType } from '@/lib/types'

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex Market' }
export function mpLabel(mp: string): string { return MP_LABEL[mp] ?? mp }

// Status marker written into stock_notify_state.last_status for manual-reminder
// rows, keeping them distinct from edit-mode write outcomes ('sent'/'fail').
export const MANUAL_STATUS = 'manual'

export interface ManualReminder {
  sku: string
  target: number             // the number the seller must set by hand
  marketplace: MarketplaceType
}

/**
 * Given one SKU group's members, return the manual reminders for its read-only
 * listings that are out of sync. Empty unless the group spans ≥2 marketplaces (a
 * single-marketplace group has no sibling to reconcile against).
 *
 * Target = computeAvailable(members) — the shared free-to-sell, applied to every
 * read-only listing (mirror-always). A member is "out of sync" when its currently
 * listed number differs from that target.
 */
export function computeManualReminders(members: SyncMember[]): ManualReminder[] {
  const marketplaces = new Set(members.map(m => m.marketplace))
  if (marketplaces.size < 2) return []          // not cross-marketplace → nothing to reconcile

  const target = computeAvailable(members)
  const out: ManualReminder[] = []
  for (const m of members) {
    if (m.apiMode !== 'read_only') continue     // only read-only listings get a manual reminder
    if (!m.sku) continue                        // no human SKU to name → skip (unidentifiable)
    if (m.listedStock === target) continue      // already correct → no reminder
    out.push({ sku: m.sku, target, marketplace: m.marketplace })
  }
  return out
}

/**
 * Should we send a reminder for this (sku, marketplace) at this target, given the
 * last-notified fingerprint? Fire when there is no prior MANUAL fingerprint or the
 * target value changed. Silent while the same divergence persists unchanged.
 */
export function shouldRemind(
  prior: { status: string | null; target: number | null } | null | undefined,
  target: number,
): boolean {
  if (!prior) return true
  if (prior.status !== MANUAL_STATUS) return true
  return prior.target !== target
}

/**
 * Build the one grouped reminder message. Header + one line per listing to fix.
 * First line is the phone-notification preview.
 */
export function buildManualMessage(items: ManualReminder[], lang: NotifLang = 'uz'): string {
  const T = notifT(lang)
  const lines: string[] = [T.manualStockTitle(items.length)]
  for (const it of items) lines.push(T.manualStockLine(it.sku, it.target, mpLabel(it.marketplace)))
  return lines.join('\n')
}
