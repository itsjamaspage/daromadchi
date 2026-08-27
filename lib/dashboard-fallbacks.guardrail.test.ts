import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The dashboard degrades a broken panel instead of 500ing the page. That is the
// right trade — but the fallback it renders is a claim. A failed getKpis used to
// fall back to zeroes, and the seller could not tell "you sold nothing this
// week" from "the query threw". Zero is an answer; we did not have one.
//
// The fix is that every fallback also records the panel's name, so the page can
// show a placeholder and a banner. This guards the shape: a swallowed rejection
// in the dashboard's data path has to go through withFallback(), which is the
// only thing that records. A hand-rolled `.catch(e => { …; return [] })` slipped
// back in would restore the silence, and nothing else in the repo would notice.

const ROOT = join(__dirname, '..')
const PAGE = 'app/dashboard/page.tsx'

// A .catch that returns a value — i.e. swallows the rejection and substitutes
// something for the caller to render. `.catch(fn)` where fn re-throws is fine;
// this looks only for the substituting form.
const SWALLOWING_CATCH = /\.catch\s*\(\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/g

describe('the dashboard cannot fail silently', () => {
  test(`every swallowed rejection in ${PAGE} records which panel it was`, () => {
    const src = readFileSync(join(ROOT, PAGE), 'utf8')
    const offenders: string[] = []

    const lines = src.split('\n')
    lines.forEach((line, i) => {
      SWALLOWING_CATCH.lastIndex = 0
      if (!SWALLOWING_CATCH.test(line)) return
      // The three top-level loads (shops, stock groups, sync info) are not
      // slice panels and have no banner to appear in; they are named here so
      // that a NEW swallowing catch is what fails, not these.
      if (/getUserShops|getStockGroups|getSyncInfo/.test(line)) return
      offenders.push(`${PAGE}:${i + 1}  ${line.trim()}`)
    })

    assert.deepEqual(
      offenders, [],
      'These swallow a failure without recording it, so the panel renders a ' +
      'fallback the seller reads as data. Route them through withFallback():\n' +
      offenders.join('\n'),
    )
  })

  test('every panel fetched for a slice goes through withFallback', () => {
    const src = readFileSync(join(ROOT, PAGE), 'utf8')
    const block = src.slice(src.indexOf('const [kpis,'), src.indexOf('  return {', src.indexOf('const [kpis,')))
    const calls = block.split('\n').filter(l => /^\s*(withFallback|get[A-Z])/.test(l.trim()))

    assert.ok(calls.length >= 6, `expected the six slice panels, found ${calls.length}`)
    for (const c of calls) {
      assert.match(c.trim(), /^withFallback\(/, `not wrapped: ${c.trim()}`)
    }
  })

  test('the failure list reaches the client', () => {
    const client = readFileSync(join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    assert.match(client, /failed: PanelKey\[\]/, 'MarketplaceSlice must carry `failed`')
    assert.match(client, /kpisFailed \? UNKNOWN/, 'a failed KPI query must not render a number')
    assert.match(client, /DataErrorBanner/, 'the failure has to be visible, not only absent')
  })
})
