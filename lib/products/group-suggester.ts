// Pure product-group candidate scorer — NO DB, NO marketplace calls.
// Given a user's products (across their shops), it proposes cross-marketplace
// pairs that look like the SAME physical product, each with a score, tier, and
// the signals that fired. It NEVER auto-merges — the script/API only ever writes
// a `pending` suggestion for a human to approve.
//
// Hard rules baked in here:
//   • Cross-marketplace only (a.marketplace !== b.marketplace).
//   • Different match_key only. Same normalized SKU already auto-groups in
//     computeStockGroups, so it's not a candidate — which is ALSO why an
//     "identical normalized SKU" booster can never fire here (kept as a recorded
//     signal for transparency; the live booster is identical BARCODE).
//   • NEVER prefix-match a SKU (JMM9 vs JMM99). Keys are compared by exact
//     normalized equality; SKUs only ever act as an exact-equal booster.
//   • Colour gate: two KNOWN, DIFFERENT colours are never the same variant.

import { resolveColor } from '@/lib/products/resolveColor'
import { tokenize, jaccard, cyrillicToLatin } from '@/lib/shared/text-similarity'

export type SuggestTier = 'strong' | 'likely' | 'weak'

export interface SuggesterProduct {
  id: string
  shopId: string
  marketplace: string
  matchKey: string                 // normalizeKey(sku) — or `#<id>` when no SKU
  sku: string | null
  title: string
  category: string | null          // raw marketplace category
  canonicalCategoryId: number | null // resolved via category_aliases, when available
  price: number | null
  barcode: string | null           // products.market_barcode (Uzum string barcode)
}

export interface CandidateSignals {
  colorA: string | null
  colorB: string | null
  colorMatch: boolean              // both known AND equal (tie-breaker only, not a score booster)
  categoryMatch: boolean           // canonical-equal, or raw-string-equal (tie-breaker only)
  titleSim: number                 // DISTINCTIVE-token Jaccard (colour/category words stripped), 0..1
  priceRatio: number | null        // max/min, null when a price is missing
  priceOk: boolean                 // within the 30% band (or unknown)
  barcodeMatch: boolean            // both known AND equal (strong identity signal)
  skuMatch: boolean                // structurally always false for candidates (see note above)
}

export interface GroupCandidate {
  aProductId: string
  bProductId: string
  aMatchKey: string                // canonical (sorted) order — a <= b
  bMatchKey: string
  score: number                    // 0..1
  tier: SuggestTier
  signals: CandidateSignals
}

const PRICE_BAND = 0.30            // ±30%
const MIN_SCORE = 0.35            // below this it's not worth suggesting
const MIN_TITLE_LEN = 3          // mirror the matcher's 3-char guard
// Distinctive-title floor: a pair must share real distinguishing tokens (model
// code, etc.) — colour + category alone can't qualify it. A barcode match is an
// independent strong identity signal that bypasses the floor.
const TITLE_FLOOR = 0.34

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function tierFor(score: number): SuggestTier {
  if (score >= 0.85) return 'strong'
  if (score >= 0.6) return 'likely'
  return 'weak'
}

function nonBlank(s: string | null | undefined): string | null {
  const v = (s ?? '').trim()
  return v.length > 0 ? v : null
}

// Tokens that actually distinguish a product: title tokens with the category's
// own tokens and any colour word removed. resolveColor(token) !== null flags a
// colour word (in any language / inflection), so "белые"/"oq"/"white" drop out
// while a model code like "jmm99" survives. This is what demotes colour/category
// from score-inflating signals to mere gates/tie-breakers.
function distinctiveTokens(title: string, category: string | null): { raw: Set<string>; lat: Set<string> } {
  const cat = category ? tokenize(category) : new Set<string>()
  const raw = new Set<string>()
  const lat = new Set<string>()
  for (const tok of tokenize(title)) {
    if (cat.has(tok)) continue
    if (resolveColor(tok) !== null) continue
    raw.add(tok)
    lat.add(cyrillicToLatin(tok))
  }
  return { raw, lat }
}

function distinctiveTitleSim(a: SuggesterProduct, b: SuggesterProduct): number {
  const da = distinctiveTokens(a.title, a.category)
  const db = distinctiveTokens(b.title, b.category)
  return Math.max(jaccard(da.raw, db.raw), jaccard(da.lat, db.lat))
}

/**
 * Score a single ordered pair (already gated to cross-marketplace,
 * different-match-key). Returns null when the pair fails a hard gate or scores
 * below MIN_SCORE.
 */
export function scorePair(a: SuggesterProduct, b: SuggesterProduct): GroupCandidate | null {
  if ((a.title ?? '').trim().length < MIN_TITLE_LEN || (b.title ?? '').trim().length < MIN_TITLE_LEN) return null

  const colorA = resolveColor(a.title)?.key ?? null
  const colorB = resolveColor(b.title)?.key ?? null
  const bothColorsKnown = !!colorA && !!colorB
  // Colour GATE: two known, different colours are different variants → drop.
  if (bothColorsKnown && colorA !== colorB) return null
  const colorMatch = bothColorsKnown && colorA === colorB

  // Category GATE: if both categories are known and differ (canonical-aware) → drop.
  let categoryMatch = false
  if (a.canonicalCategoryId != null && b.canonicalCategoryId != null) {
    if (a.canonicalCategoryId !== b.canonicalCategoryId) return null
    categoryMatch = true
  } else if (a.category != null && b.category != null) {
    if (a.category.trim().toLowerCase() !== b.category.trim().toLowerCase()) return null
    categoryMatch = true
  }

  // Boosters. A mismatch/absence NEVER rules a pair out (real data has
  // mismatched barcodes/SKUs across markets) — it just doesn't add.
  const bcA = nonBlank(a.barcode), bcB = nonBlank(b.barcode)
  const barcodeMatch = !!bcA && !!bcB && bcA === bcB
  const skuMatch = a.matchKey === b.matchKey // never true here (different keys gate)

  // (a) TITLE FLOOR: score on DISTINCTIVE tokens, and require a real distinctive
  // overlap (or a barcode match) before a pair can qualify at all. This is what
  // kills "two different white earphones" — they share only colour+category,
  // whose tokens are stripped, so their distinctive similarity is ~0.
  const titleSim = distinctiveTitleSim(a, b)
  if (titleSim < TITLE_FLOOR && !barcodeMatch) return null

  // Price sanity: within ±30%. Missing price → can't check → treat as OK.
  const pa = a.price, pb = b.price
  let priceRatio: number | null = null
  let priceOk = true
  if (pa != null && pb != null && pa > 0 && pb > 0) {
    priceRatio = Math.max(pa, pb) / Math.min(pa, pb)
    priceOk = priceRatio <= 1 + PRICE_BAND
  }

  // (b) Colour/category are GATES + TIE-BREAKERS only, never score boosters —
  // nearly every candidate already shares them (they're gated), so they carry no
  // discriminating weight. Base = distinctive title sim; barcode is the one real
  // additive identity signal.
  let score = titleSim
  if (barcodeMatch) score += 0.25
  if (colorMatch) score += 0.02          // tie-breaker nudge only
  if (categoryMatch) score += 0.02       // tie-breaker nudge only
  if (!bothColorsKnown) score *= 0.9     // mild discount when a colour is unknown
  if (!priceOk) score *= 0.40            // heavy penalty, not a hard drop
  score = clamp01(score)

  if (score < MIN_SCORE) return null

  // Canonical sorted order so a pair is stored once, never in both directions.
  const [aKey, bKey, aId, bId] = a.matchKey <= b.matchKey
    ? [a.matchKey, b.matchKey, a.id, b.id]
    : [b.matchKey, a.matchKey, b.id, a.id]

  return {
    aProductId: aId, bProductId: bId, aMatchKey: aKey, bMatchKey: bKey,
    score: Math.round(score * 1000) / 1000, tier: tierFor(score),
    signals: { colorA, colorB, colorMatch, categoryMatch, titleSim: Math.round(titleSim * 1000) / 1000, priceRatio: priceRatio == null ? null : Math.round(priceRatio * 100) / 100, priceOk, barcodeMatch, skuMatch },
  }
}

/**
 * Generate all candidate pairs for one user's products. Cross-marketplace and
 * different-match-key only; de-duplicated by canonical (a_match_key,b_match_key);
 * highest score wins when the same key-pair is reachable via multiple products.
 */
export function suggestGroups(products: SuggesterProduct[]): GroupCandidate[] {
  const best = new Map<string, GroupCandidate>()
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i], b = products[j]
      if (a.marketplace === b.marketplace) continue      // cross-marketplace only
      if (a.matchKey === b.matchKey) continue             // already auto-grouped
      const cand = scorePair(a, b)
      if (!cand) continue
      const key = `${cand.aMatchKey}::${cand.bMatchKey}`
      const prev = best.get(key)
      if (!prev || cand.score > prev.score) best.set(key, cand)
    }
  }
  return [...best.values()].sort((x, y) => y.score - x.score)
}
