/**
 * The dashboard's money formatter — one copy, so the KPI cards, the category
 * breakdown and anything else that shows a soʼm figure read identically.
 *
 * "315 000" → "315 ming soʼm", "1 500 000" → "1.5 mln soʼm", "800" → "800 soʼm".
 *
 * This is the CURRENCY formatter. The compact axis-tick formatter in
 * RevenueChart ("45K" / "1.2M", no currency) is a different job on purpose and
 * is not this — don't fold them together.
 */
export function formatSum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + " mln so'm"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '')     + " ming so'm"
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}
