/**
 * Legacy → current SKU aliases for order↔product re-linking.
 *
 * When a seller renames an article (the product-card SKU changes), orders that
 * were placed under the OLD article keep arriving from the marketplace with the
 * pre-rename SKU forever. Without a mapping those order lines never resolve to
 * the (renamed) product and re-orphan (product_id → NULL) on every re-sync.
 *
 * Extend LEGACY_SKU_ALIASES when a rename happens. Keys are the UPPER-CASED core
 * article AFTER any numeric marketplace prefix is stripped (e.g. the "JMJ16BEG"
 * in "5124786-JMJ16BEG"); values are the current products.sku article.
 */
export const LEGACY_SKU_ALIASES: Record<string, string> = {
  JMJ16BEG: 'JMJ16BG',
  JMM99: 'JMWHT',
}

/**
 * Uzum order lines carry the seller article in several shapes:
 *   "5124786-JMJ16BEG"     numeric marketplace prefix + article
 *   "5124786-JMM99-БЕЛЫЙ"  prefix + legacy article + colour suffix
 *   "JMWHT"                already the clean current article
 *
 * Produce an ordered, de-duped list of candidate lookup keys to try against
 * products.sku: the alias of the prefix-stripped value and of its core (the part
 * before the first '-') come FIRST, then the raw prefix-stripped / core / original
 * strings. That way a legacy article re-links to its renamed product, while a
 * current article still matches exactly. Pure; never throws; [] for empty input.
 */
export function canonicalSkuCandidates(raw: string | null | undefined): string[] {
  if (raw == null) return []
  const s0 = String(raw).trim()
  if (!s0) return []
  const stripped = s0.replace(/^\d+-/, '')   // drop a leading "5124786-" prefix
  const core = stripped.split('-')[0]        // "JMM99" from "JMM99-БЕЛЫЙ"
  const out: string[] = []
  const add = (v: string): void => {
    const t = v.trim()
    if (!t) return
    const alias = LEGACY_SKU_ALIASES[t.toUpperCase()]
    if (alias && !out.includes(alias)) out.push(alias)
    if (!out.includes(t)) out.push(t)
  }
  add(stripped)
  add(core)
  add(s0)
  return out
}
