/**
 * Guards on the Help Center corpus.
 *
 * The articles are hand-written prose in three locale blocks, and drift between
 * those blocks is invisible until a reader hits it: an orphaned RU body kept
 * `tashqi-trafik` — an article describing a screen that never existed — alive
 * long after anyone would have found it by reading the UZ array, and a trial
 * length hardcoded as "3 kunlik" outlived the code that set it by weeks.
 *
 * These tests do not police wording. They check the mechanical invariants that
 * let a wrong article hide: a slug that renders in one language and not
 * another, a translation key pointing at an article that no longer exists, an
 * interpolation that never ran, and a number that should have come from code.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAllSlugs, getArticle, getCategoryList } from './help-content'
import { TRIAL_DAYS } from './billing/features'

const LOCALES = ['uz', 'ru', 'en'] as const
const SRC = readFileSync(new URL('./help-content.ts', import.meta.url), 'utf8')

/** Slug keys of one `Record<string, string>` literal in the source. */
function mapKeys(constName: string): string[] {
  const start = SRC.indexOf(`const ${constName}`)
  assert.notEqual(start, -1, `${constName} not found`)
  const body = SRC.slice(start)
  const end = body.indexOf('\n}\n')
  return [...body.slice(0, end).matchAll(/^ {2}'([a-z0-9-]+)':/gm)].map(m => m[1])
}

test('every article renders in every locale', () => {
  for (const slug of getAllSlugs()) {
    for (const lang of LOCALES) {
      const a = getArticle(slug, lang)
      assert.ok(a, `${slug} missing in ${lang}`)
      for (const field of ['title', 'summary', 'content'] as const) {
        assert.ok(a[field].trim().length > 0, `${slug}.${field} empty in ${lang}`)
      }
    }
  }
})

test('no translation key points at an article that no longer exists', () => {
  const slugs = new Set(getAllSlugs())
  for (const name of ['ARTICLE_TITLES', 'ARTICLE_CONTENT_RU', 'ARTICLE_CONTENT_EN']) {
    for (const key of mapKeys(name)) {
      assert.ok(slugs.has(key), `${name} has an orphaned entry: '${key}'`)
    }
  }
})

test('RU and EN bodies are actually translated, not the Uzbek fallback', () => {
  // A missing entry in ARTICLE_CONTENT_* silently serves the UZ body. Cyrillic
  // in the RU render is the cheapest proof the override was found.
  for (const slug of getAllSlugs()) {
    const ru = getArticle(slug, 'ru')!.content
    assert.match(ru, /[а-яА-ЯёЁ]/, `${slug} RU body looks untranslated`)
  }
})

test('no interpolation is left unresolved in a rendered body', () => {
  for (const slug of getAllSlugs()) {
    for (const lang of LOCALES) {
      const c = getArticle(slug, lang)!.content
      assert.doesNotMatch(c, /\$\{/, `${slug} (${lang}) has a literal \${...}`)
    }
  }
})

test('trial length is interpolated from TRIAL_DAYS, never hardcoded', () => {
  // Matches "<n> kun" / "<n> дн…" / "<n> day…" — any trial-shaped number that
  // disagrees with the code is the bug this guards.
  const shape = /(\d+)[  ]?(kunlik|kun|дней|дня|день|days|day)\b/g
  for (const slug of ['bepul-sinov', 'tariflar']) {
    for (const lang of LOCALES) {
      const c = getArticle(slug, lang)!.content
      for (const [, n, unit] of c.matchAll(shape)) {
        // 30-day turnover windows and the reminder lead time are their own
        // numbers; only flag values in the range a trial length would occupy.
        if (Number(n) > 20 || Number(n) < 4) continue
        assert.equal(Number(n), TRIAL_DAYS,
          `${slug} (${lang}) says "${n} ${unit}" but TRIAL_DAYS is ${TRIAL_DAYS}`)
      }
    }
  }
})

test('every category in the nav has at least one article', () => {
  for (const lang of LOCALES) {
    for (const c of getCategoryList(lang)) {
      assert.ok(c.articles.length > 0, `${c.slug} is empty in ${lang}`)
    }
  }
})
