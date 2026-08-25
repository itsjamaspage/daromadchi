/**
 * The sitemap must declare every page the site asks to have indexed.
 *
 * It did not. This file listed 7 URLs while 43 pages carried a self-referential
 * canonical — /cookies and all 35 help articles were absent, and Google found
 * them by crawling links instead of being told they existed.
 *
 * The rule these tests enforce: a page that declares `alternates.canonical` is
 * asking to be indexed, so it belongs in the sitemap. Adding an indexable page
 * without a sitemap entry now fails here rather than quietly under-declaring the
 * site for however long it takes someone to compare two numbers in Search
 * Console.
 *
 * Run: node --import tsx --test app/sitemap.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sitemap from './sitemap'
import robots from './robots'
import { getAllSlugs } from '../lib/help-content'

const APP_DIR = new URL('.', import.meta.url).pathname
const ORIGIN = 'https://daromadchi.uz'

const entries = sitemap()
const paths = entries.map(e => new URL(e.url).pathname)
const pathSet = new Set(paths)

/** Every page/layout file under app/, excluding API routes. */
function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'api' || name === 'node_modules') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) routeFiles(full, acc)
    else if (/^(page|layout)\.tsx$/.test(name)) acc.push(full)
  }
  return acc
}

/**
 * Literal canonical paths declared across the app.
 *
 * Template-literal canonicals (the `/help/${slug}` in the dynamic route) are
 * deliberately skipped — a regex cannot expand them. They get their own,
 * stronger check against getAllSlugs() below.
 */
function declaredCanonicals(): string[] {
  const found: string[] = []
  for (const file of routeFiles(APP_DIR)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/canonical:\s*'([^'`$]*)'/g)) found.push(m[1])
  }
  return [...new Set(found)]
}

test('every page declaring a canonical is in the sitemap', () => {
  const missing = declaredCanonicals().filter(p => !pathSet.has(p === '/' ? '/' : p))
  assert.deepEqual(missing, [],
    `these pages ask to be indexed but are not declared: ${missing.join(', ')}`)
})

test('every help article is in the sitemap', () => {
  const slugs = getAllSlugs()
  assert.ok(slugs.length > 0, 'no help articles found — the check would pass vacuously')
  const missing = slugs.filter(s => !pathSet.has(`/help/${s}`))
  assert.deepEqual(missing, [], `help articles missing from the sitemap: ${missing.join(', ')}`)
})

test('the sitemap contains no duplicates and nothing off-origin', () => {
  assert.equal(new Set(entries.map(e => e.url)).size, entries.length, 'duplicate URL in sitemap')
  for (const e of entries) {
    assert.equal(new URL(e.url).origin, ORIGIN, `${e.url} is not on the canonical origin`)
  }
})

test('no sitemap URL is disallowed by robots.txt', () => {
  // Declaring a URL and then forbidding its crawl is a contradiction Search
  // Console reports as an error, not a warning.
  const disallowed = [robots().rules].flat().flatMap(r => [r?.disallow ?? []].flat())
  for (const p of paths) {
    for (const rule of disallowed) {
      assert.ok(!p.startsWith(rule), `${p} is in the sitemap but robots.txt disallows ${rule}`)
    }
  }
})

test('no entry carries a lastModified the build cannot substantiate', () => {
  // `new Date()` at build time stamps the deploy date on every page, telling
  // crawlers the whole site changed on every ship. Omitted until a real
  // per-page edit date exists — see the comment in sitemap.ts.
  const stamped = entries.filter(e => e.lastModified !== undefined).map(e => e.url)
  assert.deepEqual(stamped, [],
    `these entries carry a lastModified with no real source behind it: ${stamped.join(', ')}`)
})
