/**
 * Pure logic for the read-only "update your stock manually" reminder — no DB, no
 * network, no server imports, so it is unit-testable in isolation (like
 * stock-allocation.ts). The DB/dispatch wrapper lives in manual-stock-notify.ts.
 */

import { computeAvailable, type SyncMember } from '@/lib/marketplace/stock-allocation'
import { notifT, type NotifLang } from '@/lib/notif-i18n'
import { COLOR_LABELS } from '@/lib/products/resolveColor'
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
  title?: string | null      // products.title — the human name
  colorKey?: string | null   // products.variant_color — resolved key, localized at render
  orderId?: string | null    // the sale that moved this group (orders.order_id_external)
  orderMarketplace?: MarketplaceType | null  // where that sale happened — see GroupIdentity
}

/**
 * Identity for one SKU group — the same physical product on every marketplace,
 * so one set of these covers the whole group.
 *
 * Deliberately a separate argument rather than fields on SyncMember: that type
 * is shared with the edit-mode write path, and widening it to carry display
 * copy would put presentation concerns into the allocation maths.
 */
export interface GroupIdentity {
  title?: string | null
  colorKey?: string | null
  orderId?: string | null
  /**
   * Where that sale happened. The selling marketplace decrements its OWN listing
   * once the seller accepts the order for shipping — nobody has to touch it by
   * hand — so a reminder naming it is at best noise and at worst an instruction
   * to overwrite a number the marketplace is already maintaining. Reminders are
   * for the OTHER side of the group: the listing that knows nothing about the
   * sale and still shows the pre-sale figure.
   */
  orderMarketplace?: MarketplaceType | null
}

/** Localize a resolved colour key. Unknown keys are omitted, never shown raw. */
function colorLabel(key: string | null | undefined, lang: NotifLang): string | null {
  if (!key) return null
  return (COLOR_LABELS as Record<string, Record<string, string>>)[key]?.[lang] ?? null
}

/**
 * "M9 (чёрный, JMBLK)" — name first, because that is what the seller recognises
 * on a phone; the SKU is what they type into the marketplace, so it stays, just
 * not as the headline. Degrades to the bare SKU when there is no title.
 */
export function productLabel(r: ManualReminder, lang: NotifLang): string {
  const name = r.title?.trim()
  const color = colorLabel(r.colorKey, lang)
  if (!name) return r.sku
  const inner = [color, r.sku].filter(Boolean).join(', ')
  return `${name} (${inner})`
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
export function computeManualReminders(members: SyncMember[], identity: GroupIdentity = {}): ManualReminder[] {
  const marketplaces = new Set(members.map(m => m.marketplace))
  if (marketplaces.size < 2) return []          // not cross-marketplace → nothing to reconcile

  const target = computeAvailable(members)
  const out: ManualReminder[] = []
  for (const m of members) {
    if (m.apiMode !== 'read_only') continue     // only read-only listings get a manual reminder
    if (!m.sku) continue                        // no human SKU to name → skip (unidentifiable)
    // The marketplace the sale came from maintains its own stock — see
    // GroupIdentity.orderMarketplace. Telling the seller to set it by hand is
    // noise next to the listing that genuinely needs a human.
    if (identity.orderMarketplace && m.marketplace === identity.orderMarketplace) continue
    if (m.listedStock === target) continue      // already correct → no reminder
    out.push({ sku: m.sku, target, marketplace: m.marketplace, ...identity })
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
  for (const it of items) {
    lines.push(T.manualStockLine(productLabel(it, lang), it.target, mpLabel(it.marketplace), it.orderId ?? null))
  }
  // Why this message exists at all. A seller who never opted into edit mode has
  // no way to know the app COULD have done this for them, and one line at the
  // foot is the only place that fact is ever in front of them.
  lines.push('', T.manualStockFooter)
  return lines.join('\n')
}
