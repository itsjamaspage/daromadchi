/**
 * What one order actually earned. Pure: no DB, no network, no framework.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 * Three separate screens computed profit three different ways, and two of them
 * could not tell "zero" from "don't know":
 *
 *   • Yandex publishes commission ONLY in the netting report, days after
 *     delivery, so orders.marketplace_fee is NULL until then (by design — see
 *     lib/yandex/sync.ts). Reading that NULL as a zero fee returns the order's
 *     whole revenue as profit. It put "Чистая прибыль = Общая выручка = 115 000"
 *     on the dashboard for a sale nobody had been paid for.
 *   • A product with no cost_price contributes nothing to COGS, so it shows as
 *     pure profit at 100% margin. The seller's powerbanks read exactly that.
 *
 * Both are the same mistake: an absent value coerced to 0, then presented as a
 * fact. Both are too high, and both look confident.
 *
 * `Known<T>` makes the mistake unwritable. An unknown fee is not a number, so it
 * cannot be added to one — the compiler stops you, and every caller has to say
 * out loud what it does about the gap. Callers may EXCLUDE the order and name
 * what is missing, or show a warning, or render a dash. What none of them can do
 * any more is quietly call it zero.
 *
 * The guardrail in order-economics.guardrail.test.ts keeps it that way: the
 * coalesce-to-zero patterns are banned outside this module.
 */

export type UnknownReason =
  /** The marketplace has not reported this order's commission yet. */
  | 'fee_not_reported'
  /** The seller has not entered a cost price for something in this order. */
  | 'cost_not_set'

export type Known<T> =
  | { known: true; value: T }
  | { known: false; reason: UnknownReason }

export const known = <T>(value: T): Known<T> => ({ known: true, value })
export const notKnown = <T>(reason: UnknownReason): Known<T> => ({ known: false, reason })

/** Sum, or the first reason it cannot be summed. Unknowns are contagious. */
export function addKnown(...parts: Known<number>[]): Known<number> {
  let total = 0
  for (const p of parts) {
    if (!p.known) return p
    total += p.value
  }
  return known(total)
}

/** One order, as the money layer sees it. Nulls mean "not reported", never 0. */
export interface OrderInput {
  /** orders.revenue — what the buyer paid. Always known once delivered. */
  revenue: number
  /** orders.marketplace_fee. NULL until the marketplace reports it. */
  marketplaceFee: number | null
  /**
   * Where `marketplaceFee` came from.
   *
   * `'derived'` means WE estimated it, not that the marketplace reported it.
   * lib/uzum/sync.ts has a fallback that takes (revenue − shop balance) as the
   * total fee and spreads it across orders in proportion to revenue when Uzum's
   * finance feed returns nothing. That number is a guess, and a guess written
   * into the same column as a fact is exactly the coercion Known<T> exists to
   * prevent — so it is treated as `fee_not_reported`, not as a known fee.
   *
   * Undefined or null is read as 'reported', which is what every row carried
   * before the column existed.
   */
  feeSource?: 'reported' | 'derived' | null
  /** orders.delivery_cost. NULL alongside the fee. */
  deliveryCost: number | null
  /**
   * Net from the settlement feed, when a row exists for this order. Beats the
   * stored estimate: it is what the marketplace actually paid.
   */
  settlementNet?: number | null
  /**
   * Σ(quantity × cost_price) for the order's items, or null when ANY item has
   * no cost price. Null rather than a partial sum on purpose — a total missing
   * one product's cost is not a smaller cost, it is an unknown one.
   */
  cogs: number | null
}

export interface OrderEconomics {
  revenue: number
  /** What the marketplace kept: revenue − what it paid out. */
  fees: Known<number>
  cogs: Known<number>
  /** revenue − fees − cogs. Known only when both of those are. */
  net: Known<number>
}

/**
 * Money is known when the marketplace has reported it — a settlement row, or a
 * fee stored at sync time. A missing fee is `fee_not_reported`, never 0.
 */
export function orderEconomics(o: OrderInput): OrderEconomics {
  const revenue = o.revenue

  const fees: Known<number> =
    o.settlementNet != null ? known(revenue - o.settlementNet)
    // A DERIVED fee is not a fee. Settlement net above is real (it is what the
    // marketplace actually paid), and a reported fee is real; an estimate we
    // computed ourselves is an answer we do not have, however confident the
    // number looks sitting in the column next to the real ones.
    : o.marketplaceFee != null && o.feeSource !== 'derived'
      ? known(o.marketplaceFee + (o.deliveryCost ?? 0))
    : notKnown('fee_not_reported')

  const cogs: Known<number> = o.cogs != null ? known(o.cogs) : notKnown('cost_not_set')

  const net: Known<number> =
    !fees.known ? fees
    : !cogs.known ? cogs
    : known(revenue - fees.value - cogs.value)

  return { revenue, fees, cogs, net }
}

/** One group of orders left out of a total, and why. */
export interface ExcludedGroup {
  key: string
  reason: UnknownReason
  revenue: number
  orders: number
}

export interface PeriodTotals {
  /** Every order in the period, whether or not its money is known. */
  revenue: number
  /** Revenue behind the totals below — the orders that count. */
  countedRevenue: number
  fees: number
  cogs: number
  /** countedRevenue − fees − cogs. */
  net: number
  /** Group keys that contributed to the totals. */
  counted: string[]
  /** Orders left OUT because the marketplace has not reported their money. */
  excluded: ExcludedGroup[]
  /**
   * Orders counted with a cost of zero because the seller has not entered one.
   * The net is OVERSTATED by however much those goods cost, and the caller has
   * to say so.
   */
  costMissing: { orders: number; revenue: number }
}

/**
 * Total a period.
 *
 * ── The two unknowns are not the same, and are not treated the same ─────────
 * Collapsing them was tempting and wrong. They differ in who can act:
 *
 *   fee_not_reported — the marketplace has not published the commission yet.
 *     Nothing the seller can do; the number will arrive on its own. Counting
 *     the order would mean inventing a fee, so the order is EXCLUDED and named:
 *     "Ожидает расчёта: Yandex Market (115 000)".
 *
 *   cost_not_set — the seller has not entered what the goods cost. They can fix
 *     it in a minute, and excluding the order would leave someone who has never
 *     entered a cost staring at a profit of zero forever, which teaches nothing.
 *     So the order is COUNTED with a cost of zero — the only arithmetic
 *     available — and the total is flagged as overstated with the count of
 *     orders behind it.
 *
 * Both stay visible. Neither is silently zeroed. The difference is that one
 * says "wait" and the other says "do something", which is the difference that
 * matters to the person reading the screen.
 *
 * An excluded order takes its COGS with it: keeping the cost while dropping the
 * income would charge a cost against revenue the total does not contain.
 */
export function sumEconomics(orders: (OrderInput & { key: string })[]): PeriodTotals {
  let revenue = 0, countedRevenue = 0, fees = 0, cogs = 0
  let costMissingOrders = 0, costMissingRevenue = 0
  const counted = new Set<string>()
  const excluded = new Map<string, ExcludedGroup>()

  for (const o of orders) {
    revenue += o.revenue
    const e = orderEconomics(o)

    if (!e.fees.known) {
      const id = `${o.key}::${e.fees.reason}`
      const g = excluded.get(id) ?? { key: o.key, reason: e.fees.reason, revenue: 0, orders: 0 }
      g.revenue += o.revenue; g.orders += 1
      excluded.set(id, g)
      continue
    }

    counted.add(o.key)
    countedRevenue += o.revenue
    fees += e.fees.value
    if (e.cogs.known) {
      cogs += e.cogs.value
    } else {
      costMissingOrders += 1
      costMissingRevenue += o.revenue
    }
  }

  return {
    revenue,
    countedRevenue,
    fees,
    cogs,
    net: countedRevenue - fees - cogs,
    counted: [...counted].sort(),
    excluded: [...excluded.values()].sort((a, b) => a.key.localeCompare(b.key)),
    costMissing: { orders: costMissingOrders, revenue: costMissingRevenue },
  }
}
