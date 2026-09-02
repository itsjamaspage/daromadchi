import { resolveWithFallback, lookupTaxonomy } from '@/lib/categories/resolve'
import type { Lang } from '@/lib/i18n'

export const ALL_CAT = '__all__'

export function catKey(raw: string | null, title?: string | null): string {
  const r = resolveWithFallback(raw, title)
  return r ? r.canonical_id : (raw || '')
}

export function catDisplay(raw: string | null, lang: Lang, title?: string | null): string {
  const r = resolveWithFallback(raw, title)
  if (!r) return raw || '—'
  return lang === 'uz' ? r.name_uz : lang === 'en' ? r.name_en : r.name_ru
}

export function catKeyLabel(key: string, lang: Lang): string {
  const cat = lookupTaxonomy(key)
  if (cat) return lang === 'uz' ? cat.name.uz : lang === 'en' ? cat.name.en : cat.name.ru
  return key
}

export function buildCategoryList(items: { category?: string | null; title?: string | null }[]): string[] {
  const seen = new Set<string>()
  const cats: string[] = []
  for (const p of items) {
    const k = catKey(p.category ?? null, p.title ?? null)
    if (!k || seen.has(k)) continue
    seen.add(k); cats.push(k)
  }
  return [ALL_CAT, ...cats]
}
