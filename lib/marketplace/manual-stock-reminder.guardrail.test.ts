/**
 * GUARDRAIL: manual-stock-reminder.ts can never write to a marketplace.
 *
 * AGENTS.md makes marketplace APIs read-only except through two audited
 * modules. This feature exists precisely BECAUSE it cannot write, so "it
 * doesn't write" has to be a property of the code rather than of the review
 * that let it in.
 *
 * Deliberately in its own file, importing NOTHING from the module under test.
 * The check is static analysis over the import graph, and coupling it to a
 * runtime import would make it fail to run in exactly the case it exists for:
 * an import that reaches stock-sync.ts crashes at module load (that file pulls
 * in Next client code), so a combined file would die before the walker ran and
 * report a stack trace instead of naming the violation.
 *
 * Run: node --import tsx --test lib/marketplace/manual-stock-reminder.guardrail.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const WRITE_CAPABLE = [
  'lib/marketplace/stock-writer.ts',   // the sanctioned ostatok writer
  'lib/marketplace/order-cancel.ts',   // the sanctioned oversell cancel
  'lib/marketplace-readonly-guard.ts', // owns marketplaceFetch — any outbound call
]

const REPO = resolve(new URL('../..', import.meta.url).pathname)

/** Every repo file reachable from `entry` by following its import graph. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]
      let target: string | null = null
      if (spec.startsWith('@/')) target = join(REPO, spec.slice(2))
      else if (spec.startsWith('.')) target = resolve(dirname(file), spec)
      if (!target) continue // bare package — not repo code
      for (const cand of [`${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), target]) {
        if (existsSync(cand) && cand.endsWith('.ts')) { queue.push(cand); break }
      }
    }
  }
  return seen
}

describe('guardrail: no marketplace write path is reachable', () => {
  const entry = join(REPO, 'lib/marketplace/manual-stock-reminder.ts')
  const reachable = reachableFrom(entry)

  it('the import walker actually works (it finds a known dependency)', () => {
    // Guards the guard: a walker that silently resolved nothing would make
    // every assertion below pass vacuously.
    assert.ok(reachable.has(join(REPO, 'lib/marketplace/stock-allocation.ts')),
      'walker did not reach stock-allocation.ts — the reachability check is not working')
    assert.ok(reachable.size > 3, `only ${reachable.size} files reached; the walker is not following imports`)
  })

  for (const w of WRITE_CAPABLE) {
    it(`cannot reach ${w}`, () => {
      assert.ok(!reachable.has(join(REPO, w)),
        `manual-stock-reminder.ts transitively imports ${w} — a marketplace write is now one call away`)
    })
  }

  it('does not reach stock-sync.ts, which imports the writer', () => {
    // Called out separately because reusing its loadGroups() is the tempting
    // shortcut, and it is exactly what would open a write path.
    assert.ok(!reachable.has(join(REPO, 'lib/marketplace/stock-sync.ts')),
      'importing stock-sync.ts pulls in pushStock from stock-writer.ts')
  })

  it('makes no outbound HTTP call of its own', () => {
    const src = readFileSync(entry, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    for (const bad of [/\bfetch\s*\(/, /\baxios\b/, /\bhttps?\.request\b/, /marketplaceFetch/]) {
      assert.doesNotMatch(src, bad, `found an outbound call matching ${bad}`)
    }
  })

  it('never mutates a marketplace-facing column', () => {
    // The only tables it writes are notification state. products.stock_quantity
    // is what a marketplace write would mirror locally; touching it here would
    // desync the listing view even without an API call.
    const src = readFileSync(entry, 'utf8')
    for (const table of ['products', 'shops', 'orders', 'orderItems']) {
      assert.doesNotMatch(src, new RegExp(`db\\s*\\.\\s*(?:update|delete)\\s*\\(\\s*${table}\\s*\\)`),
        `writes to ${table} — this module is read-only outside notification state`)
    }
  })
})
