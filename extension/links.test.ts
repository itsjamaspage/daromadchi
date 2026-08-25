/**
 * Every daromadchi.uz link in the extension must point at a route that exists.
 *
 * The popup shipped six dead links for an unknown number of releases: five had
 * lost their `/dashboard` prefix (`/orders`, `/products`, `/unit-economics`,
 * `/analytics`, `/analytics/stock`) and one — `/analytics/ads` — named a page
 * that was never built. Nothing caught it, because the extension is plain JS
 * outside the Next.js router: a link there is a string, and a wrong string
 * looks exactly like a right one until someone clicks it.
 *
 * This walks the extension source, extracts every daromadchi.uz URL, and
 * resolves it against app/ on disk. A renamed or deleted route now fails here
 * rather than in a user's popup.
 *
 * Run: node --import tsx --test extension/links.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const EXT_DIR = new URL('.', import.meta.url).pathname
const APP_DIR = join(EXT_DIR, '..', 'app')

/** Base constants like `const API = '…/api'` are concatenated with a path at
 *  the call site, so they are not links and cannot be resolved on their own. */
const BASE_CONSTANTS = new Set(['/api'])

interface Link { path: string; file: string }

function extensionLinks(): Link[] {
  const out: Link[] = []
  for (const name of readdirSync(EXT_DIR)) {
    if (!/\.(js|html)$/.test(name)) continue
    const src = readFileSync(join(EXT_DIR, name), 'utf8')
    for (const m of src.matchAll(/https:\/\/(?:www\.)?daromadchi\.uz(\/[^'"`\s?)]*)?/g)) {
      // Trim a query string or a `${...}` interpolation off the end — the route
      // is the part before either.
      const path = ((m[1] ?? '/').split('$')[0].replace(/\/+$/, '') || '/')
      if (BASE_CONSTANTS.has(path)) continue
      out.push({ path, file: name })
    }
  }
  return out
}

function routeExists(path: string): boolean {
  if (path === '/') return existsSync(join(APP_DIR, 'page.tsx'))
  if (path.startsWith('/api/')) return existsSync(join(APP_DIR, path, 'route.ts'))
  return existsSync(join(APP_DIR, path, 'page.tsx'))
}

test('every extension link resolves to a route that exists', () => {
  const links = extensionLinks()
  assert.ok(links.length > 10, `only found ${links.length} links — the scan probably broke`)

  const dead = links.filter(l => !routeExists(l.path))
  assert.deepEqual(dead, [],
    `dead links: ${dead.map(l => `${l.path} (${l.file})`).join(', ')}`)
})

test('no extension link names a dashboard page without the /dashboard prefix', () => {
  // The specific shape of the original bug: `/orders` instead of
  // `/dashboard/orders`. Such a path can silently become valid again if a
  // top-level route of that name is ever added, so it is worth naming directly
  // rather than relying on the existence check alone.
  const DASHBOARD_ONLY = ['orders', 'products', 'analytics', 'unit-economics', 'stocks', 'alerts', 'pnl']
  const bad = extensionLinks().filter(l => DASHBOARD_ONLY.includes(l.path.split('/')[1] ?? ''))
  assert.deepEqual(bad, [],
    `missing the /dashboard prefix: ${bad.map(l => `${l.path} (${l.file})`).join(', ')}`)
})
