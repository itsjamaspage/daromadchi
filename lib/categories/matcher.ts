import { TAXONOMY, type CanonicalCategory } from './taxonomy'
import { cyrillicToLatin, normalizeText as normalize, tokenize, jaccard } from '@/lib/shared/text-similarity'

// Re-exported so existing importers (matcher.test.ts, scripts) keep working
// after the helpers moved to lib/shared/text-similarity.ts.
export { cyrillicToLatin }

export type MatchTier = 'exact' | 'substring' | 'token_set'

export interface MatchResult {
  canonical_id: string
  score: number
  tier: MatchTier
}

function getAllTerms(cat: CanonicalCategory): string[] {
  const all: string[] = []
  for (const lang of ['ru', 'uz', 'en'] as const) {
    all.push(cat.name[lang])
    all.push(...cat.terms[lang])
  }
  for (const mp of ['uzum', 'yandex_market'] as const) {
    all.push(...cat.raw_examples[mp])
  }
  return all
}

export function matchCategory(rawCategory: string): MatchResult | null {
  const input = normalize(rawCategory)
  const inputLatin = cyrillicToLatin(input)
  if (!input || input.length < 3) return null

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

    // Tier 2: substring match (base 0.85, longer term = higher score)
    for (let i = 0; i < normalizedTerms.length; i++) {
      const term = normalizedTerms[i]
      const termLat = latinTerms[i]
      let matchLen = 0
      if (term.length >= 4 && (input.includes(term) || term.includes(input))) {
        matchLen = term.length
      } else if (termLat.length >= 4 && (inputLatin.includes(termLat) || termLat.includes(inputLatin))) {
        matchLen = termLat.length
      }
      if (matchLen > 0) {
        const score = 0.85 + matchLen / 10000
        if (!best || score > best.score) {
          best = { canonical_id: cat.id, score, tier: 'substring' }
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

      if (j >= 0.5) {
        const score = Math.round(j * 800) / 1000
        if (!best || score > best.score) {
          best = { canonical_id: cat.id, score, tier: 'token_set' }
        }
      }
    }
  }

  return best
}
