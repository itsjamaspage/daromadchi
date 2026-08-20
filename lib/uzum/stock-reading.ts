/**
 * What stock quantity a Uzum listing actually has — pure, no I/O.
 *
 * ── Why this isn't just `quantityActive + quantityFbs` ──────────────────────
 * Uzum reports two things that can disagree. The SKU carries numbers; the CARD
 * carries a lifecycle `status.value`, and when that reads RUN_OUT ("Tugadi" /
 * "Закончился") the seller cabinet shows the listing as out of stock and
 * unsellable. The numbers can still be non-zero in that state because they
 * include buckets like units returned from cancelled orders — physically in the
 * seller's hands, but not re-listable. Trusting the numbers alone showed
 * phantom stock, which is why the sync started forcing 0 on RUN_OUT.
 *
 * ── Why forcing 0 was too strong ────────────────────────────────────────────
 * RUN_OUT is a card-level state that does not flip back the instant a seller
 * restocks a SKU. While it lags, `outOfStock ? 0 : rawStock` rewrote a real
 * quantity to 0 on EVERY heavy pass — so a restocked item read 0 in Daromadchi
 * indefinitely, and no amount of syncing fixed it. That is the worse failure:
 * phantom stock overstates by a few units, but a frozen 0 tells a seller they
 * have nothing to sell while the marketplace is selling it.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * Trust the quantities. A SKU whose live quantity is positive is stocked,
 * whatever the card says; RUN_OUT could only ever have agreed with a zero the
 * numbers already report, so it no longer participates in the number at all.
 * The phantom-stock concern it was added for is real but smaller, and it is
 * addressed where it belongs — the seller sees Uzum's own numbers, the same
 * ones the cabinet shows.
 */

/** The SKU-level fields this decision reads. Both are optional in Uzum's DTO. */
export interface UzumSkuQuantities {
  quantityActive?: number | null
  quantityFbs?: number | null
}

/** Uzum's card lifecycle value meaning "sold out, not sellable". */
export const UZUM_RUN_OUT = 'RUN_OUT'

/** Live units Uzum reports for a SKU, across both fulfilment buckets. */
export function uzumRawStock(sku: UzumSkuQuantities): number {
  const active = Number(sku.quantityActive ?? 0)
  const fbs = Number(sku.quantityFbs ?? 0)
  const total = (Number.isFinite(active) ? active : 0) + (Number.isFinite(fbs) ? fbs : 0)
  // A negative total is not a quantity Uzum can mean; clamp rather than store it.
  return total > 0 ? total : 0
}

/**
 * The quantity to store for this SKU.
 *
 * The card status is NOT a parameter, and that absence is the fix. It used to
 * gate this value; now it can only ever have agreed with a zero the numbers
 * already report, so consulting it would be a branch that cannot change the
 * answer. If Uzum ever exposes a status that means something the quantities do
 * not, it comes back here as a real input rather than as a silent override.
 */
export function uzumStockQuantity(sku: UzumSkuQuantities): number {
  return uzumRawStock(sku)
}
