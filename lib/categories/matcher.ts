import { TAXONOMY, type CanonicalCategory } from './taxonomy'

export type MatchTier = 'exact' | 'substring' | 'token_set'

export interface MatchResult {
  canonical_id: string
  score: number
  tier: MatchTier
}

const CYR_TO_LAT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
  'ъ': "'", 'ы': 'i', 'ь': "'", 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'ў': "o'", 'қ': "q", 'ғ': "g'", 'ҳ': "h",
}

export function cyrillicToLatin(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join('')
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function getAllTerms(cat: CanonicalCategory): string[] {
  const all: string[] = []
  for (const lang of ['ru', 'uz', 'en'] as const) {
    all.push(cat.name[lang])
    all.push(...cat.terms[lang])
  }
  for (const mp of ['uzum', 'wildberries', 'yandex_market'] as const) {
    all.push(...cat.raw_examples[mp])
  }
  return all
}

export function matchCategory(rawCategory: string): MatchResult | null {
  const input = normalize(rawCategory)
  const inputLatin = cyrillicToLatin(input)
  if (!input) return null

  let best: MatchResult | null = null

  for (const cat of TAXONOMY) {
    const allTerms = getAllTerms(cat)
    const normalizedTerms = allTerms.map(normalize)
    const latinTerms = normalizedTerms.map(cyrillicToLatin)

    // Tier 1: exact match (score 1.0)
    for (let i = 0; i < normalizedTerms.length; i++) {
      if (input === normalizedTerms[i] || inputLatin === latinTerms[i]) {
        return { canonical_id: cat.id, score: 1.0, tier: 'exact' }
      }
    }

    // Tier 2: substring match (score 0.85)
    for (let i = 0; i < normalizedTerms.length; i++) {
      const term = normalizedTerms[i]
      const termLat = latinTerms[i]
      if (
        (term.length >= 4 && (input.includes(term) || term.includes(input))) ||
        (termLat.length >= 4 && (inputLatin.includes(termLat) || termLat.includes(inputLatin)))
      ) {
        if (!best || 0.85 > best.score) {
          best = { canonical_id: cat.id, score: 0.85, tier: 'substring' }
        }
      }
    }

    // Tier 3: token_set Jaccard (score 0.5–0.8)
    const inputTokens = tokenize(rawCategory)
    const inputTokensLatin = tokenize(cyrillicToLatin(rawCategory))

    for (let i = 0; i < normalizedTerms.length; i++) {
      const termTokens = tokenize(allTerms[i])
      const termTokensLatin = tokenize(cyrillicToLatin(allTerms[i]))

      const j1 = jaccard(inputTokens, termTokens)
      const j2 = jaccard(inputTokensLatin, termTokensLatin)
      const j = Math.max(j1, j2)

      if (j >= 0.4) {
        const score = Math.round(j * 800) / 1000
        if (!best || score > best.score) {
          best = { canonical_id: cat.id, score, tier: 'token_set' }
        }
      }
    }
  }

  return best
}
