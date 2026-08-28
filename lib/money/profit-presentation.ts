/**
 * How confidently the dashboard may state a profit, given how much of the
 * counted revenue is uncosted. Pure: no DB, no React — the boundary maths lives
 * here so it can be tested and can't drift between the card and a future caller.
 *
 * ── Why a profit with missing cost is not a fact ────────────────────────────
 * net = revenue − commission − cost, and cost ≥ 0. So when cost is unknown, the
 * figure the card would show (revenue − commission) is an UPPER BOUND on the
 * real profit, not the profit. A seller who has entered no costs sees a large,
 * confident number that is really gross margin wearing a net-profit label.
 *
 * The response is tiered by the share of counted revenue that is uncosted:
 *   • 0            → the number is exact. Show it.
 *   • 0 < s < 40%  → the bound is nearly tight. Show the number with a small
 *                    "cost not set" note — honest and not alarmist.
 *   • 40% ≤ s <100%→ material. Show it as "≤ X": correct at any share, and it
 *                    stops the number from being read as settled profit.
 *   • s = 100%     → no counted sale is costed; the figure carries no profit
 *                    information at all. Show no number, ask for costs instead.
 */

export type ProfitTier =
  /** Show the net figure. `warnMissingCost` adds the small "cost not set" note. */
  | { kind: 'exact'; warnMissingCost: boolean }
  /** Show the figure as an upper bound ("≤ X"). */
  | { kind: 'bounded' }
  /** Show no number — every counted soʼm is uncosted. */
  | { kind: 'suppressed' }

export const COST_MISSING_MATERIAL = 0.40

export function profitTier(input: {
  countedRevenue: number
  costMissingRevenue: number
  /** Share at/above which a partial missing cost flips to the "≤ X" bound. */
  materialThreshold?: number
}): ProfitTier {
  const { countedRevenue, costMissingRevenue } = input
  const threshold = input.materialThreshold ?? COST_MISSING_MATERIAL

  // Nothing counted, or a clamp against bad inputs: no arithmetic to qualify.
  if (countedRevenue <= 0) return { kind: 'exact', warnMissingCost: false }

  // Missing cost can't exceed the counted revenue it sits on; treat ≥ as 100%.
  if (costMissingRevenue >= countedRevenue) return { kind: 'suppressed' }

  const share = Math.max(0, costMissingRevenue) / countedRevenue
  if (share >= threshold) return { kind: 'bounded' }
  return { kind: 'exact', warnMissingCost: share > 0 }
}
