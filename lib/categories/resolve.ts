import { TAXONOMY } from './taxonomy'
import { matchCategory } from './matcher'

export interface ResolvedCategory {
  canonical_id: string
  name_ru: string
  name_uz: string
  name_en: string
}

const taxonomyById = new Map(TAXONOMY.map(c => [c.id, c]))

const cache = new Map<string, ResolvedCategory | null>()

export function resolveCanonical(rawCategory: string): ResolvedCategory | null {
  const cached = cache.get(rawCategory)
  if (cached !== undefined) return cached

  const match = matchCategory(rawCategory)
  if (!match) {
    cache.set(rawCategory, null)
    return null
  }

  const cat = taxonomyById.get(match.canonical_id)
  if (!cat) {
    cache.set(rawCategory, null)
    return null
  }

  const resolved: ResolvedCategory = {
    canonical_id: match.canonical_id,
    name_ru: cat.name.ru,
    name_uz: cat.name.uz,
    name_en: cat.name.en,
  }
  cache.set(rawCategory, resolved)
  return resolved
}

export function resolveWithFallback(
  rawCategory: string | null,
  titleFallback?: string | null,
): ResolvedCategory | null {
  if (rawCategory) {
    const r = resolveCanonical(rawCategory)
    if (r) return r
  }
  if (titleFallback) return resolveCanonical(titleFallback)
  return null
}

export function canonicalName(rawCategory: string, lang: 'ru' | 'uz' | 'en' = 'ru'): string {
  const resolved = resolveCanonical(rawCategory)
  if (!resolved) return rawCategory
  return resolved[`name_${lang}`]
}

export function lookupTaxonomy(slug: string) {
  return taxonomyById.get(slug)
}
