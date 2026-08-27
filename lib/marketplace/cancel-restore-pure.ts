/**
 * Pure logic for the read-only "restore your listing after cancel" alert — no DB,
 * no network, no server imports, so it is unit-testable in isolation. The DB
 * dispatch wrapper lives in cancel-restore-alert.ts.
 *
 * When a read-only seller cancels an order, the marketplace does NOT put the unit
 * back on the listing — it's physically on the shelf but unsellable. We compare
 * the current listing to the reservation-time snapshot (the restore target) and
 * tell the seller either to fix it (ACTION) or that it fixed itself (INFO).
 */

import { notifT, type NotifLang } from '@/lib/notif-i18n'
import type { MarketplaceType } from '@/lib/types'

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex Market' }
export function mpLabel(mp: string): string { return MP_LABEL[mp] ?? mp }

export type RestoreVariant = 'action' | 'info'

/** One cancelled order eligible for the alert. `before` = reservation-time
 *  snapshot (restore target); `after` = current listing; `qty` = units ordered. */
export interface RestoreCandidate {
  orderId: string
  marketplace: MarketplaceType
  sku: string
  name: string
  before: number
  after: number
  qty: number
}

/**
 * ACTION when the listing is still short by at least the order qty (the unit
 * didn't come back); INFO when it's back at/above the snapshot (the marketplace
 * restored it). A partial recovery (between the two) is treated as ACTION — still
 * short, still worth restoring.
 */
export function pickVariant(before: number, after: number, qty: number): RestoreVariant {
  return after >= before ? 'info' : 'action'
}

export interface RestoreGroup {
  marketplace: MarketplaceType
  variant: RestoreVariant
  items: RestoreCandidate[]
}

/**
 * Batch candidates into one message per (marketplace, variant): several
 * cancellations in the window collapse into a single grouped message. Returns the
 * groups plus every order id to stamp (at-most-once), in a stable order.
 */
export function planRestoreAlerts(candidates: RestoreCandidate[]): { groups: RestoreGroup[]; orderIds: string[] } {
  const byKey = new Map<string, RestoreGroup>()
  for (const c of candidates) {
    const variant = pickVariant(c.before, c.after, c.qty)
    const key = `${c.marketplace}:${variant}`
    let g = byKey.get(key)
    if (!g) { g = { marketplace: c.marketplace, variant, items: [] }; byKey.set(key, g) }
    g.items.push(c)
  }
  const groups = [...byKey.values()]
  const orderIds = candidates.map(c => c.orderId)
  return { groups, orderIds }
}

/** Assemble one Telegram message for a group. Single-order groups get the full
 *  explanatory body; multi-order groups get one line per order + one closing. */
export function buildRestoreMessage(group: RestoreGroup, lang: NotifLang = 'uz'): string {
  const T = notifT(lang)
  const mp = mpLabel(group.marketplace)
  const title = group.variant === 'action' ? T.restoreActionTitle : T.restoreInfoTitle

  if (group.items.length === 1) {
    const it = group.items[0]
    const head = T.restoreOrderCancelled(it.orderId, it.name, it.sku, mp)
    if (group.variant === 'action') {
      return `${title}\n\n${head}\n\n${T.restoreActionDetail(mp, it.before, it.after)} ${T.restoreActionNote}\n\n${T.restoreActionCta(mp, it.before)}`
    }
    return `${title}\n\n${head}\n${T.restoreInfoDetail(mp, it.after)}`
  }

  const lines = group.items.map(it => T.restoreLine(it.sku, it.before, it.after)).join('\n')
  const closing = group.variant === 'action'
    ? `${T.restoreActionNote} ${T.restoreActionCtaMulti(mp)}`
    : T.restoreInfoNoteMulti(mp)
  return `${title}\n\n${T.restoreMpGroup(mp)}\n${lines}\n\n${closing}`
}
