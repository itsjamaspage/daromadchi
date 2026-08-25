/**
 * What Daromadchi shows for a product's price and stock: the seller's override
 * where they set one, the marketplace's number otherwise.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 * It used to be exported from AnalyticsProductTable.tsx, which carries
 * 'use client'. Next.js replaces EVERY export of a client module with a client
 * reference, so the server component that imported it was not calling a
 * function at all — it was calling a proxy, and the page threw at request time
 * with "Attempted to call effective() from the server". It compiled and built
 * cleanly; only a real request could show it.
 *
 * So this file deliberately has NO 'use client' directive: it is plain shared
 * logic that both the server page and the client table import. Any future
 * helper both sides need belongs here too, for the same reason.
 *
 * ── Why overrides are layered here, not in the query ────────────────────────
 * They are NOT folded into Product.selling_price / available_stock at the
 * query layer, because those feed the stock engine, turnover, the oversell
 * path and the Products page — a display preference set on Analytics must not
 * reach any of them.
 */
import type { Product } from '@/lib/types'

export interface EffectiveValues {
  price: number
  cost: number
  stockQty: number
  priceOverridden: boolean
  stockOverridden: boolean
}

export function effective(p: Product): EffectiveValues {
  // `!= null` and not a truthiness check: 0 is a real override. A seller must
  // be able to say "I have none of this" and "this is free", and a falsy test
  // would silently read either as "no override set".
  const priceOverridden = p.price_override != null
  const stockOverridden = p.stock_override != null
  return {
    price:    priceOverridden ? Number(p.price_override) : Number(p.selling_price ?? 0),
    cost:     Number(p.cost_price ?? 0),
    stockQty: stockOverridden ? Number(p.stock_override) : p.available_stock,
    priceOverridden,
    stockOverridden,
  }
}
