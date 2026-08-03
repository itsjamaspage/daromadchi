// Shared text-similarity helpers. Used by the category matcher
// (lib/categories/matcher.ts) and the product-group suggester
// (lib/products/group-suggester.ts) so both score identically — Cyrillic→Latin
// folding + token-set Jaccard — instead of duplicating the logic.

const CYR_TO_LAT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
  'ъ': "'", 'ы': 'i', 'ь': "'", 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'ў': "o'", 'қ': "q", 'ғ': "g'", 'ҳ': "h",
}

export function cyrillicToLatin(text: string): string {
  return text.toLowerCase().split('').map((ch) => CYR_TO_LAT[ch] ?? ch).join('')
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

export function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter(Boolean))
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Token-set Jaccard between two free-text strings, taking the best of the raw
 * and transliterated forms (so a Cyrillic title and its Latin equivalent still
 * match). Range 0..1.
 */
export function titleSimilarity(a: string, b: string): number {
  const j1 = jaccard(tokenize(a), tokenize(b))
  const j2 = jaccard(tokenize(cyrillicToLatin(a)), tokenize(cyrillicToLatin(b)))
  return Math.max(j1, j2)
}
