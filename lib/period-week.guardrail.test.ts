/**
 * Week maths has ONE home: lib/period-week.ts.
 *
 * It had three. app/dashboard/page.tsx, app/dashboard/pnl/page.tsx and this
 * module each computed "the Monday of this week" separately, and they drifted:
 * the dashboard's copy finished with toISOString(), which converts to UTC and
 * can name the wrong Monday for anyone not on UTC, while the tested module right
 * next to it documents exactly that trap.
 *
 * Two patterns are banned outside the module, because each one is a copy of a
 * problem already solved there:
 *
 *   getDay()      — deriving a week boundary by hand. JS makes Sunday 0, so the
 *                   naive shift sends Sunday forward a week instead of back.
 *   toISOString() on a date being turned into a YYYY-MM-DD calendar day — that
 *                   is localDateStr's whole reason to exist.
 *
 * A calendar UI that has to lay out a month grid is the one honest exception and
 * is listed by name.
 *
 * Run: node --import tsx --test lib/period-week.guardrail.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SEARCH = ['app', 'components', 'lib']

/** Owns the week definition, or lays out a month grid, which needs the weekday. */
const ALLOWED = new Set([
  'lib/period-week.ts',
  'lib/period-week.test.ts',
  'lib/period-week.guardrail.test.ts',
  'components/dashboard/CalendarPicker.tsx',
])

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(name)) yield full
  }
}

const files = SEARCH.flatMap(d => [...walk(join(ROOT, d))])
  .map(f => f.slice(ROOT.length + 1))
  .filter(f => !ALLOWED.has(f))

test('nobody derives a week boundary by hand', () => {
  const offenders = files.filter(f => readFileSync(join(ROOT, f), 'utf8').includes('getDay()'))
  assert.deepEqual(offenders, [],
    'use startOfIsoWeek / endOfIsoWeek from lib/period-week.ts instead of getDay()')
})

test('no dashboard screen turns a Date into a calendar day through UTC', () => {
  // `toISOString().slice(0, 10)` is the exact shape that named the wrong day.
  //
  // Scoped to the UI, deliberately. In lib/uzum, lib/yandex and the billing and
  // sync modules the same call is CORRECT: those dates are query parameters for
  // APIs that specify UTC, and rewriting them to local time would move the
  // window they fetch. On a dashboard screen there is no such excuse — a date a
  // seller reads is a local calendar day, always.
  const offenders = files.filter(f =>
    (f.startsWith('app/dashboard/') || f.startsWith('components/dashboard/')) &&
    /toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/.test(readFileSync(join(ROOT, f), 'utf8')))
  assert.deepEqual(offenders, [],
    'use localDateStr from lib/period-week.ts — toISOString() shifts to UTC')
})

test('the guard is actually looking at files', () => {
  // A walk that silently found nothing would pass both tests above forever.
  assert.ok(files.length > 100, `only ${files.length} files scanned`)
  assert.ok(files.some(f => f.startsWith('app/dashboard/')), 'dashboard not scanned')
})

/**
 * The third ban, added after the P&L page shipped this exact bug.
 *
 * #365 fixed the drifting clamp in DateRangePicker and this file's ALLOWED set
 * — which exists so CalendarPicker can lay out a month grid — quietly exempted
 * the OTHER copy of it. The fix landed on one picker and missed the other, and
 * the user found the difference on the live site.
 *
 * So this test does not use ALLOWED. Laying out a grid is a reason to call
 * getDay(); it is not a reason to own a second copy of the paging arithmetic.
 * The banned shape is re-anchoring a range to "the N days ending today":
 *
 *     if (newTo > today) { newTo = today; newFrom = today − (rangeDays − 1) }
 *
 * It is only ever reached when the window has caught up with the present, which
 * is when the user is looking at the current week — so it corrupts the most
 * visited view, and does it silently.
 */
test('nobody re-anchors a date range to "the N days ending today"', () => {
  const everyFile = SEARCH.flatMap(d => [...walk(join(ROOT, d))]).map(f => f.slice(ROOT.length + 1))
  const offenders: string[] = []

  for (const f of everyFile) {
    // lib/period-week.ts owns the clamp — it applies it only to ranges with no
    // weekday anchor to destroy, which is the distinction the copies missed.
    if (f.startsWith('lib/period-week')) continue
    const src = readFileSync(join(ROOT, f), 'utf8')
    // Strip comments so the prose above (and in the pickers) does not self-trip.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    // The shape, not one spelling of it: a rangeDays-based rewind sitting in the
    // same file as a clamp to today.
    if (/rangeDays\s*-\s*1/.test(code) && /(newTo|nt)\s*[>=]=?\s*today/i.test(code)) {
      offenders.push(f)
    }
  }

  assert.deepEqual(offenders, [],
    'paging belongs to pageRange() in lib/period-week.ts — a second copy is how\n' +
    'the P&L calendar kept returning Thu–Wed after #365 fixed the dashboard one:\n\n' +
    offenders.map(o => '  ' + o).join('\n') + '\n')
})
